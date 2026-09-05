import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AgentEvent, AgentStatus, AnswerVersion, Draft, Evidence, ModelSlot, Note, Objection, Paragraph, Question, Room } from '../module_bindings/types';
import { ACTIVE_STATES, ROUNDS, buildBout, cornerOf, roundIndex, type BoutItem, type Corner } from '../lib/bout';
import { TONE_TEXT, speakerFor } from '../lib/labels';
import { useMediaQuery } from '../lib/reveal';
import Presence from './Activity';
import ItemCard, { type CardCtx } from './Cards';
import Fighter, { type FighterState, type Moment } from './Fighter';
import Verdict from './Verdict';
import { microStep } from '../lib/narrate';
import { toDate } from '../lib/stdb';

// Bursts of motion for the figures, derived from what just changed: a new objection is a strike on the lead, an
// overruled one staggers its author, a supported claim is a shield, a decision is a cheer. Only fresh rows fire, so a
// page opened on an old bout stays calm.
function useMoments(objections: readonly Objection[], evidence: readonly Evidence[], q: Question, now: number): Record<string, Moment> {
  const [moments, setMoments] = useState<Record<string, Moment>>({});
  const prev = useRef<{ obj: Map<string, string>; ev: Set<string>; settled: boolean; init: boolean }>({ obj: new Map(), ev: new Set(), settled: false, init: false });
  useEffect(() => {
    const fresh = (ts: { microsSinceUnixEpoch: bigint }) => now - toDate(ts).getTime() < 12_000;
    const fire: Record<string, Moment> = {};
    const cur = new Map(objections.map(o => [o.id.toString(), o.status]));
    if (prev.current.init) {
      for (const o of objections) {
        const before = prev.current.obj.get(o.id.toString());
        if (before === undefined) {
          if (fresh(o.createdAt)) {
            fire[o.bySlot] = 'strike';
            fire.council_a = 'hit';
          }
        } else if (before !== o.status && fresh(o.updatedAt)) {
          if (o.status === 'overruled') {
            fire[o.bySlot] = 'stagger';
            fire.council_a = 'shield';
          } else if (o.status === 'withdrawn') fire[o.bySlot] = 'cheer';
          else if (o.status === 'addressed') fire.council_a = 'strike';
        }
      }
      for (const e of evidence) {
        if (prev.current.ev.has(e.id.toString()) || !fresh(e.createdAt)) continue;
        if (e.verdict === 'refuted') fire.council_a = 'hit';
        else if (e.verdict === 'supported') fire.council_a = 'shield';
      }
      const settledNow = q.state === 'settled';
      if (settledNow && !prev.current.settled && q.settledAt && fresh(q.settledAt)) {
        fire.council_a = 'cheer';
        fire.council_b = 'cheer';
        fire.council_c = 'cheer';
      }
    }
    prev.current = { obj: cur, ev: new Set(evidence.map(e => e.id.toString())), settled: q.state === 'settled', init: true };
    if (!Object.keys(fire).length) return;
    setMoments(m => ({ ...m, ...fire }));
    const t = setTimeout(
      () =>
        setMoments(m => {
          const n = { ...m };
          for (const k of Object.keys(fire)) delete n[k];
          return n;
        }),
      1300
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objections, evidence, q.state]);
  return moments;
}

type Props = {
  room: Room;
  question: Question;
  notes: readonly Note[];
  drafts: readonly Draft[];
  objections: readonly Objection[];
  evidence: readonly Evidence[];
  paragraphs: readonly Paragraph[];
  versions: readonly AnswerVersion[];
  statuses: readonly AgentStatus[];
  events: readonly AgentEvent[];
  slots: readonly ModelSlot[];
  now: number;
  myName: string;
};

// How many of the newest cards in a column stay open. Everything older folds to one line.
// The lead's cards are long (a full answer, a full comeback), so its corner shows one at a time.
const OPEN_PER_CORNER: Record<Corner, number> = { left: 1, center: 2, right: 2 };

function CornerHeader({ corner, slots, statuses }: { corner: Corner; slots: readonly ModelSlot[]; statuses: readonly AgentStatus[] }) {
  const fighters = slots.filter(s => s.enabled && s.slot.startsWith('council') && cornerOf(s.slot) === corner);
  const busy = statuses.some(s => ACTIVE_STATES.has(s.state) && cornerOf(s.slot) === corner);
  const right = corner === 'right';
  return (
    <div className={`flex items-baseline gap-2 px-1 pb-1 ${right ? 'flex-row-reverse text-right' : ''}`}>
      <div className="flex items-baseline gap-2">
        {fighters.map((s, i) => {
          const sp = speakerFor(s.slot, slots);
          return (
            <span key={s.slot} className={`font-fight text-[22px] leading-none tracking-wide ${TONE_TEXT[sp.tone]}`}>
              {i > 0 && <span className="mr-2 text-muted/60">+</span>}
              {s.label}
            </span>
          );
        })}
      </div>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">{corner === 'left' ? 'defends the answer' : 'challengers'}</span>
      {busy && <span className="pulse inline-block h-1.5 w-1.5 rounded-full bg-red" aria-label="Working" />}
    </div>
  );
}

// A column that stacks upward: newest at the bottom, always visible, never scrolling the page.
function Column(props: { items: BoutItem[]; ctx: CardCtx; isOpen: (k: string) => boolean; toggle: (k: string) => void; tint: string; className?: string; footer?: ReactNode; tail?: ReactNode; lean?: boolean }) {
  const { items, ctx, isOpen, toggle, tint, className = '', footer, tail, lean } = props;
  const ref = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const footRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const sig = items.map(i => i.key).join('|') + (footer ? '|f' : '');
  // Follow the fight: newest card at the bottom, or the decision from its headline. Fonts, markdown and the ring
  // widening all reflow the column after the data lands, so re-align on every content resize until the reader
  // scrolls away on purpose.
  useEffect(() => {
    const el = ref.current;
    const inner = innerRef.current;
    if (!el || !inner) return;
    const align = () => {
      if (!stick.current) return;
      if (footRef.current) el.scrollTop = Math.max(0, footRef.current.offsetTop - 8);
      else el.scrollTop = el.scrollHeight;
    };
    stick.current = true;
    align();
    const ro = new ResizeObserver(() => align());
    ro.observe(inner);
    const t = setTimeout(align, 750);
    return () => {
      ro.disconnect();
      clearTimeout(t);
    };
  }, [sig]);
  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    const target = footRef.current ? Math.max(0, footRef.current.offsetTop - 8) : el.scrollHeight - el.clientHeight;
    stick.current = Math.abs(el.scrollTop - target) < 48;
  };
  const side = (c: Corner) => (!lean ? 'w-full' : c === 'left' ? 'w-[92%] self-start' : c === 'right' ? 'w-[92%] self-end' : 'w-full');
  return (
    <div ref={ref} onScroll={onScroll} className={`relative min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden rounded-xl ${className}`} style={{ background: tint }}>
      <div ref={innerRef} className="flex min-h-full flex-col justify-end gap-2 p-2">
        {items.map(it => (
          <div key={it.key} className={side(it.corner)}>
            <ItemCard item={it} ctx={ctx} expanded={isOpen(it.key)} onToggle={() => toggle(it.key)} />
          </div>
        ))}
        {tail}
        {footer && <div ref={footRef}>{footer}</div>}
      </div>
    </div>
  );
}

// The question sits at the top of the ring for the whole bout.
function QuestionCard({ item }: { item: Extract<BoutItem, { kind: 'question' }> }) {
  return (
    <div className="rounded-xl border border-ink/70 bg-sheet px-3.5 py-2.5">
      <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
        <span>The question</span>
        <span className="text-ink-2 normal-case tracking-normal">asked by {item.q.askedByName}</span>
      </div>
      <div className="text-[15px] font-medium leading-snug">{item.q.text}</div>
    </div>
  );
}

export default function Arena(p: Props) {
  const q = p.question;
  const settled = q.state === 'settled' || q.state === 'failed';
  const wide = useMediaQuery('(min-width: 900px)');
  const leadName = p.slots.find(s => s.slot === 'council_a')?.label ?? 'The lead';

  const items = useMemo(
    () => buildBout({ question: q, notes: p.notes, drafts: p.drafts, objections: p.objections, evidence: p.evidence, versions: p.versions, statuses: p.statuses, slots: p.slots }),
    [q, p.notes, p.drafts, p.objections, p.evidence, p.versions, p.statuses, p.slots]
  );
  const question = items.find(i => i.kind === 'question');
  const byCorner = useMemo(() => {
    const out: Record<Corner, BoutItem[]> = { left: [], center: [], right: [] };
    for (const it of items) if (it.kind !== 'question') out[it.corner].push(it);
    return out;
  }, [items]);

  // The newest cards in each corner stay open; the reader can open or fold any card.
  const [forced, setForced] = useState<Record<string, boolean>>({});
  const defaultOpen = useMemo(() => {
    const s = new Set<string>();
    for (const corner of ['left', 'center', 'right'] as Corner[]) {
      const real = byCorner[corner].filter(i => i.kind !== 'typing');
      for (const it of real.slice(-OPEN_PER_CORNER[corner])) s.add(it.key);
    }
    return s;
  }, [byCorner]);
  const isOpen = (k: string) => forced[k] ?? defaultOpen.has(k);
  const toggle = (k: string) => setForced(f => ({ ...f, [k]: !isOpen(k) }));

  // Round banner sweeps the ring whenever the bout moves on.
  const idx = roundIndex(q);
  const [banner, setBanner] = useState<{ n: number; label: string } | null>(null);
  const prevIdx = useRef(-1);
  useEffect(() => {
    if (prevIdx.current === idx) return;
    prevIdx.current = idx;
    if (idx >= 5) {
      setBanner(null);
      return;
    }
    setBanner({ n: idx + 1, label: ROUNDS[idx].label });
    const t = setTimeout(() => setBanner(null), 1900);
    return () => clearTimeout(t);
  }, [idx]);

  const ctx: CardCtx = { paragraphs: p.paragraphs, objections: p.objections, evidence: p.evidence, notes: p.notes, slots: p.slots, now: p.now, leadName };
  const openRisks = p.objections.filter(o => o.status === 'unresolved').length;

  // The figures: one per model, standing with its presence block.
  const moments = useMoments(p.objections, p.evidence, q, p.now);
  const same = (slot: string, s: string) => s === slot || (slot === 'council_a' && s === 'chair') || (slot === 'council_b' && s === 'checker');
  const stateFor = (slot: string): FighterState => (p.statuses.some(s => same(slot, s.slot) && ACTIVE_STATES.has(s.state)) ? 'working' : 'idle');
  const lineFor = (slot: string): string => {
    const st = p.statuses.find(s => same(slot, s.slot) && ACTIVE_STATES.has(s.state));
    if (st) return microStep(st.state, st.slot, p.now - toDate(st.updatedAt).getTime());
    const last = [...p.events].filter(e => same(slot, e.slot)).sort((a, b) => Number(b.id - a.id))[0];
    if (last) return last.detail;
    return settled ? 'Done for today.' : 'Ready.';
  };
  const figure = (slot: string, facing: 'left' | 'right', size = 84) => {
    const sp = speakerFor(slot, p.slots);
    return <Fighter tone={sp.tone} name={sp.name} state={stateFor(slot)} moment={moments[slot] ?? null} facing={facing} line={lineFor(slot)} size={size} />;
  };
  const stand = (slot: string, side: 'left' | 'right', size = 84, max = 3) => (
    <div className={`flex items-end gap-1 ${side === 'right' ? 'flex-row-reverse' : ''}`}>
      {figure(slot, side === 'left' ? 'right' : 'left', size)}
      <div className="min-w-0 flex-1">
        <Presence slot={slot} slots={p.slots} events={p.events} statuses={p.statuses} align={side} max={max} />
      </div>
    </div>
  );

  const verdict = settled ? (
    <div className="verdict-in">
      <Verdict room={p.room} question={q} paragraphs={p.paragraphs} objections={p.objections} evidence={p.evidence} notes={p.notes} slots={p.slots} now={p.now} myName={p.myName} />
    </div>
  ) : null;

  const bannerNode = banner && (
    <div className="round-banner pointer-events-none absolute inset-0 z-20 flex items-center justify-center" aria-live="polite">
      <div className="rounded-xl bg-ink px-8 py-5 text-center text-paper shadow-2xl">
        <div className="font-fight text-[15px] tracking-[0.3em] text-paper/70">Round {banner.n}</div>
        <div className="font-fight text-[44px] leading-none tracking-wider sm:text-[56px]">{banner.label}</div>
      </div>
    </div>
  );

  if (!wide) {
    // One column on a phone: cards lean to their corner, the ring runs down the middle.
    const tail = (
      <div className="space-y-1 rounded-xl border border-line-2 bg-sheet/70 px-1 py-1.5">
        {stand('council_a', 'left', 60, 2)}
        {stand('council_b', 'right', 60, 2)}
        {stand('council_c', 'right', 60, 2)}
      </div>
    );
    return (
      <div className="relative flex min-h-0 flex-1 flex-col">
        <Column items={items} ctx={ctx} isOpen={k => (k === 'q' ? true : isOpen(k))} toggle={toggle} tint="transparent" className="h-full" tail={settled ? null : tail} footer={verdict} lean />
        {bannerNode}
      </div>
    );
  }

  const tintL = 'color-mix(in srgb, var(--color-red) 4%, var(--color-paper))';
  const tintR = 'color-mix(in srgb, var(--color-slate) 5%, var(--color-paper))';
  // Every track is minmax(0, ...) so a long card can never widen its corner and push the page sideways.
  const cols = settled ? 'minmax(0, 0.8fr) minmax(0, 1.4fr) minmax(0, 0.8fr)' : 'minmax(0, 1fr) minmax(0, 0.9fr) minmax(0, 1fr)';

  return (
    <div className="arena relative mx-auto grid min-h-0 w-full max-w-[1400px] min-w-0 flex-1 gap-3 overflow-hidden px-3 pb-2 sm:px-5" style={{ gridTemplateColumns: cols }}>
      <div className={`flex min-h-0 min-w-0 flex-col ${settled ? 'opacity-80' : ''}`}>
        <CornerHeader corner="left" slots={p.slots} statuses={p.statuses} />
        <Column items={byCorner.left} ctx={ctx} isOpen={isOpen} toggle={toggle} tint={tintL} tail={stand('council_a', 'left')} />
      </div>

      <div className="flex min-h-0 min-w-0 flex-col">
        <div className="flex items-baseline justify-between px-1 pb-1">
          <span className="font-fight text-[22px] leading-none tracking-wide text-ink">The ring</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">{settled ? (openRisks ? `decided, ${openRisks} open` : 'decided') : 'referee and ringside'}</span>
        </div>
        {question && question.kind === 'question' && (
          <div className="mb-2 shrink-0">
            <QuestionCard item={question} />
          </div>
        )}
        <Column
          items={byCorner.center}
          ctx={ctx}
          isOpen={isOpen}
          toggle={toggle}
          tint="color-mix(in srgb, var(--color-ink) 3%, var(--color-paper))"
          tail={p.events.some(e => e.slot === 'checker') || p.statuses.some(s => s.slot === 'checker' && ACTIVE_STATES.has(s.state)) ? <Presence slot="checker" slots={p.slots} events={p.events} statuses={p.statuses} /> : null}
          footer={verdict}
        />
      </div>

      <div className={`flex min-h-0 min-w-0 flex-col ${settled ? 'opacity-80' : ''}`}>
        <CornerHeader corner="right" slots={p.slots} statuses={p.statuses} />
        <Column
          items={byCorner.right}
          ctx={ctx}
          isOpen={isOpen}
          toggle={toggle}
          tint={tintR}
          tail={
            <div className="space-y-1">
              {stand('council_b', 'right')}
              {stand('council_c', 'right')}
            </div>
          }
        />
      </div>

      {bannerNode}
    </div>
  );
}
