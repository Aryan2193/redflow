import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AgentEvent, AgentStatus, AnswerVersion, Draft, Evidence, Member, ModelSlot, Note, Objection, Paragraph, Question, Room } from '../module_bindings/types';
import { ACTIVE_STATES, ROUNDS, buildBout, roundIndex, unquote } from '../lib/bout';
import { TONE_TEXT, speakerFor } from '../lib/labels';
import { microStep } from '../lib/narrate';
import { toDate } from '../lib/stdb';
import ItemCard, { type CardCtx } from './Cards';
import Verdict from './Verdict';

type Props = {
  room: Room;
  question: Question;
  members: readonly Member[];
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

function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// One line in the log: what happened, who did it, in which colour.
type Line = { key: string; at: number; kind: string; who: string; tone: string; text: string; url?: string; live?: boolean };
const KIND_CLS: Record<string, string> = { read: 'text-muted', search: 'text-teal', open: 'text-teal', write: 'text-ink', hit: 'text-red', stands: 'text-ok', refuted: 'text-red', ruling: 'text-ink', human: 'text-warn', now: 'text-red', v: 'text-ink' };

function Band({ label, big, sub, live }: { label: string; big: ReactNode; sub: ReactNode; live?: boolean }) {
  return (
    <div className="min-w-0 px-4 py-2.5 sm:border-r sm:border-line-2 sm:last:border-r-0">
      <div className="font-fight text-[11px] tracking-wider text-muted">{label}</div>
      <div className="mt-1 flex min-w-0 items-baseline gap-2">
        <span className="font-fight text-[28px] leading-none tabular-nums text-ink">{big}</span>
        {live && <span className="pulse inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-red" aria-hidden />}
        <span className="min-w-0 truncate text-[12.5px] text-muted">{sub}</span>
      </div>
    </div>
  );
}

// A column that keeps its newest line in view until the reader scrolls away.
function Follow({ children, sig, className = '' }: { children: ReactNode; sig: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || !stick.current) return;
    el.scrollTop = el.scrollHeight;
    const t = setTimeout(() => {
      if (el && stick.current) el.scrollTop = el.scrollHeight;
    }, 400);
    return () => clearTimeout(t);
  }, [sig]);
  return (
    <div
      ref={ref}
      onScroll={e => {
        const el = e.currentTarget;
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
      }}
      className={`min-h-0 flex-1 overflow-y-auto ${className}`}
    >
      {children}
    </div>
  );
}

export default function ControlRoom(p: Props) {
  const q = p.question;
  const settled = q.state === 'settled' || q.state === 'failed';
  const leadName = p.slots.find(s => s.slot === 'council_a')?.label ?? 'The lead';
  const label = (slot: string) => speakerFor(slot, p.slots).name;
  const tone = (slot: string) => TONE_TEXT[speakerFor(slot, p.slots).tone];

  // Clock ticks every second while the bout runs.
  const [tick, setTick] = useState(Date.now());
  useEffect(() => {
    if (settled) return;
    const t = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [settled]);
  const end = q.settledAt ? toDate(q.settledAt).getTime() : tick;
  const elapsed = end - toDate(q.createdAt).getTime();

  const items = useMemo(
    () => buildBout({ question: q, notes: p.notes, drafts: p.drafts, objections: p.objections, evidence: p.evidence, versions: p.versions, statuses: p.statuses, slots: p.slots }),
    [q, p.notes, p.drafts, p.objections, p.evidence, p.versions, p.statuses, p.slots]
  );
  const idx = roundIndex(q);
  const agents = p.slots.filter(s => s.enabled && ['council_a', 'council_b', 'council_c', 'referee'].includes(s.slot));
  const working = p.statuses.filter(s => ACTIVE_STATES.has(s.state));
  const humans = p.members.filter(m => m.online);
  const hits = p.objections.length;
  const conceded = p.objections.filter(o => o.status === 'withdrawn').length;
  const openRisks = p.objections.filter(o => o.status === 'unresolved').length;

  // The log: every real move, every human word, every stamp, one line each.
  const lines: Line[] = useMemo(() => {
    const out: Line[] = [];
    const at = (ts: { microsSinceUnixEpoch: bigint }) => toDate(ts).getTime();
    for (const e of p.events) out.push({ key: 'e' + e.id, at: at(e.createdAt), kind: e.kind, who: label(e.slot), tone: tone(e.slot), text: e.detail, url: e.url || undefined });
    for (const n of p.notes) out.push({ key: 'n' + n.id, at: at(n.createdAt), kind: 'human', who: n.authorName, tone: 'text-ink', text: n.text });
    for (const o of p.objections) out.push({ key: 'o' + o.id, at: at(o.createdAt), kind: 'hit', who: label(o.bySlot), tone: tone(o.bySlot), text: `${o.severity === 3 ? 'heavy hit' : 'hit'} on section ${o.targetOrdinal || '?'}: “${unquote(o.claim).slice(0, 80)}”` });
    for (const e of p.evidence) out.push({ key: 'ev' + e.id, at: at(e.createdAt), kind: e.verdict === 'supported' ? 'stands' : e.verdict === 'refuted' ? 'refuted' : 'read', who: label('checker'), tone: tone('checker'), text: `${e.verdict === 'supported' ? 'stands' : e.verdict === 'refuted' ? 'refuted' : 'no call'}: “${unquote(e.claim).slice(0, 70)}”`, url: e.url || undefined });
    for (const v of p.versions) out.push({ key: 'v' + v.id, at: at(v.createdAt), kind: 'v', who: leadName, tone: tone('council_a'), text: v.version === 1 ? 'first answer is up, version 1' : `comeback, version ${v.version}` });
    for (const o of p.objections) {
      const tail = o.resolution.split(' | ').pop() ?? '';
      if (/^(withdrawn|held):/.test(tail)) out.push({ key: 'r' + o.id, at: at(o.updatedAt), kind: 'ruling', who: label(p.slots.find(s => s.slot === 'referee' && s.enabled) ? 'referee' : 'council_b'), tone: tone(p.slots.find(s => s.slot === 'referee' && s.enabled) ? 'referee' : 'council_b'), text: `${/^withdrawn/.test(tail) ? 'fixed' : 'still open'}: ${label(o.bySlot)} on section ${o.targetOrdinal || '?'}` });
    }
    out.sort((a, b) => a.at - b.at);
    for (const s of working) out.push({ key: 'now' + s.slot, at: Number.MAX_SAFE_INTEGER, kind: 'now', who: label(s.slot), tone: tone(s.slot), text: microStep(s.state, s.slot, tick - toDate(s.updatedAt).getTime()), live: true });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.events, p.notes, p.objections, p.evidence, p.versions, working, tick, p.slots]);

  // The spotlight: the one card that matters right now.
  const real = items.filter(i => i.kind !== 'question' && i.kind !== 'note' && i.kind !== 'typing');
  const spotlight = real[real.length - 1];
  const recent = real.slice(-6, -1).reverse();
  const [pinned, setPinned] = useState<string | null>(null);
  const shown = (pinned && real.find(i => i.key === pinned)) || spotlight;
  const ctx: CardCtx = { paragraphs: p.paragraphs, objections: p.objections, evidence: p.evidence, notes: p.notes, slots: p.slots, now: p.now, leadName };
  const humanNotes = p.notes.slice().sort((a, b) => Number(a.id - b.id));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid grid-cols-2 border-b border-line sm:grid-cols-4">
        <Band label="Agents live" big={agents.length} live={working.length > 0} sub={working.length ? `${working.map(s => label(s.slot)).join(', ')} working` : settled ? 'all done' : 'waiting'} />
        <Band label="Humans live" big={humans.length} sub={humans.map(m => m.name).join(', ') || 'nobody yet'} />
        <Band label="Round" big={settled ? (q.state === 'failed' ? 'stop' : 'done') : idx + 1} sub={settled ? (openRisks ? `decided, ${openRisks} open` : 'decided') : `${ROUNDS[Math.min(idx, 4)].label} · ${hits} hits, ${conceded} conceded`} />
        <Band label="Clock" big={clock(elapsed)} live={!settled} sub={settled ? 'settled' : idx >= 3 ? 'decides soon' : 'in progress'} />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 md:grid-cols-[300px_minmax(0,1fr)_300px]">
        <section className="flex min-h-0 flex-col border-b border-line px-3 py-2.5 md:border-b-0 md:border-r">
          <div className="mb-1.5 flex items-baseline gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
            <span className="font-fight text-[16px] tracking-wide text-ink">Log</span>
            <span>{lines.filter(l => !l.live).length} moves</span>
          </div>
          <Follow sig={lines.map(l => l.key).join('|')} className="max-h-[36vh] md:max-h-none">
            <ol className="space-y-1 text-[12.5px] leading-[1.45]">
              {lines.map(l => (
                <li key={l.key} className={`flex items-baseline gap-1.5 ${l.at !== Number.MAX_SAFE_INTEGER && p.now - l.at < 3000 ? 'enter-c' : ''}`}>
                  <span className={`shrink-0 font-mono text-[10px] uppercase tracking-wider ${KIND_CLS[l.kind] ?? 'text-muted'}`}>
                    {l.live && <span className="pulse mr-1 inline-block h-1.5 w-1.5 rounded-full bg-red align-middle" aria-hidden />}
                    {l.kind === 'v' ? 'write' : l.kind}
                  </span>
                  <span className={`shrink-0 font-semibold ${l.tone}`}>{l.who}</span>
                  {l.url ? (
                    <a href={l.url} target="_blank" rel="noreferrer" className="min-w-0 truncate text-ink-2 underline decoration-line">
                      {l.text}
                    </a>
                  ) : (
                    <span className={`min-w-0 truncate ${l.live ? 'text-ink' : 'text-ink-2'}`}>{l.text}</span>
                  )}
                </li>
              ))}
            </ol>
          </Follow>
        </section>

        <section className="flex min-h-0 flex-col px-3 py-2.5 sm:px-5">
          <div className="mb-1.5 flex items-baseline gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
            <span className="font-fight text-[16px] tracking-wide text-ink">Spotlight</span>
            <span>{settled ? 'the decision' : 'what matters right now'}</span>
            {pinned && (
              <button type="button" onClick={() => setPinned(null)} className="ml-auto underline">
                Back to live
              </button>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mb-3 rounded-xl border border-ink/60 bg-sheet px-3.5 py-2.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                The question <span className="normal-case tracking-normal text-ink-2">asked by {q.askedByName}</span>
              </div>
              <div className="mt-0.5 text-[14.5px] font-medium leading-snug">{q.text}</div>
            </div>
            {settled && !pinned ? (
              <div className="verdict-in">
                <Verdict room={p.room} question={q} paragraphs={p.paragraphs} objections={p.objections} evidence={p.evidence} notes={p.notes} slots={p.slots} now={p.now} myName={p.myName} />
              </div>
            ) : shown ? (
              <div className="enter-c" key={shown.key}>
                <ItemCard item={shown} ctx={ctx} expanded onToggle={() => {}} />
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">{leadName} is writing the first answer. The first card lands here.</div>
            )}
            {recent.length > 0 && (
              <div className="mt-3">
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">Just before</div>
                <div className="space-y-1.5">
                  {recent.map(it => (
                    <ItemCard key={it.key} item={it} ctx={ctx} expanded={false} onToggle={() => setPinned(pinned === it.key ? null : it.key)} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="flex min-h-0 flex-col border-t border-line px-3 py-2.5 md:border-l md:border-t-0" style={{ background: 'color-mix(in srgb, var(--color-ink) 3%, var(--color-paper))' }}>
          <div className="mb-1.5 flex items-baseline gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
            <span className="font-fight text-[16px] tracking-wide text-ink">Ringside</span>
            <span>{humans.length} here, everything humans say</span>
          </div>
          <Follow sig={humanNotes.map(n => n.id.toString()).join('|')} className="max-h-[36vh] md:max-h-none">
            {humanNotes.length === 0 && <p className="text-[13px] text-muted">Nothing said yet. Whatever anyone in the room types lands here, and the models read it on their next turn.</p>}
            <ol className="space-y-2.5">
              {humanNotes.map(n => (
                <li key={n.id.toString()} className={`flex gap-2 ${p.now - toDate(n.createdAt).getTime() < 3000 ? 'enter-c' : ''}`}>
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-bold text-paper" aria-hidden>
                    {n.authorName.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[12px] font-semibold">
                      {n.authorName} <span className="font-normal text-muted">{n.consumedStep === '' && !settled ? '· read on the next turn' : ''}</span>
                    </div>
                    <div className="rounded-xl border border-line bg-sheet px-2.5 py-1.5 text-[13.5px] leading-relaxed">{n.text}</div>
                  </div>
                </li>
              ))}
            </ol>
          </Follow>
        </section>
      </div>
    </div>
  );
}
