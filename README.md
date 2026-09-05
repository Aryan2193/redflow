# Redflow

Several AI models argue over your team's question. Your team argues back. Live.

Built in 24 hours at Midnight Moonshot (SpacetimeDB, Bengaluru, 5 to 6 September 2026) by Aryan Agarwal and Shreya, with Claude as the builder. Full scope and rationale in [SCOPE.md](SCOPE.md), running build log in [NOTES.md](NOTES.md).

## What it does

A team opens a room with a two-line brief and asks one question. Then, inside the SpacetimeDB module:

1. **Blind drafts.** Three models from three different labs (Gemini Flash Lite, gpt-oss-120b, Llama 4 Maverick) answer independently. None sees the others.
2. **The room asks the team.** The chair (Claude Sonnet 4.6) reads the drafts, assembles version one of the answer, and posts up to three questions only the team can answer.
3. **Anonymous critique.** Each council model attacks the other drafts and the current answer. Drafts are labelled A, B, C and shuffled, so nobody knows who wrote what. Every attack lands in the objection ledger.
4. **Grounding.** Checkable claims go to the web through one grounded call. Verdicts come back with citations.
5. **Synthesis under obligation.** The chair rebuilds the answer one edit at a time. Every edit must cite a cause: an objection, a source, or a team note. The module refuses edits that cite nothing.
6. **Verification.** Each critic reviews the objections it raised. It may withdraw only with a reason. The chair may overrule only with a reason.
7. **Settle.** An empty ledger settles the question. If nobody objected at all, one model is assigned to dissent first. Objections still standing at the round cap become visible unresolved risks.

Humans type at any time. Notes queue and are read as a batch at the start of the next agent turn, and the paragraphs they change carry the author's name. Wrap up interrupts. Go deeper runs another round.

The answer is a living document: numbered paragraphs, each with a status (Verified, Agreed, Contested, Unresolved) and a why-trail. Every version is kept, so the room shows word-level diffs and a before-and-after against a single model's first draft.

## Where the logic lives

Everything real-time is in one SpacetimeDB module, [`server/spacetimedb/src/index.ts`](server/spacetimedb/src/index.ts):

- **Tables** are the world: `room`, `member`, `note`, `question`, `draft`, `team_question`, `objection`, `evidence`, `paragraph`, `answer_version`, `agent_status`, plus private `config`, `provider`, `email_request`, and the schedule tables.
- **Reducers** are everything humans do: `createRoom`, `joinRoom`, `postNote`, `ask`, `wrapUp`, `goDeeper`, `requestVerdictEmail`, and owner-only admin reducers.
- **`runStep`** is one scheduled procedure dispatched by step name (`draft`, `moderate`, `critique`, `dissent`, `ground`, `synthesize`, `verify`, `finalize`, `email`). It makes the model and search calls over HTTP outside any transaction, then writes results in one short transaction. Every write re-checks that its round is still current; stale results are dropped.
- **`watchdogTick`** is a scheduled reducer that restarts any step that stalls and wraps up any question stuck too long.
- The rules the product claims are enforced in code, not requested in prompts: anonymized shuffled critique (`stepCritique`), refused uncaused edits and one edit per paragraph per pass (`stepSynthesize`), withdrawal and overrule only with a reason (`stepVerify`, `stepSynthesize`), the assigned dissenter (`afterFanInCheck`).

The client, [`client/`](client/), is a Vite React app that renders subscriptions with `spacetimedb/react` hooks and calls reducers. It holds no logic about the deliberation.

## Facts learned the hard way

- Procedures run one at a time on Maincloud. Timeouts are tight per step so a slow model cannot stall every room.
- Thinking models spend the token budget on hidden reasoning and truncate the JSON. Reasoning effort is set low where supported and headroom is added.
- After any schema change, regenerate the client bindings or the client's binary reader throws.

## Run it

```bash
# module
cd server && spacetime start            # local server
spacetime publish -s local redflow      # then set the provider key with the owner-only reducer
cd spacetimedb && spacetime generate --lang typescript --out-dir ../../client/src/module_bindings

# client
cd client && npm install && npm run dev
```

Production connects to Maincloud (`client/.env.production`). Model provider is OpenRouter, one key for all models and web search. Email goes through Resend or a webhook relay, set with `setEmailProvider`.
