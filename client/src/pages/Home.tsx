import { useEffect, useRef, useState } from 'react';
import { useReducer, useSpacetimeDB, useTable } from 'spacetimedb/react';
import { reducers, tables } from '../module_bindings';
import { navigate } from '../App';
import { rememberName, savedName } from '../lib/stdb';

export default function Home() {
  const { identity, isActive } = useSpacetimeDB();
  const createRoom = useReducer(reducers.createRoom);
  const joinRoom = useReducer(reducers.joinRoom);

  const [name, setName] = useState(savedName());
  const [title, setTitle] = useState('');
  const [brief, setBrief] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [error, setError] = useState('');

  // Rooms I created, so we can jump into the new one as soon as it exists.
  // The filter is only meaningful once we know who we are; before that, subscribe to nothing.
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

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim()) return setError('Add your name so the room knows who is speaking.');
    if (!title.trim()) return setError('Give the room a title. What is it deciding?');
    rememberName(name.trim());
    setBusy('create');
    waitingSince.current = myRooms.reduce<bigint>((m, r) => (r.id > m ? r.id : m), 0n);
    try {
      await createRoom({ title: title.trim(), brief: brief.trim(), name: name.trim() });
    } catch (err) {
      waitingSince.current = null;
      setBusy(null);
      setError(String((err as Error)?.message ?? err));
    }
  }

  async function onJoin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const c = code.trim().toUpperCase();
    if (!name.trim()) return setError('Add your name so the room knows who is speaking.');
    if (c.length < 4) return setError('Room codes are four characters.');
    rememberName(name.trim());
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
    <main className="mx-auto max-w-3xl px-5 pb-16 pt-14 sm:pt-20">
      <header className="mb-10">
        <div className="mb-3 flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full bg-red" aria-hidden />
          <span className="text-sm font-semibold tracking-wide">Redflow</span>
        </div>
        <h1 className="font-display text-4xl leading-[1.08] tracking-tight sm:text-5xl" style={{ textWrap: 'balance' }}>
          Several AI models argue over your team's question. Your team argues back. Live.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-ink-2">
          Ask once. Three models answer blind, attack each other's drafts, check the facts, and a chair rebuilds the answer one justified edit at a time. Anyone on your team can steer mid-debate.
        </p>
      </header>

      <label className="mb-6 block max-w-sm">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Your name</span>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="How the room should call you"
          className="w-full rounded-md border border-line bg-sheet px-3 py-2.5 outline-none focus:border-ink"
          maxLength={32}
          autoComplete="nickname"
        />
      </label>

      <div className="grid gap-5 sm:grid-cols-5">
        <form onSubmit={onCreate} className="rounded-lg border border-line bg-sheet p-5 sm:col-span-3">
          <h2 className="text-base font-semibold">Open a room</h2>
          <p className="mb-4 mt-1 text-sm text-muted">One decision per room. Your team joins by link or code.</p>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="What is this room deciding?"
            className="mb-3 w-full rounded-md border border-line bg-paper px-3 py-2.5 outline-none focus:border-ink"
            maxLength={120}
          />
          <textarea
            value={brief}
            onChange={e => setBrief(e.target.value)}
            placeholder="Two lines of context and any hard constraints. The models read this first."
            rows={3}
            className="mb-4 w-full resize-none rounded-md border border-line bg-paper px-3 py-2.5 outline-none focus:border-ink"
            maxLength={600}
          />
          <button
            type="submit"
            disabled={busy !== null || !isActive}
            className="w-full rounded-md bg-ink px-4 py-2.5 font-semibold text-paper disabled:opacity-50"
          >
            {busy === 'create' ? 'Opening the room' : 'Open the room'}
          </button>
        </form>

        <form onSubmit={onJoin} className="rounded-lg border border-line bg-sheet p-5 sm:col-span-2">
          <h2 className="text-base font-semibold">Join with a code</h2>
          <p className="mb-4 mt-1 text-sm text-muted">Four characters, from whoever opened the room.</p>
          <input
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder="7K2P"
            className="mb-4 w-full rounded-md border border-line bg-paper px-3 py-2.5 font-mono text-lg tracking-[0.3em] uppercase outline-none focus:border-ink"
            maxLength={8}
            autoCapitalize="characters"
          />
          <button
            type="submit"
            disabled={busy !== null || !isActive}
            className="w-full rounded-md border border-ink px-4 py-2.5 font-semibold disabled:opacity-50"
          >
            {busy === 'join' ? 'Joining' : 'Join'}
          </button>
        </form>
      </div>

      {error && <p className="mt-4 rounded-md bg-red-soft px-3 py-2 text-sm text-red">{error}</p>}

      <section className="mt-12 grid gap-4 text-sm text-ink-2 sm:grid-cols-3">
        <div>
          <div className="mb-1 font-semibold text-ink">1. Ask one question</div>
          Three different models answer it blind. Nobody sees anyone else's draft.
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

      <footer className="mt-16 text-xs text-muted">Built in 24 hours at Midnight Moonshot, Bengaluru, on SpacetimeDB.</footer>
    </main>
  );
}
