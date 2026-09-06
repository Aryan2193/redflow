# Redflow, full handoff (frontend and backend)

Paste this into any AI before working on Redflow. Backend sections are current. The UI section (4.2) predates the final control-room layout; see README.md and `client/src/components/ControlRoom.tsx` for the shipped room.

## 1. Product

Redflow is a live room where several different AI models fight over one team question while the team watches and steps in. Claude (the lead) writes a full answer alone. Perplexity and GPT-5.2 (the challengers) write their own answers blind, then attack Claude's answer on substance, quoting the exact claim and proposing a fix. Checkable claims go to a web fact check with sources. Claude comes back with a revised answer where every edit must cite a cause (an objection, a source, or a teammate's note) or the system refuses it. A verifier rules on each fix. What survives is the decision. Humans type at any time; their notes are read on the models' next turn and any section they change carries their name.

Hackathon: Midnight Moonshot (SpacetimeDB, Bengaluru, 5 to 6 Sep 2026), Agents track, statement "Agents have never had to share a world". Judged on real-time (35), problem (35), go-to-market (30). Qualifiers touching the code: live public URL, Maincloud module created in the window, public repo, nothing pushed after Sunday 08:30 IST, demo video under 3 minutes, stranger joins in under 30 seconds with no password, an email lands on signup, clear onboarding. Team: Aryan (captain, non-technical), Shreya (go-to-market), Claude Code (builder). Keep Redflow separate from every other project on the machine.

## 2. Architecture in one paragraph

Everything real-time lives in one SpacetimeDB TypeScript module (`server/spacetimedb/src/index.ts`, about 2,000 lines) published to Maincloud as database `redflow`. Tables hold rooms, members, questions, drafts, paragraphs, objections, evidence, versions, notes, agent status and agent events. Reducers handle human actions. The debate itself runs as scheduled procedures (`runStep`) that call OpenRouter over HTTP, parse JSON, and write results inside short transactions. The client (Vite, React 19, Tailwind v4, `spacetimedb/react`) subscribes to tables and calls reducers; it holds no logic of its own beyond rendering. There is no other server.

## 3. Backend

### 3.1 Tables (public unless noted)

- `config` (id 0, private): owner identity, killSwitch, maxCallsPerQuestion 45, maxQuestionsPerRoom 40, maxMembersPerRoom, defaultRoundCap, siteUrl (used in emailed links).
- `provider` (private): id 1 OpenRouter (baseUrl, apiKey), id 2 email sender (name `resend` or `webhook`, baseUrl, apiKey, extra = from address or relay token, enabled). Keys enter only through owner-only reducers; never in git.
- `model_slot`: slot, model, label, providerId, useWeb, enabled, reasoning ('' default, or low/medium/high/none), jsonMode ('prompt' or 'strict'). Seeds: council_a Claude anthropic/claude-sonnet-5 (lead, also used as `chair` for revisions), council_b Perplexity perplexity/sonar-pro (critic, verifier, and `checker` for fact checks), council_c GPT-5.2 openai/gpt-5.2 low (critic, dissenter). All prompt-JSON mode.
- `room`: code (4 chars, alphabet without 0/O/1/I), title (derived from the question), brief, createdBy, questionCount, callsUsed.
- `member`: roomId, identity, name, online, joinedAt, lastSeen. Index by_room_identity.
- `note`: roomId, questionId, teamQuestionId (0n; team questions are no longer created), author, authorName, text, consumedStep ('' until a step reads it), consumedRound.
- `question`: roomId, askedBy, askedByName, text, state, round, roundCap, version, createdAt, updatedAt, settledAt, wrapRequested, callsUsed, openObjections, lastError.
- `draft`: questionId, round, slot, label (anonymous letter shown to critics), model, text (markdown with `## ` headings), assumptions, latencyMs, ok.
- `paragraph`: questionId, ordinal, version, heading, text (markdown), status verified/agreed/contested/unresolved, causeType draft/objection/evidence/note, causeId, why, current. Every version kept; `current` rows are the live answer.
- `objection`: questionId, round, bySlot, byLabel, targetOrdinal, claim (verbatim quote), issue (may end with " Fix: ..."), checkable, severity 1 to 3, status open/addressed/withdrawn/overruled/unresolved, resolution, createdAt, updatedAt.
- `evidence`: questionId, objectionId, targetOrdinal, claim, verdict supported/refuted/unclear, url, title (one-sentence finding), excerpt (verbatim quote).
- `answer_version`: questionId, version, round, summary.
- `agent_status`: questionId, slot, state (idle/reading/drafting/critiquing/checking/synthesizing/verifying/dissenting/done/failed), detail.
- `agent_event`: questionId, slot, kind read/search/open/write, detail, url. The agents' visible hands: what a step read, web searches, every page a model cited (from OpenRouter url_citation annotations), each write with its duration.
- `team_question`: legacy, no longer written.
- `email_request` (private): roomId, questionId (0n for welcome emails), email, status queued/sent/failed/no_provider, sentAt.
- Scheduled: `step_schedule` (questionId, round, step, slot, attempt) runs `runStep`; `welcome_schedule` (requestId) runs `sendWelcome`; `watchdog_schedule` runs `watchdogTick` every 30s.

### 3.2 Reducers (snake_case at the CLI)

Owner only: `setProviderKey`, `setEmailProvider(kind, baseUrl, apiKey, extra)`, `setSiteUrl(url)`, `setModelSlot(slot, model, label, providerId, useWeb, reasoning, jsonMode)`, `setKillSwitch(on)`, `setLimits(...)`, `startWatchdog`.
Anyone: `openRoom(name, question)` creates room, joins, asks in one step; `createRoom`; `joinRoom(code, name)`; `leaveRoom(roomId)`; `postNote(roomId, text, teamQuestionId)` with 0n for a plain note; `ask(roomId, text)` (rejects while a question runs, under 15 chars or 3 words); `wrapUp(questionId)`; `goDeeper(questionId)` (another round); `requestVerdictEmail(questionId, email)`; `requestJoinEmail(roomId, email)` (welcome email with the room link, one per email per room per ten minutes). Rejections throw SenderError with a plain-English message that the UI shows.

### 3.3 How a question runs

State machine: drafting → critiquing (or dissenting when nobody objected) → grounding → synthesizing → verifying → settled (or failed). Rounds in the UI: Opening, The attack, Fact check, Comeback, Ruling.

1. `ask`/`openRoom` inserts the question and schedules `draft` for the lead only.
2. `stepDraft` (lead): reads question and notes; if the question mentions prices, versions, laws, rates, dates and the like, the call gets Exa web search (4 results) through OpenRouter's web plugin. Output: 3 to 7 sections with headings plus assumptions. Sections become version 1 paragraphs (status agreed, cause draft or note when notes were read). Then critic drafts are scheduled (only after version 1 exists, because the scheduler ignores insertion order).
3. `stepDraft` (critics): blind drafts, labeled with anonymous letters. `afterFanInCheck` moves to critiquing when both are in (or promotes a critic draft if the lead failed).
4. `stepCritique`: each critic sees the answer, its own draft and the other blind draft, up to 3 objections with claim, issue, fix, checkable, severity. Zero objections from both → `dissent` (GPT-5.2 argues the other side, max 2). Target paragraphs become contested.
5. `stepGround` (checker, Perplexity): top 4 checkable open objections by severity, one search call, then a second pass on anything unclear aimed at the page that owns the fact. Supported claim → objection overruled ("A source supports the claim: ..."), paragraph verified if nothing else is open against it. Refuted → stays open for the lead to fix. Skipped entirely if nothing is checkable.
6. `stepSynthesize` (chair = lead): receives open objections, evidence, overrules by evidence, new team notes. Returns edits (rewrite/add/remove with heading, body, cause_type, cause_id, why), addressed_objections (how, spoken to the critic), overruled_objections (reason, spoken to the critic), summary. Server enforces: every edit needs a real cause id or is refused; one edit per ordinal per pass; overrule needs a reason; notes are credited by name in `why`. New paragraphs get version+1. Addressed objections → `verify`; none addressed → settle.
7. `stepVerify` (Perplexity): each addressed objection → withdraw (fixed) or hold (back to open). Resolution strings: "<how> | withdrawn: <reason>" or "<how> | held: <reason>".
8. `settleFromVerify`/`settle`/`finalize`: ledger empty → settled. Round cap or wrap-up → open objections become `unresolved` (open risks) and the question settles. `goDeeper` starts a new round from critiquing with fresh drafts as needed.

Failure handling: `failStep` retries a step twice (attempt < 2), lead draft failure promotes a critic draft, verify failure reopens, chair failure marks open objections unresolved and settles. `watchdogTick` restarts a step idle for 130s and wraps up any question older than 10 minutes. Procedures on Maincloud run one at a time and hold the global lock, so steps are single HTTP calls, never loops. A republish mid-step can orphan a procedure; the watchdog recovers it.

### 3.4 Model calls

`callModel(ctx, slotRow, prov, system, user, jsonSchema, maxTokens, webResults, timeoutMs)` posts to OpenRouter chat completions. Prompt-JSON mode: the schema is appended to the system prompt and `response_format: json_object` is set for anthropic/openai models; strict json_schema for others. Web: perplexity searches on its own; openai/google use the native engine; everything else gets Exa. `repairJson` fixes raw control characters, fences, trailing commas; `finish_reason: length` is reported as "output cut off". Claude thinks by default through OpenRouter and the thinking counts against max_tokens, so Anthropic calls get an explicit thinking budget (min(4000, maxTokens)) and `max_tokens = maxTokens + budget + 9000`. Every call logs one line to the module log: `model call <slot> <model> finish= out= think= in= cost= ms=`. Typical bout: 7 to 9 calls, 2 to 3.5 minutes, 20 to 30 US cents.

Prompts: a dated house preamble (today's date injected, writing and trust rules), lead prompt shaped to the question type with section one capped at 90 words (it is the decision's bottom line), critic prompt with a six-point checklist, severity and checkable definitions, a "would the team act differently" test, a paste-ready fix, and a fight voice ("You say X. It is wrong: Y."), dissenter pre-mortem plus steelman, fact checker with verdict semantics and a source hierarchy, revision working evidence, then notes, then objections with named overrule grounds and comebacks spoken to the critic by name, verifier ruling like a referee. No questions to the team; the lead decides for the most likely case and names the assumption.

### 3.5 Email

`requestVerdictEmail` → `stepEmail` sends the settled answer, ledger and sources. `requestJoinEmail` → `sendWelcome` sends "Your Redflow room: ..." with the room link built from `config.siteUrl`. Both go through provider 2: `resend` (POST /emails with bearer key) or `webhook` (POST JSON {token, to, subject, html, text} to a relay; `tools/apps-script-relay.gs` is a Google Apps Script that sends from Gmail). Provider 2 is not configured yet; queued rows sit as no_provider until `set_email_provider` is called.

### 3.6 Commands

CLI binary `C:\Users\aryan\AppData\Local\SpacetimeDB\spacetime.exe`. From `server/spacetimedb`: `spacetime build`, `spacetime publish -s local redflow --yes`, `spacetime publish -s maincloud redflow --yes` (check no question is in flight first: `spacetime sql -s maincloud redflow "SELECT id, state FROM question WHERE state <> 'settled' AND state <> 'failed'"`), `spacetime generate --lang typescript --out-dir ../../client/src/module_bindings` after any schema change, `spacetime logs -s maincloud redflow -n 40`. Schema changes must be additive (new tables, or new columns with `.default()`); wipe only with `--delete-data=always` and only before users are in. Owner reducers: `spacetime call -s maincloud redflow set_site_url '"https://..."'`, `set_email_provider '"webhook"' '"<url>"' '""' '"<token>"'`, `set_model_slot ...`.

## 4. Frontend

### 4.1 Stack and data flow

Vite + React 19 + TypeScript + Tailwind v4 (tokens in `@theme` in `client/src/index.css`), react-markdown + remark-gfm. Data via `spacetimedb/react`: `const [rows, ready] = useTable(tables.paragraph.where(r => r.questionId.eq(qid)), { enabled })`; `const ask = useReducer(reducers.ask); await ask({ roomId, text })`; `useSpacetimeDB()` gives `isActive` and `identity`. Bindings in `client/src/module_bindings` are generated, never hand-edited. Tokens are stored per server (`redflow.token.<uri>.<db>`) with 401 recovery in `lib/stdb.ts`. Env: `client/.env.production` sets the Maincloud URI, database `redflow`, demo room `42YU`. `npm run dev -- --mode production` develops against Maincloud; `npm run build`; `npm run preview` serves dist on :4173.

### 4.2 Screens

- Home (`pages/Home.tsx`): question textarea, name, optional email, "Ask the room" → `openRoom`, then navigates to `/r/CODE` when the new room appears in the subscription. Join by code below. Email is kept in localStorage until the person is in the room.
- Room (`pages/Room.tsx`): subscriptions for the room and the selected question (latest by default, a bout selector for earlier ones), auto-join when a name is remembered, join gate (name plus optional email) otherwise, header (title, bout selector, people count, How this works, room code copy), RoundBar, Arena, Composer. Once the member exists, a pending email triggers `requestJoinEmail` once.
- Arena (`components/Arena.tsx`): full-viewport, the page never scrolls. Three tracks with `minmax(0, ...)`: left corner Claude (defends), ring in the middle (pinned question, fact checks, notes, ruling, decision), right corner Perplexity + GPT-5.2 (challengers). Newest card at the bottom of each column; older cards fold to one-line entries; Claude's corner keeps one open, the others two. Columns follow the fight through reflows (ResizeObserver) until the reader scrolls away. Round banner on each stage change. When decided the ring widens and the corners dim, and the verdict aligns to its headline. Under 900px: one column, cards lean to their corner.
- Presence (`components/Activity.tsx`, default export `Presence`): under each model's cards, its avatar, name, a live micro-step (`lib/narrate.ts` rotates through the honest sub-steps of the current stage every 2.4s) and its last real moves from `agent_event` with a "N moves so far" counter. Center gets the checker's presence when it has acted.
- Cards (`components/Cards.tsx`): every item as a gist (heading, highlighted claim, first sentence, stamps, section chips) with the rest behind See more / See the changes / See the reasons. Kinds: question, note, answer (first answer with live section chips Under attack / Revised in vN / Verified / Open risk and a hit flash when a section is newly contested), draft, objection (HIT, HEAVY at severity 3, ANSWERED, FIXED, BLOCKED, STILL OPEN), evidence (STANDS, REFUTED, NO CALL, source host), revision (CONCEDED, CORRECTED, FROM THE TEAM per edit, BLOCKED per overrule, word diff when the change is targeted), ruling (FIXED / STILL OPEN). Fresh cards write themselves in at about 70 characters a second (`lib/reveal.ts`); old cards render in full.
- Verdict (`components/Verdict.tsx`): dark card. DECISION stamp, headline (section one heading), The debate (one-line account plus hits, fixed, blocked, stood on evidence, facts checked, sources), What the debate changed (each change with who caused it), The answer (section one body), open risks, actions: Read the full answer (unfolds the document with status dots), Go deeper, Share as image (`lib/shareCard.ts`), Email it.
- Composer (`components/Composer.tsx`): pills Step in / New question (disabled while a question runs), queued-notes count, Wrap it up now; Enter sends.
- `lib/bout.ts` turns rows into ordered items with corner, round and speaker and holds helpers (`cleanHeading`, `cleanWhy`, `unquote`, `splitSections`, `hostOf`, `causeOf`, `ROUNDS`, `roundIndex`, `ACTIVE_STATES`). `lib/labels.ts` speaker tones and state looks. `lib/diff.ts` word diff. `lib/autosize.ts`.

### 4.3 Design system

Light warm paper. Tokens: paper #f7f5f0, sheet #fffdf9, ink #1c1a17, ink-2 #453f37, muted #7d766b, line #e3ded4, red #b8321f (Claude, refuted, open risk), teal #1c7c8a (Perplexity), slate #4a5d8a (GPT-5.2), ok #2f7a4d, warn #a86a0b, judg #5f6b7a, each with a -soft tint. Fonts: Newsreader for the verdict headline and the full-answer document, Instrument Sans for UI and cards, Barlow Condensed (`.font-fight`) only for stamps, corner names and round banners. Color carries state on the key text via `.hl-*`, never on whole messages. Speaker tints `.bub-*`. Motion ease-out expo, 260 to 520ms, no bounce; all static under prefers-reduced-motion. Copy: plain words, no em dashes, no exclamation marks, every state has a word not only a color.

### 4.4 Deploy

Public URL is GitHub Pages from the `gh-pages` branch: from `client/`, `MSYS_NO_PATHCONV=1 npx vite build --base=/redflow/ --outDir dist-pages`, copy `index.html` to `404.html` (SPA fallback), add `.nojekyll`, push the folder as the `gh-pages` branch (force). The LAN preview during the hackathon is `vite preview` on :4173. `vercel.json` exists if a Vercel deploy is ever wanted.

## 5. State of play and open items (as of Sunday 06:30 IST)

- Live and verified: full bout on Maincloud with web search for the lead, two-pass fact check, presence feeds, arena, verdict. Public URL live. Repo public, pushed at every step.
- Open: email provider 2 not configured (needs a relay URL and token, or a Resend key with a verified domain); demo video to record against docs/DEMO-SCRIPT.md; launch post (docs/LAUNCH-POST.md) needs the arena vocabulary; freeze 08:30, nothing pushed after that.
- Decided against, with reasons in NOTES.md: adopting AI Town (Convex engine, wrong for the SpacetimeDB rubric), OpenPets (desktop-only), animated fighter figures (removed at Aryan's call), a Gather-style stage (no time).
- Cost: about $2.50 of OpenRouter credit used so far; a bout costs 20 to 30 US cents.
