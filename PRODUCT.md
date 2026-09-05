# Product

Redflow: a live room where several different AI models argue over a team's question, and the team argues back. Built at the Midnight Moonshot hackathon (SpacetimeDB, Bengaluru, 5 to 6 September 2026) for the Agents track statement "Agents have never had to share a world". Source of truth for scope is SCOPE.md.

## Register

product

The room is a tool people are inside while deciding something. Design serves the task. One surface, the bout arena, is allowed to carry identity: it is what judges and strangers watch, and it must read from a metre away on a projector.

## Users

- Founders and product teams making calls on incomplete information: pricing, positioning, launch plans, hiring. They ask one hard question and steer while three models fight over it.
- Strategy, research and consulting teams that already run red teams by hand.
- Hackathon judges and strangers who arrive by link or four-letter code on a phone, with no account, and must understand what is happening within thirty seconds.
- Ten people can be in one room at once. Most are non-technical.

## Product Purpose

Every AI answer today is one model's first draft, and when models check each other they agree too fast and are wrong together. Redflow makes different models answer blind, attack each other on substance, check facts on the web, and rebuild the answer one justified edit at a time, while the humans who own the question interrupt with facts only they know. The output is an answer a team acts on, with every change traced to an objection, a source, or a teammate.

Success looks like: a stranger reads the room and knows who is winning and why; a team gets an answer better than one model alone; a judge sees real-time shared state as the product, not a feature.

## Brand Personality

- A sharp senior advisor in a fight, not a chatbot. Specific, committed, dated facts, no hedging.
- Spectator sport for decisions: the debate is the show, the verdict is the payoff. The room should feel like watching a bout, with rounds, blows, blocks and a decision.
- Honest about what stood and what fell. Nothing quietly disappears; open risks stay on screen.
- Warm paper and ink, red for the lead, teal and slate for the challengers, green and red only for outcomes. No neon, no dark-mode-by-default.
- Copy is plain and short. No exclamation marks. No em dashes. No AI cliches.

## Anti-references

- Generic chat UI with a fixed AI side and a fixed user side.
- Dashboards of metrics tiles; the room is a story, not a KPI board.
- Confetti, sound, bouncy easing, glassmorphism. Effects must convey a state change (hit, block, fixed, decided), never decorate.
- Dark SaaS with neon accents. The room lives in a bright hall.
- Walls of markdown. The first section is the verdict; detail folds beneath it.

## Design Principles

1. The state of the fight is legible at a glance: who is speaking, what was attacked, what stood, what fell, what is still open.
2. Color carries state on the key text only, never whole messages.
3. Nothing scrolls the page. The arena stacks; history compresses; the newest blow is always visible.
4. Live means live: new text appears as it is generated; every state change is acknowledged in place within 300 ms.
5. The verdict comes in the middle, concise enough to act on, with the full answer folded beneath.
6. Works on a judge's phone with one thumb and no account.

## Accessibility & Inclusion

- Respect prefers-reduced-motion: every effect has a static equivalent that still communicates the state.
- Never rely on color alone: every state has a word (Under attack, Fixed, Stands, Refuted, Open risk).
- Text contrast at AA on both paper and ink surfaces. Body text 15 to 16px minimum, verdict larger.
- Keyboard: composer and every button reachable; focus visible.
- Non-technical, non-native English readers: plain words, short sentences, no jargon in labels.
