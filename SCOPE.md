<!-- Midnight Moonshot scope v1.1, Sat 5 Sep 2026 17:00 IST. Generated from moonshot-scope.html; the published page is canonical. -->

*Redflow · Agents track · Statement: "Agents have never had to share a world"*

# Redflow: a room where several AI models argue over your team's question, and your team argues back, live.

This page is the single source of truth for the build. The one-pager is the shareable summary. The full scope below it is what gets built tonight, what does not, and why.

*One-pager · Redflow*

## Redflow in one page

### The problem

Every AI answer today is one model's first draft. Nobody checks it. When models are made to check each other, they agree too fast and end up wrong together. Teams then paste that draft into a group chat and argue about it with the AI outside the room.

### What we are building

- **A shared room, joined by link or a four-character code, with just a name.** Ten teammates can be in it at once. Judges get in within thirty seconds.
- **Four different AI models, not one.** Three answer blind, critique each other anonymously, and one chair rebuilds the answer. A fact-checker verifies the claims that can be verified, with sources.
- **Humans steer mid-debate.** Any teammate drops context or a correction at any time. The agents absorb it on their next turn instead of restarting.
- **The answer is a living document.** One panel, always the current best version, edited in place. Every paragraph shows whether it is Verified, Contested, Agreed judgment, or Unresolved. Every change names its cause: an objection, a source, or a teammate.

### How one question runs

1. **Ask.** The room has a two-line brief. Anyone types a question. New notes queue and are read as one batch on the next turn.
2. **Blind drafts.** Three models answer independently, in parallel, capped at about 250 words. The first synthesis is on screen in about a minute, marked version one.
3. **The room asks the team.** The moderator lists the things only the team can know and posts them as questions anyone can answer.
4. **Anonymous critique.** Each model attacks the other two drafts, shown in random order with no author names. Every attack lands in the objection ledger.
5. **Grounding.** Checkable claims go to web search. Verdicts come back with citations. Judgments are marked as judgments, not chased.
6. **Synthesis with obligation.** The chair edits the answer one justified edit at a time. An edit with no cited cause is refused by the system.
7. **Settle or go deeper.** Critics withdraw objections with a reason or hold. Empty ledger means settled. Open objections show as unresolved risks, and anyone can press "go deeper."

### Why it wins on the rubric

| Parameter | Points | How we score it |
|---|---|---|
| Real-time | 35 | The product cannot exist without shared state. The deliberation itself runs inside the SpacetimeDB module. The whole room is inside one live world. Two tabs: ask in one, correct from the other, both watch the agents pivot. |
| Cracked the problem | 35 | The statement opens with "every agent assumes it is the only actor on the state." Ours must handle each other's edits and the humans' interjections. A judge completes ask, steer, read in under three minutes. The hard part others skip: conformity, and live steering without a restart. |
| Take it to market | 30 | Named ICP on the product and in the post. A named first-500 channel with signups shown live. Three posts across the day. Screenshots of models disagreeing are the traction engine. |

### What makes it different

Multi-model councils exist for one person, one shot, at a premium price, and mark agreement at the answer level. Group chats with an AI exist with one model and no critique. Nobody has put a team inside a live multi-model deliberation, grounded the debate with tools, and tracked every objection to resolution at the claim level. The research says solo debate makes models agree and be wrong together. Our ledger is built to prevent exactly that.

### Tonight

- 17:00 Setup, accounts, hour-one tests
- 20:00 Checkpoint 3: two phones, first draft landing live
- 23:00 Launch post, first strangers in
- 01:30 Fix what users broke, then polish
- 06:00 Demo video, freeze prep
- 08:30 Code freeze

### Asks from the team

- ICP choice and the one-liner in Shreya's words
- OpenRouter account with about $30 credit
- Resend account plus DNS records on our domain
- Posts one, two, three. Twenty-five users tonight
- The stage answer: where do the first 500 users come from

### Not building

Accounts or passwords. Code tasks. File uploads. Slack or WhatsApp bridges. Version scrubber UI. Model scoreboard. Addressing individual agents. Memory across rooms. Any tool beyond web search and reading a pasted URL.

*Team: Aryan (captain, decisions, accounts) · Shreya (GTM: name, ICP, posts, users) · Claude (sole builder) · Stack: SpacetimeDB Maincloud · TypeScript · React · OpenRouter*

## Full scope

Everything below was decided in the afternoon scoping session and checked against the handbook, the SpacetimeDB documentation, current products, and the multi-agent research. Treat it as settled unless a checkpoint mentor cuts something.

### Context and constraints

| Item | Fact |
|---|---|
| Event | Midnight Moonshot, 24-hour SpacetimeDB hackathon, Bengaluru. Kick-off Sat 12:00. Code freeze Sun 08:30, enforced server-side. Submissions close 09:30. Top 10 demo live from 11:00. |
| Track and statement | Agents. "Build a space where multiple agents, or agents and humans, act on the same live world and handle each other: cooperate, compete, negotiate." |
| Hard rules | Real-time logic lives in a SpacetimeDB module on Maincloud. Repo created after Sat 14:00. Module creation timestamp checked. Nothing pushed after freeze. Teams of one to three, locked. |
| Qualifiers | Runs on a phone. Live URL opens on the judges' device. Demo video under three minutes. One-liner. Links in a public post. An email lands when someone signs up. A stranger is inside in under thirty seconds with no password. Onboarding exists. |
| Scoring | Real-time 35, problem 35, market 30 (positioning 10, plan 10, traction 10). Whole-number scores averaged across judges. Ties go to the SpacetimeDB team's read of the real-time parameter. |
| Team | Two non-technical founders. Claude is the only builder and operator. Every scope decision is filtered through one question: can one builder ship it robustly by 08:30 with no surprises. |

### Thesis, and the evidence behind the design rules

Debate by itself does not reliably beat one good model. Two systematic studies found multi-agent debate often fails to outperform single-model techniques while costing far more. The lift comes from three things debate alone lacks, and all three are load-bearing here.

1. **Different models.** Model heterogeneity is the one intervention found to consistently improve every debate framework tested. Same model in different hats does not count.
2. **Tools that check facts.** Grounding beats more talking. Only verifiable claims get checked, because most claims in strategy text are judgments and chasing them wastes the whole time budget.
3. **A structure that forces resolution.** Conformity is the main failure. Most stance changes in debate are social, and most of those flip a right answer to a wrong one. Even empty reasoning persuades. So drafts are blind, critique is anonymized and shuffled, drafts are length-capped so verbosity cannot win, objections can only be withdrawn with a stated reason, and the chair can only change a claim by citing a cause. When nobody objects, one model is assigned to dissent.

Two more findings shaped the product. Stanford's Co-STORM showed people prefer watching agents deliberate and steering them over a search engine or a chatbot, and its moderator that asks the unasked questions became our "the room asks the team" step. Anthropic's multi-agent lessons confirmed the separate verification pass, externalized state, and self-contained briefs per agent call, and warned that these systems use about fifteen times the tokens of a chat, which is why rooms carry budgets.

### The product

**Rooms.** Someone creates a room with a two-line brief: what this room is deciding, and any hard constraints. They get a link, a four-character code, and a QR. Every agent reads the brief first.

**Joining.** Open the link, type a name, you are in. No account, no email at the door. The phone remembers the name. Presence shows who is in the room.

**Two surfaces.** The Answer is one living document, edited in place. The Room is the running stream: drafts, critiques, evidence, moderator questions, and teammates' notes, in order. On a phone these are two tabs.

**Asking and steering.** Anyone types. Human notes queue and are read as a batch at the start of each agent turn, which keeps ten people from triggering ten restarts. "Wrap up" from any human interrupts immediately and marks in-flight work as superseded.

**The moderator asks back.** Right after drafts, the room posts the specific things only the team can know. Anyone answers. Those answers enter the next turn as facts.

**Settling.** A question settles when the objection ledger is empty, or when the round cap hits, in which case open objections appear in the answer as unresolved risks. Any human can press "go deeper" for another round, or ask again to reopen.

**Email at the moment of value.** When a question settles, a button offers "email me this verdict." That is where the email qualifier lives, at a step people want rather than at the door.

**Before and after.** Version one, a single model's blind draft, sits next to the final, with the list of what changed and why. This is the demo of value.

### The deliberation protocol

| Role | Who | Does |
|---|---|---|
| Council | Three open models from three different labs | Blind drafts. Then each critiques the other two drafts. Then each verifies its own objections after synthesis. |
| Chair | A fourth model, the strongest available, never drafts | Runs the moderator step. Synthesizes with one cited cause per edit. Writes unresolved risks. |
| Fact-checker | One council model with web search attached | Sorts claims into checkable and judgment. Verifies checkable ones in one grounded call. Returns verdict and citations per claim. |
| Dissenter | Assigned to one council model when no objections were raised | Argues the opposite before the room is allowed to settle. |

Rules the system enforces rather than requests: drafts are anonymized and shuffled before critique. Drafts are capped near 250 words. Critics score claims, never length. An objection is withdrawn only with a reason. A chair edit without a cited objection, source, or teammate note is rejected by the module. Default depth is one critique round with the answer improving live. "Go deeper" adds a round. Roughly ten model calls per question. First answer on screen around sixty seconds. Full first round around ninety seconds to two minutes.

### The answer model

The answer is a list of numbered paragraphs, each a row with a status and a why-trail. Statuses:

- **Verified**: Checked against a source. The citation is attached.
- **Agreed judgment**: Not a checkable fact. All models endorsed it. No open objection.
- **Contested**: At least one objection is still open against it.
- **Unresolved**: The round cap hit with the objection still standing. Shown as a risk.

Tap a paragraph and it shows why it is the way it is: "rewritten because objection 3, source X" or "added because Priya said the launch is Bangalore only." Those teammate references are the human credit tags. Every version is kept in the data so the before-and-after works and a version scrubber can be added later without a migration.

### Feature tiers

**Core, ships tonight**

- Rooms, brief, link, code, QR, name-only join, presence
- Room stream with human notes and batching
- Blind drafts, anonymous shuffled critique, ledger
- Grounded fact-check with citations
- Chair synthesis with cited causes, module-enforced
- Verification, withdrawal reasons, dissenter, settle
- Moderator questions to the team
- Living answer with four statuses and why-trail
- Word-level diff highlighting on every edit, so the changed words are visible next to their cause
- Human credit tags
- Before and after
- One-tap share-as-image of the ledger or the before-and-after, for posts
- Wrap up, go deeper
- Email me this verdict
- Onboarding empty state, seeded example room

**Stretch, only after users are in**

- Public read-only verdict page per settled question
- Version scrubber UI over the kept versions
- Model scoreboard: whose objections survived
- Room templates: strategy review, research brief, decision memo

**Not building**

- Accounts, passwords, uploads, code tasks
- Slack or WhatsApp bridges
- Addressing individual agents
- Memory across rooms
- Any tool beyond search and reading a pasted URL

### Architecture

**Module (SpacetimeDB, TypeScript, on Maincloud).** The whole world is a set of tables, and every agent reads the same rows. A human note is a row insert every agent sees on its next turn. The deliberation state machine, turn order, model calls, and tool calls all live in the module. Maincloud database name: redflow.

| Table | Holds |
|---|---|
| room, member | Brief, code, created by. Who is present, their name, last seen. |
| question | One asked question per row, with its state: drafting, moderating, critiquing, grounding, synthesizing, verifying, settled. Round count, cap, budget used. |
| note | Human messages and answers to moderator questions, with the turn they were consumed in. |
| draft, objection, evidence | Blind drafts by anonymous label. The ledger: target claim, issue, checkable flag, status, withdrawal reason. Citations with URL, excerpt, verdict. |
| paragraph, edit | Answer rows with status and version. The why-trail: which objection, source, or note caused each change. |
| team_question | Moderator questions and who answered them. |
| provider, config (private) | Model endpoints and keys, written only by the module owner. Global kill switch. Per-room caps. |
| step_schedule | Scheduled procedure rows that drive each step for each question. |

**Reducers** handle everything humans do: create room, join, post note, ask, answer team question, wrap up, go deeper, request verdict email, plus owner-only reducers for providers and the kill switch. **Procedures** make the outside calls: one per step per question, scheduled from reducers, calling models and search over HTTP, then writing results in one short transaction.

**Client.** React with the SpacetimeDB React hooks, phone-first, two tabs on small screens. Subscriptions are filtered by room. Hosted on our domain.

**External services.** OpenRouter, one key for all models and for web search through its web plugin, which returns citations with excerpts that fill the evidence table directly. Jina Reader for a URL a teammate pastes. Resend for email on our domain. Nothing else.

**Constraints from how SpacetimeDB works, and what they mean for the code.**

The database sits behind one global lock, held only inside transactions. Model output is parsed and the edit list built outside the transaction; the transaction only inserts. Transaction callbacks can re-run, so every write is idempotent and tagged with a round and step id, and late results for a superseded round are dropped. Subscriptions allow one join and simple filters, so every table carries a room id. Schema changes are additive only once users are in. The free tier's monthly energy covers millions of reducer calls and pauses idle databases, resuming in under a second. Whether several scheduled procedures run concurrently is not documented and is the first thing tested.

**Safeguards.** Fetched web pages are untrusted: the fact-checker extracts quotes only, inside hard delimiters, and has no other tools; the chair only ever sees evidence rows. Per-room caps on questions and model calls, a maximum room size, and an owner-only kill switch, all live before the launch post goes out.

**Build hygiene.** Development runs against a local SpacetimeDB server and publishes to Maincloud only at milestones. Every model response is repaired and validated against a schema inside the module before it touches a table, and a failure retries on another provider. A manual stranger test on a phone runs before every deploy. Nothing else is added to the toolchain; the longer list of monitoring, testing, and orchestration tools was considered and cut on purpose.

### Models and tools

| Need | Choice |
|---|---|
| Council | Three current open models from distinct labs, for example Qwen, DeepSeek, and Kimi or GLM. Fast mid-size variants for drafts and critique, routed by latency. |
| Chair | The strongest model available on the key, routed by quality, never a drafter. |
| Structured output | Every call requests a JSON schema and is routed only to providers that honor it. Parse-and-repair is the exception path. |
| Web search | OpenRouter web plugin on the fact-checker's call. One grounded call per batch of checkable claims. Citations arrive as standardized annotations. |
| Pasted URLs | Jina Reader, a URL prefix, no key. |
| Credits key | If the AI Grants key arrives, it becomes an extra provider row. Nothing depends on it. |
| Cost | About ten to fifteen cents per question. A few hundred questions across testing and tonight's users. About $30 of credit covers the day. |

### Rubric mapping and qualifier checklist

| Judges test | What they will see |
|---|---|
| Two tabs, act in one, watch the other | Tab one asks. Tab two, as a teammate, posts a correction mid-debate. Both watch the agents absorb it on the next turn and the answer change with a credit tag. |
| Open the module | State in tables, logic in reducers, deliberation in scheduled procedures, subscriptions driving the UI. The module is doing the real work. |
| Ten plus users inside | The room during the demo, everyone on their phone, in one room. |
| Core task unaided in under three minutes | Join, ask, read the first answer at about a minute, steer, watch it change, settle. |
| The hard part others skip | Agents reacting to a world that changes while they think. Conformity prevented by mechanism, not by hoping. |
| Phone, live URL, thirty seconds, onboarding, email | Phone-first client on our domain. Link plus name. An empty state that says what to do and a seeded example room. Email me this verdict, sent from our domain. |
| Positioning, plan, traction | ICP and one-liner on the landing state and in the post. A named channel with live signups. Three posts, screenshots of models disagreeing and the ledger. |

### Risks and mitigations

| Risk | Mitigation |
|---|---|
| Latency makes it feel slow to judges | First answer at about a minute, improving live. One round by default. Length caps. Critics routed by latency. |
| Procedures run one at a time on Maincloud | Tested in hour one with three slow fetches. If serialized, drafts are staggered and the timeline is re-planned before any product code. |
| Models agree too easily | Blind drafts, anonymized shuffled critique, withdrawal reasons, cited causes, assigned dissenter. |
| Chatbot theatre instead of substance | Objections must name a claim and a problem. Grounding only on checkable claims. The before-and-after makes the delta visible or exposes its absence. |
| Prompt injection through fetched pages | Quote-only extraction, delimiters, no other tools for the checker, chair sees evidence rows only. |
| Anonymous public link plus paid calls | Per-room caps, room size limit, kill switch. |
| Bad JSON from a model | Schema-enforced outputs where supported, one repair pass, then retry with a different provider. |
| Session or laptop failure during the night | Repo committed at every working state. Scope and decisions in this document and in the builder's memory so a fresh session resumes without re-deciding. |

## Plan and timeline

Scoping and research took the afternoon, which was the right trade, so the handbook's day plan compresses. Checkpoint 2 at 17:00 is an architecture conversation with the mentor, using the five-line pitch. From there:

| When | What | Done means |
|---|---|---|
| 17:00 to 18:00 | Repo, CLI, logins, OpenRouter credit, Resend DNS. Throwaway module published. Hour-one tests. | Procedure concurrency known. A grounded model call and an email both sent from inside a procedure. Subscribed from a phone. |
| 18:00 to 20:00 | Real module and client. Rooms, join, presence, stream, ask. Blind drafts and first synthesis landing live. | Checkpoint 3 at 20:00: two phones in a room, a question asked, a first answer appearing on both. |
| 20:00 to 22:30 | Critique, ledger, grounding, chair edits with causes, verification, moderator questions, settle, go deeper, wrap up. | A full question runs end to end with four models and the answer updates in place. |
| 22:30 to 23:30 | Stranger-proofing: empty state, seeded room, email verdict, incognito test, phone pass. | A stranger gets in and asks within thirty seconds without help. |
| 23:00 | Launch post out. Room link shared in the venue and outside. | Twenty-five people in rooms tonight. Notes on where they got stuck. |
| 23:30 to 01:30 | Fix what users broke. Ship the one thing everyone asked for. | The work list from watching users is empty or deliberately parked. |
| 01:30 to 04:00 | Polish: statuses shading, word-level diffs, credit tags, before-and-after view, share-as-image, type and spacing. | It looks designed on a phone. |
| 04:00 to 06:00 | Comms and stretch: welcome message, one-liner on the landing state, every link checked, verdict share page if time allows. | Every surface talks like a human and nothing dead-ends. |
| 06:00 to 07:30 | Demo video under three minutes: the problem in one line, then the product with people in it. Stage answers rehearsed. | Video posted publicly. Links in the post. |
| 08:00 to 08:30 | Final checkpoint. Last commit. Hands off. | Frozen. |

### Team roles

| Who | Owns |
|---|---|
| Aryan | Captain and submitter. Decisions at checkpoints. Browser logins and accounts when handed over. Gets testers into rooms tonight. Demo narration. |
| Shreya | Product name. ICP choice and one-liner. Posts one, two, three from a warm account. First-500 plan with a named channel and evidence it is running. Twenty-five users tonight. Quotes and screenshots for the stage. |
| Claude | Everything technical: module, client, models, tools, hosting, email, tests, deploys, commits, demo path. |

## GTM kit

Raw material for Shreya. Pick, rewrite in your voice, and keep the claims that survive.

### ICP candidates

1. **Founders and product teams making calls on incomplete information.** Pricing, positioning, launch plans, hiring. Channel: founder and PM communities in Bengaluru, the room tonight, the panel's own communities.
2. **Strategy, research, and consulting teams** who already run internal red teams by hand. Channel: LinkedIn, consulting alumni groups.
3. **Student teams and hackathon crews** deciding what to build. Channel: college WhatsApp groups, the venue.

### One-liner variants

- Several AI models argue over your team's question. Your team argues back. Live.
- Ask once. Three models answer blind, tear each other apart, check the facts, and a chair rebuilds the answer one justified edit at a time, while your whole team steers.
- A war room where AI red-teams AI, and everyone on your team is in the room.

### Lines for the stage and the post

- Most multi-model products make models talk. Talking makes them agree. Agreeing makes them wrong together. We built the version where they have to prove it.
- Multi-model councils exist for one person, one shot. This is the team version that runs live.
- Every paragraph in the answer tells you whether it was verified, agreed, or contested, and who changed it and why.

### Post skeletons

- **Post one, announcement.** What we are here to build in one line, why single-model answers are the problem, and that the thread ends with the launch tonight.
- **Post two, build update.** A screenshot of two models disagreeing in the ledger, or the moderator asking the team a question nobody expected.
- **Post three, launch.** The one-liner, a fifteen-second clip of a correction landing mid-debate and the answer changing, the link, and who it is for.

### The first-500 answer

Name one channel and why it fits the ICP, then show it running: the community post, the DMs, the signups counter live on stage. The room tonight is the seed, not the plan.

### Open decisions

1. **ICP.** One of the three above, in Shreya's words, on the landing state and in the post by launch.
2. **DNS access.** Who manages the domain's DNS, so the site can be pointed and the Resend records added.

Redflow scope v1.2 · written Sat 5 Sep 2026, 17:00 IST, updated with the product name and the final tool list · supersedes all chat discussion before it · changes after a checkpoint get a v2 stamp here
