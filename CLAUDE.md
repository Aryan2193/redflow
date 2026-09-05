# Redflow

Midnight Moonshot hackathon entry (SpacetimeDB, Bengaluru, Sat 5 Sep to Sun 6 Sep 2026, code freeze Sun 08:30 IST).
A live room where a team asks one question, several different AI models answer blind, critique each other,
check facts, and a chair rebuilds a living answer one justified edit at a time, while the team steers mid-debate.

Read SCOPE.md first. It is the single source of truth; do not reopen settled decisions.
Read NOTES.md for the running build log and current state.

## Rules for this repo
- This project is separate from every other project on this machine. No Gravity context, brand, infra, or handles.
- Team: Aryan (captain, accounts, decisions), Shreya (GTM), Claude (sole builder). Ask Aryan only for account actions.
- Real-time logic lives in the SpacetimeDB module (`server/`). The client (`client/`) renders subscriptions and calls reducers.
- Maincloud database name: `redflow`. Local dev server: `spacetime start` (127.0.0.1:3000).
- Secrets live in `.secrets/` (gitignored). Never commit keys. Keys enter the module through owner-only reducers.
- Commit at every working state with explicit paths. Nothing may be pushed after Sun 08:30 IST.
- No em dashes anywhere (code comments, UI copy, docs). No exclamation marks in UI copy.
- Schema changes are additive once users are in (Maincloud automigrate rules). Wipe freely before launch only.
- Procedures: parse and validate outside `withTx`; the transaction only inserts; every write carries question id + round + step; drop late results for superseded rounds.

## Commands
- CLI binary: `C:\Users\aryan\AppData\Local\SpacetimeDB\spacetime.exe` (on PATH in new terminals).
- Module: `cd server && spacetime build`; local publish `spacetime publish -s local redflow`; Maincloud `spacetime publish -s maincloud redflow`.
- Bindings: `spacetime generate --lang typescript --out-dir ../client/src/module_bindings` (run from `server/`).
- Client: `cd client && npm run dev`.
