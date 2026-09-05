// What a model is doing inside a call, told in small steps. The server only knows the step; these lines are the
// honest narration of what that step consists of, rotating while the call runs. Real events (searches, pages
// opened, writes) come from the agent_event table and sit alongside these.

const STEPS: Record<string, string[]> = {
  lead_drafting: [
    'reading the question again',
    'listing the options',
    'picking a recommendation',
    'writing section 1',
    'putting numbers and dates to it',
    'writing the risks',
    'writing the first seven days',
    'checking every claim has a date',
  ],
  drafting: ['reading the question', 'taking a position', 'writing the strongest reasons', 'naming the common mistake', 'listing assumptions'],
  reading: ['reading the brief', 'waiting for the first answer', 'reading the first answer'],
  critiquing: [
    'reading section 1',
    'comparing with own draft',
    'checking the numbers in section 2',
    'looking for the missing option',
    'testing whether the team would act differently',
    'quoting the exact claim',
    'writing the fix',
    'rating severity',
  ],
  dissenting: ['running the pre-mortem', 'steelmanning the other side', 'quoting the weakest claim', 'writing the fix'],
  checking: ['searching the web', 'opening the top result', 'reading the page', 'looking for the primary source', 'copying the exact quote', 'deciding: stands or refuted'],
  synthesizing: [
    'reading the evidence first',
    'reading the objections',
    'deciding what to concede',
    'deciding what to block',
    'rewriting section 1',
    'recording the cause of each edit',
    'writing the comeback line',
  ],
  verifying: ['re-reading the revised section', 'checking the fix against the objection', 'looking for a deleted claim the answer still leans on', 'ruling'],
};

export function microStep(state: string, slot: string, elapsedMs: number): string {
  const key = state === 'drafting' && slot === 'council_a' ? 'lead_drafting' : state;
  const list = STEPS[key] ?? STEPS.reading;
  const offset = slot === 'council_b' ? 1 : slot === 'council_c' ? 2 : 0;
  const i = (Math.floor(Math.max(0, elapsedMs) / 2400) + offset) % list.length;
  return list[i];
}
