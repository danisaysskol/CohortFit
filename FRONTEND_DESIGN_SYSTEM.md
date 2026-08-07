# CohortFit — Frontend Design System ("Lab Ledger")

> The single source of truth for the UI. Implemented in `frontend/app/globals.css`; every page uses these tokens and components. Warm-light only (no dark mode). Rationale and anti-AI-slop reasoning: `docs/design-direction.md`.

## Principles
1. **Hairlines, not shadows.** Structure comes from 1px rules; drop-shadows are reserved for popovers/menus only.
2. **6px radius ceiling.** `cell 0 · control 4px · card 6px`. Never 16px rounded cards (an AI-slop tell).
3. **Tabular figures on all data.** Every count/percentage/ID is monospaced with `font-variant-numeric: tabular-nums`.
4. **Accent restraint.** The prussian accent marks interactive elements and one data highlight — ≤ ~10% of the surface. Semantic colors (ok/warn/danger) encode state only, never decoration, and always pair with a label/icon (color-blind safe).
5. **Warm neutrals, chosen.** Greige paper, warm near-black ink — never pure `#000`/`#FFF`.

## Color tokens
| token | hex | role |
|---|---|---|
| `--bg` | `#EFEDE6` | page (warm greige) |
| `--surface` | `#F8F7F3` | cards (brighter paper) |
| `--surface-2` | `#FCFBF8` | insets, code, table stripes |
| `--ink` | `#1B1A17` | primary text |
| `--muted` | `#6C6A62` | secondary text |
| `--faint` | `#918D82` | labels, tertiary |
| `--line` | `#D8D5CC` | hairline |
| `--line-strong` | `#C4C0B4` | stronger divider / input border |
| `--accent` | `#1E3A54` | prussian ink-navy (interactive + one highlight) |
| `--accent-ink` | `#F8F7F3` | text on accent |
| `--ok` | `#3D7A5D` | green / pass |
| `--warn` | `#B07515` | amber / caution |
| `--danger` | `#A32E28` | red / error |

## Type
- **Display + body:** `Hanken Grotesk` (self-hosted, weights 400/500/600/700/800). Hierarchy by weight.
- **Data + labels:** `IBM Plex Mono` (400/500/600). Uppercase microlabels at `+0.09em`.
- Fonts are self-hosted in `frontend/public/fonts/*.woff2` via `@font-face` (`display: swap`) — no font CDN.
- Scale (px): `12 · 13 · 14 · 16 · 20 · 26 · 34` (~1.25). Body 14–15. Text measure ≤ 68ch.

## Radius / spacing / motion
- Radius: `--rc: 6px` (cards), `--rk: 4px` (controls), cells `0`.
- Spacing on a 4px grid; dense table rows.
- Motion functional only: 120–160ms ease-out; no bounce, nothing slides in on load. `prefers-reduced-motion` respected.

## Signature — the Provenance Ledger
The cohort inclusion→exclusion funnel, rendered like a bank statement: columns `CRITERION · SOURCE · REMAINING · Δ`, running `n` in tabular mono, red delta in the margin, an emphasized `COHORT` total row. It is the cohort builder, the audit trail, and the "show the query" requirement in one. Class: `.ledger`.

## Component classes (in `globals.css`)
- Shell: `.bar` (top bar), `nav a.active`, `.safety` (banner on every page).
- Surfaces: `.panel` / `.panel-h` / `.panel-b`, `.grid2`.
- Controls: `.btn`, `.btn-ghost`, `.field` (input), `.search`.
- Data: `.ledger`, `.gt` (grid table), `.tablewrap`, `.flags` + `.flag` + `.pill{.err,.find,.caveat}`, `.metrics` + `.metric`.
- Status: `.st`, `.dim`, severity classes `.dotr/.dota/.dotg`, `.sq{.red,.amber,.green}`.
- Prose: `.lbl` (mono microlabel), `.note`, `.chip`, `.ai` (AI-generated content marker), `.abstain`.

## Rules of use
- **AI-generated content** is always marked (`.ai` block with an `AI` badge) and visually distinct from source data — a safety requirement.
- **Safety banner** (`.safety`) renders on every page via the root layout.
- New UI reuses these classes; do not introduce new radii > 6px, drop-shadows on cards, or a third typeface.

## Screenshots
Current UI lives in `docs/ui-screenshots/` (`app-cohorts`, `app-quality`, `app-evaluation`, `app-schema`). Refresh via claude-in-chrome whenever the UI changes.
