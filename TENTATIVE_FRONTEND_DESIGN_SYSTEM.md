# CohortFit — Frontend Design System ("Lab Ledger")

> The single source of truth for the UI. Implemented in `frontend/app/globals.css`; every page uses these tokens and components. Warm-light only (no dark mode). This document is **tentative** — it evolves as we test the product with real judges' eyes.

## Philosophy — Apple clarity, Google Material tactility

We keep Apple's restraint and typographic calm, and deliberately borrow three ideas from Google's **Material Design** so the interface is easier to grasp at a glance and rewards a judge who spends only seconds on each screen:

1. **Focus on the user.** Prioritise human needs. Every interaction is smooth, helpful, and respectful of the user's time and attention. A feature must *announce itself* — if something is clickable, the UI says so (an explicit call-to-action, a hint line, an active state), never a hidden affordance the user has to discover by accident.
2. **Material as metaphor.** Ground the interface in physical, tactile qualities — surfaces, light, and shadow — to create spatial awareness and a natural hierarchy. Cards sit on a slightly deeper ground and lift with a soft elevation; the surface that answers a click (a timeline, a drill-in) lifts higher than the surfaces around it.
3. **Motion with purpose.** Use animation and transition intentionally — to guide focus, explain a change, and maintain continuity. When a result opens off-screen, the page smoothly brings it into view so the user never hunts for the outcome of their click. No decorative motion; `prefers-reduced-motion` is fully honoured.

## Principles

1. **Contrast first.** Headings and data are near-black (`--ink` / `--ink-strong`), not taupe. Secondary text is a genuinely darker muted, not a faint wash. Keywords are emphasised (weight, accent colour, or a highlighter wash) so the eye lands on what matters.
2. **Tactile elevation.** Structure comes from *both* 1px rules **and** a small, disciplined shadow scale (`--elev-1` for resting cards, `--elev-2` for focus surfaces that open on a click). This is the Material influence; it replaces the earlier "hairlines, not shadows" rule.
3. **Generous scale.** Page titles are large (~31px/800). Headline numbers are large mono figures. Nothing important is small or low-contrast.
4. **9px radius ceiling.** `cell 0 · control 6px · card 9px`. Never 16px+ rounded cards (an AI-slop tell).
5. **Tabular figures on all data.** Every count/percentage/ID is monospaced with `font-variant-numeric: tabular-nums`.
6. **Accent restraint.** The prussian accent marks interactive elements and one data highlight. Semantic colours (ok/warn/danger) encode state only, never decoration, and always pair with a label/icon (colour-blind safe).
7. **Warm neutrals, chosen.** Greige paper, warm near-black ink — never pure `#000`/`#FFF`.

## Color tokens

| token | hex | role |
|---|---|---|
| `--bg` | `#E4E0D5` | page ground (deeper greige, so cards lift) |
| `--surface` | `#FBFAF6` | cards (brighter paper) |
| `--surface-2` | `#FFFEFB` | insets, panel headers, code, table stripes |
| `--ink` | `#141309` | primary text (near-black) |
| `--ink-strong` | `#0A0A05` | headings, emphasised keywords |
| `--muted` | `#524F46` | secondary text (darkened for real contrast) |
| `--faint` | `#787468` | tertiary labels |
| `--line` | `#D2CEC3` | hairline |
| `--line-strong` | `#B6B1A3` | stronger divider / input border |
| `--accent` | `#1E3A54` | prussian ink-navy (interactive + one highlight) |
| `--accent-hi` | `#27527A` | accent hover / keyword |
| `--accent-ink` | `#F8F7F3` | text on accent |
| `--accent-2` | `#AF4E32` | warm second accent |
| `--ok` | `#2F6B4C` | green / pass |
| `--warn` | `#946009` | amber / caution |
| `--danger` | `#9C2620` | red / error |

## Elevation (Material as metaphor)

| token | value | use |
|---|---|---|
| `--elev-1` | `0 1px 2px …/.05, 0 2px 8px …/.06` | resting cards: `.panel`, `.stile`, `.dtile`, `.metric`, `.verdict`, `.cm-cell` |
| `--elev-2` | `0 8px 20px …/.10, 0 20px 44px …/.10` | focus surfaces that open on a click: `.panel-pop` (timeline, finding drill-in) |

The sticky cohort input also carries a soft downward shadow + backdrop blur so it reads as a layer above the scrolling content.

## Type

- **Display + body:** `Hanken Grotesk` (self-hosted, weights 400/500/600/700/800). Hierarchy by weight.
- **Data + labels:** `IBM Plex Mono` (400/500/600). Uppercase microlabels at `+0.09em`.
- Fonts are self-hosted in `frontend/public/fonts/*.woff2` via `@font-face` (`display: swap`) — no font CDN.
- Scale (px): body `15` · page title `31/800` · headline number `31–33` · verdict `22/800`. Emphasis helpers: `.kw` (accent keyword), `.hl` (highlighter wash), `b/strong` → `--ink-strong`.

## Motion with purpose

- Transitions 120–180ms ease-out; no bounce, nothing decorative slides in on load.
- **Auto-focus on result:** opening a timeline (Cohorts) or a finding drill-in (Quality) triggers `scrollIntoView({behavior:"smooth"})` on the opened panel — the answer to a click comes to the user.
- Focus surfaces animate in with a short `pop` (fade + 6px rise), so a new surface reads as *arriving*, not just appearing.
- `@media (prefers-reduced-motion: reduce)` disables all of the above.

## Discoverability (focus on the user)

Nothing important is a hidden affordance. Concretely:

- **Hint lines** (`.hint`) sit above interactive tables to state what a click does ("Select any patient to open their full event timeline…").
- **Row call-to-action** (`.rowcta`): every clickable row carries a persistent pill — `TIMELINE →` on patient rows, `INSPECT` on finding rows — that fills with accent on hover and shows an active label (`VIEWING`, `HIDE`) once opened.
- Panel headers state the interaction ("SELECT A ROW TO INSPECT").

## Signature — the Provenance Ledger

The cohort inclusion→exclusion funnel, rendered like a bank statement: columns `CRITERION · SOURCE · REMAINING · Δ`, running `n` in tabular mono, red delta in the margin, an emphasised `COHORT` total row. It is the cohort builder, the audit trail, and the "show the query" requirement in one. Class: `.ledger`.

## Component classes (in `globals.css`)

- Shell: `.bar` (top bar), `nav a.active`, `.safety` (banner on every page).
- Surfaces: `.panel` / `.panel-h` / `.panel-b`, `.panel-pop` (focus surface), `.grid2`.
- Controls: `.btn`, `.btn-ghost`, `.btn-2`, `.field` (input), `.chip-btn`.
- Data: `.ledger`, `.gt` (grid table), `.tablewrap`, `.drill-tbl` (offending-rows table), `.flags` + `.flag` + `.pill{.err,.find,.caveat}`, `.metrics` + `.metric`.
- Dashboards: `.verdict`, `.stile`, `.dtile` + `.dgrid`, `.sevbar`, `.cbars`, `.cm` (confusion matrix).
- Discoverability: `.hint`, `.rowcta`, `.row-click` / `.row-on`, `.flag-click` / `.flag-on`.
- Prose: `.lbl` (mono microlabel), `.note`, `.chip`, `.ai` (AI-generated content marker), `.abstain`, `.kw`, `.hl`.

## Rules of use

- **AI-generated content** is always marked (`.ai` block with an `AI` badge) and visually distinct from source data — a safety requirement.
- **Safety banner** (`.safety`) renders on every page via the root layout.
- New UI reuses these classes; do not introduce radii > 9px, a third typeface, or decorative motion. Elevation is allowed but only from the two tokens above — no ad-hoc shadows.

## Screenshots

Current UI lives in `docs/ui-screenshots/`. Refresh via claude-in-chrome whenever the UI changes.
