import { useEffect, useRef, useState } from 'react';
import { useReducer } from 'spacetimedb/react';
import { reducers } from '../module_bindings';
import type { Question, Room } from '../module_bindings/types';
import { useAutosize } from '../lib/autosize';

type Props = {
  room: Room;
  question?: Question;
  queued: number;
  // Asking a new question is opened from the header; the composer itself only steps in.
  asking: boolean;
  onAskingChange: (v: boolean) => void;
  onSent: () => void;
};

export default function Composer(p: Props) {
  const ask = useReducer(reducers.ask);
  const postNote = useReducer(reducers.postNote);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [hint, setHint] = useState('');
  const [sending, setSending] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  useAutosize(taRef, text, 200);

  const q = p.question;
  const busy = !!q && q.state !== 'settled' && q.state !== 'failed';
  const asking = !q || p.asking;
  useEffect(() => {
    if (p.asking) taRef.current?.focus();
  }, [p.asking]);

  async function send(e: React.SyntheticEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setErr('');
    setHint('');
    setSending(true);
    try {
      if (asking) {
        await ask({ roomId: p.room.id, text: body });
        p.onAskingChange(false);
      } else {
        await postNote({ roomId: p.room.id, text: body, teamQuestionId: 0n });
        if (q && !busy) setHint('Saved. Press Go deeper on the decision to make the room use it, or ask a new question from the top right.');
      }
      setText('');
      p.onSent();
    } catch (e2) {
      setErr(String((e2 as Error)?.message ?? e2));
    } finally {
      setSending(false);
    }
  }

  const placeholder = asking ? (q ? 'Ask the room a new question.' : 'Ask one question. A decision, a plan, a claim to stress-test.') : busy ? 'Step in. A fact, a constraint, a correction. The models read it on their next turn.' : 'Step in with a note for the next round.';

  return (
    <form onSubmit={send} className="shrink-0 border-t border-line bg-paper px-4 pb-[max(env(safe-area-inset-bottom),10px)] pt-2.5 sm:px-8">
      <div className="mx-auto max-w-[900px]">
        <div className={`flex items-end gap-2 rounded-2xl border bg-sheet px-3 py-2 focus-within:border-ink ${asking && q ? 'border-red' : 'border-line'}`}>
          {asking && q && <span className="mb-1.5 shrink-0 rounded-full bg-red-soft px-2 py-0.5 text-[11px] font-semibold text-red">New question</span>}
          <textarea
            ref={taRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send(e);
              }
              if (e.key === 'Escape' && p.asking) p.onAskingChange(false);
            }}
            rows={1}
            placeholder={placeholder}
            className="flex-1 resize-none bg-transparent py-1 text-[15px] outline-none placeholder:text-muted"
            maxLength={2000}
            aria-label={asking ? 'Ask a new question' : 'Step in'}
          />
          {asking && q && (
            <button type="button" onClick={() => p.onAskingChange(false)} className="mb-1 shrink-0 text-xs text-muted underline">
              Cancel
            </button>
          )}
          <button type="submit" disabled={sending || !text.trim()} className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold text-paper disabled:opacity-40 ${asking ? 'bg-red' : 'bg-ink'}`}>
            {asking ? 'Ask' : 'Step in'}
          </button>
        </div>
        {(err || hint || p.queued > 0) && (
          <div className="mt-1.5 flex gap-3 text-xs">
            {err && <span className="text-red">{err}</span>}
            {hint && !err && <span className="text-warn">{hint}</span>}
            {p.queued > 0 && !err && (
              <span className="text-muted">
                {p.queued} note{p.queued === 1 ? '' : 's'} waiting for the next turn
              </span>
            )}
          </div>
        )}
      </div>
    </form>
  );
}
