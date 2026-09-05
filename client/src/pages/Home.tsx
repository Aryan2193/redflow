import { useEffect, useRef, useState } from 'react';
import { useReducer, useSpacetimeDB, useTable } from 'spacetimedb/react';
import { reducers, tables } from '../module_bindings';
import { navigate } from '../App';
import { rememberName, rememberPendingEmail, savedName } from '../lib/stdb';
import { useAutosize } from '../lib/autosize';

const DEMO_ROOM = ((import.meta.env.VITE_DEMO_ROOM as string | undefined) ?? '').toUpperCase();

export default function Home() {
  const { identity, isActive } = useSpacetimeDB();
  const openRoom = useReducer(reducers.openRoom);
  const joinRoom = useReducer(reducers.joinRoom);

  const [name, setName] = useState(savedName());
  const [email, setEmail] = useState('');
  const [question, setQuestion] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'open' | 'join' | null>(null);
  const [error, setError] = useState('');
  const qRef = useRef<HTMLTextAreaElement>(null);
  useAutosize(qRef, question, 260);

  // Rooms I created, so we can jump into the new one as soon as it exists.
  const myRoomsQuery = identity ? tables.room.where(r => r.createdBy.eq(identity)) : tables.room.where(r => r.id.eq(0n));
  const [myRooms] = useTable(myRoomsQuery, { enabled: !!identity });
  const waitingSince = useRef<bigint | null>(null);

  useEffect(() => {
    if (waitingSince.current === null) return;
    const newest = myRooms.reduce<bigint>((m, r) => (r.id > m ? r.id : m), 0n);
    if (newest > waitingSince.current) {
      const r = myRooms.find(x => x.id === newest)!;
      waitingSince.current = null;
      setBusy(null);
      navigate(`/r/${r.code}`);
    }
  }, [myRooms]);

  async function onOpen(e: React.SyntheticEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim()) return setError('Add your name so the room knows who is speaking.');
    if (question.trim().length < 8) return setError('Ask a fuller question. One or two sentences is right.');
    rememberName(name.trim());
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('That does not look like an email. Leave it empty or fix it.');
    rememberPendingEmail(email.trim());
    setBusy('open');
    waitingSince.current = myRooms.reduce<bigint>((m, r) => (r.id > m ? r.id : m), 0n);
    try {
      await openRoom({ name: name.trim(), question: question.trim() });
    } catch (err) {
      waitingSince.current = null;
      setBusy(null);
      setError(String((err as Error)?.message ?? err));
    }
  }

  async function onJoin(e: React.SyntheticEvent) {
    e.preventDefault();
    setError('');
    const c = code.trim().toUpperCase();
    if (!name.trim()) return setError('Add your name so the room knows who is speaking.');
    if (c.length < 4) return setError('Room codes are four characters.');
    rememberName(name.trim());
    rememberPendingEmail(email.trim());
    setBusy('join');
    try {
      await joinRoom({ code: c, name: name.trim() });
      navigate(`/r/${c}`);
    } catch (err) {
      setError(String((err as Error)?.message ?? err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-5 pb-16 pt-12 sm:pt-16">
      <header className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full bg-red" aria-hidden />
          <span className="text-sm font-semibold tracking-wide">Redflow</span>
        </div>
        <h1 className="font-display text-4xl leading-[1.08] tracking-tight sm:text-5xl" style={{ textWrap: 'balance' }}>
          Several AI models argue over your question. Your team argues back. Live.
        </h1>
      </header>

      <form onSubmit={onOpen} className="rounded-lg border border-line bg-sheet p-4 sm:p-5">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Your question</span>
          <textarea
            ref={qRef}
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void onOpen(e);
              }
            }}
            rows={2}
            placeholder="A decision, a plan, a claim you want stress-tested. One or two sentences."
            className="w-full resize-none rounded-md border border-line bg-paper px-3 py-3 text-lg leading-snug outline-none focus:border-ink"
            maxLength={2000}
          />
        </label>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="flex-1">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Your name</span>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="How the room should call you"
              className="w-full rounded-md border border-line bg-paper px-3 py-2.5 outline-none focus:border-ink"
              maxLength={32}
              autoComplete="nickname"
            />
          </label>
          <label className="flex-1">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Email, optional</span>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="We send your room link"
              className="w-full rounded-md border border-line bg-paper px-3 py-2.5 outline-none focus:border-ink"
              maxLength={120}
              autoComplete="email"
            />
          </label>
          <button
            type="submit"
            disabled={busy !== null || !isActive}
            className="rounded-md bg-red px-5 py-2.5 font-semibold text-paper disabled:opacity-50 sm:min-w-44"
          >
            {busy === 'open' ? 'Opening the room' : 'Ask the room'}
          </button>
        </div>
        <p className="mt-2 text-xs text-muted">
          A room opens around your question. Three models answer blind, then argue. Share the room link so your team can steer.
        </p>
      </form>

      <form onSubmit={onJoin} className="mt-4 flex items-end gap-2 rounded-lg border border-line-2 px-4 py-3">
        <label className="flex-1">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Have a room code?</span>
          <input
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder="7K2P"
            className="w-full rounded-md border border-line bg-sheet px-3 py-2 font-mono tracking-[0.3em] uppercase outline-none focus:border-ink"
            maxLength={8}
            autoCapitalize="characters"
          />
        </label>
        <button type="submit" disabled={busy !== null || !isActive} className="rounded-md border border-ink px-4 py-2 font-semibold disabled:opacity-50">
          {busy === 'join' ? 'Joining' : 'Join'}
        </button>
      </form>

      {error && <p className="mt-3 rounded-md bg-red-soft px-3 py-2 text-sm text-red">{error}</p>}

      {DEMO_ROOM && (
        <p className="mt-4 text-sm text-ink-2">
          Want to watch first? Step into the room we are running tonight:{' '}
          <button onClick={() => navigate(`/r/${DEMO_ROOM}`)} className="font-mono font-semibold tracking-[0.15em] text-ink underline">
            {DEMO_ROOM}
          </button>
        </p>
      )}

      <section className="mt-12 grid gap-4 text-sm text-ink-2 sm:grid-cols-3">
        <div>
          <div className="mb-1 font-semibold text-ink">1. Ask one question</div>
          Three models from three labs answer it blind. Nobody sees anyone else's draft.
        </div>
        <div>
          <div className="mb-1 font-semibold text-ink">2. Watch the ledger</div>
          They attack each other's claims. Checkable ones go to the web. A chair rebuilds the answer, one cited edit at a time.
        </div>
        <div>
          <div className="mb-1 font-semibold text-ink">3. Argue back</div>
          Drop a correction any time. The agents absorb it on their next turn. Every paragraph shows how hard it was fought.
        </div>
      </section>

      <footer className="mt-14 text-xs text-muted">Built in 24 hours at Midnight Moonshot, Bengaluru, on SpacetimeDB.</footer>
    </main>
  );
}
