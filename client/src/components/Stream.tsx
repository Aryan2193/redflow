import { useEffect, useMemo, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useReducer } from 'spacetimedb/react';
import { reducers } from '../module_bindings';
import type { AgentStatus, AnswerVersion, Draft, Evidence, Member, ModelSlot, Note, Objection, Question, Room, TeamQuestion } from '../module_bindings/types';
import { idHex, timeAgo, toDate } from '../lib/stdb';
import { useAutosize } from '../lib/autosize';
import { slotColor } from '../lib/labels';

type Props = {
  room: Room;
  question?: Question;
  members: readonly Member[];
  notes: readonly Note[];
  drafts: readonly Draft[];
  objections: readonly Objection[];
  evidence: readonly Evidence[];
  teamQs: readonly TeamQuestion[];
  versions: readonly AnswerVersion[];
  statuses: readonly AgentStatus[];
  slots: readonly ModelSlot[];
  now: number;
  me: string;
};

type Kind = 'question' | 'note' | 'draft' | 'teamq' | 'objection' | 'evidence' | 'version';
type Item = { key: string; at: number; kind: Kind; node: React.ReactNode };

const ACTIVE_STATES = new Set(['reading', 'drafting', 'critiquing', 'checking', 'synthesizing', 'verifying', 'dissenting']);
const STAGE_OF: Record<Kind, string> = { question: '', note: '', draft: 'Drafts', teamq: '', objection: 'Critique', evidence: 'Fact check', version: 'Revision' };

function Avatar({ slot, label, human }: { slot?: string; label: string; human?: boolean }) {
  const initial = label.trim().charAt(0).toUpperCase() || '?';
  return (
    <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-paper ${human ? 'bg-ink' : slotColor(slot ?? '')}`} aria-hidden>
      {initial}
    </span>
  );
}

export default function Stream(p: Props) {
  const ask = useReducer(reducers.ask);
  const postNote = useReducer(reducers.postNote);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [hint, setHint] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const forceScroll = useRef(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  useAutosize(taRef, text, 200);

  const q = p.question;
  const questionOpen = !!q && q.state !== 'settled' && q.state !== 'failed';
  const [askMode, setAskMode] = useState(false);
  const canAsk = !q || (!questionOpen && askMode);
  const [tqAnswers, setTqAnswers] = useState<Record<string, string>>({});
  const label = (slot: string) => p.slots.find(s => s.slot === slot)?.label ?? slot;
  const queued = q ? p.notes.filter(n => n.questionId === q.id && n.consumedStep === '' && n.teamQuestionId === 0n).length : 0;

  const items: Item[] = useMemo(() => {
    const out: Item[] = [];
    const at = (ts: { microsSinceUnixEpoch: bigint }) => toDate(ts).getTime();
    const relevantNotes = q ? p.notes.filter(n => n.questionId === q.id || n.questionId === 0n) : p.notes;
    for (const n of relevantNotes) {
      const mine = idHex(n.author) === p.me;
      const tq = n.teamQuestionId !== 0n ? p.teamQs.find(t => t.id === n.teamQuestionId) : undefined;
      out.push({
        key: 'n' + n.id,
        at: at(n.createdAt),
        kind: 'note',
        node: (
          <div className={`flex gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
            <Avatar label={n.authorName} human />
            <div className={`max-w-[85%] rounded-lg px-3 py-2 text-[15px] ${mine ? 'bg-ink text-paper' : 'border border-line bg-sheet'}`}>
              <div className={`text-xs ${mine ? 'text-paper/70' : 'text-muted'}`}>
                {n.authorName}
                {tq ? ' answered the room' : ''} · {timeAgo(n.createdAt, p.now)}
                {n.consumedStep === '' && questionOpen && !tq ? ' · read on the next turn' : ''}
              </div>
              {tq && <div className={`text-xs italic ${mine ? 'text-paper/70' : 'text-muted'}`}>"{tq.text}"</div>}
              <div className="whitespace-pre-wrap">{n.text}</div>
            </div>
          </div>
        ),
      });
    }
    if (q) {
      out.push({
        key: 'q' + q.id,
        at: at(q.createdAt),
        kind: 'question',
        node: (
          <div className="rounded-lg border-2 border-ink bg-sheet px-3 py-2">
            <div className="text-xs text-muted">
              {q.askedByName} asked · {timeAgo(q.createdAt, p.now)}
            </div>
            <div className="font-medium">{q.text}</div>
          </div>
        ),
      });
      for (const d of p.drafts) {
        const isLead = d.slot === 'council_a';
        out.push({
          key: 'd' + d.id,
          at: at(d.createdAt),
          kind: 'draft',
          node: (
            <details className="rounded-lg border border-line bg-sheet px-3 py-2">
              <summary className="flex cursor-pointer items-center gap-2 text-sm">
                <Avatar slot={d.slot} label={label(d.slot)} />
                <span>
                  <span className="font-semibold">{label(d.slot)}</span>{' '}
                  <span className="text-muted">{isLead ? 'wrote the first answer' : `drafted its own view, blind${d.label ? `, shown to others as draft ${d.label}` : ''}`} · {(d.latencyMs / 1000).toFixed(0)}s</span>
                </span>
              </summary>
              <div className="doc mt-3 text-[15px] leading-relaxed">
                <Markdown remarkPlugins={[remarkGfm]}>{d.text}</Markdown>
              </div>
              {d.assumptions && <div className="mt-2 text-xs text-muted">Assumed: {d.assumptions.split('\n').join('; ')}</div>}
            </details>
          ),
        });
      }
      for (const t of p.teamQs) {
        out.push({
          key: 't' + t.id,
          at: at(t.createdAt),
          kind: 'teamq',
          node: (
            <div className="rounded-lg border border-warn/60 bg-warn-soft/50 px-3 py-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-warn">The room asks the team</div>
              <div className="mt-0.5 text-[15px]">{t.text}</div>
              {t.answeredAt ? (
                <div className="mt-1 text-xs text-muted">Answered by {t.answeredByName}</div>
              ) : (
                <form
                  className="mt-2 flex gap-2"
                  onSubmit={async e => {
                    e.preventDefault();
                    const body = (tqAnswers[t.id.toString()] ?? '').trim();
                    if (!body) return;
                    try {
                      await postNote({ roomId: p.room.id, text: body, teamQuestionId: t.id });
                      setTqAnswers(a => ({ ...a, [t.id.toString()]: '' }));
                    } catch (e2) {
                      setErr(String((e2 as Error)?.message ?? e2));
                    }
                  }}
                >
                  <input
                    value={tqAnswers[t.id.toString()] ?? ''}
                    onChange={e => setTqAnswers(a => ({ ...a, [t.id.toString()]: e.target.value }))}
                    placeholder="Answer here"
                    className="flex-1 rounded-md border border-line bg-sheet px-2.5 py-1.5 text-sm outline-none focus:border-ink"
                  />
                  <button className="rounded-md bg-ink px-3 py-1.5 text-sm font-semibold text-paper">Answer</button>
                </form>
              )}
            </div>
          ),
        });
      }
      for (const o of p.objections) {
        const [issue, fix] = o.issue.split(' Fix: ');
        const chip =
          o.status === 'open'
            ? 'bg-warn-soft text-warn'
            : o.status === 'withdrawn' || o.status === 'addressed'
              ? 'bg-ok-soft text-ok'
              : o.status === 'overruled'
                ? 'bg-judg-soft text-judg'
                : 'bg-red-soft text-red';
        const chipText = o.status === 'withdrawn' ? 'fixed' : o.status === 'addressed' ? 'fix pending check' : o.status === 'unresolved' ? 'open risk' : o.status;
        out.push({
          key: 'o' + o.id,
          at: at(o.createdAt),
          kind: 'objection',
          node: (
            <div className="rounded-lg border border-line bg-sheet px-3 py-2 text-[15px]">
              <div className="flex items-center gap-2 text-xs text-muted">
                <Avatar slot={o.bySlot} label={label(o.bySlot)} />
                <span>
                  <span className="font-semibold text-ink">{label(o.bySlot)}</span> objects{o.targetOrdinal ? ` to section ${o.targetOrdinal}` : ''}
                </span>
                <span className={`ml-auto rounded-full px-2 py-0.5 ${chip}`}>{chipText}</span>
              </div>
              {o.claim && <div className="mt-1.5 text-ink-2">"{o.claim}"</div>}
              <div className="mt-1">{issue}</div>
              {fix && (
                <div className="mt-1 text-ink-2">
                  <span className="font-semibold text-ink">Fix:</span> {fix}
                </div>
              )}
              {o.resolution && <div className="mt-1.5 border-t border-line-2 pt-1.5 text-xs text-muted">{o.resolution}</div>}
            </div>
          ),
        });
      }
      for (const e of p.evidence) {
        let host = '';
        try {
          host = e.url ? new URL(e.url).hostname.replace(/^www\./, '') : '';
        } catch {
          host = e.url;
        }
        out.push({
          key: 'e' + e.id,
          at: at(e.createdAt),
          kind: 'evidence',
          node: (
            <div className="rounded-lg border border-line bg-sheet px-3 py-2 text-[15px]">
              <div className="flex items-center gap-2 text-xs text-muted">
                <Avatar slot="checker" label={label('checker')} />
                <span>
                  <span className="font-semibold text-ink">{label('checker')}</span> checked a claim
                </span>
                <span className={`ml-auto rounded-full px-2 py-0.5 ${e.verdict === 'supported' ? 'bg-ok-soft text-ok' : e.verdict === 'refuted' ? 'bg-red-soft text-red' : 'bg-warn-soft text-warn'}`}>{e.verdict}</span>
              </div>
              <div className="mt-1.5 text-ink-2">"{e.claim}"</div>
              <div className="mt-1">{e.title}</div>
              {e.excerpt && <div className="mt-1 text-xs italic text-muted">"{e.excerpt}"</div>}
              {e.url && (
                <a href={e.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-ink underline">
                  {host}
                </a>
              )}
            </div>
          ),
        });
      }
      for (const v of p.versions) {
        out.push({
          key: 'v' + v.id,
          at: at(v.createdAt),
          kind: 'version',
          node: (
            <div className="rounded-lg bg-ink px-3 py-2 text-[15px] text-paper">
              <span className="font-semibold">Version {v.version}.</span> {v.summary}
            </div>
          ),
        });
      }
    }
    return out.sort((a, b) => a.at - b.at);
  }, [p.notes, p.drafts, p.teamQs, p.objections, p.evidence, p.versions, q, p.me, p.now, p.slots, p.room.id, questionOpen, tqAnswers, postNote]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (nearBottom.current || forceScroll.current) {
      el.scrollTop = el.scrollHeight;
      forceScroll.current = false;
    }
  }, [items.length]);

  async function send(e: React.SyntheticEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setErr('');
    setSending(true);
    try {
      if (canAsk) await ask({ roomId: p.room.id, text: body });
      else await postNote({ roomId: p.room.id, text: body, teamQuestionId: 0n });
      setText('');
      setAskMode(false);
      forceScroll.current = true;
      setHint(!canAsk && q && q.state === 'settled' ? 'Saved. The answer has settled, so press Go deeper on the Answer tab to make the room take this into account, or ask a new question.' : '');
    } catch (e2) {
      setErr(String((e2 as Error)?.message ?? e2));
    } finally {
      setSending(false);
    }
  }

  const activeAgents = p.statuses.filter(s => ACTIVE_STATES.has(s.state));
  const myMember = p.members.find(m => idHex(m.identity) === p.me);
  const justJoined = myMember ? p.now - toDate(myMember.joinedAt).getTime() < 120_000 : false;

  // Stage dividers between kinds, so the debate reads in chapters.
  let lastStage = '';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {justJoined && myMember && (
        <div className="shrink-0 border-b border-line-2 bg-warn-soft/50 px-4 py-2 text-sm text-ink-2">
          <span className="font-semibold text-ink">Welcome, {myMember.name}.</span>{' '}
          {q ? 'This is the debate behind the answer. Add context or a correction below; the models read it on their next turn.' : 'Ask the room one question below.'}
        </div>
      )}
      <div
        ref={listRef}
        onScroll={e => {
          const el = e.currentTarget;
          nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
        }}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4 pt-4"
      >
        {!q && (
          <div className="rounded-lg border border-dashed border-line px-3 py-3 text-sm text-muted">
            <div className="font-medium text-ink">This room is waiting for its first question.</div>
            Keep it concrete: a decision, a plan, a claim you want stress-tested.
          </div>
        )}
        {items.map(it => {
          const stage = STAGE_OF[it.kind];
          const divider = stage && stage !== lastStage ? stage : '';
          if (stage) lastStage = stage;
          return (
            <div key={it.key}>
              {divider && (
                <div className="mb-3 mt-5 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-muted">
                  <span className="h-px flex-1 bg-line" />
                  {divider}
                  <span className="h-px flex-1 bg-line" />
                </div>
              )}
              {it.node}
            </div>
          );
        })}
        {activeAgents.length > 0 && (
          <div className="space-y-1.5 px-1 pt-1 text-sm text-muted">
            {activeAgents.map(s => (
              <div key={s.id.toString()} className="flex items-center gap-2">
                <Avatar slot={s.slot} label={label(s.slot)} />
                <span className="pulse inline-block h-1.5 w-1.5 rounded-full bg-red" aria-hidden />
                <span>
                  <span className="font-semibold text-ink-2">{label(s.slot)}</span> {s.detail || s.state}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={send} className="shrink-0 border-t border-line bg-paper px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3">
        <div className="mb-1.5 flex items-center gap-3 text-xs text-muted">
          <span>{canAsk ? (q ? 'New question' : 'Your question') : 'Note to the room'}</span>
          {queued > 0 && <span>· {queued} waiting for the next turn</span>}
          {q && !questionOpen && (
            <button type="button" onClick={() => setAskMode(v => !v)} className="ml-auto rounded-full border border-line px-2 py-0.5 text-ink-2">
              {askMode ? 'Back to notes' : 'Ask a new question'}
            </button>
          )}
        </div>
        <div className="flex items-end gap-2">
          <textarea
            ref={taRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send(e);
              }
            }}
            rows={1}
            placeholder={canAsk ? 'Ask one question. A decision, a plan, a claim to stress-test.' : questionOpen ? 'Add context or a correction. Read on the next turn.' : 'Add a note for the next round.'}
            className="flex-1 resize-none rounded-md border border-line bg-sheet px-3 py-2.5 outline-none focus:border-ink"
            maxLength={2000}
          />
          <button type="submit" disabled={sending || !text.trim()} className={`rounded-md px-3.5 py-2.5 text-sm font-semibold text-paper disabled:opacity-50 ${canAsk ? 'bg-red' : 'bg-ink'}`}>
            {canAsk ? 'Ask' : 'Send'}
          </button>
        </div>
        {err && <div className="mt-1.5 text-xs text-red">{err}</div>}
        {hint && !err && <div className="mt-1.5 text-xs text-warn">{hint}</div>}
      </form>
    </div>
  );
}
