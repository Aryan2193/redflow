import { useEffect, useRef, useState, type ReactNode } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Draft, Evidence, ModelSlot, Note, Objection, Paragraph } from '../module_bindings/types';
import { changedShare, wordDiff } from '../lib/diff';
import { TONE_BG, TONE_BUB, TONE_TEXT, evidenceState, objectionState, type Speaker } from '../lib/labels';
import { causeOf, cleanHeading, cleanWhy, hostOf, splitSections, unquote, type BoutItem } from '../lib/bout';
import { useLive, useReveal } from '../lib/reveal';
import Stamp, { type StampTone } from './Stamp';

export type CardCtx = {
  paragraphs: readonly Paragraph[];
  objections: readonly Objection[];
  evidence: readonly Evidence[];
  notes: readonly Note[];
  slots: readonly ModelSlot[];
  now: number;
  leadName: string;
};

// ---------------------------------------------------------------------------------------------
// Small parts
// ---------------------------------------------------------------------------------------------

function ago(at: number, now: number): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 8) return 'now';
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.round(m / 60)}h`;
}

// The first sentence or two, cut at a sentence end. The rest waits behind See more.
function gist(text: string, max = 150): string {
  const plain = text.replace(/[#*_>`]/g, '').replace(/\s+/g, ' ').trim();
  if (plain.length <= max) return plain;
  const cut = plain.slice(0, max);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
  return (end > max * 0.45 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, '') + '...').trim();
}

function Md({ children }: { children: string }) {
  return (
    <div className="chat-md">
      <Markdown remarkPlugins={[remarkGfm]}>{children}</Markdown>
    </div>
  );
}

// Text that writes itself in when the card is fresh.
function LiveText({ text, live, md = false, className = '' }: { text: string; live: boolean; md?: boolean; className?: string }) {
  const { shown, done } = useReveal(text, live);
  return (
    <div className={`relative ${className}`}>
      {md ? <Md>{shown}</Md> : <span className="whitespace-pre-wrap">{shown}</span>}
      {!done && <span className="caret" aria-hidden />}
    </div>
  );
}

export function Chip({ cls, children }: { cls: string; children: ReactNode }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold leading-4 ${cls}`}>{children}</span>;
}

function Severity({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" title={`Severity ${n} of 3`} aria-label={`Severity ${n} of 3`}>
      {[1, 2, 3].map(i => (
        <span key={i} className={`inline-block h-1.5 w-1.5 rounded-full ${i <= n ? 'bg-red' : 'bg-line'}`} />
      ))}
    </span>
  );
}

export function Avatar({ sp, size = 7 }: { sp: Speaker; size?: 6 | 7 }) {
  const cls = size === 6 ? 'h-6 w-6 text-[11px]' : 'h-7 w-7 text-[12px]';
  return (
    <span className={`inline-flex ${cls} shrink-0 items-center justify-center rounded-full font-bold text-paper ${TONE_BG[sp.tone]}`} aria-hidden>
      {sp.name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}

function More({ open, onToggle, label = 'See more' }: { open: boolean; onToggle: () => void; label?: string }) {
  return (
    <button type="button" onClick={onToggle} className="mt-2 text-xs font-semibold text-ink-2 underline decoration-line hover:decoration-ink">
      {open ? 'See less' : label}
    </button>
  );
}

// ---------------------------------------------------------------------------------------------
// Stamps and one-line summaries per kind
// ---------------------------------------------------------------------------------------------

const OBJ_STAMP: Record<string, { text: string; tone: StampTone }> = {
  open: { text: 'Hit', tone: 'red' },
  addressed: { text: 'Answered', tone: 'warn' },
  withdrawn: { text: 'Fixed', tone: 'ok' },
  overruled: { text: 'Blocked', tone: 'judg' },
  unresolved: { text: 'Still open', tone: 'red' },
};
const EV_STAMP: Record<string, { text: string; tone: StampTone }> = {
  supported: { text: 'Stands', tone: 'ok' },
  refuted: { text: 'Refuted', tone: 'red' },
  unclear: { text: 'No call', tone: 'warn' },
};

export function stampOf(item: BoutItem): { text: string; tone: StampTone } | null {
  switch (item.kind) {
    case 'objection':
      return OBJ_STAMP[item.o.status] ?? null;
    case 'evidence':
      return EV_STAMP[item.e.verdict] ?? EV_STAMP.unclear;
    case 'revision':
      return { text: `v${item.v.version}`, tone: 'ink' };
    case 'answer':
      return { text: 'v1', tone: 'ink' };
    case 'ruling': {
      const fixed = item.group.filter(o => /\| withdrawn: /.test(o.resolution)).length;
      return fixed === item.group.length ? { text: 'All fixed', tone: 'ok' } : { text: `${item.group.length - fixed} open`, tone: 'red' };
    }
    default:
      return null;
  }
}

export function summaryOf(item: BoutItem): string {
  switch (item.kind) {
    case 'question':
      return item.q.text;
    case 'note':
      return item.n.text;
    case 'answer':
      return 'First answer, written alone';
    case 'draft':
      return item.again ? 'Drafted again' : 'Own answer, written blind';
    case 'objection':
      return `Section ${item.o.targetOrdinal || '?'}: ${unquote(item.o.claim)}`;
    case 'evidence':
      return `Checked: ${unquote(item.e.claim)}`;
    case 'revision':
      return item.v.summary;
    case 'ruling':
      return 'Ruling on the fixes';
    case 'typing':
      return item.s.detail || item.s.state;
  }
}

// ---------------------------------------------------------------------------------------------
// Bodies: a gist that reads in two seconds, everything else behind See more.
// ---------------------------------------------------------------------------------------------

function SectionChip({ cur, exists, flash }: { cur?: Paragraph; exists: boolean; flash: boolean }) {
  let chip: ReactNode = null;
  if (cur && cur.version > 1) chip = <Chip cls="bg-ok-soft text-ok">Revised in v{cur.version}</Chip>;
  else if (cur?.status === 'contested') chip = <Chip cls="bg-red-soft text-red">Under attack</Chip>;
  else if (cur?.status === 'verified') chip = <Chip cls="bg-ok-soft text-ok">Verified</Chip>;
  else if (cur?.status === 'unresolved') chip = <Chip cls="bg-red text-paper">Open risk</Chip>;
  else if (!cur && exists) chip = <Chip cls="bg-judg-soft text-judg">Removed later</Chip>;
  if (!chip) return null;
  return <span className={flash ? 'hit inline-block rounded-full' : 'inline-block'}>{chip}</span>;
}

function AnswerBody({ d, ctx, live }: { d: Draft; ctx: CardCtx; live: boolean }) {
  const v1 = ctx.paragraphs.filter(x => x.version === 1 && x.text).sort((a, b) => a.ordinal - b.ordinal);
  const secs = v1.length ? v1.map(p => ({ heading: cleanHeading(p.heading), body: p.text, ordinal: p.ordinal })) : splitSections(d.text).map((s, i) => ({ ...s, ordinal: i + 1 }));
  const [more, setMore] = useState(false);
  // A blow that lands flashes the section it hit.
  const prev = useRef<Record<number, string>>({});
  const [hits, setHits] = useState<Set<number>>(new Set());
  const sig = ctx.paragraphs.filter(p => p.current).map(p => `${p.ordinal}:${p.status}`).join(',');
  useEffect(() => {
    const now: Record<number, string> = {};
    const fresh = new Set<number>();
    for (const p of ctx.paragraphs) {
      if (!p.current) continue;
      now[p.ordinal] = p.status;
      if (prev.current[p.ordinal] && prev.current[p.ordinal] !== 'contested' && p.status === 'contested') fresh.add(p.ordinal);
    }
    prev.current = now;
    if (fresh.size) {
      setHits(fresh);
      const t = setTimeout(() => setHits(new Set()), 800);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  const [first, ...rest] = secs;
  const curOf = (ordinal: number) => ctx.paragraphs.find(p => p.current && p.ordinal === ordinal);
  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
        <span>First answer, written alone</span>
        <span>{(d.latencyMs / 1000).toFixed(0)}s</span>
      </div>
      {first && (
        <section>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            {first.heading && <h4 className="text-[15px] font-semibold leading-snug">{first.heading}</h4>}
            <SectionChip cur={curOf(first.ordinal)} exists={v1.length > 0} flash={hits.has(first.ordinal)} />
          </div>
          {more ? <Md>{first.body}</Md> : <LiveText text={gist(first.body, 220)} live={live} className="leading-relaxed" />}
        </section>
      )}
      {rest.length > 0 && (
        <ul className="mt-2.5 space-y-1.5 border-t border-black/10 pt-2">
          {rest.map(s => (
            <li key={s.ordinal}>
              <div className="flex flex-wrap items-center gap-2 text-[14px]">
                <span className="font-medium">{s.heading || `Section ${s.ordinal}`}</span>
                <SectionChip cur={curOf(s.ordinal)} exists={v1.length > 0} flash={hits.has(s.ordinal)} />
              </div>
              {more && (
                <div className="mt-1">
                  <Md>{s.body}</Md>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <More open={more} onToggle={() => setMore(v => !v)} label={`Read the full answer (${secs.length} sections)`} />
    </div>
  );
}

function DraftBody({ d, leadName, again, live }: { d: Draft; leadName: string; again: boolean; live: boolean }) {
  const secs = splitSections(d.text);
  const [first, ...rest] = secs;
  const [more, setMore] = useState(false);
  return (
    <div>
      <div className="mb-1.5 text-xs text-muted">{again ? 'Drafted again for this round' : `Own answer, written blind, before seeing ${leadName}'s`}</div>
      {first && (
        <>
          {first.heading && <h4 className="mb-1 text-[15px] font-semibold leading-snug">{first.heading}</h4>}
          {more ? <Md>{first.body}</Md> : <LiveText text={gist(first.body, 160)} live={live} className="leading-relaxed" />}
        </>
      )}
      {more && rest.length > 0 && (
        <div className="card-scroll mt-3 space-y-3">
          {rest.map((s, i) => (
            <section key={i}>
              {s.heading && <h4 className="mb-1 text-[15px] font-semibold leading-snug">{s.heading}</h4>}
              <Md>{s.body}</Md>
            </section>
          ))}
          {d.assumptions && <p className="text-xs text-muted">Assumed: {d.assumptions.split('\n').join('; ')}</p>}
        </div>
      )}
      {secs.length > 0 && <More open={more} onToggle={() => setMore(v => !v)} label={`Read the full draft (${secs.length} sections)`} />}
    </div>
  );
}

function ObjectionBody({ o, ctx, live }: { o: Objection; ctx: CardCtx; live: boolean }) {
  const st = objectionState(o.status);
  const stamp = OBJ_STAMP[o.status] ?? OBJ_STAMP.open;
  const [issue, fix] = o.issue.split(' Fix: ');
  const [more, setMore] = useState(false);
  const tail = o.resolution.split(' | ').pop() ?? '';
  let foot = '';
  if (o.status === 'withdrawn') foot = tail.replace(/^withdrawn:\s*/, '');
  else if (o.status === 'overruled') foot = o.resolution;
  else if (o.status === 'addressed') foot = o.resolution ? `${ctx.leadName}: ${o.resolution}` : '';
  else if (/^held:/.test(tail)) foot = tail.replace(/^held:\s*/, '');
  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
        <span>Section {o.targetOrdinal || '?'}</span>
        <Severity n={o.severity} />
        {o.severity === 3 && <span className="font-fight text-[12px] tracking-wider text-red">heavy</span>}
        <Stamp tone={stamp.tone} small className="ml-auto">
          {stamp.text}
        </Stamp>
      </div>
      {o.claim && (
        <p className="leading-relaxed">
          <span className={`hl ${st.hl}`}>“{unquote(o.claim)}”</span>
        </p>
      )}
      {more ? (
        <div className="mt-1.5">
          <p className="leading-relaxed">{issue}</p>
          {fix && (
            <p className="mt-1.5 leading-relaxed">
              <span className="font-semibold">Fix:</span> {fix}
            </p>
          )}
          {foot && <p className="mt-2 border-t border-black/10 pt-1.5 text-xs leading-relaxed text-ink-2">{foot}</p>}
        </div>
      ) : (
        <LiveText text={gist(issue, 130)} live={live} className="mt-1.5 text-[14px] leading-relaxed text-ink-2" />
      )}
      <More open={more} onToggle={() => setMore(v => !v)} />
    </div>
  );
}

function EvidenceBody({ e, live }: { e: Evidence; live: boolean }) {
  const st = evidenceState(e.verdict);
  const stamp = EV_STAMP[e.verdict] ?? EV_STAMP.unclear;
  const [more, setMore] = useState(false);
  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
        <span>Checked on the web</span>
        {e.url && (
          <a href={e.url} target="_blank" rel="noreferrer" className="font-semibold text-ink-2 underline decoration-line">
            {hostOf(e.url)}
          </a>
        )}
        <Stamp tone={stamp.tone} live={live} className="ml-auto">
          {stamp.text}
        </Stamp>
      </div>
      <p className="leading-relaxed">
        <span className={`hl ${st.hl}`}>“{unquote(e.claim)}”</span>
      </p>
      {more ? (
        <div className="mt-1.5">
          {e.title && <p className="leading-relaxed">{e.title}</p>}
          {e.excerpt && <blockquote className="mt-1.5 border-l-2 border-line pl-2.5 text-[14px] italic leading-relaxed text-ink-2">“{unquote(e.excerpt)}”</blockquote>}
        </div>
      ) : (
        e.title && <LiveText text={gist(e.title, 120)} live={live} className="mt-1.5 text-[14px] leading-relaxed text-ink-2" />
      )}
      {(e.title || e.excerpt) && <More open={more} onToggle={() => setMore(v => !v)} />}
    </div>
  );
}

function RevisionBody({ item, ctx, live }: { item: Extract<BoutItem, { kind: 'revision' }>; ctx: CardCtx; live: boolean }) {
  const v = item.v;
  const [more, setMore] = useState(false);
  const edits = ctx.paragraphs.filter(p => p.version === v.version).sort((a, b) => a.ordinal - b.ordinal);
  const overruled = ctx.objections.filter(o => o.status === 'overruled' && o.round === v.round && o.resolution.startsWith('Overruled by the lead'));
  const label = (slot: string) => ctx.slots.find(s => s.slot === slot)?.label ?? slot;
  const prevOf = (p: Paragraph) => ctx.paragraphs.filter(x => x.ordinal === p.ordinal && x.version < p.version && x.text).sort((a, b) => b.version - a.version)[0];
  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
        <span>Comeback</span>
        <Stamp tone="ink" small>
          Version {v.version}
        </Stamp>
      </div>
      <LiveText text={more ? v.summary : gist(v.summary, 170)} live={live} className="font-medium leading-relaxed" />
      {edits.length > 0 && (
        <ul className="mt-2.5 space-y-2">
          {edits.map(p => {
            const removed = !p.text;
            const cause = causeOf(p, ctx.objections, ctx.evidence, ctx.notes, ctx.slots);
            const prev = prevOf(p);
            const segs = more && prev && !removed ? wordDiff(prev.text, p.text) : null;
            const useDiff = segs && changedShare(segs) < 0.4;
            return (
              <li key={p.id.toString()}>
                <div className="flex flex-wrap items-center gap-2">
                  <Stamp tone={cause.tone} small live={live}>
                    {cause.stamp}
                  </Stamp>
                  <span className="text-[14px] font-semibold leading-snug">{removed ? `Removed: ${cleanHeading(p.heading)}` : cleanHeading(p.heading)}</span>
                  <span className={`hl ${cause.hl} text-[11px] font-semibold`}>{cause.text}</span>
                </div>
                {more && (
                  <div className="mt-1 rounded-lg border border-black/10 bg-white/60 px-3 py-2">
                    <p className="text-xs leading-relaxed text-ink-2">{cleanWhy(p.why)}</p>
                    {!removed &&
                      (useDiff && segs ? (
                        <p className="mt-1.5 whitespace-pre-wrap text-[15px] leading-relaxed">
                          {segs.map((s, i) =>
                            s.type === 'same' ? <span key={i}>{s.text}</span> : <span key={i} className={s.type === 'add' ? 'diff-add' : 'diff-del'}>{s.text}</span>
                          )}
                        </p>
                      ) : (
                        <div className="mt-1.5">
                          <Md>{p.text}</Md>
                        </div>
                      ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {overruled.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {overruled.map(o => (
            <li key={o.id.toString()} className="flex flex-wrap items-baseline gap-x-2 text-[14px] leading-relaxed">
              <Stamp tone="judg" small live={live}>
                Blocked
              </Stamp>
              <span className="font-semibold">{label(o.bySlot)}</span>
              {more && <span className="text-ink-2">{o.resolution.replace(/^Overruled by the lead:\s*/, '')}</span>}
            </li>
          ))}
        </ul>
      )}
      <More open={more} onToggle={() => setMore(v => !v)} label="See the changes" />
    </div>
  );
}

function RulingBody({ group, ctx, live }: { group: Objection[]; ctx: CardCtx; live: boolean }) {
  const label = (slot: string) => ctx.slots.find(s => s.slot === slot)?.label ?? slot;
  const [more, setMore] = useState(false);
  return (
    <div>
      <div className="mb-1.5 text-xs text-muted">Ruling on the fixes</div>
      <ul className="space-y-1.5 leading-relaxed">
        {group.map(o => {
          const tail = o.resolution.split(' | ').pop() ?? '';
          const ok = /^withdrawn:/.test(tail);
          const reason = tail.replace(/^(withdrawn|held):\s*/, '');
          return (
            <li key={o.id.toString()} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[14px]">
              <Stamp tone={ok ? 'ok' : 'red'} small live={live}>
                {ok ? 'Fixed' : 'Still open'}
              </Stamp>
              <span className="text-ink-2">
                {label(o.bySlot)}{o.targetOrdinal ? `, section ${o.targetOrdinal}` : ''}
              </span>
              {more && <span className="basis-full text-ink">{reason}</span>}
            </li>
          );
        })}
      </ul>
      <More open={more} onToggle={() => setMore(v => !v)} label="See the reasons" />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// The card
// ---------------------------------------------------------------------------------------------

export default function ItemCard({ item, ctx, expanded, onToggle }: { item: BoutItem; ctx: CardCtx; expanded: boolean; onToggle: () => void }) {
  const live = useLive(item.kind === 'typing' ? 0 : item.at);
  const sp = item.speaker;
  const enter = live ? (item.corner === 'left' ? 'enter-l' : item.corner === 'right' ? 'enter-r' : 'enter-c') : '';

  if (item.kind === 'typing') {
    // The step itself; the activity feed above the corner narrates the moves inside it.
    return (
      <div className={`flex items-center gap-2 ${item.corner === 'right' ? 'flex-row-reverse text-right' : ''}`}>
        <Avatar sp={sp} size={6} />
        <div className={`bub inline-flex items-center gap-2 rounded-2xl px-3 py-1.5 text-[14px] text-ink-2 ${TONE_BUB[sp.tone]}`}>
          <span className={`typing flex items-center gap-0.5 ${TONE_TEXT[sp.tone]}`} aria-hidden>
            <span />
            <span />
            <span />
          </span>
          {item.s.detail || item.s.state}
        </div>
      </div>
    );
  }

  const stamp = stampOf(item);

  if (!expanded) {
    return (
      <button type="button" onClick={onToggle} className={`bub flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] ${TONE_BUB[sp.tone]} hover:brightness-[0.98]`} title="Open">
        <Avatar sp={sp} size={6} />
        <span className={`shrink-0 font-semibold ${sp.human ? 'text-paper' : TONE_TEXT[sp.tone]}`}>{sp.name}</span>
        <span className={`min-w-0 flex-1 truncate ${sp.human ? 'text-paper/80' : 'text-ink-2'}`}>{summaryOf(item)}</span>
        {stamp && (
          <Stamp tone={stamp.tone} small>
            {stamp.text}
          </Stamp>
        )}
      </button>
    );
  }

  return (
    <article className={`bub min-w-0 break-words rounded-2xl px-3.5 py-2.5 text-[15px] ${TONE_BUB[sp.tone]} ${enter}`}>
      <button type="button" onClick={onToggle} className={`mb-1.5 flex w-full items-center gap-2 text-left text-xs ${sp.human ? 'text-paper/70' : 'text-muted'}`} title="Fold">
        <Avatar sp={sp} size={6} />
        <span className={`font-semibold ${sp.human ? 'text-paper' : TONE_TEXT[sp.tone]}`}>{sp.name}</span>
        {sp.role && <span>{sp.role}</span>}
        <span className="ml-auto">{ago(item.at, ctx.now)}</span>
      </button>
      {item.kind === 'question' && <div className="text-[16px] font-medium leading-snug">{item.q.text}</div>}
      {item.kind === 'note' && (
        <div>
          <div className="whitespace-pre-wrap leading-relaxed">{item.n.text}</div>
          {item.waiting && <div className="mt-1 text-[11px] text-paper/60">Read on the next turn</div>}
        </div>
      )}
      {item.kind === 'answer' && <AnswerBody d={item.d} ctx={ctx} live={live} />}
      {item.kind === 'draft' && <DraftBody d={item.d} leadName={ctx.leadName} again={item.again} live={live} />}
      {item.kind === 'objection' && <ObjectionBody o={item.o} ctx={ctx} live={live} />}
      {item.kind === 'evidence' && <EvidenceBody e={item.e} live={live} />}
      {item.kind === 'revision' && <RevisionBody item={item} ctx={ctx} live={live} />}
      {item.kind === 'ruling' && <RulingBody group={item.group} ctx={ctx} live={live} />}
    </article>
  );
}
