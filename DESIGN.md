# Design

Visual system for Redflow's client (Vite, React 19, Tailwind v4). Tokens live in `client/src/index.css` under `@theme`.

## Visual Theme

Light, warm paper. A bright hackathon hall, a projector, a laptop shared by three people. Ink on paper for reading, one saturated color per fighter, green and red reserved for outcomes. Effects are stamps, flashes and banners that mark state changes in a bout; they never decorate.

## Color Palette

- paper `#f7f5f0` page ground
- sheet `#fffdf9` cards, inputs
- ink `#1c1a17` text, human bubbles, the verdict card
- ink-2 `#453f37` secondary text
- muted `#7d766b` metadata
- line `#e3ded4`, line-2 `#ede9e1` borders and dividers
- red `#b8321f` (soft `#f9e6e1`) the lead, Claude; also refuted and open-risk states
- teal `#1c7c8a` (soft `#e0eff1`) Perplexity, critic and fact checker
- slate `#4a5d8a` (soft `#e6eaf3`) GPT-5.2, critic
- ok `#2f7a4d` (soft `#e2f1e7`) verified, fixed, stands
- warn `#a86a0b` (soft `#f8edd6`) fix awaiting check, unclear, team questions
- judg `#5f6b7a` (soft `#e8ebef`) overruled, agreed judgment

Speaker tints on cards: color-mix of the speaker color at 5 to 6% into sheet, border at 28 to 30% into line.

## Typography

- Display: Newsreader (serif), verdict headline and the full answer document.
- UI and body: Instrument Sans, 15px in cards, 16 to 17px for the verdict bottom line, 11px uppercase tracked labels for metadata.
- Fight type: Barlow Condensed 600 to 700, uppercase, tracked, for round banners, corner names and stamps only. Never in buttons, labels or body.
- Mono: system mono for room codes.

## Components

- Card: 1px border, 12 to 16px radius, speaker tint. Header row: avatar circle (speaker color, initial), name in speaker color, role in muted, time.
- Highlight `.hl-*`: key text gets a soft background plus a 2px inset underline in the state color. Red open, amber pending, green fixed or supported, slate overruled, teal or amber for the team.
- Stamp: bordered uppercase condensed word, rotated a few degrees, colored by outcome (STANDS, REFUTED, NO CALL, CONCEDED, OVERRULED, FIXED, STILL OPEN, DECISION). Enters with a fast scale-down.
- Round banner: condensed uppercase, sweeps in at the center of the ring on every stage change, then settles into the round bar.
- Round bar: five steps (Opening, The attack, Fact check, Comeback, Ruling) with the live step pulsing and a bout clock.
- Chip: 11px semibold, pill, soft background, for states and versions.
- Verdict card: ink background, paper text, eyebrow, serif headline, bottom line, what the debate changed, sources, score strip, actions.
- Composer: rounded field with mode pills above it; ink send button, red when asking a new question.

## Layout

- Desktop: full-viewport arena, no page scroll. Three columns: left corner (the lead), the ring (question, banners, referee, humans, verdict), right corner (challengers). Newest card at the bottom of each column; older cards compress into one-line entries.
- Mobile: one column, cards aligned to their corner, the ring items centered, internal scroll that follows the fight.
- Max reading width 65 to 75ch in the verdict document.

## Motion

- Ease-out expo `cubic-bezier(0.16, 1, 0.3, 1)`. No bounce, no elastic.
- Card entrance 320 to 360ms from the corner's outer edge. Stamps 260ms. Round banner 1.6s total. Verdict 480ms scale from 0.96.
- Live text reveals at about 70 characters per second, capped at 12s per card.
- prefers-reduced-motion: all of the above become instant; states still read through words and color.
