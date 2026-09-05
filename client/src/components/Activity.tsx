import { useEffect, useState } from 'react';
import type { AgentEvent, AgentStatus } from '../module_bindings/types';
import { ACTIVE_STATES } from '../lib/bout';
import { microStep } from '../lib/narrate';
import { toDate } from '../lib/stdb';

type Line = { key: string; kind: string; text: string; url?: string; at: number; live?: boolean };

const KIND_TAG: Record<string, string> = { read: 'read', search: 'search', open: 'open', write: 'write', now: 'now' };
const KIND_CLS: Record<string, string> = {
  read: 'text-muted',
  search: 'text-teal',
  open: 'text-teal',
  write: 'text-ink',
  now: 'text-red',
};

// The agents' hands, visible: every real search, page and write from the server, plus the step they are on right now.
export default function Activity({ slots, events, statuses, align = 'left', max = 4 }: { slots: readonly string[]; events: readonly AgentEvent[]; statuses: readonly AgentStatus[]; align?: 'left' | 'right'; max?: number }) {
  const [now, setNow] = useState(Date.now());
  const busy = statuses.some(s => slots.includes(s.slot) && ACTIVE_STATES.has(s.state));
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setNow(Date.now()), 800);
    return () => clearInterval(t);
  }, [busy]);

  const lines: Line[] = [];
  for (const s of statuses) {
    if (!slots.includes(s.slot) || !ACTIVE_STATES.has(s.state)) continue;
    const elapsed = now - toDate(s.updatedAt).getTime();
    lines.push({ key: 'now' + s.slot, kind: 'now', text: microStep(s.state, s.slot, elapsed), at: now, live: true });
  }
  const real = events
    .filter(e => slots.includes(e.slot))
    .map(e => ({ key: 'e' + e.id, kind: e.kind, text: e.detail, url: e.url || undefined, at: toDate(e.createdAt).getTime() }))
    .sort((a, b) => b.at - a.at)
    .slice(0, Math.max(1, max - lines.length));
  lines.push(...real);
  if (!lines.length) return null;

  const total = events.filter(e => slots.includes(e.slot)).length;
  return (
    <ol className={`activity space-y-0.5 px-1 pb-1.5 text-[12px] leading-4 ${align === 'right' ? 'text-right' : ''}`} aria-live="polite" aria-label="Activity">
      {lines.map(l => {
        const fresh = now - l.at < 2500 && !l.live;
        return (
          <li key={l.key} className={`flex items-baseline gap-1.5 ${align === 'right' ? 'flex-row-reverse' : ''} ${fresh ? 'enter-c' : ''}`}>
            <span className={`font-mono text-[10px] uppercase tracking-wider ${KIND_CLS[l.kind] ?? 'text-muted'}`}>
              {l.live && <span className="pulse mr-1 inline-block h-1.5 w-1.5 rounded-full bg-red align-middle" aria-hidden />}
              {KIND_TAG[l.kind] ?? l.kind}
            </span>
            {l.url ? (
              <a href={l.url} target="_blank" rel="noreferrer" className="min-w-0 truncate text-ink-2 underline decoration-line">
                {l.text}
              </a>
            ) : (
              <span className={`min-w-0 truncate ${l.live ? 'text-ink' : 'text-ink-2'}`}>{l.text}</span>
            )}
          </li>
        );
      })}
      {total > max && <li className={`text-[10px] uppercase tracking-wider text-muted ${align === 'right' ? 'text-right' : ''}`}>{total} actions so far</li>}
    </ol>
  );
}
