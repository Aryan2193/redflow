import type { ReactNode } from 'react';

export type StampTone = 'ok' | 'red' | 'warn' | 'judg' | 'ink';

// A rubber stamp: the fight's way of saying what just happened to a claim.
export default function Stamp({ tone, live, small, children, className = '' }: { tone: StampTone; live?: boolean; small?: boolean; children: ReactNode; className?: string }) {
  return (
    <span className={`stamp stamp-${tone} ${small ? 'stamp-sm' : ''} ${live ? 'stamp-in' : ''} ${className}`} role="status">
      {children}
    </span>
  );
}
