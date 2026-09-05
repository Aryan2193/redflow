# Redflow demo video, under three minutes

Handbook rule: the problem in one line, then the product working with people in it. No slides. Post it publicly and link it in the launch thread.

## Setup before recording

- Two phones and one laptop, all on the public URL. The laptop shows the room at desktop width so the whole arena is on screen: Claude's corner on the left, the ring in the middle, the challengers on the right.
- A fresh room with a real question. Name it after a real decision, not a test. Example: "Redflow pricing after the hackathon."
- Aryan holds phone one, Shreya holds phone two. The laptop is the camera's main subject; phones appear when they act.
- A bout costs about twenty rupees in API calls and takes two to three minutes. Rehearse once end to end, then record.
- Nothing on the laptop needs scrolling. The newest blow always lands at the bottom of its corner; older cards fold into one-line entries above it.

## Script

**0:00 to 0:15. The problem, one line, spoken over the empty ring.**
"Every AI answer you get is one model's first draft. Nobody checks it. And when you paste it into your team chat, the AI is not in the room."

**0:15 to 0:35. Ask. Round one.**
Aryan types the question on phone one. Cut to the laptop: the question pins to the top of the ring, the banner says Round 1, Opening, the clock starts, and three typing bubbles appear in the corners. Say: "Claude defends. Perplexity and GPT challenge. None of them sees the others' first answer."

**0:35 to 1:05. The first answer, written live, with the agents' hands visible.**
Point at the activity feed under Claude's name: "searching the web for current facts", then "opened" lines with the sites it read, then "writing section 1". Say: "Every move is logged as it happens: what it read, what it searched, which pages it opened." Claude's answer writes itself into the left corner at about forty seconds, recommendation first, the rest folded. Shreya types a fact from phone two ("we already have a landing page"). Show her name land in the ring.

**1:05 to 1:40. Round two, the attack.**
The banner sweeps: Round 2, The attack. Cards slide into the right corner stamped HIT, the attacked claim highlighted in red, and on the left Claude's sections flash "Under attack." Say: "Every hit quotes the exact claim and says what would fix it. Heavy means the recommendation itself is at stake." When the fact check runs, point at the ring's feed filling with "searching" and "opened" lines and the counter climbing, then at the STANDS or REFUTED stamp with its source. Say: "It searched twice for the ones it could not settle, hunting the page that owns the fact."

**1:40 to 2:15. The steer and the comeback.**
Aryan types a correction from phone one mid-bout. Say: "Anyone can step in." The banner says Round 4, Comeback. Claude's card slides in on the left with CONCEDED stamps on the sections it changed and BLOCKED on the objections it refused, each with its reason. Point at a stamp that says "From the team" with Aryan's name. Say: "Every change has to cite a hit, a source, or a teammate. With no cause, the system refuses the edit."

**2:15 to 2:40. Round five, the ruling, then the decision.**
The ruling card lands in the ring: FIXED or STILL OPEN per hit. The ring widens and the decision card scales in: the headline, then the debate in one line with the score, then what changed and who caused it, then the answer. Say: "What survived the fight is the answer. Anything still open stays on the page as a risk. Nothing quietly disappears." Tap Read the full answer.

**2:40 to 2:55. Who it is for and the link.**
Shreya, on camera: the one-liner and the ICP in her words, then the URL and the room code.

**2:55 to 3:00. Card.** Redflow. Several AI models fight over your team's question. Your team steps in. Live. Built in 24 hours at Midnight Moonshot on SpacetimeDB.

## Stage answers to rehearse

- **"Is the module doing the real work?"** Yes. Every round is a scheduled procedure inside the SpacetimeDB module. The client only renders subscriptions and calls reducers. Open `server/spacetimedb/src/index.ts`: `runStep`, `stepSynthesize`, `afterFanInCheck`.
- **"Why not one strong model?"** Debate research says models agree too fast and end up wrong together. Redflow uses three labs, tools for facts, and a ledger that forces resolution. The lift is in the structure, not the chatter.
- **"Where do the first 500 users come from?"** Shreya's channel, with the evidence it is already running: the community post, the DMs, the signups.
- **"What did you cut?"** Accounts, uploads, integrations, version scrubber, model scoreboard. All listed in SCOPE.md.
