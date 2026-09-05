import { useEffect, useMemo, useRef, useState } from 'react';
import { useReducer } from 'spacetimedb/react';
import { reducers } from '../module_bindings';
import type { AgentStatus, AnswerVersion, Draft, Evidence, Member, ModelSlot, Note, Objection, Question, Room, TeamQuestion } from '../module_bindings/types';
import { idHex, timeAgo, toDate } from '../lib/stdb';

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

type Item = { key: string; at: number; kind: string; node: React.ReactNode };

const ACTIVE_STATES = new Set(['reading', 'drafting', 'critiquing', 'checking', 'synthesizing', 'verifying', 'dissenting']);

export default function Stream(p: Props) {
  const ask = useReducer(reducers.ask);
  const postNote = useReducer(reducers.postNote);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  const q = p.question;
  const canAsk = !q || q.state === 'settled' || q.state === 'failed';
  const label = (slot: string) => p.slots.find(s => s.slot === slot)?.label ?? slot;
  const queued = q ? p.notes.filter(n => n.questionId === q.id && n.consumedStep === '' && n.teamQuestionId === 0n).length : 0;

  const items: Item[] = useMemo(() => {
    const out: Item[] = [];
    const at = (ts: { microsSinceUnixEpoch: bigint }) => toDate(ts).getTime();
    for (const n of p.notes) {
      const mine = idHex(n.author) === p.me;
      const tq = n.teamQuestionId !== 0n ? p.teamQs.find(t => t.id === n.teamQuestionId) : undefined;
      out.push({
        key: 'n' + n.id,
        at: at(n.createdAt),
        kind: 'note',
        node: (
          <div className={`max-w-[92%] rounded-lg px-3 py-2 ${mine ? 'ml-auto bg-ink text-paper' : 'bg-sheet border border-line'}`}>
            <div className={`text-xs ${mine ? 'text-paper/70' : 'text-muted'}`}>
              {n.authorName}
              {tq ? ' answered the room' : ''} · {timeAgo(n.createdAt, p.now)}
              {n.consumedStep === '' && q && n.questionId === q.id && !tq ? ' · waiting for the next turn' : ''}
            </div>
            {tq && <div className={`text-xs italic ${mine ? 'text-paper/70' : 'text-muted'}`}>"{tq.text}"</div>}
            <div className="whitespace-pre-wrap">{n.text}</div>
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
            <div className="text-xs text-muted">{q.askedByName} asked the room · {timeAgo(q.createdAt, p.now)}</div>
            <div className="font-medium">{q.text}</div>
          </div>
        ),
      });
      for (const d of p.drafts) {
        out.push({
          key: 'd' + d.id,
          at: at(d.createdAt),
          kind: 'draft',
          node: (
            <details className="rounded-lg border border-line bg-sheet px-3 py-2">
              <summary className="cursor-pointer text-sm">
                <span className="font-semibold">{label(d.slot)}</span> <span className="text-muted">drafted blind{d.label ? `, shown to critics as draft ${d.label}` : ''} · {(d.latencyMs / 1000).toFixed(1)}s</span>
              </summary>
              <div className="mt-2 whitespace-pre-line text-sm text-ink-2">{d.text}</div>
              {d.assumptions.split('\n@@unknowns')[0] && (
                <div className="mt-2 text-xs text-muted">Assumed: {d.assumptions.split('\n@@unknowns')[0].split('\n').join('; ')}</div>
              )}
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
            <div className="rounded-lg border border-warn bg-warn-soft/60 px-3 py-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-warn">The room asks the team</div>
              <div>{t.text}</div>
              {t.answeredAt && <div className="mt-1 text-xs text-muted">Answered by {t.answeredByName}</div>}
            </div>
          ),
        });
      }
      for (const o of p.objections) {
        out.push({
          key: 'o' + o.id,
          at: at(o.createdAt),
          kind: 'objection',
          node: (
            <div className="rounded-lg border border-line bg-sheet px-3 py-2 text-sm">
              <div className="flex items-center gap-2 text-xs text-muted">
                <span className="font-semibold text-ink">{label(o.bySlot)}</span>
                <span>objects{o.targetOrdinal ? ` to paragraph ${o.targetOrdinal}` : ''}</span>
                <span className={`ml-auto rounded-full px-2 py-0.5 ${o.status === 'open' ? 'bg-warn-soft text-warn' : o.status === 'withdrawn' || o.status === 'addressed' ? 'bg-ok-soft text-ok' : o.status === 'overruled' ? 'bg-judg-soft text-judg' : 'bg-red-soft text-red'}`}>{o.status}</span>
              </div>
              {o.claim && <div className="mt-1 text-ink-2">"{o.claim}"</div>}
              <div className="mt-0.5">{o.issue}</div>
              <div className="mt-1 flex gap-2 text-xs text-muted">
                {o.checkable && <span>checkable</span>}
                <span>severity {o.severity}</span>
              </div>
              {o.resolution && <div className="mt-1 border-t border-line-2 pt-1 text-xs text-muted">{o.resolution}</div>}
            </div>
          ),
        });
      }
      for (const e of p.evidence) {
        out.push({
          key: 'e' + e.id,
          at: at(e.createdAt),
          kind: 'evidence',
          node: (
            <div className="rounded-lg border border-line bg-sheet px-3 py-2 text-sm">
              <div className="flex items-center gap-2 text-xs text-muted">
                <span className="font-semibold text-ink">{label('checker')}</span> <span>checked a claim</span>
                <span className={`ml-auto rounded-full px-2 py-0.5 ${e.verdict === 'supported' ? 'bg-ok-soft text-ok' : e.verdict === 'refuted' ? 'bg-red-soft text-red' : 'bg-warn-soft text-warn'}`}>{e.verdict}</span>
              </div>
              <div className="mt-1 text-ink-2">"{e.claim}"</div>
              <div className="mt-1">{e.title}</div>
              {e.excerpt && <div className="mt-1 text-xs italic text-muted">"{e.excerpt}"</div>}
              {e.url && (
                <a href={e.url} target="_blank" rel="noreferrer" className="mt-1 block truncate text-xs text-ink underline">
                  {e.url}
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
            <div className="rounded-lg bg-ink px-3 py-2 text-sm text-paper">
              <span className="font-mono text-xs text-paper/70">version {v.version}</span> {v.summary}
            </div>
          ),
        });
      }
    }
    return out.sort((a, b) => a.at - b.at);
  }, [p.notes, p.drafts, p.teamQs, p.objections, p.evidence, p.versions, q, p.me, p.now, p.slots]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [items.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setErr('');
    setSending(true);
    try {
      if (canAsk) await ask({ roomId: p.room.id, text: body });
      else await postNote({ roomId: p.room.id, text: body, teamQuestionId: 0n });
      setText('');
    } catch (e2) {
      setErr(String((e2 as Error)?.message ?? e2));
    } finally {
      setSending(false);
    }
  }

  const activeAgents = p.statuses.filter(s => ACTIVE_STATES.has(s.state));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-4 pt-4">
        {!q && (
          <div className="rounded-lg border border-dashed border-line px-3 py-3 text-sm text-muted">
            <div className="font-medium text-ink">This room is waiting for its first question.</div>
            Ask below. Keep it concrete: a decision, a plan, a claim you want stress-tested. Notes you add before asking are read too.
          </div>
        )}
        {items.map(it => (
          <div key={it.key}>{it.node}</div>
        ))}
        {activeAgents.length > 0 && (
          <div className="space-y-1 px-1 text-xs text-muted">
            {activeAgents.map(s => (
              <div key={s.id.toString()} className="flex items-center gap-2">
                <span className="pulse inline-block h-1.5 w-1.5 rounded-full bg-red" aria-hidden />
                <span className="font-semibold text-ink-2">{label(s.slot)}</span> {s.detail || s.state}
              </div>
            ))}
          </div>
        )}
        <div ref={bottom} />
      </div>

      <form onSubmit={send} className="sticky bottom-0 border-t border-line bg-paper px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3">
        {queued > 0 && (
          <div className="mb-1.5 text-xs text-muted">
            {queued} note{queued === 1 ? '' : 's'} waiting for the agents' next turn
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send(e as unknown as React.FormEvent);
              }
            }}
            rows={2}
            placeholder={canAsk ? 'Ask the room one question' : 'Add context or a correction. The agents read it on their next turn.'}
            className="flex-1 resize-none rounded-md border border-line bg-sheet px-3 py-2 outline-none focus:border-ink"
            maxLength={2000}
          />
          <button type="submit" disabled={sending || !text.trim()} className={`rounded-md px-3.5 py-2.5 text-sm font-semibold ${canAsk ? 'bg-red text-paper' : 'bg-ink text-paper'} disabled:opacity-50`}>
            {canAsk ? 'Ask' : 'Note'}
          </button>
        </div>
        {err && <div className="mt-1.5 text-xs text-red">{err}</div>}
        <div className="mt-1.5 text-xs text-muted">
          {p.members.filter(m => m.online).map(m => m.name).join(', ') || 'Nobody else here yet'}
        </div>
      </form>
    </div>
  );
}
