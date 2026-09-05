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
  unresolved: 'An objection stood when the round ended. Read it below.',
};

// Colors for the people at the table. Lead is the brand red.
export function slotColor(slot: string): string {
  switch (slot) {
    case 'council_a':
    case 'chair':
      return 'bg-red';
    case 'council_b':
    case 'checker':
      return 'bg-teal';
    case 'council_c':
      return 'bg-slate';
    default:
      return 'bg-ink';
  }
}

export const STAGES = ['Drafting', 'Critique', 'Fact check', 'Revision', 'Settled'] as const;

export function stageIndex(q: Question): number {
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
      return 3;
    case 'settled':
    case 'failed':
      return 4;
    default:
      return 0;
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
      return openRisks > 0 ? `Settled with ${openRisks} open risk${openRisks === 1 ? '' : 's'}, shown below.` : 'Settled. Every objection was resolved.';
    case 'failed':
      return 'The room hit a problem and stopped.';
    default:
      return q.state;
  }
}
