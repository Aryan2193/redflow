# Redflow, frontend context

Paste this into any AI before asking it to work on the Redflow client.

## What Redflow is

Redflow is a live room where several different AI models fight over one team question while the team watches and steps in. A user asks one question. Claude (the lead) writes a full answer alone. Perplexity and GPT-5.2 (the challengers) write their own answers blind, then attack Claude's answer on substance, quoting the exact claim and proposing a fix. Checkable claims go to a web fact check. Claude comes back with a revised answer where every edit must cite a cause (an objection, a source, or a teammate's note) or the system refuses it. A verifier rules on whether each fix holds. What survives is the decision. Humans can type at any time: their notes are read on the models' next turn and any section they change carries their name.

Built for the Midnight Moonshot 24-hour hackathon (SpacetimeDB, Bengaluru, 5 to 6 Sep 2026), Agents track, statement "Agents have never had to share a world". Judged on real-time (35), problem (35), go-to-market (30). Frontend-relevant qualifiers: works on a phone, a stranger joins in under 30 seconds with no password, an email form that lands, and clear onboarding. Code freeze Sunday 08:30 IST.

Team: Aryan (captain, non-technical), Shreya (go-to-market), Claude Code (sole builder so far). Product name and brand: Redflow. Nothing from any other project belongs here.

## The UI today: a bout arena (v4)

The room is a full-viewport arena that never scrolls the page.

- Left corner: Claude, "defends the answer". Right corner: Perplexity + GPT-5.2, "challengers". Middle: "the ring", holding the pinned question, fact checks, Claude's questions to the team, humans' notes, the ruling, and finally the decision card.
- Newest card lands at the bottom of its column; older cards fold to one-line entries (click to open). Claude's corner keeps one card open, the other columns two. Columns scroll internally only as a safety net.
- Five rounds shown in a round bar with a live clock: Opening, The attack, Fact check, Comeback, Ruling. A banner sweeps the ring on every round change. When the bout is decided the ring widens (grid-template-columns transition) and the corners dim.
- Effects mark state only: cards slide in from their corner; rubber stamps (HIT, HEAVY, ANSWERED, FIXED, BLOCKED, STILL OPEN, STANDS, REFUTED, NO CALL, CONCEDED, CORRECTED, FROM THE TEAM, DECISION) scale in; a section of Claude's answer flashes and shakes when a hit lands on it; the decision card scales in. All static under prefers-reduced-motion.
- Fresh cards "write themselves in" at about 70 characters a second (a client-side reveal; the server delivers whole messages, real token streaming is not available).
- One composer at the bottom handles everything humans type: pills "Steer the debate" / "New question" (one question at a time), amber "Reply to Claude" chips for open team questions, "N notes waiting for the next turn", "Wrap it up now".
- Under 900px: one column, cards lean to their corner, the ring items run full width, compact round bar (R1 to R5).
- Home page: question-first. Type the question and a name, press "Ask the room", land in a new room at /r/CODE. Also join by four-letter code. Rooms need no account; the name is remembered on the device.

## Stack and layout of the client

- Vite + React 19 + TypeScript + Tailwind v4 (tokens in `@theme` in `client/src/index.css`). react-markdown + remark-gfm for markdown bodies. No other UI libraries.
- Real-time data: SpacetimeDB via `spacetimedb/react`. Everything on screen is a subscription; every human action is a reducer call. Generated bindings live in `client/src/module_bindings` (never hand-edit; regenerate from the server if the schema changes).
  - `const [rows, ready] = useTable(tables.paragraph.where(r => r.questionId.eq(qid)), { enabled })`
  - `const ask = useReducer(reducers.ask); await ask({ roomId, text })` (one params object, returns a promise, throws with a readable message on rejection)
  - `const { isActive, identity } = useSpacetimeDB()`
- Files:
  - `src/App.tsx` tiny router (`/` Home, `/r/:code` Room), BASE-aware, error boundary, `navigate(path)`.
  - `src/pages/Home.tsx` question-first landing. `src/pages/Room.tsx` subscriptions, join gate, header, bout selector, RoundBar, Arena, Composer.
  - `src/components/Arena.tsx` corners, ring, folding, round banner, verdict placement. `Cards.tsx` every card body plus fold summaries and stamps. `Composer.tsx` the bottom input. `RoundBar.tsx`. `Stamp.tsx`. `Verdict.tsx` the decision card (headline, bottom line, what changed and who caused it, sources, open risks, score strip, Read the full answer, Go deeper, Share as image, Email it).
  - `src/lib/bout.ts` turns rows into ordered items with corner, round and speaker; helpers `cleanHeading`, `cleanWhy`, `unquote`, `splitSections`, `hostOf`, `causeOf`, `ROUNDS`, `roundIndex`. `lib/labels.ts` speaker tones and state looks. `lib/reveal.ts` `useLive`, `useReveal`, `useMediaQuery`. `lib/diff.ts` word diff. `lib/autosize.ts`. `lib/stdb.ts` connection, token storage, `toDate`, `timeAgo`, `idHex`. `lib/shareCard.ts` canvas PNG of the verdict.
- Env: `client/.env.production` sets `VITE_STDB_URI=wss://maincloud.spacetimedb.com`, `VITE_STDB_DB=redflow`, `VITE_DEMO_ROOM=42YU`. Dev without a mode points at a local server on ws://127.0.0.1:3000; use `npm run dev -- --mode production` to develop against the live Maincloud database. `npm run build` then `npm run preview` serves dist on :4173.

## Data the frontend reads (the contract, kept to what the UI needs)

One `room` (id, code, title, brief, questionCount) has `member`s (name, online, identity), `question`s, `note`s and `team_question`s. Each `question` (id, roomId, askedByName, text, state, round, version, openObjections, lastError, createdAt, updatedAt, settledAt, wrapRequested) has:

- `draft` (slot, round, label, text as markdown with `## ` headings, assumptions, latencyMs). The lead's round-1 draft is version one of the answer.
- `paragraph` (ordinal, version, heading, text as markdown, status, causeType, causeId, why, current). `current` rows are the live answer. Status: verified, agreed, contested, unresolved. causeType: draft, objection, evidence, note. `why` reads like "Because of objection 4112: ..." or "Because Aryan said so: ..."; `cleanWhy` strips the prefix.
- `objection` (bySlot, round, targetOrdinal, claim, issue, checkable, severity 1 to 3, status, resolution). `issue` may contain " Fix: <fix>". Status: open, addressed (lead says it fixed it, awaiting the verifier), withdrawn (fixed), overruled (blocked, by evidence or by the lead), unresolved (stood when the round ended, shown as an open risk). `resolution` conventions: "A source supports the claim: ...", "Overruled by the lead: ...", "<how> | withdrawn: <reason>", "<how> | held: <reason>".
- `evidence` (objectionId, targetOrdinal, claim, verdict supported/refuted/unclear, url, title = one-sentence finding, excerpt = verbatim quote).
- `answer_version` (version, round, summary). Version 2+ is a comeback.
- `team_question` (text, answer, answeredByName, answeredAt): Claude asking the team something only they know.
- `note` (authorName, text, teamQuestionId or 0n, consumedStep empty until a model has read it).
- `agent_status` (slot, state, detail): who is working right now. Active states: reading, drafting, critiquing, checking, synthesizing, verifying, dissenting.
- `model_slot` (slot, label, enabled): council_a = Claude (lead, also the chair), council_b = Perplexity (critic, verifier, fact checker), council_c = GPT-5.2 (critic, dissenter when nobody objects), checker, chair.

Question state machine, in order: drafting, critiquing (or dissenting), grounding, synthesizing, verifying, settled (or failed). Rounds map onto it: Opening = drafting, The attack = critiquing/dissenting, Fact check = grounding, Comeback = synthesizing, Ruling = verifying. "Go deeper" starts another round with the same states.

Reducers the UI calls: `openRoom({ name, question })`, `joinRoom({ code, name })`, `ask({ roomId, text })` (rejects while a question is running, and under 15 chars or 3 words), `postNote({ roomId, text, teamQuestionId })` (0n for a plain note), `wrapUp({ questionId })`, `goDeeper({ questionId })`, `requestVerdictEmail({ questionId, email })`.

## Design system

- Light, warm paper. A bright hackathon hall and a projector, not a dark dashboard. Tokens: paper #f7f5f0, sheet #fffdf9, ink #1c1a17, ink-2 #453f37, muted #7d766b, line #e3ded4, line-2 #ede9e1, red #b8321f (Claude, refuted, open risk), teal #1c7c8a (Perplexity), slate #4a5d8a (GPT-5.2), ok #2f7a4d (verified, fixed, stands), warn #a86a0b (pending, unclear, team), judg #5f6b7a (overruled, agreed). Each has a `-soft` tint.
- Fonts: Newsreader (serif) for the verdict headline and the full-answer document; Instrument Sans for UI and card bodies (15px in cards); Barlow Condensed (`.font-fight`) only for stamps, corner names and round banners; system mono for room codes.
- Color carries state on the key text only, via `.hl .hl-red|ok|warn|judg|teal|slate` (soft background plus a 2px inset underline), never on whole messages. Speaker tints on cards via `.bub .bub-red|teal|slate|human`.
- Motion: ease-out expo `cubic-bezier(0.16, 1, 0.3, 1)`, 260 to 520ms, no bounce. Classes: `enter-l`, `enter-r`, `enter-c`, `stamp-in`, `hit`, `round-banner`, `verdict-in`, `caret`, `typing`, `pulse`. `.card-scroll` caps long bodies at 34vh. `.chat-md` styles markdown inside cards, `.doc` styles the full-answer document.
- Banned: side-stripe borders as accents, gradient text, glassmorphism, confetti, sound, bouncy easing, dark mode by default, identical card grids, modals as a first thought.

## Copy rules

Plain words, short sentences. No em dashes anywhere (use commas, colons or periods). No exclamation marks in UI copy. No AI cliches. Every state has a word as well as a color (Under attack, Fixed, Stands, Refuted, Open risk). Controls say what happens ("Ask", "Send", "Reply", "Wrap it up now", "Go deeper"). Address the team as "you", the models by their labels.

## Boundaries

The frontend never changes the schema or the pipeline. If a UI idea needs a new field, say so; that is a server change plus regenerated bindings. Keep the page from scrolling, keep everything reachable on a phone with one thumb, keep the join flow at "type a name, you are in".
