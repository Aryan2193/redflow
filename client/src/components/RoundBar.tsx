import { useEffect, useState } from 'react';
import type { Question } from '../module_bindings/types';
import { ROUNDS, roundIndex } from '../lib/bout';
import { toDate } from '../lib/stdb';

function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export default function RoundBar({ question: q, openRisks }: { question: Question; openRisks: number }) {
  const idx = roundIndex(q);
  const decided = idx >= 5;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (decided) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [decided]);
  const end = q.settledAt ? toDate(q.settledAt).getTime() : now;
  const elapsed = end - toDate(q.createdAt).getTime();
  const current = ROUNDS[Math.min(idx, 4)];

  return (
    <div className="mx-auto flex w-full max-w-[1400px] items-center gap-3 px-3 sm:px-5">
      <ol className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2" aria-label="Rounds">
        {ROUNDS.map((r, i) => {
          const done = i < idx;
          const active = i === idx && !decided;
          return (
            <li key={r.key} className={`flex min-w-0 items-center gap-1.5 ${i < ROUNDS.length - 1 ? 'flex-1' : ''}`}>
              <span
                className={`font-fight shrink-0 rounded-sm px-1.5 py-0.5 text-[13px] leading-none tracking-wider sm:text-[14px] ${
                  active ? 'bg-ink text-paper' : done || decided ? 'text-ink' : 'text-muted/60'
                }`}
              >
                <span className="sm:hidden">{r.short}</span>
                <span className="hidden sm:inline">{r.label}</span>
              </span>
              {i < ROUNDS.length - 1 && <span className={`h-px flex-1 ${done || decided ? 'bg-ink/50' : 'bg-line'}`} aria-hidden />}
            </li>
          );
        })}
      </ol>
      <div className="flex shrink-0 items-center gap-2 font-mono text-[13px] tabular-nums text-ink-2">
        {!decided && <span className="pulse inline-block h-1.5 w-1.5 rounded-full bg-red" aria-hidden />}
        <span className="sr-only">{decided ? 'Decided after' : `Round ${idx + 1}, ${current.label}, `}</span>
        <span>{clock(elapsed)}</span>
        {decided && <span className={`font-fight text-[13px] tracking-wider ${openRisks ? 'text-warn' : 'text-ok'}`}>{q.state === 'failed' ? 'Stopped' : openRisks ? `Decided, ${openRisks} open` : 'Decided'}</span>}
      </div>
    </div>
  );
}
