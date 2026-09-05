import { useEffect, useMemo, useRef, useState } from 'react';
import { useReducer, useSpacetimeDB, useTable } from 'spacetimedb/react';
import { reducers, tables } from '../module_bindings';
import type { Question } from '../module_bindings/types';
import { idHex, rememberName, savedName } from '../lib/stdb';
import Answer from '../components/Answer';
import Stream from '../components/Stream';
import { navigate } from '../App';

const SLOT_ORDER = ['council_a', 'council_b', 'council_c', 'checker', 'chair'];

export default function Room({ code }: { code: string }) {
  const { identity, isActive } = useSpacetimeDB();
  const joinRoom = useReducer(reducers.joinRoom);

  const [rooms, roomsReady] = useTable(tables.room.where(r => r.code.eq(code)));
  const room = rooms[0];
  const roomId = room?.id ?? 0n;
  const enabled = !!room;

  const [members] = useTable(tables.member.where(r => r.roomId.eq(roomId)), { enabled });
  const [questions, questionsLoaded] = useTable(tables.question.where(r => r.roomId.eq(roomId)), { enabled });
  const [notes] = useTable(tables.note.where(r => r.roomId.eq(roomId)), { enabled });
  const [slots] = useTable(tables.modelSlot);

  const question: Question | undefined = useMemo(
    () => questions.reduce<Question | undefined>((best, q) => (!best || q.id > best.id ? q : best), undefined),
    [questions]
  );
  const qid = question?.id ?? 0n;
  const qEnabled = !!question;

  const [paragraphs] = useTable(tables.paragraph.where(r => r.questionId.eq(qid)), { enabled: qEnabled });
  const [objections] = useTable(tables.objection.where(r => r.questionId.eq(qid)), { enabled: qEnabled });
  const [evidence] = useTable(tables.evidence.where(r => r.questionId.eq(qid)), { enabled: qEnabled });
  const [drafts] = useTable(tables.draft.where(r => r.questionId.eq(qid)), { enabled: qEnabled });
  const [teamQs] = useTable(tables.teamQuestion.where(r => r.questionId.eq(qid)), { enabled: qEnabled });
  const [statuses] = useTable(tables.agentStatus.where(r => r.questionId.eq(qid)), { enabled: qEnabled });
  const [versions] = useTable(tables.answerVersion.where(r => r.questionId.eq(qid)), { enabled: qEnabled });

  const me = idHex(identity);
  const myMember = members.find(m => idHex(m.identity) === me);
  const [name, setName] = useState(savedName());
  const [joinError, setJoinError] = useState('');
  const triedAutoJoin = useRef(false);

  // Returning visitor with a remembered name walks straight in. A member who reloaded is marked present again.
  useEffect(() => {
    if (!room || !identity || !isActive) return;
    if (myMember && myMember.online) return;
    const n = myMember?.name || savedName();
    if (!n || triedAutoJoin.current) return;
    triedAutoJoin.current = true;
    joinRoom({ code, name: n }).catch(err => setJoinError(String((err as Error)?.message ?? err)));
  }, [room, identity, isActive, myMember, code, joinRoom]);

  const [tab, setTab] = useState<'answer' | 'room'>('answer');
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(Date.now());
  // A room with no question yet opens on the composer, so a first-time visitor sees what to do.
  const steeredOnce = useRef(false);
  useEffect(() => {
    if (steeredOnce.current || !enabled || !questionsLoaded) return;
    steeredOnce.current = true;
    if (questions.length === 0) setTab('room');
  }, [enabled, questionsLoaded, questions.length]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const orderedSlots = useMemo(
    () => [...slots].sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot)),
    [slots]
  );

  if (roomsReady && !room) {
    return (
      <main className="mx-auto max-w-md px-5 pt-24 text-center">
        <p className="font-display text-2xl">No room with the code {code}.</p>
        <button onClick={() => navigate('/')} className="mt-6 rounded-md bg-ink px-4 py-2 font-semibold text-paper">
          Back to the start
        </button>
      </main>
    );
  }

  if (!room) {
    return <main className="px-5 pt-24 text-center text-muted">Opening the room.</main>;
  }

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
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="How the room should call you"
            className="w-full rounded-md border border-line bg-sheet px-3 py-3 text-lg outline-none focus:border-ink"
            maxLength={32}
          />
          <button type="submit" disabled={!isActive} className="mt-3 w-full rounded-md bg-ink px-4 py-3 font-semibold text-paper disabled:opacity-50">
            Step in
          </button>
          {joinError && <p className="mt-3 text-sm text-red">{joinError}</p>}
          <p className="mt-6 text-sm text-muted">No account. Your name is remembered on this device. {members.length} {members.length === 1 ? 'person is' : 'people are'} already here.</p>
        </form>
      </main>
    );
  }

  const online = members.filter(m => m.online);

  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <button onClick={() => navigate('/')} className="flex items-center gap-2" aria-label="Redflow home">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-red" aria-hidden />
            <span className="text-sm font-semibold">Redflow</span>
          </button>
          <div className="min-w-0 flex-1 truncate text-sm text-ink-2">
            <span className="font-medium text-ink">{room.title}</span>
          </div>
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
        <div className="flex items-center gap-2 overflow-x-auto px-4 pb-2 text-xs text-muted">
          <span className="whitespace-nowrap">
            {online.length} here{online.length !== members.length ? `, ${members.length} joined` : ''}
          </span>
          <span aria-hidden>·</span>
          <span className="whitespace-nowrap">
            At the table: {orderedSlots.filter(s => s.slot.startsWith('council')).map(s => s.label).join(', ')}
            {orderedSlots.find(s => s.slot === 'chair') ? `, chaired by ${orderedSlots.find(s => s.slot === 'chair')!.label}` : ''}
          </span>
        </div>
        <div className="flex border-t border-line-2 md:hidden">
          {(['answer', 'room'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-sm font-semibold ${tab === t ? 'border-b-2 border-ink text-ink' : 'text-muted'}`}
            >
              {t === 'answer' ? 'Answer' : 'Room'}
            </button>
          ))}
        </div>
      </header>

      <div className="grid flex-1 md:grid-cols-12">
        <section className={`${tab === 'answer' ? 'block' : 'hidden'} md:col-span-7 md:block md:border-r md:border-line`}>
          <Answer
            room={room}
            question={question}
            paragraphs={paragraphs}
            objections={objections}
            evidence={evidence}
            drafts={drafts}
            teamQs={teamQs}
            versions={versions}
            statuses={statuses}
            slots={orderedSlots}
            now={now}
            myName={myMember.name}
          />
        </section>
        <section className={`${tab === 'room' ? 'flex' : 'hidden'} flex-col md:col-span-5 md:flex`}>
          <Stream
            room={room}
            question={question}
            members={members}
            notes={notes}
            drafts={drafts}
            objections={objections}
            evidence={evidence}
            teamQs={teamQs}
            versions={versions}
            statuses={statuses}
            slots={orderedSlots}
            now={now}
            me={me}
          />
        </section>
      </div>
    </div>
  );
}
