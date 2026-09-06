# Redflow

**Four AI models fight over your question. Your team steps in. Live.**

Live: **https://aryan2193.github.io/redflow/** · Watch a room: code **42YU** · Built in 24 hours at Midnight Moonshot (SpacetimeDB, Bengaluru, 5 to 6 Sep 2026), Agents track.

Statement we built against: *"Agents have never had to share a world."* In Redflow, four models from four labs and any number of humans act on one live room. The models have to handle each other's edits, and the humans' interruptions, without a restart.

## What happens when you ask

1. **First answer.** Claude writes the best full answer it can, alone. Perplexity and GPT-5.2 write their own, blind, so nobody anchors on anyone.
2. **Objections.** Each challenger quotes the exact claim it disputes, says why, and proposes a fix. Objections that would not change what the team does are not allowed.
3. **Fact check.** Every checkable claim is searched. Each comes back confirmed or disproved, with the page that owns the fact, and a second search for anything unclear.
4. **Revision.** Claude changes only what it can justify. Every edit must cite an objection, a source, or a teammate's note by name. Uncaused edits are refused by the database, not by a prompt.
5. **Ruling.** Gemini, which neither wrote the answer nor attacked it, accepts or rejects each fix. What survives is the decision. Anything still disputed stays on the page as an open risk.

Humans type at any time. A note is read on the models' next move; if a note lands after the last revision, the room takes one more pass before deciding. "Add context" gives every model standing facts for the whole room. A bout takes two to three minutes and costs about 25 US cents in model calls.

Everything the agents do is visible as it happens: what they read, what they searched, which pages they opened, what they wrote, in a live feed with the decision in the spotlight and the humans' chat beside it.

## Why it beats asking one model

- **Different labs, not one model in four hats.** Model diversity is the one intervention that reliably improves multi-agent debate. Same model with different prompts agrees with itself.
- **Facts are checked, not asserted.** Claims go to the web and come back with sources.
- **A structure that forces resolution.** Blind drafts, objections with fixes, edits that must cite a cause, a referee who owes nobody anything. Debate alone makes models converge; the rules are what make the answer better.

## How it is built

Everything real-time lives in one SpacetimeDB module (`server/spacetimedb/src/index.ts`) published to Maincloud as the database `redflow`.

- **Tables** hold rooms, members, questions, drafts, paragraphs (every version kept), objections, evidence, versions, notes, agent status and agent events.
- **Reducers** handle the humans: open a room, join, ask, step in with a note, add context, wrap up, go deeper.
- **Scheduled procedures** run the bout itself: each step is one model call over HTTP (OpenRouter) whose result is written inside a short transaction. A state machine (drafting, critiquing, grounding, synthesizing, verifying, settled) decides who acts next. A watchdog restarts a stalled step and wraps up anything that runs too long.
- **The client** (Vite, React 19, Tailwind v4, `spacetimedb/react`) only subscribes to tables and calls reducers. There is no other server. Open two tabs, or two phones, and both see every move the moment it lands.
- **Login** is SpacetimeAuth, SpacetimeDB's own hosted OIDC, with magic links. Guests join with just a name.

Models: Claude Sonnet 5 (lead), Perplexity Sonar Pro (challenger and fact checker), GPT-5.2 (challenger), Gemini 3.8 Flash (referee), all through one OpenRouter key.

## Run it yourself

Prerequisites: Node 20+, the [SpacetimeDB CLI](https://spacetimedb.com/install), an OpenRouter key.

```bash
# Server: build and publish the module (local server or Maincloud)
cd server/spacetimedb
spacetime build
spacetime publish -s local redflow --yes          # or: -s maincloud
spacetime call -s local redflow set_provider_key '"sk-or-..."'
spacetime generate --lang typescript --out-dir ../../client/src/module_bindings

# Client
cd ../../client
npm install
npm run dev                                       # local server on ws://127.0.0.1:3000
npm run dev -- --mode production                  # against Maincloud (see .env.production)
```

Schema changes must be additive once users are in. Regenerate the bindings after any change to the module.

## Repository map

- `server/spacetimedb/` the module: schema, reducers, the bout pipeline, prompts, email.
- `client/` the web client. `src/components/ControlRoom.tsx` is the room; `src/components/Cards.tsx` renders every kind of move; `src/components/Verdict.tsx` is the decision.
- `docs/HANDOFF.md` full frontend and backend handoff. `docs/DEMO-SCRIPT.md` the demo. `docs/LAUNCH-POST.md` the post.
- `SCOPE.md` the scope we locked at the start. `NOTES.md` the running build log, hour by hour. `PRODUCT.md` and `DESIGN.md` the design context.
- `tools/apps-script-relay.gs` an optional Gmail relay for verdict emails.

## Team

Aryan Agarwal (captain) and Shreya (go-to-market), with Claude Code as the builder. Bengaluru.

## Licence

MIT. See `LICENSE`.
