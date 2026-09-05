import { useMemo, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useReducer } from 'spacetimedb/react';
import { reducers } from '../module_bindings';
import type { Evidence, ModelSlot, Note, Objection, Paragraph, Question, Room } from '../module_bindings/types';
import { toDate } from '../lib/stdb';
import { renderShareCard, shareOrDownload } from '../lib/shareCard';
import { STATUS_DOT, STATUS_HELP, STATUS_LABEL, STATUS_TEXT } from '../lib/labels';
import { cleanWhy, unquote } from './Thread';

type Props = {
  room: Room;
  question: Question;
  paragraphs: readonly Paragraph[];
  objections: readonly Objection[];
  evidence: readonly Evidence[];
  notes: readonly Note[];
  slots: readonly ModelSlot[];
  now: number;
  myName: string;
  compact?: boolean;
};

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function duration(ms: number): string {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  return m ? `${m}m ${s % 60}s` : `${s}s`;
}

export default function Verdict(p: Props) {
  const q = p.question;
  const goDeeper = useReducer(reducers.goDeeper);
  const requestEmail = useReducer(reducers.requestVerdictEmail);
  const [full, setFull] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [emailState, setEmailState] = useState<'idle' | 'sent' | 'error'>('idle');
  const [shareState, setShareState] = useState<'idle' | 'working' | 'shared' | 'downloaded' | 'copied'>('idle');
  const [err, setErr] = useState('');

  const label = (slot: string) => p.slots.find(s => s.slot === slot)?.label ?? slot;
  const current = useMemo(() => p.paragraphs.filter(x => x.current && x.text).sort((a, b) => a.ordinal - b.ordinal), [p.paragraphs]);
  const first = current[0];

  const changes = useMemo(
    () =>
      p.paragraphs
        .filter(x => x.version > 1)
        .sort((a, b) => a.version - b.version || a.ordinal - b.ordinal)
        .map(x => {
          let text = 'Revised';
          let hl = 'hl-judg';
          if (x.causeType === 'objection') {
            const o = p.objections.find(y => y.id === x.causeId);
            text = o ? `${label(o.bySlot)} objected` : 'An objection';
            hl = 'hl-red';
          } else if (x.causeType === 'evidence') {
            const e = p.evidence.find(y => y.id === x.causeId);
            text = e?.url ? `Checked against ${hostOf(e.url)}` : 'Checked on the web';
            hl = 'hl-ok';
          } else if (x.causeType === 'note') {
            const n = p.notes.find(y => y.id === x.causeId);
            text = n ? `${n.authorName} said so` : 'The team said so';
            hl = 'hl-warn';
          }
          return { id: x.id, why: cleanWhy(x.why), removed: !x.text, heading: x.heading, cause: text, hl };
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [p.paragraphs, p.objections, p.evidence, p.notes, p.slots]
  );

  const fixed = p.objections.filter(o => o.status === 'withdrawn').length;
  const stood = p.objections.filter(o => o.status === 'overruled' && o.resolution.startsWith('A source supports')).length;
  const overruled = p.objections.filter(o => o.status === 'overruled').length - stood;
  const open = p.objections.filter(o => o.status === 'unresolved');
  const verified = p.evidence.filter(e => e.verdict === 'supported').slice(0, 3);
  const models = p.slots.filter(s => s.slot.startsWith('council') && s.enabled).map(s => s.label);
  const took = q.settledAt ? toDate(q.settledAt).getTime() - toDate(q.createdAt).getTime() : 0;

  async function share() {
    setShareState('working');
    try {
      const blob = await renderShareCard({
        room: p.room,
        question: q,
        paragraphs: [...p.paragraphs],
        objections: p.objections,
        models,
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

  if (!first) {
    return <div className="rounded-2xl border border-line bg-sheet px-4 py-3 text-sm text-muted">{q.state === 'failed' ? 'The room stopped before it had an answer.' : 'Settled without an answer.'}</div>;
  }

  const btn = 'rounded-full border border-paper/30 px-3 py-1.5 text-[13px] font-semibold text-paper hover:border-paper/60 disabled:opacity-50';

  return (
    <div className="pt-2">
      <section className="rounded-2xl bg-ink px-5 py-5 text-paper sm:px-7 sm:py-6">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold uppercase tracking-wider text-paper/60">
          <span className="inline-block h-2 w-2 rounded-full bg-red" aria-hidden />
          <span>The room's answer</span>
          <span>· version {q.version}</span>
          {took > 0 && <span>· settled in {duration(took)}</span>}
          {open.length > 0 && (
            <span className="rounded-full bg-red px-2 py-0.5 normal-case tracking-normal text-paper">
              {open.length} open risk{open.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
        {first.heading && (
          <h2 className="font-display mt-3 text-[1.55rem] leading-[1.2] tracking-tight sm:text-[1.8rem]" style={{ textWrap: 'balance' }}>
            {first.heading.replace(/^\s*\[?\s*section\s*\d+\s*\]?\s*(\([a-z ]+\))?\s*[:.-]?\s*/i, '')}
          </h2>
        )}
        <div className="chat-md mt-3 text-[16px] text-paper/90 sm:text-[17px]">
          <Markdown remarkPlugins={[remarkGfm]}>{first.text}</Markdown>
        </div>

        {p.compact ? null : changes.length > 0 ? (
          <div className="mt-5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-paper/60">What the debate changed</div>
            <ul className="mt-2 space-y-2 text-[14.5px] leading-relaxed text-paper/90">
              {changes.map(c => (
                <li key={c.id.toString()} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className={`hl ${c.hl} shrink-0 text-xs font-semibold text-ink`}>{c.cause}</span>
                  <span>
                    {c.removed ? `Removed “${c.heading}”. ` : ''}
                    {c.why}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-5 text-[14px] text-paper/70">{p.objections.length ? 'Every objection was answered without changing the text.' : 'Nobody objected. The first answer stood as written.'}</p>
        )}

        {!p.compact && verified.length > 0 && (
          <div className="mt-5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-paper/60">Checked against sources</div>
            <ul className="mt-2 space-y-1.5 text-[14px] leading-relaxed text-paper/85">
              {verified.map(e => (
                <li key={e.id.toString()}>
                  <span className="hl hl-ok mr-1.5 text-xs font-semibold text-ink">Supported</span>
                  {e.claim}{' '}
                  {e.url && (
                    <a href={e.url} target="_blank" rel="noreferrer" className="text-paper/70 underline">
                      {hostOf(e.url)}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {!p.compact && open.length > 0 && (
          <div className="mt-5 rounded-lg border border-red/70 bg-red/15 px-3.5 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#f4b3a6]">Open risks</div>
            <ul className="mt-1.5 space-y-1.5 text-[14px] leading-relaxed">
              {open.map(o => (
                <li key={o.id.toString()}>
                  <span className="font-medium">“{unquote(o.claim)}”</span> {o.issue.split(' Fix: ')[0]}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-paper/70">Press Go deeper to make the room work through these.</p>
          </div>
        )}

        <div className={`mt-5 flex flex-wrap gap-x-4 gap-y-1 border-t border-paper/15 pt-3 text-[12.5px] text-paper/70 ${p.compact ? 'hidden' : ''}`}>
          <span>{models.join(' vs ')}</span>
          <span>
            {p.objections.length} objection{p.objections.length === 1 ? '' : 's'}
          </span>
          <span>{fixed} fixed</span>
          <span>{stood} stood on evidence</span>
          {overruled > 0 && <span>{overruled} overruled</span>}
          <span>
            {p.evidence.length} fact{p.evidence.length === 1 ? '' : 's'} checked
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => setFull(v => !v)} className="rounded-full border border-paper bg-paper px-3 py-1.5 text-[13px] font-semibold text-ink">
            {full ? 'Hide the full answer' : 'Read the full answer'}
          </button>
          {!p.compact && q.state === 'settled' && (
            <button type="button" onClick={() => goDeeper({ questionId: q.id }).catch(e => setErr(String((e as Error)?.message ?? e)))} className={btn}>
              Go deeper
            </button>
          )}
          {!p.compact && (
            <button type="button" onClick={share} disabled={shareState === 'working'} className={btn}>
              {shareState === 'working' ? 'Rendering' : shareState === 'copied' ? 'Copied' : shareState === 'downloaded' ? 'Saved' : shareState === 'shared' ? 'Shared' : 'Share as image'}
            </button>
          )}
          {!p.compact && (
            <button type="button" onClick={() => setEmailOpen(v => !v)} className={btn}>
              Email it
            </button>
          )}
        </div>

        {emailOpen && (
          <form
            className="mt-3 flex gap-2"
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
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder={`${p.myName.toLowerCase().replace(/\s+/g, '.')}@work.com`}
              className="flex-1 rounded-full border border-paper/30 bg-transparent px-3.5 py-1.5 text-[14px] text-paper outline-none placeholder:text-paper/40 focus:border-paper"
            />
            <button className="rounded-full bg-paper px-3.5 py-1.5 text-[13px] font-semibold text-ink">Send</button>
          </form>
        )}
        {emailState === 'sent' && <p className="mt-2 text-xs text-[#9fd3b0]">Queued. It lands in a minute, with the ledger and the sources.</p>}
        {emailState === 'error' && <p className="mt-2 text-xs text-[#f4b3a6]">That address did not go through. Check it and try again.</p>}
        {err && <p className="mt-2 text-xs text-[#f4b3a6]">{err}</p>}
      </section>

      {full && (
        <article className="mt-3 rounded-2xl border border-line bg-sheet px-5 py-5 sm:px-7 sm:py-6">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">The full answer, version {q.version}</div>
          <div className="mt-4 space-y-7">
            {current.map(para => (
              <section key={para.id.toString()}>
                <div className="flex items-baseline gap-3">
                  <span className={`mt-2 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_DOT[para.status] ?? 'bg-judg'}`} title={STATUS_HELP[para.status]} aria-hidden />
                  <h3 className="font-display text-[1.3rem] font-medium leading-snug">{para.heading || `Section ${para.ordinal}`}</h3>
                  <span className={`ml-auto shrink-0 text-xs font-semibold uppercase tracking-wider ${STATUS_TEXT[para.status] ?? 'text-judg'}`} title={STATUS_HELP[para.status]}>
                    {STATUS_LABEL[para.status] ?? para.status}
                    {para.version > 1 ? ` · v${para.version}` : ''}
                  </span>
                </div>
                <div className="doc mt-2 pl-[22px]">
                  <Markdown remarkPlugins={[remarkGfm]}>{para.text}</Markdown>
                </div>
              </section>
            ))}
          </div>
        </article>
      )}
    </div>
  );
}
