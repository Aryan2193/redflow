import { useMemo, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useReducer } from 'spacetimedb/react';
import { reducers } from '../module_bindings';
import type { Evidence, ModelSlot, Note, Objection, Paragraph, Question, Room } from '../module_bindings/types';
import { toDate } from '../lib/stdb';
import { renderShareCard, shareOrDownload } from '../lib/shareCard';
import { STATUS_DOT, STATUS_HELP, STATUS_LABEL, STATUS_TEXT } from '../lib/labels';
import { cleanHeading, cleanWhy, hostOf, unquote } from '../lib/bout';
import Stamp from './Stamp';

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
};

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
          return { id: x.id, why: cleanWhy(x.why), removed: !x.text, heading: cleanHeading(x.heading), cause: text, hl };
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [p.paragraphs, p.objections, p.evidence, p.notes, p.slots]
  );

  const open = p.objections.filter(o => o.status === 'unresolved');
  const took = q.settledAt ? toDate(q.settledAt).getTime() - toDate(q.createdAt).getTime() : 0;

  async function share() {
    setShareState('working');
    try {
      const blob = await renderShareCard({
        room: p.room,
        question: q,
        paragraphs: [...p.paragraphs],
        objections: p.objections,
        models: p.slots.filter(s => s.slot.startsWith('council') && s.enabled).map(s => s.label),
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

  const btn = 'rounded-full border border-line bg-sheet px-3 py-1.5 text-[13px] font-semibold text-ink-2 hover:border-ink disabled:opacity-50';
  const eyebrow = 'text-[11px] font-semibold uppercase tracking-wider text-muted';

  return (
    <div>
      <section className={`decision rounded-2xl px-5 py-5 sm:px-7 sm:py-6 ${open.length ? 'decision-risk' : ''}`}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
          <Stamp tone={open.length ? 'red' : 'ok'} live={p.now - toDate(q.settledAt ?? q.updatedAt).getTime() < 8000} className="mr-1">
            {open.length ? 'Decision, with risks' : q.state === 'failed' ? 'Stopped' : 'Decision'}
          </Stamp>
          <span>version {q.version}</span>
          {took > 0 && <span>· {duration(took)}</span>}
          {open.length > 0 && (
            <span className="rounded-full bg-red px-2 py-0.5 normal-case tracking-normal text-paper">
              {open.length} open risk{open.length === 1 ? '' : 's'}
            </span>
          )}
        </div>

        {first.heading && (
          <h2 className="font-display mt-3 text-[1.55rem] leading-[1.2] tracking-tight text-ink sm:text-[1.8rem]" style={{ textWrap: 'balance' }}>
            {cleanHeading(first.heading)}
          </h2>
        )}

        <div className="mt-3">
          <div className={eyebrow}>The answer</div>
          <div className="chat-md mt-1.5 text-[16px] text-ink sm:text-[17px]">
            <Markdown remarkPlugins={[remarkGfm]}>{first.text}</Markdown>
          </div>
        </div>

        {changes.length > 0 ? (
          <div className="mt-4 border-t border-black/10 pt-4">
            <div className={eyebrow}>What the debate changed</div>
            <ul className="mt-2 space-y-2 text-[14.5px] leading-relaxed text-ink">
              {changes.map(c => (
                <li key={c.id.toString()} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className={`hl ${c.hl} shrink-0 text-xs font-semibold`}>{c.cause}</span>
                  <span>
                    {c.removed ? `Removed “${c.heading}”. ` : ''}
                    {c.why}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-4 border-t border-black/10 pt-4 text-[14px] text-ink-2">{p.objections.length ? 'Every objection was answered without changing the text.' : 'Nobody objected. The first answer stood as written.'}</p>
        )}

        {open.length > 0 && (
          <div className="mt-4 rounded-lg border border-red/50 bg-red-soft/60 px-3.5 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-red">Open risks</div>
            <ul className="mt-1.5 space-y-1.5 text-[14px] leading-relaxed">
              {open.map(o => (
                <li key={o.id.toString()}>
                  <span className="font-medium">“{unquote(o.claim)}”</span> {o.issue.split(' Fix: ')[0]}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-ink-2">Press Go deeper to make the room work through these.</p>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => setFull(v => !v)} className="rounded-full bg-ink px-3 py-1.5 text-[13px] font-semibold text-paper">
            {full ? 'Hide the full answer' : 'Read the full answer'}
          </button>
          {q.state === 'settled' && (
            <button type="button" onClick={() => goDeeper({ questionId: q.id }).catch(e => setErr(String((e as Error)?.message ?? e)))} className={btn}>
              Go deeper
            </button>
          )}
          <button type="button" onClick={share} disabled={shareState === 'working'} className={btn}>
            {shareState === 'working' ? 'Rendering' : shareState === 'copied' ? 'Copied' : shareState === 'downloaded' ? 'Saved' : shareState === 'shared' ? 'Shared' : 'Share as image'}
          </button>
          <button type="button" onClick={() => setEmailOpen(v => !v)} className={btn}>
            Email it
          </button>
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
              className="flex-1 rounded-full border border-line bg-paper px-3.5 py-1.5 text-[14px] outline-none focus:border-ink"
            />
            <button className="rounded-full bg-ink px-3.5 py-1.5 text-[13px] font-semibold text-paper">Send</button>
          </form>
        )}
        {emailState === 'sent' && <p className="mt-2 text-xs text-ok">Queued. It lands in a minute, with the ledger and the sources.</p>}
        {emailState === 'error' && <p className="mt-2 text-xs text-red">That address did not go through. Check it and try again.</p>}
        {err && <p className="mt-2 text-xs text-red">{err}</p>}
      </section>

      {full && (
        <article className="mt-3 rounded-2xl border border-line bg-sheet px-5 py-5 sm:px-7 sm:py-6">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">The full answer, version {q.version}</div>
          <div className="mt-4 space-y-7">
            {current.map(para => (
              <section key={para.id.toString()}>
                <div className="flex items-baseline gap-3">
                  <span className={`mt-2 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_DOT[para.status] ?? 'bg-judg'}`} title={STATUS_HELP[para.status]} aria-hidden />
                  <h3 className="font-display text-[1.3rem] font-medium leading-snug">{cleanHeading(para.heading) || `Section ${para.ordinal}`}</h3>
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
