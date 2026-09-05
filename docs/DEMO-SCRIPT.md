# Redflow demo video, under three minutes

Handbook rule: the problem in one line, then the product working with people in it. No slides. Post it publicly and link it in the launch thread.

## Setup before recording

- Two phones and one laptop, all on the public URL. Laptop shows the room in a browser at desktop width so the Answer and the Room sit side by side.
- A fresh room with a real brief. Name it after a real decision, not a test. Example: "Redflow pricing after the hackathon."
- Aryan holds phone one, Shreya holds phone two. The laptop is the camera's main subject; phones appear when they act.
- Rooms cost about five cents per question, so rehearse once end to end, then record.

## Script

**0:00 to 0:15. The problem, one line, spoken over the empty room.**
"Every AI answer you get is one model's first draft. Nobody checks it. And when you paste it into your team chat, the AI is not in the room."

**0:15 to 0:35. Ask.**
Aryan types the question on phone one. Cut to the laptop: the question appears instantly, three names light up as "drafting blind." Say: "Three models from three labs answer on their own. None of them sees the others."

**0:35 to 1:05. Version one and the room asks back.**
The chair's version one lands on all three screens at about forty seconds. Point at the "The room asks you" card. Say: "Before it argues, the room asks the team what only the team can know." Shreya answers one of the questions from phone two. Show her name appear on the laptop.

**1:05 to 1:40. The argument.**
The stream fills with objections. Say: "Now they attack each other, anonymously, so nobody can play favorites. Checkable claims go to the web." Point at one evidence card with a source link. Point at one objection marked checkable.

**1:40 to 2:15. The steer and the rebuilt answer.**
Aryan posts a correction from phone one mid-debate. Say: "Anyone can interrupt." Version two lands: the changed words flash green and red for nine seconds. Tap the paragraph on the laptop to show "Because Aryan said so" and the objection that caused the other edit. Say: "Every change has to cite a cause. If the chair tries to change something with no reason, the system refuses it."

**2:15 to 2:40. The ledger settles.**
Point at the status pill: "Settled. Every objection was resolved," or the unresolved risks block if one stands. Say: "Objections get withdrawn with a reason, overruled with a reason, or they stay on the page as risks. Nothing quietly disappears." Tap "Show what one model said first" for the before and after.

**2:40 to 2:55. Who it is for and the link.**
Shreya, on camera: the one-liner and the ICP in her words, then the URL and the room code.

**2:55 to 3:00. Card.** Redflow. Several AI models argue over your team's question. Your team argues back. Live. Built in 24 hours at Midnight Moonshot on SpacetimeDB.

## Stage answers to rehearse

- **"Is the module doing the real work?"** Yes. Every step is a scheduled procedure inside the SpacetimeDB module. The client only renders subscriptions and calls reducers. Open `server/spacetimedb/src/index.ts`: `runStep`, `stepSynthesize`, `afterFanInCheck`.
- **"Why not one strong model?"** Debate research says models agree too fast and end up wrong together. Redflow uses three labs, tools for facts, and a ledger that forces resolution. The lift is in the structure, not the chatter.
- **"Where do the first 500 users come from?"** Shreya's channel, with the evidence it is already running: the community post, the DMs, the signups.
- **"What did you cut?"** Accounts, uploads, integrations, version scrubber, model scoreboard. All listed in SCOPE.md.
