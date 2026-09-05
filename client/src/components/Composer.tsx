import { useEffect, useRef, useState } from 'react';
import { useReducer } from 'spacetimedb/react';
import { reducers } from '../module_bindings';
import type { ModelSlot, Question, Room, TeamQuestion } from '../module_bindings/types';
import { useAutosize } from '../lib/autosize';

type Props = {
  room: Room;
  question?: Question;
  openTeamQs: readonly TeamQuestion[];
  queued: number;
  slots: readonly ModelSlot[];
  replyTo: TeamQuestion | null;
  onReplyTo: (t: TeamQuestion | null) => void;
  onSent: () => void;
};

export default function Composer(p: Props) {
  const ask = useReducer(reducers.ask);
  const postNote = useReducer(reducers.postNote);
  const wrapUp = useReducer(reducers.wrapUp);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [hint, setHint] = useState('');
  const [sending, setSending] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  useAutosize(taRef, text, 200);

  const q = p.question;
  const busy = !!q && q.state !== 'settled' && q.state !== 'failed';
  const defaultMode: 'ask' | 'note' = !q || !busy ? 'ask' : 'note';
  const [mode, setMode] = useState<'ask' | 'note'>(defaultMode);
  const modeKey = `${q?.id ?? 0}-${busy}`;
  useEffect(() => {
    setMode(!q || !busy ? 'ask' : 'note');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modeKey]);
  useEffect(() => {
    if (p.replyTo) taRef.current?.focus();
  }, [p.replyTo]);

  const lead = p.slots.find(s => s.slot === 'council_a')?.label ?? 'The lead';
  const asking = !p.replyTo && mode === 'ask';

  async function send(e: React.SyntheticEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setErr('');
    setHint('');
    setSending(true);
    try {
      if (p.replyTo) {
        await postNote({ roomId: p.room.id, text: body, teamQuestionId: p.replyTo.id });
        p.onReplyTo(null);
      } else if (asking) {
        await ask({ roomId: p.room.id, text: body });
      } else {
        await postNote({ roomId: p.room.id, text: body, teamQuestionId: 0n });
        if (q && !busy) setHint('Saved. Press Go deeper on the answer to make the room use it, or switch to a new question.');
      }
      setText('');
      p.onSent();
    } catch (e2) {
      setErr(String((e2 as Error)?.message ?? e2));
    } finally {
      setSending(false);
    }
  }

  const pill = (active: boolean, extra = '') => `rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors ${active ? 'border-ink bg-ink text-paper' : 'border-line bg-sheet text-ink-2 hover:border-ink'} ${extra}`;

  const placeholder = p.replyTo
    ? 'Your answer. The models read it on their next turn.'
    : asking
      ? q
        ? 'Ask the room a new question.'
        : 'Ask one question. A decision, a plan, a claim to stress-test.'
      : busy
        ? 'Steer the debate. Add a fact, a constraint, or a correction.'
        : 'Add a note for the next round.';

  return (
    <form onSubmit={send} className="shrink-0 border-t border-line bg-paper px-3 pb-[max(env(safe-area-inset-bottom),10px)] pt-2 sm:px-4">
      <div className="mx-auto max-w-[760px]">
        {p.replyTo ? (
          <div className="mb-1.5 flex items-center gap-2 text-xs text-ink-2">
            <span className="rounded-full bg-warn-soft px-2.5 py-0.5 font-semibold text-warn">Replying to {lead}</span>
            <span className="min-w-0 flex-1 truncate italic">“{p.replyTo.text}”</span>
            <button type="button" onClick={() => p.onReplyTo(null)} className="shrink-0 underline">
              Cancel
            </button>
          </div>
        ) : (
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
            {q && (
              <button type="button" onClick={() => setMode('note')} className={pill(mode === 'note')}>
                Steer the debate
              </button>
            )}
            <button type="button" onClick={() => setMode('ask')} disabled={busy} title={busy ? 'One question at a time. Wrap this one up first.' : ''} className={pill(mode === 'ask', 'disabled:cursor-not-allowed disabled:opacity-40')}>
              {q ? 'New question' : 'Your question'}
            </button>
            {p.openTeamQs.map(t => (
              <button key={t.id.toString()} type="button" onClick={() => p.onReplyTo(t)} className="max-w-[60%] truncate rounded-full border border-warn bg-warn-soft px-2.5 py-0.5 text-xs font-semibold text-warn">
                Reply to {lead}: “{t.text}”
              </button>
            ))}
            {p.queued > 0 && !p.replyTo && (
              <span>
                {p.queued} note{p.queued === 1 ? '' : 's'} waiting for the next turn
              </span>
            )}
            {busy && q && (
              <button type="button" onClick={() => wrapUp({ questionId: q.id }).catch(e => setErr(String((e as Error)?.message ?? e)))} className="ml-auto underline">
                Wrap it up now
              </button>
            )}
          </div>
        )}
        <div className="flex items-end gap-2 rounded-2xl border border-line bg-sheet px-3 py-2 focus-within:border-ink">
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
            placeholder={placeholder}
            className="flex-1 resize-none bg-transparent py-1 text-[15px] outline-none placeholder:text-muted"
            maxLength={2000}
            aria-label="Message the room"
          />
          <button type="submit" disabled={sending || !text.trim()} className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold text-paper disabled:opacity-40 ${asking ? 'bg-red' : 'bg-ink'}`}>
            {p.replyTo ? 'Reply' : asking ? 'Ask' : 'Send'}
          </button>
        </div>
        {err && <div className="mt-1.5 text-xs text-red">{err}</div>}
        {hint && !err && <div className="mt-1.5 text-xs text-warn">{hint}</div>}
      </div>
    </form>
  );
}
