import { useEffect, useRef, useState } from 'react';
import { useReducer, useSpacetimeDB, useTable } from 'spacetimedb/react';
import { reducers, tables } from '../module_bindings';
import { navigate } from '../App';
import { rememberName, savedName } from '../lib/stdb';
import { nameFromProfile } from '../lib/auth';
import SignIn, { useOptionalAuth } from '../components/AuthBits';
import { useAutosize } from '../lib/autosize';

const DEMO_ROOM = ((import.meta.env.VITE_DEMO_ROOM as string | undefined) ?? '').toUpperCase();

const CAST = [
  { name: 'Claude', role: 'lead', does: 'writes the first answer and every revision', bg: 'bg-red', text: 'text-red' },
  { name: 'Perplexity', role: 'challenger', does: 'attacks it and checks the facts on the web', bg: 'bg-teal', text: 'text-teal' },
  { name: 'GPT-5.2', role: 'challenger', does: 'attacks it from a second angle', bg: 'bg-slate', text: 'text-slate' },
  { name: 'Gemini', role: 'referee', does: 'rules on every fix, took no side', bg: 'bg-warn', text: 'text-warn' },
];

const ROUNDS = [
  ['First answer', 'Claude answers alone. The challengers draft their own, blind.'],
  ['Objections', 'Each challenger quotes the exact claim it disputes and says what would fix it.'],
  ['Fact check', 'Checkable claims are searched. Each stands or falls, with the source.'],
  ['Revision', 'Claude changes only what it can justify: an objection, a source, or your note.'],
  ['Ruling', 'Gemini accepts or rejects each fix. What survives is the decision.'],
];

export default function Home() {
  const { identity, isActive } = useSpacetimeDB();
  const openRoom = useReducer(reducers.openRoom);
  const joinRoom = useReducer(reducers.joinRoom);

  const auth = useOptionalAuth();
  const [name, setName] = useState(() => savedName() || nameFromProfile(auth?.user?.profile));
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
    <main className="mx-auto max-w-3xl px-5 pb-20 pt-8 sm:pt-12">
      <div className="mb-10 flex items-center gap-2">
        <span className="inline-block h-3 w-3 rounded-full bg-red" aria-hidden />
        <span className="text-sm font-semibold tracking-wide">Redflow</span>
        <SignIn className="ml-auto" />
      </div>

      <header>
        <h1 className="font-display text-[2.4rem] leading-[1.06] tracking-tight sm:text-[3.4rem]" style={{ textWrap: 'balance' }}>
          Four AI models fight over your question. Your team steps in. Live.
        </h1>
        <p className="mt-4 max-w-[60ch] text-[17px] leading-relaxed text-ink-2">
          Ask once. Claude answers, Perplexity and GPT-5.2 attack the answer, the facts get checked on the web, and Gemini rules on every fix. Type at any moment and the models read it on their next move. Two to three minutes to a decision you can defend.
        </p>
      </header>

      <form onSubmit={onOpen} className="mt-8 rounded-2xl border border-line bg-sheet p-4 sm:p-5">
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
            placeholder="A decision, a plan, a claim you want stress-tested. One or two sentences, with the numbers you have."
            className="w-full resize-none rounded-xl border border-line bg-paper px-3 py-3 text-lg leading-snug outline-none focus:border-ink"
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
              className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 outline-none focus:border-ink"
              maxLength={32}
              autoComplete="nickname"
            />
          </label>
          <button type="submit" disabled={busy !== null || !isActive} className="rounded-xl bg-red px-5 py-2.5 font-semibold text-paper disabled:opacity-50 sm:min-w-44">
            {busy === 'open' ? 'Opening the room' : 'Ask the room'}
          </button>
        </div>
        <p className="mt-2 text-xs text-muted">A room opens around your question with a four-letter code. Share it and your team is in with just a name. No account, no password.</p>
      </form>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <form onSubmit={onJoin} className="flex flex-1 items-end gap-2 rounded-2xl border border-line-2 px-4 py-3">
          <label className="flex-1">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Have a room code?</span>
            <input
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="7K2P"
              className="w-full rounded-xl border border-line bg-sheet px-3 py-2 font-mono tracking-[0.3em] uppercase outline-none focus:border-ink"
              maxLength={8}
              autoCapitalize="characters"
            />
          </label>
          <button type="submit" disabled={busy !== null || !isActive} className="rounded-xl border border-ink px-4 py-2 font-semibold disabled:opacity-50">
            {busy === 'join' ? 'Joining' : 'Join'}
          </button>
        </form>
        {DEMO_ROOM && (
          <button onClick={() => navigate(`/r/${DEMO_ROOM}`)} className="flex flex-col items-start justify-center rounded-2xl border border-line-2 bg-sheet px-4 py-3 text-left hover:border-ink sm:w-64">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">Watch a live room first</span>
            <span className="mt-1 text-sm text-ink-2">
              The room we are running today, code <span className="font-mono font-semibold tracking-[0.15em] text-ink">{DEMO_ROOM}</span>. Read the bouts, or start one.
            </span>
          </button>
        )}
      </div>

      {error && <p className="mt-3 rounded-xl bg-red-soft px-3 py-2 text-sm text-red">{error}</p>}

      <section className="mt-14">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Who is in the room</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-4">
          {CAST.map(c => (
            <li key={c.name} className="flex items-start gap-2.5">
              <span className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-paper ${c.bg}`} aria-hidden>
                {c.name.charAt(0)}
              </span>
              <div className="min-w-0">
                <div className={`text-[15px] font-semibold ${c.text}`}>
                  {c.name} <span className="text-xs font-normal text-muted">{c.role}</span>
                </div>
                <div className="text-[13.5px] leading-snug text-ink-2">{c.does}</div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">How a bout runs</h2>
        <ol className="mt-3 grid gap-4 sm:grid-cols-5">
          {ROUNDS.map(([title, body], i) => (
            <li key={title}>
              <div className="font-fight text-[13px] tracking-wider text-muted">Round {i + 1}</div>
              <div className="mt-0.5 text-[15px] font-semibold">{title}</div>
              <div className="mt-1 text-[13.5px] leading-snug text-ink-2">{body}</div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-12 grid gap-5 text-[14.5px] leading-relaxed text-ink-2 sm:grid-cols-3">
        <div>
          <div className="mb-1 font-semibold text-ink">Four labs, not one model in four hats</div>
          Models from different labs disagree in useful ways. Same model, different prompts, agrees with itself.
        </div>
        <div>
          <div className="mb-1 font-semibold text-ink">Facts are checked, not asserted</div>
          Every checkable claim goes to the web and comes back confirmed or disproved, with the page that owns the fact.
        </div>
        <div>
          <div className="mb-1 font-semibold text-ink">Nothing changes without a reason</div>
          Every edit to the answer cites an objection, a source, or a teammate by name. Uncaused edits are refused. Anything still disputed stays on the page as an open risk.
        </div>
      </section>

      <footer className="mt-16 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span>Built in 24 hours at Midnight Moonshot, Bengaluru, on SpacetimeDB.</span>
        <a href="https://github.com/Aryan2193/redflow" target="_blank" rel="noreferrer" className="underline">
          Source on GitHub
        </a>
      </footer>
    </main>
  );
}
