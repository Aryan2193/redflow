# Redflow build log

## State (18:10 IST Sat)
- Repo + GitHub (Aryan2193/redflow, private). Scope in SCOPE.md. Secrets in .secrets/ (gitignored).
- server/ = TS module (built, published to LOCAL as `redflow`). client/ = Vite React TS + Tailwind v4 + spacetimedb SDK. probe/ = throwaway test module (Maincloud).
- Bindings generated to client/src/module_bindings.
- SpacetimeDB CLI 2.10.0. Local server running in background. Maincloud logged in.

## Hour-one tests: DONE
- **Procedure concurrency on Maincloud: SERIALIZED.** Two LLM procedures ran strictly back-to-back (call 2 started 2ms after call 1 finished). Procedures do NOT run in parallel on Maincloud; the global lock + single runtime serialize them. => Blind drafts run one after another, not concurrently. Budget ~2-3s per model call. First answer (3 drafts + moderate) ~= 12-18s serial. Still well under the 60s target. No design change needed, but do NOT assume parallelism anywhere.
- **Grounded OpenRouter call from a procedure: WORKS.** ctx.http.fetch to OpenRouter with response_format json_schema + provider.require_parameters returned clean JSON. Web plugin (max_results) returned 3 url_citation annotations; served by deepseek via Baidu (web) / Morph (no web). JSON schema honored. Model slug that works: deepseek/deepseek-v4-flash-0731.
- **CLI reducers are snake_case** at call time (set_key not setKey). Client bindings convert case automatically.
- Still TODO test: subscribe from a phone (do at first client deploy).

## Model slugs to verify against OpenRouter /models before Maincloud (seeded in init, may need correcting):
- council_a deepseek/deepseek-v4-flash-0731 (CONFIRMED works)
- council_b qwen/qwen3.8-27b (VERIFY)
- council_c moonshotai/kimi-k3 (VERIFY)
- chair anthropic/claude-sonnet-5 (VERIFY availability on this key)
- checker deepseek/deepseek-v4-flash-0731 + web (CONFIRMED)

## Architecture decisions during build
- One `runStep` procedure dispatched by step name (draft/moderate/critique/dissent/ground/synthesize/verify/finalize). Scheduled from reducers and from itself via step_schedule.
- Fan-in tracked via agent_status rows (done/failed per slot). Every write re-checks round is current; stale rounds dropped.
- Chair edits refused unless cause_id matches an open objection / evidence / fresh note. This is the anti-conformity rule, enforced in code (stepSynthesize).
- Nobody objects => assign one council model to dissent before settling.
- Living answer = paragraph rows, current=true is what shows; every version kept.

## Next
- Verify model slugs. Build client (join, room, answer/room tabs, agent status, ledger). Test full loop locally. Then Maincloud publish as `redflow`.
- Deferred: email (Resend/Apps Script) ~22:00; domain + hosting at deploy.
