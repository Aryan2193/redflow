import { useEffect, useMemo, useRef, useState } from 'react';
import { useReducer, useSpacetimeDB, useTable } from 'spacetimedb/react';
import { reducers, tables } from '../module_bindings';
import type { Question } from '../module_bindings/types';
import { idHex, rememberName, savedName } from '../lib/stdb';
import { slotColor } from '../lib/labels';
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

  const latestQuestion: Question | undefined = useMemo(
    () => questions.reduce<Question | undefined>((best, q) => (!best || q.id > best.id ? q : best), undefined),
    [questions]
  );
  const [viewQid, setViewQid] = useState<bigint | null>(null);
  const latestId = latestQuestion?.id ?? 0n;
  useEffect(() => {
    setViewQid(null);
  }, [latestId]);
  const question: Question | undefined = (viewQid !== null ? questions.find(q => q.id === viewQid) : undefined) ?? latestQuestion;
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

  useEffect(() => {
    if (!room || !identity || !isActive) return;
    if (myMember && myMember.online) return;
    const n = myMember?.name || savedName();
    if (!n || triedAutoJoin.current) return;
    triedAutoJoin.current = true;
    joinRoom({ code, name: n }).catch(err => setJoinError(String((err as Error)?.message ?? err)));
  }, [room, identity, isActive, myMember, code, joinRoom]);

  const [tab, setTab] = useState<'answer' | 'debate'>('answer');
  const [copied, setCopied] = useState(false);
  const [explain, setExplain] = useState(false);
  const [seenVersion, setSeenVersion] = useState(0);
  const currentVersion = question?.version ?? 0;
  useEffect(() => {
    if (tab === 'answer') setSeenVersion(currentVersion);
  }, [tab, currentVersion]);
  const answerChanged = currentVersion > seenVersion;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);
  const steeredOnce = useRef(false);
  useEffect(() => {
    if (steeredOnce.current || !enabled || !questionsLoaded) return;
    steeredOnce.current = true;
    if (questions.length === 0) setTab('debate');
  }, [enabled, questionsLoaded, questions.length]);

  const orderedSlots = useMemo(() => [...slots].sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot)), [slots]);
  const table = orderedSlots.filter(s => s.slot.startsWith('council'));

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

  return (
    <div className="mx-auto flex h-dvh max-w-7xl flex-col">
      <header className="shrink-0 border-b border-line bg-paper">
        <div className="flex items-center gap-3 px-4 py-2.5">
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
        <div className="flex items-center gap-3 overflow-x-auto px-4 pb-2 text-xs text-muted">
          <span className="whitespace-nowrap">
            {online.length} here{online.length !== members.length ? `, ${members.length} joined` : ''}
          </span>
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            {table.map(s => (
              <span key={s.slot} className="inline-flex items-center gap-1">
                <span className={`inline-block h-2 w-2 rounded-full ${slotColor(s.slot)}`} aria-hidden />
                {s.label}
                {s.slot === 'council_a' ? ' (lead)' : ''}
              </span>
            ))}
          </span>
          <button onClick={() => setExplain(v => !v)} className="ml-auto whitespace-nowrap rounded-full border border-line px-2 py-0.5 text-ink-2">
            {explain ? 'Close' : 'How this works'}
          </button>
        </div>
        {explain && (
          <div className="border-t border-line-2 bg-sheet px-4 py-3 text-sm text-ink-2">
            <ol className="list-decimal space-y-1 pl-5">
              <li>You ask one question. {table[0]?.label ?? 'The lead'} writes the best full answer it can. That is version one, on screen in about twenty seconds.</li>
              <li>{table.slice(1).map(s => s.label).join(' and ')} draft their own view blind, then attack the answer on substance. Each objection must say what would make it right.</li>
              <li>Disputed facts are checked on the web. Then {table[0]?.label ?? 'the lead'} revises. Every change must cite an objection, a source, or your note, or the system refuses it.</li>
              <li>A critic confirms the fixes hold. Anything still standing shows as an open risk. Nothing quietly disappears.</li>
            </ol>
            <p className="mt-2">Type at any time. Your note is read on the next turn, and the section it changes carries your name.</p>
          </div>
        )}
        <div className="flex border-t border-line-2 md:hidden">
          {(['answer', 'debate'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`relative flex-1 py-2 text-sm font-semibold ${tab === t ? 'border-b-2 border-ink text-ink' : 'text-muted'}`}>
              {t === 'answer' ? 'Answer' : 'Debate'}
              {t === 'answer' && answerChanged && <span className="absolute right-6 top-2 inline-block h-2 w-2 rounded-full bg-red" aria-label="The answer changed" />}
            </button>
          ))}
        </div>
      </header>

      <div className="grid min-h-0 flex-1 md:grid-cols-12">
        <section className={`${tab === 'answer' ? 'block' : 'hidden'} min-h-0 overflow-y-auto md:col-span-8 md:block md:border-r md:border-line`}>
          <Answer
            room={room}
            question={question}
            questions={questions}
            onSelectQuestion={id => setViewQid(id === latestId ? null : id)}
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
        <section className={`${tab === 'debate' ? 'flex' : 'hidden'} min-h-0 flex-col bg-paper md:col-span-4 md:flex`}>
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
