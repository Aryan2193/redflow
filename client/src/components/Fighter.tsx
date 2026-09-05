import { useEffect, useState } from 'react';
import type { Tone } from '../lib/labels';

// What a fighter is doing this instant. `moment` is a short burst layered on the base state.
export type FighterState = 'idle' | 'working';
export type Moment = 'hit' | 'strike' | 'shield' | 'cheer' | 'stagger' | null;

const FILL: Record<Tone, string> = { red: 'var(--color-red)', teal: 'var(--color-teal)', slate: 'var(--color-slate)', ink: 'var(--color-ink)' };

// A small human figure drawn in the model's color. Every pose is CSS on a handful of shapes, so it costs nothing and
// respects reduced motion. Facing: left-corner fighters face right, right-corner fighters face left.
export default function Fighter(props: { tone: Tone; name: string; state: FighterState; moment: Moment; facing: 'left' | 'right'; line: string; size?: number }) {
  const { tone, name, state, moment, facing, line, size = 84 } = props;
  const [said, setSaid] = useState(false);
  useEffect(() => {
    if (!said) return;
    const t = setTimeout(() => setSaid(false), 3200);
    return () => clearTimeout(t);
  }, [said]);
  const fill = FILL[tone];
  const flip = facing === 'left' ? 'scale(-1, 1)' : 'none';
  const cls = ['fig', `fig-${state}`, moment ? `fig-${moment}` : '', facing === 'left' ? 'fig-faces-left' : 'fig-faces-right'].filter(Boolean).join(' ');
  return (
    <button
      type="button"
      onClick={() => setSaid(v => !v)}
      className={`relative inline-flex shrink-0 flex-col items-center focus:outline-none ${cls}`}
      style={{ width: size, height: size * 1.15 }}
      aria-label={`${name}: ${line}`}
      title={`${name}. Tap to hear what it is doing.`}
    >
      {(said || moment === 'hit' || moment === 'strike') && (
        <span className={`fig-bubble absolute -top-1 z-10 w-max max-w-[180px] rounded-xl border border-line bg-sheet px-2.5 py-1.5 text-left text-[12px] leading-snug text-ink shadow-md ${facing === 'left' ? 'right-[70%]' : 'left-[70%]'}`}>
          {moment === 'hit' ? 'Ouch.' : moment === 'strike' ? 'Take that.' : line}
        </span>
      )}
      <svg viewBox="0 0 64 74" width={size} height={size * 1.15} style={{ transform: flip, color: fill }} aria-hidden>
        {/* shadow */}
        <ellipse cx="32" cy="70" rx="14" ry="3" fill="rgba(0,0,0,0.12)" />
        {/* legs */}
        <g className="fig-legs">
          <rect x="24" y="48" width="7" height="20" rx="3.5" fill="var(--color-ink)" />
          <rect x="33" y="48" width="7" height="20" rx="3.5" fill="var(--color-ink)" />
        </g>
        {/* body */}
        <g className="fig-body">
          <rect x="19" y="26" width="26" height="26" rx="8" fill="currentColor" />
          {/* far arm */}
          <g className="fig-arm fig-arm-far" style={{ transformOrigin: '22px 30px' }}>
            <rect x="14" y="28" width="7" height="18" rx="3.5" fill="currentColor" opacity="0.85" />
            <circle cx="17.5" cy="47" r="4" fill="var(--color-paper)" stroke="currentColor" strokeWidth="1.5" />
          </g>
          {/* near arm */}
          <g className="fig-arm fig-arm-near" style={{ transformOrigin: '42px 30px' }}>
            <rect x="42" y="28" width="7" height="18" rx="3.5" fill="currentColor" />
            <circle cx="45.5" cy="47" r="4" fill="var(--color-paper)" stroke="currentColor" strokeWidth="1.5" />
          </g>
          {/* head */}
          <g className="fig-head" style={{ transformOrigin: '32px 24px' }}>
            <circle cx="32" cy="15" r="11" fill="var(--color-paper)" stroke="currentColor" strokeWidth="2" />
            <path d="M21 13 Q32 2 43 13" fill="currentColor" />
            <circle className="fig-eye" cx="28" cy="16" r="1.4" fill="var(--color-ink)" />
            <circle className="fig-eye" cx="36" cy="16" r="1.4" fill="var(--color-ink)" />
            <path className="fig-mouth" d="M29 21 Q32 23 35 21" stroke="var(--color-ink)" strokeWidth="1.2" fill="none" />
          </g>
        </g>
      </svg>
      <span className="font-fight mt-0.5 text-[12px] leading-none tracking-wider" style={{ color: fill }}>
        {name}
      </span>
    </button>
  );
}
