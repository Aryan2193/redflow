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

## 19:05
- Steering verified: note posted during drafting is consumed at moderate (v1 why credits the author, causeType note) and chair cites notes as causes at synthesize. q5 settled in 68s.
- go_deeper verified (round 2 settled, ledger empty).
- Checkpoint 3 brief delivered to Aryan in chat. Still waiting: publish decision (domain vs GitHub Pages), email sender.

## 19:35
- Maincloud reducer round-trip 3s (an earlier 60s CLI timeout was a blip). Demo room 42YU running q2.
- GitHub Pages repo NOT created yet (Aryan has not run the two commands). Staging refreshed at C:/Users/aryan/redflow-web.
- vercel CLI installed globally (no login yet) so a domain deploy is one login + one command.

## 19:40 stranger test (isolated browser context, no saved name/token, Maincloud)
- Home -> open room: 521ms to /r/AWCJ. Room tab opened by default. Ask visible in 274ms. Agents visible immediately. Member online on server.

## 20:25 feedback round 1 (Aryan)
- One-step rooms: openRoom(name, question) reducer, title derived from the question. Home is question-first.
- Composers auto-grow (lib/autosize.ts). Enter sends, Shift+Enter newline.
- Page no longer scrolls; each panel scrolls itself; stream follows new items only when reader is at the bottom or just sent.
- Team questions persist until answered (even after settle). Latest version summary shown under the status pill with highlight. Answer tab marker when a version lands while on Room tab.
- Earlier questions in a room selectable from a dropdown.
- Verified in isolated browser: one-step open 581ms, textarea grows, page scroll 0.

## 20:27
- Stable test build served by vite preview on :4173 (LAN http://10.155.96.27:4173, Maincloud). Dev server :5173 reloads on every edit; do not hand :5173 to testers.

## 20:40 first outside users
- Rooms on Maincloud: 6. Room 672H opened by "Richa" (mentor?), 2 questions, 3 notes consumed, one question taken to v3 via go deeper (21 calls). All 8 questions settled, 0 errors. Spend $0.74 total, $17.44 left.

## 21:48
- Trap found via mentor room 672H: after settle the composer flipped to ask mode and a one-word reply became question 8 "answered". Fixed: ask mode is explicit after the first question; server rejects questions under 15 chars or 3 words; team questions answerable inline in the stream.
- Module republished both servers; preview dist rebuilt; Pages staging refreshed.

## 23:28 pipeline v2 + UI v2 (after Aryan: "plain Claude beat us", "UI pathetic")
- Roster: lead/chair anthropic/claude-sonnet-5 (prompt JSON + json_object), critics perplexity/sonar-pro (web) + openai/gpt-5.2 (low), checker perplexity/sonar-pro. Perplexity tested: best fact-checker (5.5s, primary sources, 1c). Claude native web costs 9c/call (30k tokens injected): avoid.
- Flow: lead full answer = v1 (~20-35s), critics draft blind then attack substance with fixes, checker, lead revises (no hedging, cause per edit, overrule with reason), one verifier. 8 calls, ~15c/question.
- Bug found: Claude output truncated at max_tokens => "invalid json". Fixed with +4000 headroom, finish_reason detection, string sanitizer.
- UI v2: document answer (headings + markdown), 5-stage stepper + narrative, debate rail with avatars/chapters, labels Verified/Agreed/Disputed/Open risk, before/after toggle "Claude alone".

## 01:10 (Sun) prompt pass (after Aryan: "improve the council and other agents system prompts")
- Every model call rewritten: shared house prompt now dated (today's date injected per call), with writing and trust rules; lead shapes the answer to the question type (decision / how / fact / strategy), section one is the recommendation, headings sentence case and specific, assumptions must be confirmable, team questions answerable with a number or yes/no; blind critic drafts must take a position and name the common mistake; critics get a six-point checklist, severity and checkable definitions, a "would the team act differently" test, and a paste-ready fix; dissenter runs a pre-mortem plus a steelman; fact checker gets verdict semantics, a source hierarchy, verbatim quotes only; lead revision works evidence first, then notes, then objections, with named overrule grounds and a duty to change its mind; verifier gets withdraw/hold criteria and must quote the fixing words.
- Found while testing: Sonnet 5 thinks by default through OpenRouter and the thinking counts against max_tokens (probe: 376 thinking tokens on a trivial call). A six-objection revision thought 7,000 tokens against a 3,000 budget and was cut off twice, then settled with 5 unresolved. Fix: explicit thinking budget for Anthropic calls plus a ceiling of maxTokens + budget + 9000. Per-call usage now logged (`spacetime logs`: "model call <slot> ... out= think= cost= ms=").
- Local run after the fix (question 4099): v1 in 59s, settled v2 in 3m10s, 6 objections (3 withdrawn after fixes, 3 overruled: 2 by evidence, 1 by the lead), 0 open. Cost per call: lead 5.0c, chair 10.5c, perplexity 3.4c+3.6c+1.5c+2.0c, gpt-5.2 not reported. About 28c per question with the chair thinking freely. Dial: `set_model_slot chair ... reasoning=low` drops chair thinking to zero (probe) for roughly 20c per question.
- Explainer copy corrected: version one lands "in under a minute" (was "about twenty seconds").
