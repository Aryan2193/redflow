import { useEffect, useState } from 'react';
import type { AgentEvent, AgentStatus, ModelSlot } from '../module_bindings/types';
import { ACTIVE_STATES } from '../lib/bout';
import { TONE_BG, TONE_TEXT, speakerFor } from '../lib/labels';
import { microStep } from '../lib/narrate';
import { toDate } from '../lib/stdb';

type Line = { key: string; kind: string; text: string; url?: string; at: number };

const KIND_CLS: Record<string, string> = {
  read: 'text-muted',
  search: 'text-teal',
  open: 'text-teal',
  write: 'text-ink',
};

// One model, present in its corner: who it is, what it is doing this second, and the last few real moves it made
// (searches, pages opened, reads, writes) straight from the server. Sits right under the cards, where the model is.
export default function Presence({ slot, slots, events, statuses, align = 'left', max = 3 }: { slot: string; slots: readonly ModelSlot[]; events: readonly AgentEvent[]; statuses: readonly AgentStatus[]; align?: 'left' | 'right'; max?: number }) {
  const sp = speakerFor(slot, slots);
  // The lead also acts as "chair" when it revises; both are the same model in the same corner.
  const mine = (s: string) => s === slot || (slot === 'council_a' && s === 'chair');
  const status = statuses.find(s => mine(s.slot) && ACTIVE_STATES.has(s.state));
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!status) return;
    const t = setInterval(() => setNow(Date.now()), 800);
    return () => clearInterval(t);
  }, [status]);

  const real: Line[] = events
    .filter(e => mine(e.slot))
    .map(e => ({ key: 'e' + e.id, kind: e.kind, text: e.detail, url: e.url || undefined, at: toDate(e.createdAt).getTime() }))
    .sort((a, b) => b.at - a.at);
  const shown = real.slice(0, max);
  const right = align === 'right';
  const nowLine = status ? microStep(status.state, status.slot, now - toDate(status.updatedAt).getTime()) : real[0] ? real[0].text : 'waiting';

  return (
    <div className={`activity px-1 pt-1 text-[12px] leading-4 ${right ? 'text-right' : ''}`} aria-live="polite">
      <div className={`flex items-center gap-2 ${right ? 'flex-row-reverse' : ''}`}>
        <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-paper ${TONE_BG[sp.tone]}`} aria-hidden>
          {sp.name.charAt(0)}
        </span>
        <span className={`font-semibold ${TONE_TEXT[sp.tone]}`}>{sp.name}</span>
        {status ? (
          <span className={`inline-flex items-center gap-1.5 text-ink ${right ? 'flex-row-reverse' : ''}`}>
            <span className="pulse inline-block h-1.5 w-1.5 rounded-full bg-red" aria-hidden />
            <span>{nowLine}</span>
          </span>
        ) : (
          <span className="text-muted">{nowLine}</span>
        )}
      </div>
      {shown.length > 0 && (
        <ol className={`mt-1 space-y-0.5 ${right ? 'pr-8' : 'pl-8'}`}>
          {shown.map(l => {
            const fresh = now - l.at < 2500;
            return (
              <li key={l.key} className={`flex items-baseline gap-1.5 ${right ? 'flex-row-reverse' : ''} ${fresh ? 'enter-c' : ''}`}>
                <span className={`font-mono text-[10px] uppercase tracking-wider ${KIND_CLS[l.kind] ?? 'text-muted'}`}>{l.kind}</span>
                {l.url ? (
                  <a href={l.url} target="_blank" rel="noreferrer" className="min-w-0 truncate text-ink-2 underline decoration-line">
                    {l.text}
                  </a>
                ) : (
                  <span className="min-w-0 truncate text-ink-2">{l.text}</span>
                )}
              </li>
            );
          })}
          {real.length > max && <li className="text-[10px] uppercase tracking-wider text-muted">{real.length} moves so far</li>}
        </ol>
      )}
    </div>
  );
}
