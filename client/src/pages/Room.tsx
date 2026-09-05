import { useEffect, useMemo, useRef, useState } from 'react';
import { useReducer, useSpacetimeDB, useTable } from 'spacetimedb/react';
import { reducers, tables } from '../module_bindings';
import type { Question, TeamQuestion } from '../module_bindings/types';
import { idHex, rememberName, savedName, toDate } from '../lib/stdb';
import Arena from '../components/Arena';
import Composer from '../components/Composer';
import RoundBar from '../components/RoundBar';
import { navigate } from '../App';

export default function Room({ code }: { code: string }) {
  const { identity, isActive } = useSpacetimeDB();
  const joinRoom = useReducer(reducers.joinRoom);

  const [rooms, roomsReady] = useTable(tables.room.where(r => r.code.eq(code)));
  const room = rooms[0];
  const roomId = room?.id ?? 0n;
  const enabled = !!room;

  const [members] = useTable(tables.member.where(r => r.roomId.eq(roomId)), { enabled });
  const [questions] = useTable(tables.question.where(r => r.roomId.eq(roomId)), { enabled });
  const [notes] = useTable(tables.note.where(r => r.roomId.eq(roomId)), { enabled });
  const [teamQs] = useTable(tables.teamQuestion.where(r => r.roomId.eq(roomId)), { enabled });
  const [slots] = useTable(tables.modelSlot);

  const ordered = useMemo(() => [...questions].sort((a, b) => Number(a.id - b.id)), [questions]);
  const latest: Question | undefined = ordered[ordered.length - 1];
  const [viewQid, setViewQid] = useState<bigint | null>(null);
  const latestId = latest?.id ?? 0n;
  useEffect(() => {
    setViewQid(null);
  }, [latestId]);
  const question: Question | undefined = (viewQid !== null ? ordered.find(x => x.id === viewQid) : undefined) ?? latest;
  const qid = question?.id ?? 0n;
  const qEnabled = !!question;

  const [paragraphs] = useTable(tables.paragraph.where(r => r.questionId.eq(qid)), { enabled: qEnabled });
  const [objections] = useTable(tables.objection.where(r => r.questionId.eq(qid)), { enabled: qEnabled });
  const [evidence] = useTable(tables.evidence.where(r => r.questionId.eq(qid)), { enabled: qEnabled });
  const [drafts] = useTable(tables.draft.where(r => r.questionId.eq(qid)), { enabled: qEnabled });
  const [statuses] = useTable(tables.agentStatus.where(r => r.questionId.eq(qid)), { enabled: qEnabled });
  const [versions] = useTable(tables.answerVersion.where(r => r.questionId.eq(qid)), { enabled: qEnabled });

  const me = idHex(identity);
  const myMember = members.find(m => idHex(m.identity) === me);
  const [name, setName] = useState(savedName());
  const [joinError, setJoinError] = useState('');
  const triedAutoJoin = useRef(false);

  useEffect(() => {
    if (!room || !identity || !isActive) return;
    if (myMember && myMember.online) return;
    const n = myMember?.name || savedName();
    if (!n || triedAutoJoin.current) return;
    triedAutoJoin.current = true;
    joinRoom({ code, name: n }).catch(err => setJoinError(String((err as Error)?.message ?? err)));
  }, [room, identity, isActive, myMember, code, joinRoom]);

  const [copied, setCopied] = useState(false);
  const [explain, setExplain] = useState(false);
  const [replyTo, setReplyTo] = useState<TeamQuestion | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  const table = useMemo(() => {
    const order = ['council_a', 'council_b', 'council_c'];
    return [...slots].filter(s => s.slot.startsWith('council') && s.enabled).sort((a, b) => order.indexOf(a.slot) - order.indexOf(b.slot));
  }, [slots]);

  if (isActive && roomsReady && !room) {
    return (
      <main className="mx-auto max-w-md px-5 pt-24 text-center">
        <p className="font-display text-2xl">No room with the code {code}.</p>
        <button onClick={() => navigate('/')} className="mt-6 rounded-md bg-ink px-4 py-2 font-semibold text-paper">
          Back to the start
        </button>
      </main>
    );
  }
  if (!room) return <main className="px-5 pt-24 text-center text-muted">Opening the room.</main>;

  if (!myMember) {
    return (
      <main className="mx-auto max-w-md px-5 pt-20">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Room {room.code}</p>
        <h1 className="font-display mt-1 text-3xl leading-tight">{room.title}</h1>
        {room.brief && <p className="mt-2 text-ink-2">{room.brief}</p>}
        <form
          onSubmit={async e => {
            e.preventDefault();
            if (!name.trim()) return;
            rememberName(name.trim());
            try {
              await joinRoom({ code, name: name.trim() });
            } catch (err) {
              setJoinError(String((err as Error)?.message ?? err));
            }
          }}
          className="mt-8"
        >
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Your name</label>
          <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="How the room should call you" className="w-full rounded-md border border-line bg-sheet px-3 py-3 text-lg outline-none focus:border-ink" maxLength={32} />
          <button type="submit" disabled={!isActive} className="mt-3 w-full rounded-md bg-ink px-4 py-3 font-semibold text-paper disabled:opacity-50">
            Step in
          </button>
          {joinError && <p className="mt-3 text-sm text-red">{joinError}</p>}
          <p className="mt-6 text-sm text-muted">
            No account. Your name is remembered on this device. {members.length} {members.length === 1 ? 'person is' : 'people are'} already here.
          </p>
        </form>
      </main>
    );
  }

  const online = members.filter(m => m.online);
  const openTeamQs = question ? teamQs.filter(t => t.questionId === question.id && !t.answeredAt) : [];
  const queued = question ? notes.filter(n => n.questionId === question.id && n.consumedStep === '' && n.teamQuestionId === 0n).length : 0;
  const openRisks = objections.filter(o => o.status === 'unresolved').length;
  const justJoined = now - toDate(myMember.joinedAt).getTime() < 120_000;
  const lead = table[0]?.label ?? 'The lead';

  return (
    <div className="flex h-dvh flex-col">
      <header className="shrink-0 border-b border-line bg-paper">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2 sm:px-5">
          <button onClick={() => navigate('/')} className="flex shrink-0 items-center gap-2" aria-label="Redflow home">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-red" aria-hidden />
            <span className="text-sm font-semibold">Redflow</span>
          </button>
          <div className="min-w-0 flex-1 truncate text-sm text-ink-2">{room.title}</div>
          {ordered.length > 1 && (
            <select
              value={(question?.id ?? 0n).toString()}
              onChange={e => {
                const id = BigInt(e.target.value);
                setViewQid(id === latestId ? null : id);
              }}
              className="order-last min-w-0 basis-full rounded-md border border-line bg-sheet px-2 py-1 text-xs text-ink sm:order-none sm:max-w-xs sm:basis-auto"
              aria-label="Which bout to show"
            >
              {ordered.map((x, i) => (
                <option key={x.id.toString()} value={x.id.toString()}>
                  Bout {i + 1}: {x.text.slice(0, 48)}
                  {x.text.length > 48 ? '...' : ''}
                </option>
              ))}
            </select>
          )}
          <span className="hidden whitespace-nowrap text-xs text-muted sm:inline">
            {online.length} here{online.length !== members.length ? `, ${members.length} joined` : ''}
          </span>
          <button onClick={() => setExplain(v => !v)} className="shrink-0 whitespace-nowrap rounded-full border border-line px-2 py-0.5 text-xs text-ink-2" aria-label="How this works">
            {explain ? 'Close' : <><span className="sm:hidden">How</span><span className="hidden sm:inline">How this works</span></>}
          </button>
          <button
            onClick={() => {
              navigator.clipboard
                ?.writeText(window.location.href)
                .then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1800);
                })
                .catch(() => {});
            }}
            className="shrink-0 rounded-md border border-line bg-sheet px-2.5 py-1 font-mono text-sm tracking-[0.2em]"
            title="Copy the room link"
          >
            {copied ? <span className="font-sans tracking-normal text-ok">Link copied</span> : room.code}
          </button>
        </div>
        {explain && (
          <div className="border-t border-line-2 bg-sheet">
            <div className="mx-auto max-w-[1400px] px-3 py-3 text-sm text-ink-2 sm:px-5">
              <ol className="list-decimal space-y-1 pl-5">
                <li>You ask one question. Round one: {lead} writes the best full answer it can, alone. {table.slice(1).map(s => s.label).join(' and ')} write their own blind.</li>
                <li>Round two: the challengers attack {lead}'s answer on substance. Every hit quotes the exact claim and says what would fix it.</li>
                <li>Round three: disputed facts are checked on the web. A claim stands or is refuted, with the source.</li>
                <li>Round four: {lead} comes back. Every change cites a hit, a source, or your message, or the system refuses it. Round five: the fixes are ruled on. What survives is the decision.</li>
              </ol>
              <p className="mt-2">Type at any time. Your message is read on the next turn, and any section it changes carries your name.</p>
            </div>
          </div>
        )}
        {question && (
          <div className="border-t border-line-2 py-1.5">
            <RoundBar question={question} openRisks={openRisks} />
          </div>
        )}
      </header>

      {justJoined && (
        <p className="shrink-0 py-1 text-center text-xs text-muted">
          Welcome, {myMember.name}. {question ? `This is the bout behind the answer. ${lead} defends, the others attack. Type below to step in.` : 'Ask the room one question below.'}
        </p>
      )}

      {question ? (
        <Arena
          room={room}
          question={question}
          notes={notes.filter(n => n.questionId === question.id || n.questionId === 0n)}
          teamQs={teamQs.filter(t => t.questionId === question.id)}
          drafts={drafts}
          objections={objections}
          evidence={evidence}
          paragraphs={paragraphs}
          versions={versions}
          statuses={statuses}
          slots={slots}
          now={now}
          myName={myMember.name}
          onReply={setReplyTo}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center px-5 text-center">
          <div className="max-w-md">
            <p className="font-display text-2xl leading-tight">This room is waiting for its first question.</p>
            <p className="mt-2 text-sm text-muted">Keep it concrete: a decision, a plan, a claim you want stress-tested.</p>
          </div>
        </div>
      )}

      <Composer room={room} question={latest} openTeamQs={openTeamQs} queued={queued} slots={slots} replyTo={replyTo} onReplyTo={setReplyTo} onSent={() => setViewQid(null)} />
    </div>
  );
}
