# Redflow, frontend context for a redesign

Paste this into any AI before asking it to design or build a new Redflow client. It describes the product, the live data it must render, and the rules that hold. It deliberately says nothing about how the current client looks, because you are designing that from scratch.

## What Redflow is

Redflow is a live room where several different AI models fight over one team question while the team watches and steps in. A user asks one question. Claude (the lead) writes a full answer alone. Perplexity and GPT-5.2 (the challengers) write their own answers blind, then attack Claude's answer on substance, quoting the exact claim and proposing a fix. Checkable claims go to a web fact check. Claude comes back with a revised answer where every edit must cite a cause (an objection, a source, or a teammate's note) or the system refuses it. A verifier rules on whether each fix holds. What survives is the decision. Humans can type at any time: their notes are read on the models' next turn and any section they change carries their name.

Built for the Midnight Moonshot 24-hour hackathon (SpacetimeDB, Bengaluru, 5 to 6 Sep 2026), Agents track, statement "Agents have never had to share a world". Judged on real-time (35), problem (35), go-to-market (30). Frontend-relevant qualifiers: works on a phone, a stranger joins in under 30 seconds with no password, an email form that lands, and clear onboarding. Code freeze Sunday 08:30 IST.

Team: Aryan (captain, non-technical), Shreya (go-to-market), Claude Code (sole builder so far). Product name: Redflow. Nothing from any other project belongs here.

## Who is on stage

- Claude: the lead. Writes the first full answer, asks the team questions only they can answer, and revises after the attack. Every revision cites its cause.
- Perplexity: challenger. Writes a blind answer, attacks Claude's answer, fact-checks claims on the web with sources, and rules on whether Claude's fixes hold.
- GPT-5.2: challenger. Writes a blind answer, attacks Claude's answer, and is assigned to argue the other side when nobody objects.
- Humans: ask the one question, answer Claude's questions to the team, add facts and corrections mid-debate, wrap it up, go deeper, ask again. Up to ten in a room, no accounts, a name is enough.

## How one question runs

1. Ask. One question at a time per room. The lead starts writing; the challengers wait to draft blind.
2. First answer. Claude's full answer lands as version one, usually within a minute, in 3 to 7 sections with headings. Claude may post up to two questions for the team.
3. Blind drafts. The challengers' own answers land.
4. The attack. Each challenger raises up to three objections, each quoting the exact claim, saying what is wrong, proposing a fix, marking severity 1 to 3 and whether a web search could settle it. If nobody objects, GPT-5.2 is assigned to dissent.
5. Fact check. Checkable claims are searched. Each comes back supported, refuted, or unclear, with a source URL and a verbatim quote.
6. Comeback. Claude revises: sections rewritten, added or removed, each with a cause and a one-line why. Objections are either addressed or overruled with a reason. A version summary is written.
7. Ruling. Perplexity checks each addressed objection against the revised text: withdrawn (fixed) or held (still open).
8. Decision. When nothing stands open the question settles. Objections still standing appear as open risks. Anyone can press Go deeper for another round or email the verdict.

Typical bout: 7 to 8 model calls, 2 to 3 minutes end to end.

## Stack

- Vite + React 19 + TypeScript + Tailwind v4. react-markdown + remark-gfm for markdown bodies. Add nothing heavy without a reason; the page must load fast on a phone at a hackathon venue.
- Real-time data comes from SpacetimeDB via `spacetimedb/react`. Everything on screen is a subscription; every human action is a reducer call. Generated bindings live in `client/src/module_bindings` (never hand-edit; regenerate from the server if the schema changes).
  - `const [rows, ready] = useTable(tables.paragraph.where(r => r.questionId.eq(qid)), { enabled })`
  - `const ask = useReducer(reducers.ask); await ask({ roomId, text })` (one params object, returns a promise, throws with a readable message on rejection)
  - `const { isActive, identity } = useSpacetimeDB()`
- Keep as infrastructure: `src/module_bindings/` (generated), `src/lib/stdb.ts` (connection, per-server token storage, 401 recovery, `toDate`, `timeAgo`, `idHex`), `src/App.tsx` (routes `/` and `/r/:code`, BASE-aware, error boundary, `navigate(path)`), `src/lib/diff.ts` (word diff between versions, useful for showing what changed), `src/lib/autosize.ts` (textarea autogrow). Everything else in `src/pages` and `src/components` is the old design and can be replaced wholesale.
- Env: `client/.env.production` sets `VITE_STDB_URI=wss://maincloud.spacetimedb.com`, `VITE_STDB_DB=redflow`, `VITE_DEMO_ROOM=42YU` (a room with finished bouts to render against). Dev without a mode points at a local server on ws://127.0.0.1:3000; use `npm run dev -- --mode production` to develop against the live Maincloud database. `npm run build` then `npm run preview` serves dist on :4173.

## Data the frontend reads (the contract)

One `room` (id, code, title, brief, questionCount) has `member`s (name, online, identity, joinedAt), `question`s, `note`s and `team_question`s. Each `question` (id, roomId, askedByName, text, state, round, version, openObjections, lastError, createdAt, updatedAt, settledAt, wrapRequested) has:

- `draft` (slot, round, label, text as markdown with `## ` headings, assumptions, latencyMs). The lead's round-1 draft is version one of the answer.
- `paragraph` (ordinal, version, heading, text as markdown, status, causeType, causeId, why, current). `current` rows are the live answer, sorted by ordinal. Status: verified, agreed, contested, unresolved. causeType: draft, objection, evidence, note. `why` reads like "Because of objection 4112: ..." or "Because Aryan said so: ..."; strip the prefix for display. Every version is kept, so before-and-after and word diffs are possible.
- `objection` (bySlot, round, targetOrdinal, claim, issue, checkable, severity 1 to 3, status, resolution, createdAt, updatedAt). `issue` may contain " Fix: <fix>"; split on it. Status: open, addressed (lead says it fixed it, awaiting the verifier), withdrawn (fixed), overruled (blocked, by evidence or by the lead), unresolved (stood when the round ended, show as an open risk). `resolution` conventions: "A source supports the claim: ...", "Overruled by the lead: ...", "<how> | withdrawn: <reason>", "<how> | held: <reason>". The verifier's ruling has no row of its own; derive it from objections whose resolution contains "| withdrawn:" or "| held:".
- `evidence` (objectionId, targetOrdinal, claim, verdict supported/refuted/unclear, url, title = one-sentence finding, excerpt = verbatim quote, createdAt).
- `answer_version` (version, round, summary, createdAt). Version 2 and up are revisions; the summary is the lead's one-line account of what changed.
- `team_question` (text, answer, answeredByName, answeredAt, createdAt): Claude asking the team something only they know. Answered through a note carrying its id.
- `note` (authorName, text, teamQuestionId or 0n, consumedStep empty until a model has read it, createdAt). Humans' messages.
- `agent_status` (slot, state, detail): who is working right now and on what. Active states: reading, drafting, critiquing, checking, synthesizing, verifying, dissenting. Terminal: done, failed, idle.
- `model_slot` (slot, label, enabled): council_a = Claude (lead, also revises as "chair"), council_b = Perplexity (critic, verifier, and fact checker under the slot name checker), council_c = GPT-5.2 (critic, dissenter), plus checker and chair rows that resolve to the same two models. Use `label` for display.

Question state machine, in order: drafting, critiquing (or dissenting), grounding, synthesizing, verifying, settled (or failed). Everything arrives as row inserts and updates in real time; there is no streaming of partial text, a card's text is complete when its row appears.

Reducers the UI calls: `openRoom({ name, question })` creates a room and asks in one step; `joinRoom({ code, name })`; `ask({ roomId, text })` (rejects while a question is running, and under 15 chars or 3 words); `postNote({ roomId, text, teamQuestionId })` (0n for a plain note); `wrapUp({ questionId })`; `goDeeper({ questionId })`; `requestVerdictEmail({ questionId, email })`. Rejections carry a plain-English message; show it.

## What the UI must make legible

Design it however you like, but a stranger who has never seen it must be able to tell, within seconds and from a metre away on a projector:

- who is speaking (which model or which person) and what round the bout is in;
- what was attacked (the quoted claim), how badly (severity), and what happened to that attack (open, answered, fixed, blocked, still open);
- which facts were checked, and whether the claim stood or fell, with the source one tap away;
- what changed in the answer and who caused each change (a challenger, a source, or a named teammate);
- the current answer, recommendation first, with each section's status;
- when it is decided, the decision itself, concise, with open risks impossible to miss;
- where to type, and what typing will do right now (new question, steer the running debate, or answer Claude's question).

## Rules that hold regardless of design

- Plain words, short sentences. No em dashes anywhere (commas, colons or periods instead). No exclamation marks in UI copy. No AI cliches.
- Every state has a word, not only a color. Never rely on color alone.
- Works on a phone with one thumb. Joining is "type a name, you are in". No account, no password, no email at the door; the email form lives at the moment of value, when a question settles.
- Respect prefers-reduced-motion with a static equivalent for every effect. Contrast at AA.
- The frontend never changes the schema or the pipeline. If a design needs a new field, say so; that is a server change plus regenerated bindings.
