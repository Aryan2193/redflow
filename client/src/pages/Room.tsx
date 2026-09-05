import { useEffect, useMemo, useRef, useState } from 'react';
import { useReducer, useSpacetimeDB, useTable } from 'spacetimedb/react';
import { reducers, tables } from '../module_bindings';
import type { ModelSlot, Note, Question, Room as RoomRow, TeamQuestion } from '../module_bindings/types';
import { idHex, rememberName, savedName, toDate } from '../lib/stdb';
import { narrative, slotColor } from '../lib/labels';
import Thread from '../components/Thread';
import Composer from '../components/Composer';
import { navigate } from '../App';

const ACTIVE = new Set(['reading', 'drafting', 'critiquing', 'checking', 'synthesizing', 'verifying', 'dissenting']);

// An earlier question in the room: subscribes to its own rows and renders folded to its verdict.
function PastThread(p: { room: RoomRow; question: Question; notes: readonly Note[]; teamQs: readonly TeamQuestion[]; slots: readonly ModelSlot[]; now: number; myName: string }) {
  const qid = p.question.id;
  const [paragraphs] = useTable(tables.paragraph.where(r => r.questionId.eq(qid)));
  const [objections] = useTable(tables.objection.where(r => r.questionId.eq(qid)));
  const [evidence] = useTable(tables.evidence.where(r => r.questionId.eq(qid)));
  const [drafts] = useTable(tables.draft.where(r => r.questionId.eq(qid)));
  const [versions] = useTable(tables.answerVersion.where(r => r.questionId.eq(qid)));
  return (
    <Thread
      room={p.room}
      question={p.question}
      notes={p.notes.filter(n => n.questionId === qid)}
      teamQs={p.teamQs.filter(t => t.questionId === qid)}
      drafts={drafts}
      objections={objections}
      evidence={evidence}
      paragraphs={paragraphs}
      versions={versions}
      statuses={[]}
      slots={p.slots}
      now={p.now}
      myName={p.myName}
      collapsed
    />
  );
}

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
  const question: Question | undefined = ordered[ordered.length - 1];
  const past = ordered.slice(0, -1);
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

  // Follow the conversation only when the reader is already at the bottom, or just sent something.
  const listRef = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const forceScroll = useRef(false);
  const activeCount = statuses.filter(s => ACTIVE.has(s.state)).length;
  const signature = `${questions.length}|${notes.length}|${teamQs.length}|${drafts.length}|${objections.length}|${evidence.length}|${versions.length}|${activeCount}|${question?.state ?? ''}|${paragraphs.length}`;
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (nearBottom.current || forceScroll.current) {
      el.scrollTop = el.scrollHeight;
      forceScroll.current = false;
    }
  }, [signature]);

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
        <div className="mx-auto flex max-w-[760px] items-center gap-3 px-3 py-2.5 sm:px-4">
          <button onClick={() => navigate('/')} className="flex items-center gap-2" aria-label="Redflow home">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-red" aria-hidden />
            <span className="text-sm font-semibold">Redflow</span>
          </button>
          <div className="min-w-0 flex-1 truncate text-sm text-ink-2">{room.title}</div>
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
            className="rounded-md border border-line bg-sheet px-2.5 py-1 font-mono text-sm tracking-[0.2em]"
            title="Copy the room link"
          >
            {copied ? <span className="font-sans tracking-normal text-ok">Link copied</span> : room.code}
          </button>
        </div>
        <div className="mx-auto flex max-w-[760px] items-center gap-3 overflow-x-auto px-3 pb-2 text-xs text-muted sm:px-4">
          <span className="whitespace-nowrap">
            {online.length} here{online.length !== members.length ? `, ${members.length} joined` : ''}
          </span>
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            {table.map((s, i) => (
              <span key={s.slot} className="inline-flex items-center gap-1">
                {i > 0 && <span className="mr-0.5 text-muted/70">vs</span>}
                <span className={`inline-block h-2 w-2 rounded-full ${slotColor(s.slot)}`} aria-hidden />
                {s.label}
              </span>
            ))}
          </span>
          {question && <span className="hidden truncate sm:inline">· {narrative(question, statuses, slots, openRisks)}</span>}
          <button onClick={() => setExplain(v => !v)} className="ml-auto whitespace-nowrap rounded-full border border-line px-2 py-0.5 text-ink-2">
            {explain ? 'Close' : 'How this works'}
          </button>
        </div>
        {explain && (
          <div className="border-t border-line-2 bg-sheet">
            <div className="mx-auto max-w-[760px] px-3 py-3 text-sm text-ink-2 sm:px-4">
              <ol className="list-decimal space-y-1 pl-5">
                <li>You ask one question. {lead} writes the best full answer it can, alone. That is version one, on screen in under a minute.</li>
                <li>{table.slice(1).map(s => s.label).join(' and ')} write their own answer blind, then attack {lead}'s on substance. Every objection quotes the exact claim and says what would fix it.</li>
                <li>Disputed facts are checked on the web. Then {lead} revises. Every change cites an objection, a source, or your message, or the system refuses it.</li>
                <li>A critic rules on whether each fix holds. What survives is the room's answer. Anything still standing shows as an open risk.</li>
              </ol>
              <p className="mt-2">Type at any time. Your message is read on the next turn, and any section it changes carries your name.</p>
            </div>
          </div>
        )}
      </header>

      <div
        ref={listRef}
        onScroll={e => {
          const el = e.currentTarget;
          nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
        }}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        <div className="mx-auto max-w-[760px] space-y-6 px-3 pb-6 pt-4 sm:px-4">
          {justJoined && (
            <p className="text-center text-xs text-muted">
              Welcome, {myMember.name}. {question ? 'This is the argument behind the answer. Type below to steer it.' : 'Ask the room one question below.'}
            </p>
          )}
          {past.map(pq => (
            <PastThread key={pq.id.toString()} room={room} question={pq} notes={notes} teamQs={teamQs} slots={slots} now={now} myName={myMember.name} />
          ))}
          {question ? (
            <Thread
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
            <div className="mx-auto max-w-md pt-16 text-center">
              <p className="font-display text-2xl leading-tight">This room is waiting for its first question.</p>
              <p className="mt-2 text-sm text-muted">Keep it concrete: a decision, a plan, a claim you want stress-tested.</p>
            </div>
          )}
        </div>
      </div>

      <Composer
        room={room}
        question={question}
        openTeamQs={openTeamQs}
        queued={queued}
        slots={slots}
        replyTo={replyTo}
        onReplyTo={setReplyTo}
        onSent={() => {
          forceScroll.current = true;
          nearBottom.current = true;
        }}
      />
    </div>
  );
}
