import { useMemo, useState } from 'react';
import { useReducer } from 'spacetimedb/react';
import { reducers } from '../module_bindings';
import type { AgentStatus, AnswerVersion, Draft, Evidence, ModelSlot, Objection, Paragraph, Question, Room, TeamQuestion } from '../module_bindings/types';
import { wordDiff } from '../lib/diff';
import { timeAgo, toDate } from '../lib/stdb';
import { renderShareCard, shareOrDownload } from '../lib/shareCard';

type Props = {
  room: Room;
  question?: Question;
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

const STATUS_LABEL: Record<string, string> = {
  verified: 'Verified',
  agreed: 'Agreed',
  contested: 'Contested',
  unresolved: 'Unresolved',
};
const STATUS_CLASS: Record<string, string> = {
  verified: 'border-ok bg-ok-soft text-ok',
  agreed: 'border-judg bg-judg-soft text-judg',
  contested: 'border-warn bg-warn-soft text-warn',
  unresolved: 'border-red bg-red-soft text-red',
};
const STATUS_BAR: Record<string, string> = {
  verified: 'bg-ok',
  agreed: 'bg-judg',
  contested: 'bg-warn',
  unresolved: 'bg-red',
};

export function stateLine(q: Question, statuses: readonly AgentStatus[], slots: readonly ModelSlot[], unresolved = 0): string {
  const label = (slot: string) => slots.find(s => s.slot === slot)?.label ?? slot;
  const active = statuses.filter(s => !['idle', 'done', 'failed'].includes(s.state));
  switch (q.state) {
    case 'drafting': {
      const who = active.map(s => label(s.slot));
      return who.length ? `${who.join(', ')} drafting blind` : 'Three models are drafting blind';
    }
    case 'moderating':
      return `${label('chair')} is reading the drafts and building version one`;
    case 'critiquing':
      return 'Critics are attacking the drafts and version ' + q.version;
    case 'dissenting':
      return `Nobody objected. ${active[0] ? label(active[0].slot) : 'One model'} is assigned to argue the other side`;
    case 'grounding':
      return `${label('checker')} is checking claims on the web`;
    case 'synthesizing':
      return `${label('chair')} is rebuilding the answer from the ledger`;
    case 'verifying':
      return 'Critics are checking whether the fixes hold';
    case 'settled':
      return unresolved > 0 ? `Settled with ${unresolved} unresolved risk${unresolved === 1 ? '' : 's'}` : 'Settled. Every objection was resolved';
    case 'failed':
      return 'The room hit a problem';
    default:
      return q.state;
  }
}

export default function Answer(p: Props) {
  const { question: q } = p;
  const wrapUp = useReducer(reducers.wrapUp);
  const goDeeper = useReducer(reducers.goDeeper);
  const requestEmail = useReducer(reducers.requestVerdictEmail);
  const postNote = useReducer(reducers.postNote);
  const [open, setOpen] = useState<bigint | null>(null);
  const [showBefore, setShowBefore] = useState(false);
  const [email, setEmail] = useState('');
  const [emailState, setEmailState] = useState<'idle' | 'sent' | 'error'>('idle');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [err, setErr] = useState('');
  const [shareState, setShareState] = useState<'idle' | 'working' | 'shared' | 'downloaded' | 'copied'>('idle');

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
        siteUrl: window.location.origin.includes('127.0.0.1') || window.location.origin.includes('localhost') ? '' : window.location.origin,
      });
      const result = await shareOrDownload(blob, `redflow-${p.room.code}-v${q.version}.png`);
      setShareState(result);
      setTimeout(() => setShareState('idle'), 3000);
    } catch (e) {
      setShareState('idle');
      setErr(String((e as Error)?.message ?? e));
    }
  }

  const current = useMemo(() => p.paragraphs.filter(x => x.current).sort((a, b) => a.ordinal - b.ordinal), [p.paragraphs]);
  const previousOf = (para: Paragraph) =>
    p.paragraphs
      .filter(x => x.ordinal === para.ordinal && x.version < para.version && x.text)
      .sort((a, b) => b.version - a.version)[0];
  const unresolved = p.objections.filter(o => o.status === 'unresolved');
  const openTeamQs = p.teamQs.filter(t => !t.answeredAt);
  const firstDraft = p.drafts.find(d => d.label === 'A') ?? p.drafts[0];
  const busy = q && !['settled', 'failed'].includes(q.state);
  const sortedVersions = [...p.versions].sort((a, b) => a.version - b.version);

  if (!q) {
    return (
      <div className="px-5 py-10 md:px-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">The answer</p>
        <h2 className="font-display mt-2 text-2xl leading-snug">Nothing asked yet.</h2>
        <p className="mt-3 max-w-md text-ink-2">
          Ask the room one question. Three models answer it blind, then attack each other's drafts, then a chair rebuilds the answer with every change justified. On a phone, the composer is under the Room tab.
        </p>
        {p.room.brief && (
          <div className="mt-6 rounded-md border border-line bg-sheet p-4 text-sm text-ink-2">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">Room brief</div>
            {p.room.brief}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="px-5 pb-28 pt-5 md:px-8">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">
        Asked by {q.askedByName} · {timeAgo(q.createdAt, p.now)}
      </p>
      <h2 className="font-display mt-1 text-2xl leading-snug">{q.text}</h2>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-0.5 ${busy ? 'border-line bg-sheet text-ink-2' : unresolved.length ? STATUS_CLASS.unresolved : STATUS_CLASS.verified}`}>
          {busy && <span className="pulse inline-block h-1.5 w-1.5 rounded-full bg-red" aria-hidden />}
          {stateLine(q, p.statuses, p.slots, unresolved.length)}
        </span>
        {q.version > 0 && <span className="text-muted">version {q.version}</span>}
        {q.lastError && !q.lastError.includes('retrying') && q.state !== 'settled' && (
          <span className="text-xs text-red">{q.lastError.slice(0, 90)}</span>
        )}
      </div>

      {openTeamQs.length > 0 && busy && (
        <div className="mt-5 rounded-lg border border-warn bg-warn-soft/60 p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-warn">The room asks you</div>
          <p className="mt-1 text-sm text-ink-2">Only your team can answer these. Anyone can reply; the agents read it on their next turn.</p>
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
        </div>
      )}

      {current.length === 0 ? (
        <div className="mt-8 space-y-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-5 animate-pulse rounded bg-line-2" style={{ width: `${88 - i * 12}%` }} />
          ))}
          <p className="pt-2 text-sm text-muted">The first version lands once the drafts are in. Usually under a minute.</p>
        </div>
      ) : (
        <ol className="mt-6 space-y-4">
          {current.map(para => {
            const prev = previousOf(para);
            const isOpen = open === para.id;
            // A paragraph that just changed shows its word-level diff for a few seconds without being tapped.
            const fresh = p.now - toDate(para.createdAt).getTime() < 9000 && para.version > 1;
            const showDiff = !!prev && (isOpen || fresh);
            return (
              <li key={para.id.toString()} className={`relative rounded-md ${fresh ? 'landed' : ''}`}>
                <div className={`absolute inset-y-1 left-0 w-1 rounded ${STATUS_BAR[para.status] ?? 'bg-judg'}`} aria-hidden />
                <button onClick={() => setOpen(isOpen ? null : para.id)} className="block w-full pl-4 text-left">
                  <p className="answer-text">
                    {showDiff && prev ? (
                      wordDiff(prev.text, para.text).map((s, i) =>
                        s.type === 'same' ? <span key={i}>{s.text}</span> : <span key={i} className={s.type === 'add' ? 'diff-add' : 'diff-del'}>{s.text}</span>
                      )
                    ) : (
                      para.text
                    )}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                    <span className={`rounded-full border px-2 py-0.5 ${STATUS_CLASS[para.status] ?? STATUS_CLASS.agreed}`}>{STATUS_LABEL[para.status] ?? para.status}</span>
                    {para.version > 1 && <span className="text-muted">changed in v{para.version}</span>}
                    <span className="text-muted">{isOpen ? 'hide why' : 'why'}</span>
                  </div>
                </button>
                {isOpen && (
                  <div className="ml-4 mt-2 rounded-md border border-line bg-sheet p-3 text-sm text-ink-2">
                    <div>{para.why}</div>
                    {prev && <div className="mt-1 text-xs text-muted">Green is new, struck through is gone, compared with version {prev.version}.</div>}
                    {p.evidence.filter(e => e.targetOrdinal === para.ordinal).map(e => (
                      <div key={e.id.toString()} className="mt-2 border-t border-line-2 pt-2">
                        <span className={`mr-2 rounded px-1.5 py-0.5 text-xs font-semibold ${e.verdict === 'supported' ? 'bg-ok-soft text-ok' : e.verdict === 'refuted' ? 'bg-red-soft text-red' : 'bg-warn-soft text-warn'}`}>{e.verdict}</span>
                        <span>"{e.excerpt}"</span>{' '}
                        {e.url && (
                          <a href={e.url} target="_blank" rel="noreferrer" className="text-ink underline">
                            source
                          </a>
                        )}
                      </div>
                    ))}
                    {p.objections.filter(o => o.targetOrdinal === para.ordinal && o.status !== 'withdrawn').map(o => (
                      <div key={o.id.toString()} className="mt-2 border-t border-line-2 pt-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted">{o.status} objection</span>
                        <div>{o.issue}</div>
                        {o.resolution && <div className="mt-0.5 text-xs text-muted">{o.resolution}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {unresolved.length > 0 && (
        <div className="mt-8 rounded-lg border border-red bg-red-soft/50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-red">Unresolved risks</div>
          <ul className="mt-2 space-y-2 text-sm">
            {unresolved.map(o => (
              <li key={o.id.toString()}>
                <span className="font-medium">"{o.claim}"</span> {o.issue}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-8 flex flex-wrap gap-2">
        {busy && (
          <button onClick={() => wrapUp({ questionId: q.id }).catch(e => setErr(String(e?.message ?? e)))} className="rounded-md border border-ink px-3 py-2 text-sm font-semibold">
            Wrap it up
          </button>
        )}
        {q.state === 'settled' && (
          <button onClick={() => goDeeper({ questionId: q.id }).catch(e => setErr(String(e?.message ?? e)))} className="rounded-md border border-ink px-3 py-2 text-sm font-semibold">
            Go deeper
          </button>
        )}
        {firstDraft && current.length > 0 && (
          <button onClick={() => setShowBefore(v => !v)} className="rounded-md border border-line bg-sheet px-3 py-2 text-sm">
            {showBefore ? 'Hide' : 'Show'} what one model said first
          </button>
        )}
        {current.length > 0 && (
          <button onClick={share} disabled={shareState === 'working'} className="rounded-md border border-line bg-sheet px-3 py-2 text-sm disabled:opacity-50">
            {shareState === 'working' ? 'Rendering' : shareState === 'copied' ? 'Copied to clipboard' : shareState === 'downloaded' ? 'Saved' : shareState === 'shared' ? 'Shared' : 'Share as image'}
          </button>
        )}
      </div>
      {err && <p className="mt-2 text-sm text-red">{err}</p>}

      {showBefore && firstDraft && (
        <div className="mt-4 rounded-lg border border-line bg-sheet p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">
            Before: a single model's blind draft ({firstDraft.model.split(' via ')[0]})
          </div>
          <div className="answer-text mt-2 whitespace-pre-line text-ink-2">{firstDraft.text}</div>
        </div>
      )}

      {sortedVersions.length > 0 && (
        <div className="mt-8">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">Versions</div>
          <ol className="mt-2 space-y-1.5 text-sm text-ink-2">
            {sortedVersions.map(v => (
              <li key={v.id.toString()}>
                <span className="font-mono text-xs text-muted">v{v.version}</span> {v.summary}
              </li>
            ))}
          </ol>
        </div>
      )}

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
          <p className="mt-0.5 text-xs text-muted">The settled answer, the ledger, and the sources, in your inbox.</p>
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
    </div>
  );
}
