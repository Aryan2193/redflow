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

## Rule learned 18:25
- After ANY schema change: `spacetime generate` again, or the client binary reader throws RangeError on the changed table. Bindings live in client/src/module_bindings.
- First full loop settled 18:24: ask 18:19:25, v1 ~18:20:00 (drafts 5-7s each, serial), settled ~18:24:20 with v2, 5 withdrawn, 3 unresolved, 1 uncaused edit refused, 1 web check (unclear). Whole round ~5 min; target under 3. Critic JSON failures (DeepSeek reasoning) cost ~40s; headroom raised to +1400 tokens.

## 18:43 state
- Watchdog live (30s tick, restarts stalled steps after 110s idle, wraps up after 9 min). Needed because a republish mid-step orphaned a Maincloud synthesize step.
- Council now GLM 5.3 flash / gpt-oss-120b (low) / Llama 4 Maverick; checker gpt-oss + web; chair Sonnet 4.6. DeepSeek dropped: invalid JSON 3 of 6 calls.
- Email step implemented (Resend or webhook), waiting on provider choice. setEmailProvider + setSiteUrl reducers.
- Dev server on LAN: http://10.155.96.27:5173 (mode production => Maincloud). Demo room on Maincloud: Q6S9.
- Client verified: join, live question arrival, phone layout, ask from browser (question 3 asked by browser identity). devtools fill() does not trigger React state; use evaluate_script with native setter for automated tests.

## 18:52 roster (final unless something breaks)
- council_a google/gemini-3.1-flash-lite (low) 3.8s critique; council_b openai/gpt-oss-120b (low) 1.9s; council_c meta-llama/llama-4-maverick 6.2s; checker gpt-oss-120b + web; chair claude-sonnet-4.6 (~11s). Provider sort=latency for non-chair.
- Rejected: GLM 5.3 flash (18s to 153s), qwen3.x flash (14-23s), deepseek v4 flash (10s, bad JSON), glm-4.7, gemini-3.5-flash-lite (1 objection only).
- Maincloud demo loop: ask 18:45:21, v1 18:46:02 (41s), settled 18:48:33 (3m12s).
- Chair may now overrule objections with a reason (status overruled) instead of leaving them to expire unresolved.

## 18:58
- Cost: 5 full questions + probes = $0.27 total (~5c/question). $18.46 left.
- Overrule path verified (local q4: 4 withdrawn, 5 overruled, 0 unresolved, settled ~2 min).
- Public URL blocked on Aryan: GitHub Pages fallback staged at C:/Users/aryan/redflow-web (needs `gh repo create --public` + pages API, classifier blocks me); or domain deploy once DNS host known.
