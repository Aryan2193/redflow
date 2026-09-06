import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AgentEvent, AgentStatus, AnswerVersion, Draft, Evidence, Member, ModelSlot, Note, Objection, Paragraph, Question, Room } from '../module_bindings/types';
import { ACTIVE_STATES, ROUNDS, buildBout, hostOf, roundIndex, safeUrl, unquote } from '../lib/bout';
import { TONE_BG, TONE_TEXT, speakerFor, type Speaker } from '../lib/labels';
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

function ago(at: number, now: number): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 5) return 'now';
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m}m` : `${Math.round(m / 60)}h`;
}

// One agent action: what happened, by whom, in which colour.
type Action = { key: string; at: number; kind: string; sp: Speaker; text: string; url?: string; live?: boolean };

// Plain words for what an agent did, and a colour for each.
const KIND_LABEL: Record<string, string> = {
  read: 'Read',
  search: 'Searched the web',
  open: 'Opened a page',
  write: 'Wrote',
  hit: 'Objected',
  heavy: 'Objected, severe',
  stands: 'Fact confirmed',
  refuted: 'Fact disproved',
  'no call': 'Could not verify',
  fixed: 'Fix accepted',
  'still open': 'Fix rejected',
  blocked: 'Rejected an objection',
  version: 'New version',
  now: 'Working now',
};
const KIND_PILL: Record<string, string> = {
  read: 'bg-judg-soft text-judg',
  search: 'bg-teal-soft text-teal',
  open: 'bg-teal-soft text-teal',
  write: 'bg-judg-soft text-ink',
  hit: 'bg-red-soft text-red',
  heavy: 'bg-red text-paper',
  stands: 'bg-ok-soft text-ok',
  refuted: 'bg-red-soft text-red',
  'no call': 'bg-warn-soft text-warn',
  fixed: 'bg-ok-soft text-ok',
  'still open': 'bg-red-soft text-red',
  blocked: 'bg-judg-soft text-judg',
  version: 'bg-ink text-paper',
  now: 'bg-red-soft text-red',
};

// Chat keeps its newest message in view until the reader scrolls away.
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

function Avatar({ sp }: { sp: Speaker }) {
  return (
    <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-paper ${TONE_BG[sp.tone]}`} aria-hidden>
      {sp.name.charAt(0).toUpperCase()}
    </span>
  );
}

function PanelHead({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
      <span className="font-fight text-[17px] tracking-wide text-ink">{title}</span>
      {children}
    </div>
  );
}

export default function ControlRoom(p: Props) {
  const q = p.question;
  const settled = q.state === 'settled' || q.state === 'failed';
  const leadName = p.slots.find(s => s.slot === 'council_a')?.label ?? 'The lead';
  const sp = (slot: string) => speakerFor(slot, p.slots);

  // Narrated micro-steps rotate while agents work.
  const [tick, setTick] = useState(Date.now());
  useEffect(() => {
    if (settled) return;
    const t = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [settled]);

  const items = useMemo(
    () => buildBout({ question: q, notes: p.notes, drafts: p.drafts, objections: p.objections, evidence: p.evidence, versions: p.versions, statuses: p.statuses, slots: p.slots }),
    [q, p.notes, p.drafts, p.objections, p.evidence, p.versions, p.statuses, p.slots]
  );
  const idx = roundIndex(q);
  const agents = p.slots.filter(s => s.enabled && ['council_a', 'council_b', 'council_c', 'referee'].includes(s.slot));
  const working = p.statuses.filter(s => ACTIVE_STATES.has(s.state));
  const humans = p.members.filter(m => m.online);
  const openRisks = p.objections.filter(o => o.status === 'unresolved').length;
  const refereeSlot = p.slots.find(s => s.slot === 'referee' && s.enabled) ? 'referee' : 'council_b';

  // Every real move and every stamp, one action each, newest first. Working agents sit on top.
  const actions: Action[] = useMemo(() => {
    const at = (ts: { microsSinceUnixEpoch: bigint }) => toDate(ts).getTime();
    const out: Action[] = [];
    for (const e of p.events) out.push({ key: 'e' + e.id, at: at(e.createdAt), kind: e.kind, sp: sp(e.slot), text: e.kind === 'open' ? `opened ${hostOf(e.url || e.detail.replace(/^opened /, ''))}` : e.detail, url: safeUrl(e.url) });
    for (const o of p.objections) out.push({ key: 'o' + o.id, at: at(o.createdAt), kind: o.severity === 3 ? 'heavy' : 'hit', sp: sp(o.bySlot), text: `to section ${o.targetOrdinal || '?'}: “${unquote(o.claim)}”` });
    for (const e of p.evidence) out.push({ key: 'ev' + e.id, at: at(e.createdAt), kind: e.verdict === 'supported' ? 'stands' : e.verdict === 'refuted' ? 'refuted' : 'no call', sp: sp('checker'), text: `“${unquote(e.claim)}”${e.url ? ` (${hostOf(e.url)})` : ''}`, url: safeUrl(e.url) });
    for (const v of p.versions) out.push({ key: 'v' + v.id, at: at(v.createdAt), kind: 'version', sp: sp('council_a'), text: v.version === 1 ? 'published the first answer' : `published version ${v.version} of the answer` });
    for (const o of p.objections) {
      if (o.status === 'overruled' && o.resolution.startsWith('Overruled by the lead')) out.push({ key: 'b' + o.id, at: at(o.updatedAt), kind: 'blocked', sp: sp('council_a'), text: `${sp(o.bySlot).name}'s objection to section ${o.targetOrdinal || '?'}` });
      const tail = o.resolution.split(' | ').pop() ?? '';
      if (/^(withdrawn|held):/.test(tail)) out.push({ key: 'r' + o.id, at: at(o.updatedAt), kind: /^withdrawn/.test(tail) ? 'fixed' : 'still open', sp: sp(refereeSlot), text: `${sp(o.bySlot).name}'s objection to section ${o.targetOrdinal || '?'}` });
    }
    out.sort((a, b) => b.at - a.at);
    const live: Action[] = working.map(s => ({ key: 'now' + s.slot, at: Number.MAX_SAFE_INTEGER, kind: 'now', sp: sp(s.slot), text: microStep(s.state, s.slot, tick - toDate(s.updatedAt).getTime()), live: true }));
    return [...live, ...out];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.events, p.objections, p.evidence, p.versions, working, tick, p.slots]);
  const total = actions.filter(a => !a.live).length;

  // The spotlight: the one card that matters right now.
  const real = items.filter(i => i.kind !== 'question' && i.kind !== 'note' && i.kind !== 'typing');
  const spotlight = real[real.length - 1];
  const recent = real.slice(-6, -1).reverse();
  const [pinned, setPinned] = useState<string | null>(null);
  const shown = (pinned && real.find(i => i.key === pinned)) || spotlight;
  const ctx: CardCtx = { paragraphs: p.paragraphs, objections: p.objections, evidence: p.evidence, notes: p.notes, slots: p.slots, now: p.now, leadName };
  const humanNotes = p.notes.slice().sort((a, b) => Number(a.id - b.id));
  const roundLabel = settled ? (q.state === 'failed' ? 'stopped' : openRisks ? `decided, ${openRisks} open` : 'decided') : `round ${idx + 1} · ${ROUNDS[Math.min(idx, 4)].label}`;

  return (
    <div className="mx-auto grid w-full max-w-[1480px] min-h-0 flex-1 grid-cols-1 gap-x-6 px-4 sm:px-8 md:grid-cols-[minmax(340px,1.05fr)_minmax(0,1.45fr)_minmax(260px,0.8fr)]">
      <section className="flex min-h-0 flex-col py-3">
        <PanelHead title="Agent actions">
          <span>
            {agents.length} agents{working.length ? `, ${working.length} working` : ''} · {total} so far
          </span>
        </PanelHead>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <ol className="space-y-2">
            {actions.map(a => (
              <li key={a.key} className={`flex items-start gap-2 text-[13px] leading-snug ${!a.live && p.now - a.at < 3000 ? 'enter-c' : ''}`}>
                <Avatar sp={a.sp} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className={`font-semibold ${TONE_TEXT[a.sp.tone]}`}>{a.sp.name}</span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-px text-[11px] font-semibold ${KIND_PILL[a.kind] ?? 'bg-judg-soft text-judg'}`}>
                      {a.live && <span className="pulse inline-block h-1.5 w-1.5 rounded-full bg-red" aria-hidden />}
                      {KIND_LABEL[a.kind] ?? a.kind}
                    </span>
                    {!a.live && <span className="ml-auto text-[11px] text-muted">{ago(a.at, p.now)}</span>}
                  </div>
                  {a.url ? (
                    <a href={a.url} target="_blank" rel="noreferrer" className="text-ink-2 underline decoration-line">
                      {a.text}
                    </a>
                  ) : (
                    <div className={a.live ? 'text-ink' : 'text-ink-2'}>{a.text}</div>
                  )}
                </div>
              </li>
            ))}
            {actions.length === 0 && <li className="text-[13px] text-muted">The first moves land here within seconds.</li>}
          </ol>
        </div>
      </section>

      <section className="flex min-h-0 flex-col py-3">
        <PanelHead title="Spotlight">
          <span className={settled ? 'text-ok' : 'text-ink'}>{roundLabel}</span>
          {!settled && <span className="pulse inline-block h-1.5 w-1.5 rounded-full bg-red" aria-hidden />}
          {pinned && (
            <button type="button" onClick={() => setPinned(null)} className="ml-auto underline">
              Back to live
            </button>
          )}
        </PanelHead>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {settled && !pinned ? (
            <div className="verdict-in">
              <Verdict room={p.room} question={q} paragraphs={p.paragraphs} objections={p.objections} evidence={p.evidence} notes={p.notes} slots={p.slots} now={p.now} myName={p.myName} />
            </div>
          ) : shown ? (
            <div className="enter-c" key={shown.key}>
              <ItemCard item={shown} ctx={ctx} expanded onToggle={() => {}} />
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-line px-4 py-10 text-center text-sm text-muted">{leadName} is writing the first answer. The first card lands here.</div>
          )}
          {recent.length > 0 && (
            <div className="mt-4">
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

      <section className="flex min-h-0 flex-col py-3">
        <PanelHead title="Chat">
          <span>
            {humans.length} human{humans.length === 1 ? '' : 's'} here
          </span>
        </PanelHead>
        <Follow sig={humanNotes.map(n => n.id.toString()).join('|')} className="pr-1">
          <ol className="space-y-3">
            <li className="flex gap-2">
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-bold text-paper" aria-hidden>
                {q.askedByName.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-semibold">
                  {q.askedByName} <span className="font-normal text-muted">asked</span>
                </div>
                <div className="rounded-xl border border-ink/70 bg-sheet px-3 py-2 text-[14px] font-medium leading-snug">{q.text}</div>
              </div>
            </li>
            {humanNotes.map(n => (
              <li key={n.id.toString()} className={`flex gap-2 ${p.now - toDate(n.createdAt).getTime() < 3000 ? 'enter-c' : ''}`}>
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-bold text-paper" aria-hidden>
                  {n.authorName.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-semibold">
                    {n.authorName} <span className="font-normal text-muted">{n.consumedStep === '' && !settled ? '· read on the next turn' : ''}</span>
                  </div>
                  <div className="rounded-xl border border-line bg-sheet px-3 py-2 text-[13.5px] leading-relaxed">{n.text}</div>
                </div>
              </li>
            ))}
            {humanNotes.length === 0 && <li className="text-[12.5px] text-muted">Whatever anyone here types lands under the question, and the models read it on their next turn.</li>}
          </ol>
        </Follow>
      </section>
    </div>
  );
}
