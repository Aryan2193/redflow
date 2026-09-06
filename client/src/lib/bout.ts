// The bout: every event about one question, assigned to a corner of the ring and a round.
import type { AgentStatus, AnswerVersion, Draft, Evidence, ModelSlot, Note, Objection, Paragraph, Question } from '../module_bindings/types';
import { toDate } from './stdb';
import { humanSpeaker, speakerFor, type Speaker } from './labels';

export type Corner = 'left' | 'right' | 'center';
export type Stage = 'opening' | 'attack' | 'facts' | 'comeback' | 'ruling' | '';

type Base = { key: string; at: number; corner: Corner; stage: Stage; round: number; speaker: Speaker };
export type BoutItem = Base &
  (
    | { kind: 'question'; q: Question }
    | { kind: 'note'; n: Note; waiting: boolean }
    | { kind: 'answer'; d: Draft }
    | { kind: 'draft'; d: Draft; again: boolean }
    | { kind: 'objection'; o: Objection }
    | { kind: 'evidence'; e: Evidence }
    | { kind: 'revision'; v: AnswerVersion }
    | { kind: 'ruling'; group: Objection[] }
    | { kind: 'typing'; s: AgentStatus }
  );

export const ROUNDS: { key: Stage; label: string; short: string }[] = [
  { key: 'opening', label: 'Opening', short: 'R1' },
  { key: 'attack', label: 'The attack', short: 'R2' },
  { key: 'facts', label: 'Fact check', short: 'R3' },
  { key: 'comeback', label: 'Comeback', short: 'R4' },
  { key: 'ruling', label: 'Ruling', short: 'R5' },
];

// Which round the bout is in right now, 0 to 4, or 5 once decided.
export function roundIndex(q: Question): number {
  switch (q.state) {
    case 'drafting':
      return 0;
    case 'critiquing':
    case 'dissenting':
      return 1;
    case 'grounding':
      return 2;
    case 'synthesizing':
      return 3;
    case 'verifying':
      return 4;
    default:
      return 5;
  }
}

export const ACTIVE_STATES = new Set(['reading', 'drafting', 'critiquing', 'checking', 'synthesizing', 'verifying', 'dissenting']);

export function cornerOf(slot: string): Corner {
  if (slot === 'council_a' || slot === 'chair') return 'left';
  if (slot === 'checker' || slot === 'referee') return 'center';
  return 'right';
}

// Who rules on the fixes: the referee when there is one, else a critic.
export function verifierSlot(slots: readonly ModelSlot[]): string {
  for (const s of ['referee', 'council_b', 'council_c']) if (slots.find(x => x.slot === s && x.enabled)) return s;
  return 'council_b';
}

export function unquote(s: string): string {
  return s.replace(/^["“”'\s]+|["“”'\s]+$/g, '');
}

export function cleanHeading(h: string): string {
  return h.replace(/^\s*\[?\s*section\s*\d+\s*\]?\s*(\([a-z ]+\))?\s*[:.-]?\s*/i, '').trim();
}

export function cleanWhy(why: string): string {
  return why
    .replace(/^Removed\.\s*/, '')
    .replace(/^Because of (objection|source|note) \d+:\s*/, '')
    .replace(/^Because .+? said so:\s*/, '')
    .trim();
}

// URLs arrive from model output and web annotations. Only http and https may become links.
export function safeUrl(u?: string): string | undefined {
  if (!u) return undefined;
  try {
    const parsed = new URL(u, window.location.origin);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function splitSections(md: string): { heading: string; body: string }[] {
  return md
    .split(/\n(?=## )/)
    .map(part => {
      const m = part.match(/^## (.*)\n?([\s\S]*)$/);
      return m ? { heading: cleanHeading(m[1]), body: m[2].trim() } : { heading: '', body: part.trim() };
    })
    .filter(s => s.body || s.heading);
}

export function causeOf(p: Paragraph, objections: readonly Objection[], evidence: readonly Evidence[], notes: readonly Note[], slots: readonly ModelSlot[]): { text: string; hl: string; stamp: string; tone: 'ok' | 'red' | 'warn' | 'judg' } {
  const label = (slot: string) => slots.find(s => s.slot === slot)?.label ?? slot;
  if (p.causeType === 'objection') {
    const o = objections.find(x => x.id === p.causeId);
    return { text: o ? `${label(o.bySlot)} objected` : 'An objection', hl: 'hl-red', stamp: 'Conceded', tone: 'ok' };
  }
  if (p.causeType === 'evidence') {
    const e = evidence.find(x => x.id === p.causeId);
    return { text: e?.url ? `Checked against ${hostOf(e.url)}` : 'Checked on the web', hl: 'hl-ok', stamp: 'Corrected', tone: 'ok' };
  }
  if (p.causeType === 'note') {
    const n = notes.find(x => x.id === p.causeId);
    return { text: n ? `${n.authorName} said so` : 'The team said so', hl: 'hl-warn', stamp: 'From the team', tone: 'warn' };
  }
  return { text: 'Revised', hl: 'hl-judg', stamp: 'Revised', tone: 'judg' };
}

export type BoutInput = {
  question: Question;
  notes: readonly Note[];
  drafts: readonly Draft[];
  objections: readonly Objection[];
  evidence: readonly Evidence[];
  versions: readonly AnswerVersion[];
  statuses: readonly AgentStatus[];
  slots: readonly ModelSlot[];
};

export function buildBout(p: BoutInput): BoutItem[] {
  const q = p.question;
  const settled = q.state === 'settled' || q.state === 'failed';
  const at = (ts: { microsSinceUnixEpoch: bigint }) => toDate(ts).getTime();
  const lead = speakerFor('council_a', p.slots);
  const out: BoutItem[] = [];

  out.push({ kind: 'question', key: 'q', at: at(q.createdAt), corner: 'center', stage: '', round: 1, speaker: humanSpeaker(q.askedByName), q });

  for (const n of p.notes) {
    out.push({ kind: 'note', key: 'n' + n.id, at: at(n.createdAt), corner: 'center', stage: '', round: 0, speaker: humanSpeaker(n.authorName), n, waiting: n.consumedStep === '' && !settled });
  }

  for (const d of p.drafts) {
    const isLead = d.slot === 'council_a';
    if (isLead && d.round === 1) out.push({ kind: 'answer', key: 'd' + d.id, at: at(d.createdAt), corner: 'left', stage: 'opening', round: d.round, speaker: lead, d });
    else out.push({ kind: 'draft', key: 'd' + d.id, at: at(d.createdAt), corner: cornerOf(d.slot), stage: 'opening', round: d.round, speaker: speakerFor(d.slot, p.slots), d, again: d.round > 1 });
  }

  for (const o of p.objections) {
    out.push({ kind: 'objection', key: 'o' + o.id, at: at(o.createdAt), corner: cornerOf(o.bySlot), stage: 'attack', round: o.round, speaker: speakerFor(o.bySlot, p.slots), o });
  }

  for (const e of p.evidence) {
    out.push({ kind: 'evidence', key: 'e' + e.id, at: at(e.createdAt), corner: 'center', stage: 'facts', round: 0, speaker: speakerFor('checker', p.slots), e });
  }

  for (const v of p.versions) {
    if (v.version < 2) continue;
    out.push({ kind: 'revision', key: 'v' + v.id, at: at(v.createdAt), corner: 'left', stage: 'comeback', round: v.round, speaker: lead, v });
  }

  // The verifier's ruling lives on the objections it judged. One card per round.
  const judged = p.objections.filter(o => /\| (withdrawn|held): /.test(o.resolution));
  const ref = verifierSlot(p.slots);
  for (const r of [...new Set(judged.map(o => o.round))]) {
    const group = judged.filter(o => o.round === r);
    const when = Math.max(...group.map(o => at(o.updatedAt)));
    out.push({ kind: 'ruling', key: 'vf' + r, at: when, corner: 'center', stage: 'ruling', round: r, speaker: speakerFor(ref, p.slots), group });
  }

  // Who is working right now is shown by each model's presence block under its cards, not as a card.
  return out.sort((a, b) => a.at - b.at);
}
