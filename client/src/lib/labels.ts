import type { AgentStatus, ModelSlot, Question } from '../module_bindings/types';

export const STATUS_LABEL: Record<string, string> = {
  verified: 'Verified',
  agreed: 'Agreed',
  contested: 'Disputed',
  unresolved: 'Open risk',
};

export const STATUS_TEXT: Record<string, string> = {
  verified: 'text-ok',
  agreed: 'text-judg',
  contested: 'text-warn',
  unresolved: 'text-red',
};

export const STATUS_DOT: Record<string, string> = {
  verified: 'bg-ok',
  agreed: 'bg-judg',
  contested: 'bg-warn',
  unresolved: 'bg-red',
};

export const STATUS_HELP: Record<string, string> = {
  verified: 'A source was checked and supports this.',
  agreed: 'The critics found nothing to change here.',
  contested: 'An objection is still open against this.',
  unresolved: 'An objection stood when the round ended.',
};

// Who is talking. Each model has one color for the whole room; humans are ink.
export type Tone = 'red' | 'teal' | 'slate' | 'ink';
export type Speaker = { key: string; name: string; role: string; tone: Tone; human: boolean };

const SLOT_TONE: Record<string, Tone> = { council_a: 'red', chair: 'red', council_b: 'teal', checker: 'teal', council_c: 'slate' };
const SLOT_ROLE: Record<string, string> = { council_a: 'lead', chair: 'lead', council_b: 'critic', council_c: 'critic', checker: 'fact check' };

export function speakerFor(slot: string, slots: readonly ModelSlot[]): Speaker {
  const key = slot === 'chair' ? 'council_a' : slot;
  const row = slots.find(s => s.slot === key) ?? slots.find(s => s.slot === slot);
  return { key, name: row?.label ?? slot, role: SLOT_ROLE[key] ?? '', tone: SLOT_TONE[key] ?? 'ink', human: false };
}

export function humanSpeaker(name: string): Speaker {
  return { key: 'human:' + name, name, role: '', tone: 'ink', human: true };
}

export const TONE_TEXT: Record<Tone, string> = { red: 'text-red', teal: 'text-teal', slate: 'text-slate', ink: 'text-ink' };
export const TONE_BG: Record<Tone, string> = { red: 'bg-red', teal: 'bg-teal', slate: 'bg-slate', ink: 'bg-ink' };
export const TONE_BUB: Record<Tone, string> = { red: 'bub-red', teal: 'bub-teal', slate: 'bub-slate', ink: 'bub-human' };

// Legacy dot colors used by the header chips.
export function slotColor(slot: string): string {
  return TONE_BG[SLOT_TONE[slot] ?? 'ink'];
}

export type StateLook = { label: string; hl: string; chip: string };

export function objectionState(status: string): StateLook {
  switch (status) {
    case 'open':
      return { label: 'Open', hl: 'hl-red', chip: 'bg-red-soft text-red' };
    case 'addressed':
      return { label: 'Fix awaiting check', hl: 'hl-warn', chip: 'bg-warn-soft text-warn' };
    case 'withdrawn':
      return { label: 'Fixed', hl: 'hl-ok', chip: 'bg-ok-soft text-ok' };
    case 'overruled':
      return { label: 'Overruled', hl: 'hl-judg', chip: 'bg-judg-soft text-judg' };
    case 'unresolved':
      return { label: 'Open risk', hl: 'hl-red', chip: 'bg-red text-paper' };
    default:
      return { label: status, hl: 'hl-judg', chip: 'bg-judg-soft text-judg' };
  }
}

export function evidenceState(verdict: string): StateLook {
  switch (verdict) {
    case 'supported':
      return { label: 'Supported', hl: 'hl-ok', chip: 'bg-ok-soft text-ok' };
    case 'refuted':
      return { label: 'Refuted', hl: 'hl-red', chip: 'bg-red-soft text-red' };
    default:
      return { label: 'Unclear', hl: 'hl-warn', chip: 'bg-warn-soft text-warn' };
  }
}

export function narrative(q: Question, statuses: readonly AgentStatus[], slots: readonly ModelSlot[], openRisks: number): string {
  const label = (slot: string) => slots.find(s => s.slot === slot)?.label ?? slot;
  const lead = label('council_a');
  const critics = ['council_b', 'council_c'].map(label);
  const active = statuses.filter(s => !['idle', 'done', 'failed'].includes(s.state));
  switch (q.state) {
    case 'drafting':
      return q.version === 0 ? `${lead} is writing the first answer.` : `${active.map(s => label(s.slot)).join(' and ') || critics.join(' and ')} drafting their own view, blind, before the attack.`;
    case 'critiquing':
      return `${critics.join(' and ')} are attacking ${lead}'s answer on substance.`;
    case 'dissenting':
      return `Nobody objected, which is suspicious. ${label('council_c')} was assigned to argue the other side.`;
    case 'grounding':
      return `${label('checker')} is checking the disputed facts on the web.`;
    case 'synthesizing':
      return `${lead} is revising. Every change must cite an objection, a source, or your note.`;
    case 'verifying':
      return `${label('council_b')} is checking whether the fixes actually hold.`;
    case 'settled':
      return openRisks > 0 ? `Settled with ${openRisks} open risk${openRisks === 1 ? '' : 's'}.` : 'Settled. Every objection was resolved.';
    case 'failed':
      return 'The room hit a problem and stopped.';
    default:
      return q.state;
  }
}
