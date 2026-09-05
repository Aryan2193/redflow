import { useEffect, useRef, useState } from 'react';

// True for an item that arrived moments ago, decided once when the component mounts. Old items render in full.
export function useLive(at: number, windowMs = 8000): boolean {
  const live = useRef<boolean | null>(null);
  if (live.current === null) live.current = Date.now() - at < windowMs;
  return live.current;
}

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Reveals text at reading-plus speed so a fresh message reads as if it is being written. About 70 characters a
// second, never longer than twelve seconds, instant for old items and for readers who asked for less motion.
export function useReveal(text: string, live: boolean): { shown: string; done: boolean } {
  const [n, setN] = useState(live && !reduced() ? 0 : text.length);
  useEffect(() => {
    if (!live || reduced()) {
      setN(text.length);
      return;
    }
    const total = text.length;
    const duration = Math.min(12000, Math.max(1200, (total / 70) * 1000));
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / duration);
      // Ease out slightly so the end does not snap.
      const eased = 1 - Math.pow(1 - k, 1.6);
      setN(Math.floor(total * eased));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, live]);
  const shown = text.slice(0, n);
  return { shown, done: n >= text.length };
}

export function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false));
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}
