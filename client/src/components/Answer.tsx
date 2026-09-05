import { useMemo, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useReducer } from 'spacetimedb/react';
import { reducers } from '../module_bindings';
import type { AgentStatus, AnswerVersion, Draft, Evidence, ModelSlot, Objection, Paragraph, Question, Room, TeamQuestion } from '../module_bindings/types';
import { wordDiff } from '../lib/diff';
import { timeAgo, toDate } from '../lib/stdb';
import { renderShareCard, shareOrDownload } from '../lib/shareCard';
import { STAGES, STATUS_DOT, STATUS_HELP, STATUS_LABEL, STATUS_TEXT, narrative, stageIndex } from '../lib/labels';

type Props = {
  room: Room;
  question?: Question;
  questions: readonly Question[];
  onSelectQuestion: (id: bigint) => void;
  paragraphs: readonly Paragraph[];
  objections: readonly Objection[];
  evidence: readonly Evidence[];
  drafts: readonly Draft[];
  teamQs: readonly TeamQuestion[];
  versions: readonly AnswerVersion[];
  statuses: readonly AgentStatus[];
  slots: readonly ModelSlot[];
  now: number;
  myName: string;
};

function Stepper({ q, openRisks }: { q: Question; openRisks: number }) {
  const idx = stageIndex(q);
  const settled = q.state === 'settled' || q.state === 'failed';
  return (
    <ol className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider" aria-label="Progress">
      {STAGES.map((s, i) => {
        const done = i < idx || (settled && i === 4);
        const active = i === idx && !settled;
        const color = done ? (i === 4 && openRisks > 0 ? 'text-warn' : 'text-ok') : active ? 'text-ink' : 'text-muted/60';
        return (
          <li key={s} className={`flex items-center gap-1 ${color}`}>
            <span className={`inline-block h-2 w-2 rounded-full ${done ? (i === 4 && openRisks > 0 ? 'bg-warn' : 'bg-ok') : active ? 'bg-red pulse' : 'bg-line'}`} aria-hidden />
            <span className="hidden sm:inline">{s}</span>
            {i < STAGES.length - 1 && <span className="mx-1 h-px w-3 bg-line sm:w-5" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

export default function Answer(p: Props) {
  const { question: q } = p;
  const wrapUp = useReducer(reducers.wrapUp);
  const goDeeper = useReducer(reducers.goDeeper);
  const requestEmail = useReducer(reducers.requestVerdictEmail);
  const postNote = useReducer(reducers.postNote);
  const [open, setOpen] = useState<bigint | null>(null);
  const [view, setView] = useState<'after' | 'before'>('after');
  const [email, setEmail] = useState('');
  const [emailState, setEmailState] = useState<'idle' | 'sent' | 'error'>('idle');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [err, setErr] = useState('');
  const [shareState, setShareState] = useState<'idle' | 'working' | 'shared' | 'downloaded' | 'copied'>('idle');

  const current = useMemo(() => p.paragraphs.filter(x => x.current && x.text).sort((a, b) => a.ordinal - b.ordinal), [p.paragraphs]);
  const versionOne = useMemo(() => p.paragraphs.filter(x => x.version === 1 && x.text).sort((a, b) => a.ordinal - b.ordinal), [p.paragraphs]);
  const previousOf = (para: Paragraph) => p.paragraphs.filter(x => x.ordinal === para.ordinal && x.version < para.version && x.text).sort((a, b) => b.version - a.version)[0];
  const openRisks = p.objections.filter(o => o.status === 'unresolved');
  const resolved = p.objections.filter(o => o.status === 'withdrawn' || o.status === 'overruled').length;
  const openTeamQs = p.teamQs.filter(t => !t.answeredAt);
  const busy = !!q && !['settled', 'failed'].includes(q.state);
  const sortedVersions = [...p.versions].sort((a, b) => a.version - b.version);
  const latest = sortedVersions[sortedVersions.length - 1];
  const leadLabel = p.slots.find(s => s.slot === 'council_a')?.label ?? 'The lead';
  const shown = view === 'before' && versionOne.length ? versionOne : current;

  async function share() {
    if (!q) return;
    setShareState('working');
    try {
      const blob = await renderShareCard({
        room: p.room,
        question: q,
        paragraphs: [...p.paragraphs],
        objections: p.objections,
        models: p.slots.filter(s => s.slot.startsWith('council')).map(s => s.label),
        siteUrl: /localhost|127\.0\.0\.1|10\.\d+\./.test(window.location.origin) ? '' : window.location.origin,
      });
      const result = await shareOrDownload(blob, `redflow-${p.room.code}-v${q.version}.png`);
      setShareState(result);
      setTimeout(() => setShareState('idle'), 3000);
    } catch (e) {
      setShareState('idle');
      setErr(String((e as Error)?.message ?? e));
    }
  }

  if (!q) {
    return (
      <div className="mx-auto max-w-[68ch] px-5 py-12 md:px-8">
        <h2 className="font-display text-3xl leading-tight">Nothing asked yet.</h2>
        <p className="mt-3 text-ink-2">
          Ask the room one question. {leadLabel} writes the best answer it can in about twenty seconds. Then two other models attack it, facts get checked, and {leadLabel} revises with every change justified. You can interrupt at any point.
        </p>
        {p.room.brief && <div className="mt-6 rounded-md border border-line bg-sheet p-4 text-sm text-ink-2">{p.room.brief}</div>}
      </div>
    );
  }

  const others = p.questions.filter(x => x.id !== q.id);

  return (
    <article className="mx-auto max-w-[70ch] px-5 pb-16 pt-6 md:px-8">
      <header>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span>
            Asked by <span className="font-medium text-ink-2">{q.askedByName}</span> · {timeAgo(q.createdAt, p.now)}
          </span>
          {others.length > 0 && (
            <select
              value={q.id.toString()}
              onChange={e => p.onSelectQuestion(BigInt(e.target.value))}
              className="rounded border border-line bg-sheet px-1.5 py-0.5 text-xs text-ink"
              aria-label="Other questions in this room"
            >
              {[...p.questions].sort((a, b) => Number(b.id - a.id)).map(x => (
                <option key={x.id.toString()} value={x.id.toString()}>
                  {x.text.slice(0, 60)}{x.text.length > 60 ? '...' : ''}
                </option>
              ))}
            </select>
          )}
        </div>
        <h1 className="font-display mt-2 text-[1.7rem] leading-[1.25] tracking-tight sm:text-[2rem]">{q.text}</h1>

        <div className="mt-5 rounded-lg border border-line bg-sheet px-4 py-3">
          <Stepper q={q} openRisks={openRisks.length} />
          <p className={`mt-2 text-sm ${q.state === 'settled' ? (openRisks.length ? 'text-warn' : 'text-ok') : 'text-ink-2'}`}>{narrative(q, p.statuses, p.slots, openRisks.length)}</p>
          {latest && latest.version > 1 && (
            <p className={`mt-2 border-t border-line-2 pt-2 text-sm text-ink-2 ${p.now - toDate(latest.createdAt).getTime() < 9000 ? 'landed' : ''}`}>
              <span className="font-semibold text-ink">Version {latest.version}.</span> {latest.summary}
            </p>
          )}
          {q.lastError && !q.lastError.includes('retrying') && !q.lastError.startsWith('watchdog') && q.state !== 'settled' && <p className="mt-2 text-xs text-red">{q.lastError.slice(0, 120)}</p>}
        </div>
      </header>

      {openTeamQs.length > 0 && (
        <section className="mt-5 rounded-lg border border-warn/60 bg-warn-soft/50 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-warn">The room asks you</h2>
          <p className="mt-1 text-sm text-ink-2">Only your team knows this. Anyone can answer. {busy ? 'The models read it on their next turn.' : 'The answer has settled, so your reply feeds the next round when you press Go deeper.'}</p>
          <ul className="mt-3 space-y-3">
            {openTeamQs.map(t => (
              <li key={t.id.toString()}>
                <div className="font-medium">{t.text}</div>
                <form
                  className="mt-1.5 flex gap-2"
                  onSubmit={async e => {
                    e.preventDefault();
                    const text = (answers[t.id.toString()] ?? '').trim();
                    if (!text) return;
                    try {
                      await postNote({ roomId: p.room.id, text, teamQuestionId: t.id });
                      setAnswers(a => ({ ...a, [t.id.toString()]: '' }));
                    } catch (e2) {
                      setErr(String((e2 as Error)?.message ?? e2));
                    }
                  }}
                >
                  <input
                    value={answers[t.id.toString()] ?? ''}
                    onChange={e => setAnswers(a => ({ ...a, [t.id.toString()]: e.target.value }))}
                    placeholder="Your answer"
                    className="flex-1 rounded-md border border-line bg-sheet px-3 py-2 text-sm outline-none focus:border-ink"
                  />
                  <button className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-paper">Answer</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      {versionOne.length > 0 && current.length > 0 && q.version > 1 && (
        <div className="mt-6 inline-flex rounded-md border border-line bg-sheet p-0.5 text-sm">
          {(['before', 'after'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} className={`rounded px-3 py-1 ${view === v ? 'bg-ink text-paper' : 'text-ink-2'}`}>
              {v === 'before' ? `${leadLabel} alone` : `After the debate (v${q.version})`}
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <div className="mt-8 space-y-3">
          <div className="h-6 w-2/3 animate-pulse rounded bg-line-2" />
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="h-4 animate-pulse rounded bg-line-2" style={{ width: `${92 - i * 9}%` }} />
          ))}
          <p className="pt-2 text-sm text-muted">{leadLabel} is writing the first full answer. Usually about twenty seconds.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          {shown.map(para => {
            const prev = view === 'after' ? previousOf(para) : undefined;
            const isOpen = open === para.id;
            const fresh = view === 'after' && para.version > 1 && p.now - toDate(para.createdAt).getTime() < 9000;
            const showDiff = !!prev && (isOpen || fresh);
            const status = view === 'before' ? 'agreed' : para.status;
            const secEvidence = p.evidence.filter(e => e.targetOrdinal === para.ordinal);
            const secObjections = p.objections.filter(o => o.targetOrdinal === para.ordinal && o.status !== 'withdrawn');
            return (
              <section key={para.id.toString()} className={`rounded-md ${fresh ? 'landed' : ''}`}>
                <div className="flex items-baseline gap-3">
                  <span className={`mt-2 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_DOT[status] ?? 'bg-judg'}`} title={STATUS_HELP[status]} aria-hidden />
                  <h2 className="font-display text-[1.35rem] font-medium leading-snug">{para.heading || `Section ${para.ordinal}`}</h2>
                  <button onClick={() => setOpen(isOpen ? null : para.id)} className={`ml-auto shrink-0 text-xs font-semibold uppercase tracking-wider ${STATUS_TEXT[status] ?? 'text-judg'}`} title="Why this section reads the way it does">
                    {STATUS_LABEL[status] ?? status}
                    {view === 'after' && para.version > 1 ? ` · v${para.version}` : ''}
                  </button>
                </div>
                <div className="doc mt-2 pl-[22px]">
                  {showDiff && prev ? (
                    <p style={{ whiteSpace: 'pre-wrap' }}>
                      {wordDiff(prev.text, para.text).map((s, i) =>
                        s.type === 'same' ? <span key={i}>{s.text}</span> : <span key={i} className={s.type === 'add' ? 'diff-add' : 'diff-del'}>{s.text}</span>
                      )}
                    </p>
                  ) : (
                    <Markdown remarkPlugins={[remarkGfm]}>{para.text}</Markdown>
                  )}
                </div>
                {isOpen && view === 'after' && (
                  <div className="ml-[22px] mt-3 rounded-md border border-line bg-sheet p-3 text-sm text-ink-2">
                    <div>{para.why}</div>
                    {prev && <div className="mt-1 text-xs text-muted">Green is new, struck through is gone, compared with version {prev.version}.</div>}
                    {secEvidence.map(e => (
                      <div key={e.id.toString()} className="mt-2 border-t border-line-2 pt-2">
                        <span className={`mr-2 rounded px-1.5 py-0.5 text-xs font-semibold ${e.verdict === 'supported' ? 'bg-ok-soft text-ok' : e.verdict === 'refuted' ? 'bg-red-soft text-red' : 'bg-warn-soft text-warn'}`}>{e.verdict}</span>
                        <span>{e.title}</span>{' '}
                        {e.url && (
                          <a href={e.url} target="_blank" rel="noreferrer" className="underline">
                            {new URL(e.url).hostname.replace(/^www\./, '')}
                          </a>
                        )}
                      </div>
                    ))}
                    {secObjections.map(o => (
                      <div key={o.id.toString()} className="mt-2 border-t border-line-2 pt-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted">{o.status === 'unresolved' ? 'open risk' : o.status} · {p.slots.find(s => s.slot === o.bySlot)?.label ?? o.bySlot}</span>
                        <div className="mt-0.5">{o.issue}</div>
                        {o.resolution && <div className="mt-0.5 text-xs text-muted">{o.resolution}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {view === 'before' && <p className="mt-4 text-sm text-muted">This is what {leadLabel} wrote alone, before anyone argued. Switch back to see what changed and why.</p>}

      {(q.version > 0 || p.drafts.length > 0) && (
        <div className="mt-10 flex flex-wrap gap-x-5 gap-y-1 border-t border-line pt-4 text-sm text-ink-2">
          <span>
            <b className="text-ink">{p.drafts.length}</b> drafts
          </span>
          <span>
            <b className="text-ink">{p.objections.length}</b> objections
          </span>
          <span>
            <b className="text-ink">{resolved}</b> resolved
          </span>
          <span>
            <b className="text-ink">{p.evidence.length}</b> facts checked
          </span>
          {openRisks.length > 0 && (
            <span className="text-red">
              <b>{openRisks.length}</b> open
            </span>
          )}
        </div>
      )}

      {openRisks.length > 0 && (
        <section className="mt-5 rounded-lg border border-red/50 bg-red-soft/40 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-red">Open risks</h2>
          <p className="mt-1 text-sm text-ink-2">Objections that stood when the round ended. Press Go deeper to make the room work through them.</p>
          <ul className="mt-2 space-y-2 text-sm">
            {openRisks.map(o => (
              <li key={o.id.toString()}>
                <span className="font-medium">"{o.claim}"</span> {o.issue}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {busy && (
          <button onClick={() => wrapUp({ questionId: q.id }).catch(e => setErr(String(e?.message ?? e)))} className="rounded-md border border-ink px-3 py-2 text-sm font-semibold">
            Wrap it up now
          </button>
        )}
        {q.state === 'settled' && (
          <button onClick={() => goDeeper({ questionId: q.id }).catch(e => setErr(String(e?.message ?? e)))} className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-paper">
            Go deeper
          </button>
        )}
        {current.length > 0 && (
          <button onClick={share} disabled={shareState === 'working'} className="rounded-md border border-line bg-sheet px-3 py-2 text-sm disabled:opacity-50">
            {shareState === 'working' ? 'Rendering' : shareState === 'copied' ? 'Copied to clipboard' : shareState === 'downloaded' ? 'Saved' : shareState === 'shared' ? 'Shared' : 'Share as image'}
          </button>
        )}
      </div>
      {err && <p className="mt-2 text-sm text-red">{err}</p>}

      {q.state === 'settled' && (
        <form
          className="mt-8 rounded-lg border border-line bg-sheet p-4"
          onSubmit={async e => {
            e.preventDefault();
            try {
              await requestEmail({ questionId: q.id, email: email.trim() });
              setEmailState('sent');
            } catch {
              setEmailState('error');
            }
          }}
        >
          <div className="text-sm font-semibold">Email me this verdict</div>
          <p className="mt-0.5 text-xs text-muted">The settled answer, the ledger, and the sources.</p>
          <div className="mt-2 flex gap-2">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder={`${p.myName.toLowerCase().replace(/\s+/g, '.')}@work.com`}
              className="flex-1 rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-ink"
            />
            <button className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-paper">Send</button>
          </div>
          {emailState === 'sent' && <p className="mt-2 text-xs text-ok">Queued. It lands in a minute.</p>}
          {emailState === 'error' && <p className="mt-2 text-xs text-red">That address did not go through. Check it and try again.</p>}
        </form>
      )}
    </article>
  );
}
