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

## 02:10 (Sun) UI v3: the chat (after Aryan: "make it like a ChatGPT interface... it should look like the AIs are fighting")
- Room is one chat column (max 760px). Every question is a thread: human question, Claude's first answer (sections carry live chips: Under attack, Revised in v2, Verified, Open risk), the critics' blind drafts (first section shown, rest folded), objections as messages (quoted claim highlighted in the state color: red open, amber fix awaiting check, green fixed, slate overruled; severity dots; fix; verifier footer), fact checks (claim highlighted by verdict, quote, source host), Claude's revision (summary, each edited section with its cause chip and a word diff when the change is targeted, overrules listed), the verifier's ruling (synthesized from objection resolutions, grouped per round), typing bubbles for whoever is working, then the verdict card.
- Sides flip whenever the speaker changes, humans included. Nobody owns a side. Stage dividers between chapters (First answer, Blind drafts, The attack, Fact check, Revision, Verification).
- Verdict card (dark): headline = section one heading, bottom line = section one body, What the debate changed (each change with who caused it), Checked against sources, open risks, score strip (models vs, objections, fixed, stood on evidence, facts checked), actions: Read the full answer (unfolds the document with status dots), Go deeper, Share as image, Email it. Earlier questions in a room fold to question + compact verdict + "Show the debate (N messages)".
- One composer at the bottom: pills Steer the debate / New question (disabled while a question runs, one at a time), Reply to Claude chips for open team questions (reply banner with Cancel), "N notes waiting for the next turn", Wrap it up now. Mode defaults to steer while a question runs and to new question once settled.
- Answer.tsx and Stream.tsx removed. New: components/Thread.tsx, Verdict.tsx, Composer.tsx; labels.ts gained speaker tones and state looks; index.css gained bubble tints, .hl highlights, .chat-md, typing dots, enter animations.
- Verified live on Maincloud room 42YU (question asked through the new composer): typing bubbles for all three, v1 on the right with two sections Under attack within a minute, reply-to-Claude and steering notes both landed as dark human bubbles, settled v2 in 3m 1s with 6 objections (5 fixed, 1 stood on evidence), verdict card rendered with headline and attributions. Mobile (501px) fits, no horizontal scroll.
- Lead prompt: section one now capped at 90 words since it is the verdict's bottom line. Republished both servers.

## 02:45 (Sun) UI v4: the bout arena (after Aryan: "make it feel like a fight... bout mode with rounds... no scrolling... verdict in the middle... everything rendered live... use the installed Claude skills")
- Skill: impeccable 3.0.7 (installed, based on Anthropic's frontend-design) in overdrive mode; its gates needed PRODUCT.md and DESIGN.md, written from SCOPE.md and the CSS tokens (now in the repo root). Direction chosen: corner arena (fixed corners, ring in the middle, stamps and round banners, live text reveal, CSS and Web Animations only) over a canvas HUD with health bars (misrepresents the goal, risky in the hours left) and a cinematic replay timeline (great for video, weak live).
- Layout: full-viewport, the page never scrolls. Left corner Claude (defends), right corner Perplexity + GPT-5.2 (challengers), the ring in the middle: pinned question, fact checks, team questions, humans' notes, the ruling, then the decision. Newest card at the bottom of each column; older cards fold to one-line entries (click to open). Claude's corner keeps one card open, the others two. When the bout is decided the ring widens (grid-template-columns transition) and the corners dim.
- Rounds: Opening, The attack, Fact check, Comeback, Ruling, in a round bar with a live clock; a banner sweeps the ring on every round change.
- Effects (state only, no decoration): cards slide in from their corner; stamps (HIT, HEAVY, ANSWERED, FIXED, BLOCKED, STILL OPEN, STANDS, REFUTED, NO CALL, CONCEDED, CORRECTED, FROM THE TEAM, DECISION) scale in like a rubber stamp; a section flashes and shakes when a hit lands on it; the decision scales in. Barlow Condensed for stamps, corner names and banners only. prefers-reduced-motion makes all of it static.
- Live text: fresh cards write themselves in at about 70 characters a second (capped at 12s) with a caret; old cards render in full. True token streaming is not possible from a SpacetimeDB procedure (blocking fetch), so this is the honest equivalent.
- Sharper fight in the prompts: critics open each issue with the blow, addressed to the lead by name ("You say X. It is wrong: Y."); the lead's comebacks are spoken to the critic by name ("Conceded, Perplexity: ..." / "Overruled, GPT-5.2: ..."); the summary is a defender's line; the verifier rules like a referee ("Landed: ..." / "Not fixed: ..."). Section one capped at 90 words in both the first answer and the comeback, since it is the decision's bottom line.
- Verified live on Maincloud (bout 6 in 42YU): round bar and clock, typing bubbles in both corners, first answer written live with the section list, team questions in the ring, hits stamped HIT/HEAVY with the claim in red and "Under attack" chips on Claude's sections, comeback with CONCEDED stamps, decision in a widened ring; 7 calls, 2m 18s, six hits all conceded, about 19c. Phone width works with the compact round bar (R1..R5).
- Files: lib/bout.ts (items, corners, rounds), lib/reveal.ts (useLive, useReveal, useMediaQuery), components/Cards.tsx, Arena.tsx, RoundBar.tsx, Stamp.tsx; Thread.tsx removed; Verdict gets a DECISION stamp. docs/DEMO-SCRIPT.md rewritten for the arena.

## 04:55 (Sun) agentic layer (after Aryan: "make the whole thing agentic... emphasize tool activity... no questions to the user... hide text under See more... verdict: title, the debate, what changed, then the answer")
- New table agent_event (questionId, slot, kind read|search|open|write, detail, url). The server logs every real move: what each step read, the lead's web search on time-sensitive questions, every page a model actually cited (from OpenRouter url_citation annotations), the second fact-check pass, and each write with its duration. Client Activity feed under each corner header shows the last few real events plus a narrated micro-step for whichever agent is working (lib/narrate.ts rotates through the honest sub-steps of the current stage every 2.4s). "N actions so far" counter.
- Lead gets Exa web search (4 results) when the question mentions prices, versions, laws, dates and the like. Fact checker takes a second pass on unclear verdicts aimed at the page that owns the fact. Team questions removed from the pipeline (the lead decides for the most likely case and names the assumption); Reply chips removed from the composer.
- Cards are a gist by default (heading, highlighted claim, first sentence, stamps, section chips), everything else behind See more / See the changes / See the reasons. Verdict reordered: stamp and headline, The debate (one-line account plus score and sources), What the debate changed, The answer, open risks, actions.
- Verified live (bout 7 in 42YU): Claude's corner showed "searching the web for current facts", then "opened salespipe.co", "opened revenueflow.com"; the ring showed the checker opening cience.com, driftwood.sh, bridgegroupinc.com with 16 actions; both passes of the fact check ran; settled in 2m 47s, 9 calls, about 29c (web search and heavier thinking on the lead).

## 05:55 (Sun) public URL, email at the door, presence under the model
- Live public URL: https://aryan2193.github.io/redflow/ (GitHub Pages from the gh-pages branch, built with base /redflow/, 404.html copy for the SPA routes). Module siteUrl set to it, so emailed room links point there. Redeploy: `MSYS_NO_PATHCONV=1 npx vite build --base=/redflow/ --outDir dist-pages`, copy index.html to 404.html, push the folder to gh-pages.
- Email at the door: optional email field on the home form and the join gate. It is kept on the device until the person is in the room, then `request_join_email` queues a welcome email with the room link (subject "Your Redflow room: ...") sent by the scheduled procedure `sendWelcome` through provider 2 (Resend or the Apps Script relay). One per email per room per ten minutes. No account, no password; the email is only the link. Provider 2 is NOT configured yet: needs `set_email_provider` with a relay URL and token (tools/apps-script-relay.gs) or a Resend key with a verified domain.
- Presence blocks (avatar, name, live micro-step, last real moves) now sit under each model's cards instead of above the column. Typing bubbles removed.
- OpenPets assessed and declined: an Electron desktop companion app driven over local IPC; nothing renders in a web page, judges on phones would never see it, and the pipeline runs on Maincloud, not the laptop.
- 06:10 Fighters: a small SVG human figure per model stands with its presence block (components/Fighter.tsx). Breathes and blinks idle, types while working, recoils on a hit, lunges when it lands one, guards when a claim stands, staggers when blocked, cheers at the decision; tap it and it says what it is doing. Moments derive from fresh row changes only (useMoments in Arena.tsx), so old bouts stay calm.
- 06:25 Fighters removed at Aryan's call ("really badly done"). Presence blocks stay: avatar, name, live micro-step, last real moves under each model's cards.

## 07:10 (Sun) login through SpacetimeAuth (magic link)
- SpacetimeAuth (SpacetimeDB's hosted OIDC, beta) supports magic-link email login natively and sends the email itself, so the module's own email sender is no longer needed for login. Client wired with react-oidc-context: `lib/auth.ts` (authority https://auth.spacetimedb.com/oidc, redirect `<origin><base>/callback`, session in localStorage), `components/AuthBits.tsx` (Sign in with email / Signed in as / Sign out), `main.tsx` keys the SpacetimeDB provider on the ID token so sign-in reconnects as the real identity, `buildConnection(authToken)` presents it. Inert until `VITE_AUTH_CLIENT_ID` is set in client/.env.production. Guest path (name only) unchanged.
- Aryan's account action: Maincloud dashboard, profile, module redflow, SpacetimeAuth, Use SpacetimeAuth; in Clients add redirect URIs https://aryan2193.github.io/redflow/callback, http://localhost:4173/callback, http://localhost:5173/callback and post-logout https://aryan2193.github.io/redflow/; Customization keeps Magic link on; send the client ID.
- Email-at-the-door fields removed from Home and the join gate (the welcome-email reducer stays server-side, unused).
- 07:50 SpacetimeAuth live with client_034JpEPIAlVD0JbsuP12Kn. Verified end to end on :4173: Sign in with email -> auth.spacetimedb.com login page (Send magic link / Anonymous login) -> /callback -> app signed in, SpacetimeDB connection active with the OIDC token (Maincloud accepts SpacetimeAuth tokens for the module). Magic-link email is sent by SpacetimeAuth itself. Public build redeployed with the client id.

## 06:15 (Sun) fourth agent: Gemini as the referee
- Gap filled: Perplexity was critic, fact checker and verifier at once, so it ruled on fixes to its own hits. New slot `referee` = google/gemini-3.8-flash (fourth lab, reasoning low, prompt JSON with json_object) rules on every addressed objection. Fallback chain if the referee is missing or disabled: council_b, then council_c. Registered on local and Maincloud with set_model_slot; the seed list carries it for fresh databases.
- Client: amber tone, ring header "Gemini referees", referee presence block in the ring, ruling cards attributed to the referee, verdict line "Gemini refereed."
- Real clock check: it was 06:04 IST when this started, not the 07:55 I had been estimating. Freeze 08:30 stands.
