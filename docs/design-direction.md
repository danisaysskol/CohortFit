# Design Direction — CohortFit

> Outcome of the design R&D pass (2026-08-08). The brief: kill the generic "AI-slop" look and adopt an opinionated, warm-light design **system** that reads as a shipped, design-led product for clinical-data researchers. Selected direction: **Lab Ledger**. Full realization is previewed in `design-explorer.html` and will be codified in `FRONTEND_DESIGN_SYSTEM.md` once built in Next.js.

## The four "AI tells" we design against
1. Inter / Space Grotesk type. 2. `#F4F1EA` cream + terracotta palette. 3. Uniform 16px rounded cards floating on soft drop-shadows. 4. Four-card hero grids with faint hover states. Our system rejects all four.

## Selected: **Lab Ledger**
Swiss neo-grotesque × lab notebook × instrument panel. Objective, tabular, quietly authoritative — the discipline of Linear/Suisse Int'l on **warm paper** instead of cold graphite. Structure comes from **hairlines, not shadows**.

### Palette (warm greige "paper" — deliberately not yellow cream)
| role | hex | note |
|---|---|---|
| bg | `#EFEDE6` | warm greige page, desaturated |
| surface | `#F8F7F3` | cards are *brighter* paper than the page (editorial lift) |
| ink | `#1B1A17` | warm near-black (never pure #000) |
| muted | `#6C6A62` | warm grey secondary |
| line | `#D8D5CC` | 1px hairline — the primary structural device |
| accent | `#1E3A54` | prussian ink-navy (abandons the old teal) |
| ok | `#3D7A5D` | muted eucalyptus |
| warn | `#B07515` | ochre (never neon) |
| danger | `#A32E28` | oxblood |

### Type (self-hostable, OFL)
- **Hanken Grotesk** (display + body) — a true grotesque with warmth and real character in `a`/`g`/`t`; hierarchy through weight (300–900). Explicitly not Inter/Space Grotesk. Source: Google Fonts / GitHub `marcologous/hanken-grotesk`.
- **IBM Plex Mono** (all data / labels) — institutional credibility; **tabular figures** for every count/percentage/ID; uppercase microlabels at +0.06em. Source: GitHub `IBM/plex`.

### Anti-slop rules encoded as tokens
```
--radius-cell:0; --radius-control:4px; --radius-card:6px;   /* hard 6px ceiling kills the 16px tell */
--line:1px solid #D8D5CC;                                   /* hairlines, not shadows */
--shadow-pop:0 4px 16px rgba(27,26,23,.10);                 /* popovers/menus ONLY; cards get borders */
type scale: 12/13/14/16/20/26/34 (~1.25);  body 14–15
label: 11px IBM Plex Mono, UPPERCASE, +0.06em
font-feature-settings:"tnum" 1;                             /* tabular figures on ALL data */
text measure ≤ 68ch;  accent surface budget ≤ 10% (interactive + one data highlight only)
semantic color = state only, never decoration;  each severity paired with icon/label (color-blind safe)
never pure #000 / #FFF
```

### Signature element — the **Provenance Ledger**
The inclusion→exclusion funnel rendered like a bank statement / CONSORT flow: each criterion is a hairline-ruled row with the **running `n` remaining** in tabular mono and a red delta (e.g. `−56`) in the margin. It is simultaneously the cohort builder, the audit trail, and the "show the query" requirement made visible. (Verified real numbers for *"ICU patients over 65 who died in hospital"*: 100 → 44 age≥65 → 44 with an ICU stay → **9** died in hospital.)

### Motion
Functional only: 120–160ms ease-out on state changes; no springy bounce; nothing slides in on load. One signature motion: numeric counters tick up in tabular mono when a cohort recomputes.

## Alternates (if we ever pivot)
- **Almanac** — editorial journal look: Fraunces (optical display serif) + Instrument Sans + Commit Mono; pine-green accent; scorecard as an academic report card. More soul, less severity.
- **Console** — mono-forward instrument in warm light: Geist Sans + Geist Mono; restrained signal-orange; data-quality gauges on a tick-grid. Maximum "instrument" novelty.

## Self-hosting (Next.js)
Use `next/font/local` with self-hosted variable WOFF2 (subset, `display:swap`, CSP-clean). Hanken Grotesk + IBM Plex Mono are both SIL OFL.

*Sources: 925studios anti-AI-slop guide; Mantlr/Pixeldarts on Stripe·Linear·Vercel UI; Typewolf Söhne alternatives; GitHub marcologous/hanken-grotesk & IBM/plex; CONSORT provenance viz (arXiv 1906.07625); IBM Carbon / Elastic Kibana severity palettes.*
