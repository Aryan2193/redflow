import { useEffect, useRef, useState } from 'react';
import { useReducer } from 'spacetimedb/react';
import { reducers } from '../module_bindings';
import type { Question, Room } from '../module_bindings/types';
import { useAutosize } from '../lib/autosize';
import { useMediaQuery } from '../lib/reveal';

type Props = {
  room: Room;
  question?: Question;
  queued: number;
  // Asking a new question is opened from the header; the composer itself only steps in.
  asking: boolean;
  onAskingChange: (v: boolean) => void;
  // The context box can be opened from the header on a phone, or from the button beside the prompt on desktop.
  contextOpen: boolean;
  onContextOpenChange: (v: boolean) => void;
  onSent: () => void;
};

export default function Composer(p: Props) {
  const ask = useReducer(reducers.ask);
  const postNote = useReducer(reducers.postNote);
  const addContext = useReducer(reducers.addContext);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [hint, setHint] = useState('');
  const [sending, setSending] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  useAutosize(taRef, text, 200);

  // Standing context for the whole room, written in a bigger box.
  const ctxOpen = p.contextOpen;
  const setCtxOpen = p.onContextOpenChange;
  const [ctxText, setCtxText] = useState('');
  const wide = useMediaQuery('(min-width: 768px)');
  const [ctxBusy, setCtxBusy] = useState(false);
  const ctxRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (ctxOpen) ctxRef.current?.focus();
  }, [ctxOpen]);

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

  async function saveContext() {
    const body = ctxText.trim();
    if (!body) return;
    setErr('');
    setCtxBusy(true);
    try {
      await addContext({ roomId: p.room.id, text: body });
      setCtxText('');
      setCtxOpen(false);
      setHint('Context saved. Every model reads it from its next move, on this question and every one after.');
    } catch (e2) {
      setErr(String((e2 as Error)?.message ?? e2));
    } finally {
      setCtxBusy(false);
    }
  }

  const placeholder = !wide
    ? asking
      ? 'Ask a new question'
      : 'Step in with a fact or a correction'
    : asking
      ? q
        ? 'Ask the room a new question.'
        : 'Ask one question. A decision, a plan, a claim to stress-test.'
      : busy
        ? 'Step in. A fact, a constraint, a correction. The models read it on their next turn.'
        : 'Step in with a note for the next round.';

  return (
    <form onSubmit={send} className="shrink-0 border-t border-line bg-paper px-4 pb-[max(env(safe-area-inset-bottom),10px)] pt-2.5 sm:px-8">
      <div className="mx-auto max-w-[980px]">
        {ctxOpen && (
          <div className="mb-2 rounded-2xl border border-line bg-sheet px-4 py-3">
            <div className="flex items-baseline gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Add context for the whole room</span>
              <span className="text-xs text-muted">Background, numbers, constraints, links. Paste as much as you like. It stays with the room and every model reads it on every turn.</span>
            </div>
            <textarea
              ref={ctxRef}
              value={ctxText}
              onChange={e => setCtxText(e.target.value)}
              rows={6}
              placeholder="For example: we are a two-founder team in Bengaluru, 40 paying teams at 999 a month, 14 months of runway, shipping weekly. Our pricing page: ..."
              className="mt-2 w-full resize-y rounded-xl border border-line bg-paper px-3 py-2 text-[14px] leading-relaxed outline-none focus:border-ink"
              maxLength={4000}
            />
            <div className="mt-2 flex items-center gap-2">
              <button type="button" onClick={saveContext} disabled={ctxBusy || ctxText.trim().length < 3} className="rounded-full bg-ink px-3.5 py-1.5 text-[13px] font-semibold text-paper disabled:opacity-40">
                {ctxBusy ? 'Saving' : 'Save context'}
              </button>
              <button type="button" onClick={() => setCtxOpen(false)} className="text-xs text-muted underline">
                Cancel
              </button>
              <span className="ml-auto text-xs text-muted">{ctxText.length} / 4000</span>
            </div>
          </div>
        )}
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => setCtxOpen(!ctxOpen)}
            className={`mb-0.5 hidden shrink-0 rounded-2xl border px-3 py-2.5 text-[13px] font-semibold md:inline-flex ${ctxOpen ? 'border-ink bg-ink text-paper' : 'border-line bg-sheet text-ink-2 hover:border-ink'}`}
            title="Give every model background it should know for this whole room"
          >
            Add context
          </button>
          <div className={`flex min-w-0 flex-1 items-end gap-2 rounded-2xl border bg-sheet px-3 py-1.5 focus-within:border-ink md:py-2 ${asking && q ? 'border-red' : 'border-line'}`}>
            {asking && q && <span className="mb-1.5 hidden shrink-0 rounded-full bg-red-soft px-2 py-0.5 text-[11px] font-semibold text-red md:inline">New question</span>}
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
            <button type="submit" disabled={sending || !text.trim()} className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold text-paper disabled:opacity-40 ${asking ? 'bg-red' : 'bg-ink'}`}>
              {asking ? 'Ask' : wide ? 'Step in' : 'Send'}
            </button>
          </div>
        </div>
        {(err || hint || p.queued > 0) && (
          <div className="mt-1.5 flex gap-3 text-xs">
            {err && <span className="text-red">{err}</span>}
            {hint && !err && <span className="text-ok">{hint}</span>}
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
