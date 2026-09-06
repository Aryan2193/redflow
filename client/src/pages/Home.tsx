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
  { name: 'Claude', role: 'writes and defends', does: 'Writes the full answer alone, then rewrites only what fell. Every changed line names the objection, the source, or the teammate behind it.', bg: 'bg-red', text: 'text-red' },
  { name: 'Perplexity', role: 'attacks and checks', does: 'Quotes the exact line it disputes and says what would fix it. Then takes every checkable claim to the web and links the page that owns the fact.', bg: 'bg-teal', text: 'text-teal' },
  { name: 'GPT-5.2', role: 'attacks from the other side', does: 'A second, independent attack. When the room agrees too easily, it is made to argue the opposite case so agreement has to be earned.', bg: 'bg-slate', text: 'text-slate' },
  { name: 'Gemini', role: 'rules', does: 'Never wrote a word of the answer and never attacked it. Accepts or rejects each fix. Whatever it lets through becomes the decision.', bg: 'bg-warn', text: 'text-warn' },
];

const ROUNDS = [
  ['First answer', 'Claude answers in full, alone. Perplexity and GPT write their own without seeing it, so nobody copies anybody.'],
  ['Objections', 'Each challenger quotes the exact line it disputes, says why it is wrong, and gives the fix. Vague disagreement is thrown out.'],
  ['Fact check', 'Every checkable claim is searched on the live web. It comes back confirmed or disproved, with the page linked.'],
  ['Revision', 'Claude rewrites what fell and defends what stood. An edit with no objection, source, or teammate behind it is refused.'],
  ['Ruling', 'Gemini accepts or rejects each fix. What is still disputed stays on the page as an open risk instead of quietly disappearing.'],
];

// Real questions teams have put to the public room. Tap one and it is in the box.
const EXAMPLES = [
  'We run a small design studio with six people. A client wants a 40 percent discount for a 12-month retainer. Should we take it, counter, or walk away? Our utilisation is about 70 percent and we have two months of cash.',
  'Our two-founder startup has 40 paying teams at 999 rupees a month. Should we raise a 2 crore angel round now at a 15 crore valuation, or bootstrap six more months and raise on better numbers? 14 months of runway either way.',
  'Should our first hire be a full-stack engineer or a customer success person? We ship weekly, churn is about 6 percent a month, and support takes 2 hours a day of founder time.',
];
const EXAMPLE_SHORT = ['Take the 40 percent discount?', 'Raise now or bootstrap?', 'Engineer or customer success first?'];

const VERSUS: [string, string][] = [
  ['One model agrees with itself, and is wrong together.', 'Four models from four labs. They disagree in the places that matter.'],
  ['States facts. You check them, or you do not.', 'Every checkable claim goes to the web and comes back confirmed or disproved, page linked.'],
  ['Rewrites the answer and you never see what changed.', 'Every edit names its cause. Edits without a cause are refused by the system.'],
  ['One person, one chat window.', 'Your whole team in one room from any phone. A four-letter code, a name, no password.'],
  ['You read the output when it is done.', 'You watch every move as it happens and step in mid-fight. Your note is read on the very next turn.'],
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
        <p className="font-fight text-[13px] uppercase tracking-[0.18em] text-red">Decisions that survived a fight</p>
        <h1 className="font-display mt-2 text-[2.4rem] leading-[1.06] tracking-tight sm:text-[3.4rem]" style={{ textWrap: 'balance' }}>
          One AI gives you an answer. Four fighting over it give you a decision.
        </h1>
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
            placeholder="A decision you have to make, a plan to pressure-test, or a claim you suspect. Include the numbers you have."
            className="w-full resize-none rounded-xl border border-line bg-paper px-3 py-3 text-lg leading-snug outline-none focus:border-ink"
            maxLength={2000}
          />
        </label>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="py-1 text-xs text-muted">Try one:</span>
          {EXAMPLES.map((ex, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setQuestion(ex);
                qRef.current?.focus();
              }}
              className="max-w-full truncate rounded-full border border-line-2 bg-paper px-2.5 py-1 text-left text-xs text-ink-2 hover:border-ink"
              title={ex}
            >
              {EXAMPLE_SHORT[i]}
            </button>
          ))}
        </div>
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
            {busy === 'open' ? 'Opening the room' : 'Start the fight'}
          </button>
        </div>
        <p className="mt-2 text-xs text-muted">Your question opens a room with a four-letter code. Send the code to your team. They are in with just a name, from any phone, and everything they type reaches the models on their next move.</p>
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
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">Watch a real one first</span>
            <span className="mt-1 text-sm text-ink-2">
              Public room <span className="font-mono font-semibold tracking-[0.15em] text-ink">{DEMO_ROOM}</span>. Twelve bouts already fought, every move on record. Or ask it something yourself.
            </span>
          </button>
        )}
      </div>

      {error && <p className="mt-3 rounded-xl bg-red-soft px-3 py-2 text-sm text-red">{error}</p>}

      <section className="mt-14 rounded-2xl border border-line bg-sheet p-5 sm:p-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">What came out of one bout, unedited</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
          A six-person design studio asked whether to take a 40 percent discount for a 12-month retainer. Utilisation 70 percent, two months of cash. Six minutes and 44 seconds later, version 3 of the answer read:
        </p>
        <p className="font-display mt-3 text-[1.55rem] leading-tight text-ink">Counter, cap the deal size, don't lock 12 months upfront.</p>
        <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">
          Offer 15 to 20 percent off card rate, capped at 25 percent of team capacity with one named person, two months of fees in escrow before signing, a 3-month initial term with renewal. Walk away if they will not shrink below 35 percent of revenue or will not escrow.
        </p>
        <ul className="mt-3 space-y-1.5 text-[13.5px] leading-snug text-ink-2">
          <li><span className="rounded bg-red-soft px-1.5 py-0.5 font-semibold text-red">Perplexity objected</span> and 40 percent became acceptable only if the scope shrinks to match.</li>
          <li><span className="rounded bg-teal-soft px-1.5 py-0.5 font-semibold text-teal">A fact check</span> against a published margin source made the incremental-only assumption explicit.</li>
          <li><span className="rounded bg-warn-soft px-1.5 py-0.5 font-semibold text-warn">Gemini ruled</span> on each fix. The first draft's 12-month lock did not survive.</li>
        </ul>
        <p className="mt-3 text-xs text-muted">Bout 12 in the public room. Open it and read every move.</p>
      </section>

      <section className="mt-14">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Who is in the room</h2>
        <ul className="mt-3 grid gap-4 sm:grid-cols-2">
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
        <p className="mt-3 text-[13.5px] text-ink-2">If a teammate's note or new context arrives late, the room does not decide. It runs one more pass first. Nothing you typed is ever left unread.</p>
      </section>

      <section className="mt-12">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Why not just ask one model</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-[14px] leading-snug">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-muted">
                <th className="w-1/2 pb-2 pr-4 font-semibold">One model, one chat</th>
                <th className="w-1/2 pb-2 font-semibold text-red">Redflow</th>
              </tr>
            </thead>
            <tbody>
              {VERSUS.map(([a, b]) => (
                <tr key={a} className="border-t border-line-2 align-top">
                  <td className="py-2.5 pr-4 text-muted">{a}</td>
                  <td className="py-2.5 text-ink">{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">While it runs, you are in the room too</h2>
        <ul className="mt-3 grid gap-4 text-[14.5px] leading-relaxed text-ink-2 sm:grid-cols-3">
          <li>
            <div className="mb-1 font-semibold text-ink">Step in</div>
            Know something the models do not? Type it. It is read on the very next move, and the line it changes carries your name.
          </li>
          <li>
            <div className="mb-1 font-semibold text-ink">Add context once</div>
            Paste the background, the numbers, the constraints. Every model reads it on every move, for every question the room ever asks.
          </li>
          <li>
            <div className="mb-1 font-semibold text-ink">Watch every move</div>
            Each search, each page opened, each objection and ruling appears the second it happens. Nothing hides behind a spinner.
          </li>
        </ul>
      </section>

      <section className="mt-12 rounded-2xl border border-line-2 p-5 text-[14.5px] leading-relaxed text-ink-2">
        <div className="mb-1 font-semibold text-ink">Built for the moment before you commit</div>
        Pricing a deal, picking a vendor, choosing the first hire, taking the round or not. Any question where being confidently wrong is expensive and one person's judgment is not enough. The founders, the studio, the product team, all in one room, on whatever they have in their hands.
      </section>

      <footer className="mt-16 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span>Built in 24 hours at Midnight Moonshot, Bengaluru. The whole fight runs inside a SpacetimeDB module. The browser only shows it, so everyone in the room sees the same move at the same instant.</span>
        <a href="https://github.com/Aryan2193/redflow" target="_blank" rel="noreferrer" className="underline">
          Source on GitHub
        </a>
      </footer>
    </main>
  );
}
