import { useMemo, useState, type ReactNode } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { AgentStatus, AnswerVersion, Draft, Evidence, ModelSlot, Note, Objection, Paragraph, Question, Room, TeamQuestion } from '../module_bindings/types';
import { toDate } from '../lib/stdb';
import { changedShare, wordDiff } from '../lib/diff';
import { TONE_BG, TONE_BUB, TONE_TEXT, evidenceState, humanSpeaker, objectionState, speakerFor, type Speaker } from '../lib/labels';
import Verdict from './Verdict';

export type ThreadProps = {
  room: Room;
  question: Question;
  notes: readonly Note[];
  drafts: readonly Draft[];
  objections: readonly Objection[];
  evidence: readonly Evidence[];
  paragraphs: readonly Paragraph[];
  teamQs: readonly TeamQuestion[];
  versions: readonly AnswerVersion[];
  statuses: readonly AgentStatus[];
  slots: readonly ModelSlot[];
  now: number;
  myName: string;
  collapsed?: boolean;
  onReply?: (t: TeamQuestion) => void;
};

type Item = { key: string; at: number; stage: string; round: number; speaker: Speaker; node: ReactNode; typing?: boolean };

const ACTIVE = new Set(['reading', 'drafting', 'critiquing', 'checking', 'synthesizing', 'verifying', 'dissenting']);
const STAGE_LABEL: Record<string, string> = {
  answer: 'First answer',
  drafts: 'Blind drafts',
  attack: 'The attack',
  facts: 'Fact check',
  revision: 'Revision',
  verify: 'Verification',
};

function ago(at: number, now: number): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 8) return 'now';
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.round(m / 60)}h`;
}

// Models often quote the claim themselves. One set of quotes is enough.
export function unquote(s: string): string {
  return s.replace(/^["“”'\s]+|["“”'\s]+$/g, '');
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// Older rows echo "[section 3] (agreed)" into headings. Strip it wherever a heading is shown.
export function cleanHeading(h: string): string {
  return h.replace(/^\s*\[?\s*section\s*\d+\s*\]?\s*(\([a-z ]+\))?\s*[:.-]?\s*/i, '').trim();
}

function splitSections(md: string): { heading: string; body: string }[] {
  return md
    .split(/\n(?=## )/)
    .map(part => {
      const m = part.match(/^## (.*)\n?([\s\S]*)$/);
      return m ? { heading: cleanHeading(m[1]), body: m[2].trim() } : { heading: '', body: part.trim() };
    })
    .filter(s => s.body || s.heading);
}

function Md({ children }: { children: string }) {
  return (
    <div className="chat-md">
      <Markdown remarkPlugins={[remarkGfm]}>{children}</Markdown>
    </div>
  );
}

function Chip({ cls, children }: { cls: string; children: ReactNode }) {
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

function Avatar({ sp }: { sp: Speaker }) {
  return (
    <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-paper ${TONE_BG[sp.tone]}`} aria-hidden>
      {sp.name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}

// ---------------------------------------------------------------------------------------------
// Message bodies
// ---------------------------------------------------------------------------------------------

function LeadAnswer({ d, v1, paragraphs }: { d: Draft; v1: Paragraph[]; paragraphs: readonly Paragraph[] }) {
  const secs = v1.length ? v1.map(p => ({ heading: cleanHeading(p.heading), body: p.text, ordinal: p.ordinal })) : splitSections(d.text).map((s, i) => ({ ...s, ordinal: i + 1 }));
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted">
        <span>First full answer, written alone</span>
        <Chip cls="bg-ink text-paper">Version 1</Chip>
        <span>{(d.latencyMs / 1000).toFixed(0)}s</span>
      </div>
      <div className="space-y-3.5">
        {secs.map(s => {
          const cur = paragraphs.find(p => p.current && p.ordinal === s.ordinal);
          let mark: ReactNode = null;
          if (cur && cur.version > 1) mark = <Chip cls="bg-ok-soft text-ok">Revised in v{cur.version}</Chip>;
          else if (cur?.status === 'contested') mark = <Chip cls="bg-red-soft text-red">Under attack</Chip>;
          else if (cur?.status === 'verified') mark = <Chip cls="bg-ok-soft text-ok">Verified</Chip>;
          else if (cur?.status === 'unresolved') mark = <Chip cls="bg-red text-paper">Open risk</Chip>;
          else if (!cur && v1.length) mark = <Chip cls="bg-judg-soft text-judg">Removed later</Chip>;
          return (
            <section key={s.ordinal}>
              {(s.heading || mark) && (
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  {s.heading && <h4 className="text-[15px] font-semibold leading-snug">{s.heading}</h4>}
                  {mark}
                </div>
              )}
              <Md>{s.body}</Md>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function BlindDraft({ d, leadName, again }: { d: Draft; leadName: string; again: boolean }) {
  const secs = splitSections(d.text);
  const [first, ...rest] = secs;
  return (
    <div>
      <div className="mb-1.5 text-xs text-muted">{again ? 'Drafted again for this round' : `Wrote its own answer blind, before seeing ${leadName}'s`}</div>
      {first && (
        <>
          {first.heading && <h4 className="mb-1 text-[15px] font-semibold leading-snug">{first.heading}</h4>}
          <Md>{first.body}</Md>
        </>
      )}
      {rest.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-semibold text-ink-2">
            Read the full draft ({rest.length} more section{rest.length === 1 ? '' : 's'})
          </summary>
          <div className="mt-2 space-y-3">
            {rest.map((s, i) => (
              <section key={i}>
                {s.heading && <h4 className="mb-1 text-[15px] font-semibold leading-snug">{s.heading}</h4>}
                <Md>{s.body}</Md>
              </section>
            ))}
            {d.assumptions && <p className="text-xs text-muted">Assumed: {d.assumptions.split('\n').join('; ')}</p>}
          </div>
        </details>
      )}
    </div>
  );
}

function ObjectionBody({ o, leadName }: { o: Objection; leadName: string }) {
  const st = objectionState(o.status);
  const [issue, fix] = o.issue.split(' Fix: ');
  const tail = o.resolution.split(' | ').pop() ?? '';
  let foot = '';
  if (o.status === 'withdrawn') foot = 'Fixed. ' + tail.replace(/^withdrawn:\s*/, '');
  else if (o.status === 'overruled') foot = o.resolution;
  else if (o.status === 'addressed') foot = o.resolution ? `${leadName} says: ${o.resolution}` : '';
  else if (/^held:/.test(tail)) foot = 'Still standing. ' + tail.replace(/^held:\s*/, '');
  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
        <span>Objects{o.targetOrdinal ? ` to section ${o.targetOrdinal}` : ''}</span>
        <Severity n={o.severity} />
        <Chip cls={st.chip}>{st.label}</Chip>
      </div>
      {o.claim && (
        <p className="mb-1.5 leading-relaxed">
          <span className={`hl ${st.hl}`}>“{unquote(o.claim)}”</span>
        </p>
      )}
      <p className="leading-relaxed">{issue}</p>
      {fix && (
        <p className="mt-1.5 leading-relaxed">
          <span className="font-semibold">Fix:</span> {fix}
        </p>
      )}
      {foot && <p className="mt-2 border-t border-black/10 pt-1.5 text-xs leading-relaxed text-ink-2">{foot}</p>}
    </div>
  );
}

function EvidenceBody({ e }: { e: Evidence }) {
  const st = evidenceState(e.verdict);
  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
        <span>Checked a claim on the web</span>
        <Chip cls={st.chip}>{st.label}</Chip>
      </div>
      <p className="mb-1.5 leading-relaxed">
        <span className={`hl ${st.hl}`}>“{unquote(e.claim)}”</span>
      </p>
      {e.title && <p className="leading-relaxed">{e.title}</p>}
      {e.excerpt && <blockquote className="mt-1.5 border-l-2 border-line pl-2.5 text-[14px] italic leading-relaxed text-ink-2">“{unquote(e.excerpt)}”</blockquote>}
      {e.url && (
        <a href={e.url} target="_blank" rel="noreferrer" className="mt-1.5 inline-block text-xs font-semibold underline">
          {hostOf(e.url)}
        </a>
      )}
    </div>
  );
}

function causeOf(p: Paragraph, objections: readonly Objection[], evidence: readonly Evidence[], notes: readonly Note[], slots: readonly ModelSlot[]): { text: string; hl: string } {
  const label = (slot: string) => slots.find(s => s.slot === slot)?.label ?? slot;
  if (p.causeType === 'objection') {
    const o = objections.find(x => x.id === p.causeId);
    return { text: o ? `${label(o.bySlot)} objected` : 'An objection', hl: 'hl-red' };
  }
  if (p.causeType === 'evidence') {
    const e = evidence.find(x => x.id === p.causeId);
    return { text: e?.url ? `Checked against ${hostOf(e.url)}` : 'Checked on the web', hl: 'hl-ok' };
  }
  if (p.causeType === 'note') {
    const n = notes.find(x => x.id === p.causeId);
    return { text: n ? `${n.authorName} said so` : 'The team said so', hl: 'hl-warn' };
  }
  return { text: 'Revised', hl: 'hl-judg' };
}

export function cleanWhy(why: string): string {
  return why
    .replace(/^Removed\.\s*/, '')
    .replace(/^Because of (objection|source|note) \d+:\s*/, '')
    .replace(/^Because .+? said so:\s*/, '')
    .trim();
}

function RevisionBody(props: { v: AnswerVersion; paragraphs: readonly Paragraph[]; objections: readonly Objection[]; evidence: readonly Evidence[]; notes: readonly Note[]; slots: readonly ModelSlot[] }) {
  const { v, paragraphs, objections, evidence, notes, slots } = props;
  const [diffOn, setDiffOn] = useState(true);
  const edits = paragraphs.filter(p => p.version === v.version).sort((a, b) => a.ordinal - b.ordinal);
  const overruled = objections.filter(o => o.status === 'overruled' && o.round === v.round && o.resolution.startsWith('Overruled by the lead'));
  const label = (slot: string) => slots.find(s => s.slot === slot)?.label ?? slot;
  const prevOf = (p: Paragraph) => paragraphs.filter(x => x.ordinal === p.ordinal && x.version < p.version && x.text).sort((a, b) => b.version - a.version)[0];
  const anyDiff = edits.some(p => p.text && prevOf(p));
  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
        <span>Revised the answer</span>
        <Chip cls="bg-ink text-paper">Version {v.version}</Chip>
        {anyDiff && (
          <button type="button" onClick={() => setDiffOn(x => !x)} className="ml-auto underline">
            {diffOn ? 'Hide changes' : 'Show changes'}
          </button>
        )}
      </div>
      <p className="font-medium leading-relaxed">{v.summary}</p>
      {edits.length > 0 && (
        <div className="mt-3 space-y-2.5">
          {edits.map(p => {
            const prev = prevOf(p);
            const removed = !p.text;
            const cause = causeOf(p, objections, evidence, notes, slots);
            const segs = prev && !removed ? wordDiff(prev.text, p.text) : null;
            // A targeted fix reads well as a diff. A heavy rewrite reads better clean.
            const useDiff = diffOn && segs && changedShare(segs) < 0.4;
            return (
              <section key={p.id.toString()} className="rounded-lg border border-black/10 bg-white/60 px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-[15px] font-semibold leading-snug">{removed ? `Removed: ${cleanHeading(p.heading)}` : cleanHeading(p.heading)}</h4>
                  <span className={`hl ${cause.hl} text-xs font-semibold`}>{cause.text}</span>
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-2">{cleanWhy(p.why)}</p>
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
              </section>
            );
          })}
        </div>
      )}
      {overruled.length > 0 && (
        <ul className="mt-3 space-y-1.5 text-[14px] leading-relaxed">
          {overruled.map(o => (
            <li key={o.id.toString()}>
              <span className="hl hl-judg font-semibold">Overruled {label(o.bySlot)}</span> {o.resolution.replace(/^Overruled by the lead:\s*/, '')}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function VerifyBody({ group, slots }: { group: Objection[]; slots: readonly ModelSlot[] }) {
  const label = (slot: string) => slots.find(s => s.slot === slot)?.label ?? slot;
  return (
    <div>
      <div className="mb-1.5 text-xs text-muted">Checked whether the fixes hold</div>
      <ul className="space-y-2 leading-relaxed">
        {group.map(o => {
          const tail = o.resolution.split(' | ').pop() ?? '';
          const ok = /^withdrawn:/.test(tail);
          const reason = tail.replace(/^(withdrawn|held):\s*/, '');
          return (
            <li key={o.id.toString()}>
              <span className={`hl ${ok ? 'hl-ok' : 'hl-red'} font-semibold`}>{ok ? 'Fixed' : 'Still open'}</span>{' '}
              <span className="text-ink-2">
                {label(o.bySlot)}{o.targetOrdinal ? ` on section ${o.targetOrdinal}` : ''}.
              </span>{' '}
              {reason}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// The bubble
// ---------------------------------------------------------------------------------------------

function Bubble({ item, side, now }: { item: Item; side: 'left' | 'right'; now: number }) {
  const sp = item.speaker;
  const right = side === 'right';
  const fresh = !item.typing && now - item.at < 4000;
  return (
    <div className={`flex ${right ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[94%] gap-2 sm:max-w-[82%] ${right ? 'flex-row-reverse' : ''} ${fresh ? (right ? 'enter-right' : 'enter-left') : ''}`}>
        <Avatar sp={sp} />
        <div className="min-w-0">
          <div className={`mb-1 flex items-baseline gap-2 text-xs ${right ? 'flex-row-reverse' : ''}`}>
            <span className={`font-semibold ${TONE_TEXT[sp.tone]}`}>{sp.name}</span>
            {sp.role && <span className="text-muted">{sp.role}</span>}
            {!item.typing && <span className="text-muted">{ago(item.at, now)}</span>}
          </div>
          <div className={`bub rounded-2xl px-3.5 py-2.5 text-[15px] ${TONE_BUB[sp.tone]} ${right ? 'rounded-tr-md' : 'rounded-tl-md'}`}>{item.node}</div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// The thread: one question, every message about it, in order, sides flipping with the speaker.
// ---------------------------------------------------------------------------------------------

export default function Thread(p: ThreadProps) {
  const q = p.question;
  const settled = q.state === 'settled' || q.state === 'failed';
  const [expanded, setExpanded] = useState(false);
  const lead = speakerFor('council_a', p.slots);
  const at = (ts: { microsSinceUnixEpoch: bigint }) => toDate(ts).getTime();

  const items: Item[] = useMemo(() => {
    const out: Item[] = [];
    out.push({ key: 'q', at: at(q.createdAt), stage: '', round: 1, speaker: humanSpeaker(q.askedByName), node: <div className="text-[16px] font-medium leading-snug">{q.text}</div> });

    for (const n of p.notes) {
      const tq = n.teamQuestionId !== 0n ? p.teamQs.find(t => t.id === n.teamQuestionId) : undefined;
      const waiting = n.consumedStep === '' && !settled && !tq;
      out.push({
        key: 'n' + n.id,
        at: at(n.createdAt),
        stage: '',
        round: 0,
        speaker: humanSpeaker(n.authorName),
        node: (
          <div>
            {tq && (
              <div className="mb-1 text-xs text-paper/70">
                Answering {lead.name}: <span className="italic">“{tq.text}”</span>
              </div>
            )}
            <div className="whitespace-pre-wrap leading-relaxed">{n.text}</div>
            {waiting && <div className="mt-1 text-[11px] text-paper/60">Read on the next turn</div>}
          </div>
        ),
      });
    }

    const v1 = p.paragraphs.filter(x => x.version === 1 && x.text).sort((a, b) => a.ordinal - b.ordinal);
    for (const d of p.drafts) {
      const isLead = d.slot === 'council_a';
      const firstAnswer = isLead && d.round === 1;
      out.push({
        key: 'd' + d.id,
        at: at(d.createdAt),
        stage: firstAnswer ? 'answer' : 'drafts',
        round: d.round,
        speaker: speakerFor(d.slot, p.slots),
        node: firstAnswer ? <LeadAnswer d={d} v1={v1} paragraphs={p.paragraphs} /> : <BlindDraft d={d} leadName={lead.name} again={d.round > 1} />,
      });
    }

    for (const t of p.teamQs) {
      const answer = p.notes.find(n => n.teamQuestionId === t.id);
      out.push({
        key: 't' + t.id,
        at: at(t.createdAt) + 1,
        stage: '',
        round: 0,
        speaker: lead,
        node: (
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-warn">Asks the team</div>
            <p className="leading-relaxed">
              <span className="hl hl-warn">{t.text}</span>
            </p>
            {t.answeredAt ? (
              <p className="mt-1.5 text-xs text-ink-2">
                Answered by {t.answeredByName}
                {answer ? `: ${t.answer || answer.text}` : ''}
              </p>
            ) : p.onReply ? (
              <button type="button" onClick={() => p.onReply?.(t)} className="mt-2 rounded-full border border-warn px-2.5 py-0.5 text-xs font-semibold text-warn">
                Reply
              </button>
            ) : null}
          </div>
        ),
      });
    }

    for (const o of p.objections) {
      out.push({ key: 'o' + o.id, at: at(o.createdAt), stage: 'attack', round: o.round, speaker: speakerFor(o.bySlot, p.slots), node: <ObjectionBody o={o} leadName={lead.name} /> });
    }

    for (const e of p.evidence) {
      out.push({ key: 'e' + e.id, at: at(e.createdAt), stage: 'facts', round: 0, speaker: speakerFor('checker', p.slots), node: <EvidenceBody e={e} /> });
    }

    for (const v of p.versions) {
      if (v.version < 2) continue;
      out.push({
        key: 'v' + v.id,
        at: at(v.createdAt),
        stage: 'revision',
        round: v.round,
        speaker: lead,
        node: <RevisionBody v={v} paragraphs={p.paragraphs} objections={p.objections} evidence={p.evidence} notes={p.notes} slots={p.slots} />,
      });
    }

    // The verifier's ruling lives on the objections it judged. Group by round into one message.
    const judged = p.objections.filter(o => /\| (withdrawn|held): /.test(o.resolution));
    const rounds = [...new Set(judged.map(o => o.round))];
    const verifierSlot = p.slots.find(s => s.slot === 'council_b' && s.enabled) ? 'council_b' : 'council_c';
    for (const r of rounds) {
      const group = judged.filter(o => o.round === r);
      const when = Math.max(...group.map(o => at(o.updatedAt)));
      out.push({ key: 'vf' + r, at: when, stage: 'verify', round: r, speaker: speakerFor(verifierSlot, p.slots), node: <VerifyBody group={group} slots={p.slots} /> });
    }

    if (!settled) {
      // Whoever is working shows as typing, the lead first, then the others in the order they started.
      const working = p.statuses.filter(s => ACTIVE.has(s.state)).sort((a, b) => Number(b.slot === 'council_a') - Number(a.slot === 'council_a'));
      working.forEach((s, i) => {
        const sp = speakerFor(s.slot, p.slots);
        out.push({
          key: 'typing' + s.slot,
          at: Number.MAX_SAFE_INTEGER - 10 + i,
          typing: true,
          stage: '',
          round: 0,
          speaker: sp,
          node: (
            <div className="flex items-center gap-2.5">
              <span className={`typing flex items-center gap-0.5 ${TONE_TEXT[sp.tone]}`} aria-hidden>
                <span />
                <span />
                <span />
              </span>
              <span className="text-[14px] text-ink-2">{s.detail || s.state}</span>
            </div>
          ),
        });
      });
    }

    return out.sort((a, b) => a.at - b.at);
  }, [q, p.notes, p.teamQs, p.paragraphs, p.drafts, p.objections, p.evidence, p.versions, p.statuses, p.slots, p.onReply, lead, settled]);

  // Sides flip whenever the speaker changes. Nobody owns a side.
  const laid = useMemo(() => {
    let side: 'left' | 'right' = 'left';
    let prev = '';
    return items.map(it => {
      if (prev && it.speaker.key !== prev) side = side === 'left' ? 'right' : 'left';
      prev = it.speaker.key;
      return { it, side };
    });
  }, [items]);

  const showAll = !p.collapsed || expanded;
  const visible = showAll ? laid : laid.slice(0, 1);
  let lastStage = '';

  return (
    <div className="space-y-3">
      {visible.map(({ it, side }) => {
        const stageKey = it.stage ? `${it.stage}-${it.round}` : '';
        const divider = stageKey && stageKey !== lastStage ? `${it.round > 1 ? `Round ${it.round}: ` : ''}${STAGE_LABEL[it.stage] ?? it.stage}` : '';
        if (stageKey) lastStage = stageKey;
        return (
          <div key={it.key}>
            {divider && (
              <div className="mb-3 mt-5 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-muted">
                <span className="h-px flex-1 bg-line" />
                {divider}
                <span className="h-px flex-1 bg-line" />
              </div>
            )}
            <Bubble item={it} side={side} now={p.now} />
          </div>
        );
      })}
      {p.collapsed && !expanded && items.length > 1 && (
        <div className="flex justify-center">
          <button type="button" onClick={() => setExpanded(true)} className="rounded-full border border-line bg-sheet px-3 py-1 text-xs font-semibold text-ink-2">
            Show the debate ({items.length - 1} messages)
          </button>
        </div>
      )}
      {q.state === 'failed' && <p className="text-center text-xs text-red">The room hit a problem and stopped. {q.lastError.slice(0, 140)}</p>}
      {settled && (
        <Verdict room={p.room} question={q} paragraphs={p.paragraphs} objections={p.objections} evidence={p.evidence} notes={p.notes} slots={p.slots} now={p.now} myName={p.myName} compact={!showAll} />
      )}
    </div>
  );
}
