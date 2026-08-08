# CohortFit — Attention & Interactivity Critique

> An honest internal assessment of how well the app holds a judge's attention and invites interaction, in its current state (after the design-v2, layout-compaction, and control-audit passes). Written to be acted on, not to flatter. Scored against six heuristics: **attention** (does the eye land on what matters), **discoverability** (are features self-evident), **interactivity** (can the user *do*, not just read), **cognitive load** (how much scrolling/hunting), **hierarchy** (is importance encoded in size/weight/colour), and **motion** (does animation guide, not decorate).

_Last assessed: 2026-08-08._

## 1. Verdict in one paragraph

CohortFit now reads as a shipped, design-led product rather than a hackathon demo. The redesign fixed the three things that most hurt a fast skim — low contrast, weak hierarchy, and hidden affordances — and the two flagship interactions (patient timeline, finding drill-in) are genuinely engaging and unique to this product. The remaining weakness is **structural, not cosmetic**: one of Track 2's three capabilities (natural-language cohort building) is deeply interactive, while the other two (data-quality judging, measurement exploration) are still mostly *read-only dashboards*. That gap — not any single control — is the highest-value thing left to close.

## 2. What works (keep and lean into)

- **The two click-to-explore interactions are the app's soul.** Clicking a matched patient → their event timeline, and clicking a data-quality flag → the actual offending rows + the SQL, both turn a static claim into something you can inspect. This is the "honesty as a feature" pitch made tangible, and it's the most memorable thing in the app.
- **Hierarchy now reads at a glance.** Large near-black page titles, big mono headline numbers, and tactile card elevation mean a judge's eye lands on the verdict and the key figures within a second.
- **Features announce themselves.** Hint banners, persistent `TIMELINE →` / `INSPECT` row CTAs, active `VIEWING` / `HIDE` states, and the "SELECT A ROW TO INSPECT" prompt removed the earlier ambiguity. Nothing important is a hidden affordance.
- **Motion is purposeful.** Opening a result smooth-scrolls it into view and it pops in — the answer comes to the user instead of the user hunting for it. No decorative motion.
- **The Explain strip tells the story fast.** Context → Problem → Method → Result in one compact band gives each dashboard a narrative a judge can absorb without reading paragraphs.
- **Honesty is visible, not buried.** Abstain/clarify/refuse dispositions, the "injected, not natural" eval caveat, and the safety banner on every screen all reinforce the differentiator.
- **Navigation is instant** (production build), which matters more than it sounds: a judge who clicks around without waiting explores more.

## 3. Where it lags (ranked by impact)

1. **Interactivity is lopsided across the three Track-2 capabilities.** *Cohorts* is a rich two-way conversation (type → see steps → see who's in/out → drill into a patient). *Quality* and *Evaluation* are largely one-way: you read tiles and one list, with a single drill interaction on Quality and none on Evaluation. Points 2 and 3 of the brief feel less alive than point 1. **This is the biggest gap.**
2. **The three capabilities don't form the loop the product promises.** The thesis is "build a cohort → judge *its* data quality → explore *its* measurements." Today the pages are siloed: the Quality scorecard assesses the *whole* dataset, not the cohort you just built, and there's no link from a cohort to its fitness or its measurements. The strongest single improvement would be cohort-scoped quality + measurement views, cross-linked.
3. **Evaluation is the least interactive page.** It's a static report: four tiles, a bar chart, a confusion matrix, and a per-seed table whose rows are identical (one check, deterministic). A judge can't *do* anything. It also over-promises breadth (one temporal check) — honest, but thin.
4. **The measurement/coding-pattern explorer (Track-2 point 3) barely exists.** Schema explorer shows raw rows and keys, but there's no view of measurement *coverage*, unit *variation*, or coding *patterns* as an interactive lens — the exact thing point 3 asks for.
5. **The Cohorts "Live steps" panel earns less than its footprint.** With the production build the steps often complete near-instantly, so the trace flashes. It's a nice touch during a slow LLM call but takes a full column; consider making it collapse to a one-line status once complete.
6. **Dimension tiles on Quality are display-only.** Five prominent tiles (Plausibility/Units/…) look clickable but aren't — a missed, cheap interaction (click a dimension → filter the findings list).
7. **Responsive/mobile is unverified.** Everything is validated at desktop width; the grids have breakpoints but no one has looked at a narrow viewport, and judges sometimes review on tablets.

## 4. What to improve (prioritized)

**P1 — close the interactivity gap (the differentiator).**
- Make Quality and Measurement views **cohort-scoped and cross-linked**: from a built cohort, a "judge this cohort's data" and "explore this cohort's measurements" action. This is the loop the pitch describes and the highest-leverage change. (This is the "big exploration: try 3 paths, pick the best" task already queued.)
- Add one real interaction to **Evaluation**: e.g., a control to change the number of injected errors or the seed and watch precision/recall respond live — turning a static report into a small live experiment.

**P2 — deepen existing interactions.**
- Make the five **dimension tiles clickable** to filter the findings list (cheap, obvious win).
- In the **finding drill-in**, let a row link through to that patient/stay (reuse the timeline), tying the two flagship interactions together.
- Collapse the **Live steps** panel to a compact status line once a build completes.

**P3 — polish.**
- Verify and fix **narrow-viewport** layouts.
- Add a subtle **count-up or highlight** on the headline numbers when a page loads, to draw the eye (motion with purpose, used sparingly).
- Consider a light **cross-page breadcrumb** of the current cohort so the app feels like one workflow, not five pages.

## 5. What to remove or simplify

- **The per-seed detail table on Evaluation** currently repeats identical rows (deterministic, one check). Either collapse it behind a "show per-seed detail" toggle or replace it with the seed-to-seed variance it's meant to show. As-is it adds height and says little.
- **The `openai` method chip** on Cohorts is cryptic to a non-technical judge. Either label it clearly ("Interpreted by GPT-5.6") or drop it from the primary view.
- **Redundant hint verbosity**: now that rows carry a persistent CTA *and* there's a hint banner *and* a header prompt, some screens state the same affordance three ways. Keep the strongest one per screen.
- **Nothing structural should be removed** — the page set maps cleanly to the rubric; the fix is depth, not subtraction.

## 6. Scorecard

| Heuristic | Grade | Note |
|---|---|---|
| Attention | A− | Big titles, bold numbers, tactile cards; eye lands fast. |
| Discoverability | A− | CTAs, hints, active states; occasionally over-stated. |
| Interactivity | B− | Excellent on Cohorts + drill-ins; thin on Quality/Eval. |
| Cognitive load | B+ | Compact layouts + scroll-into-view fixed most of it; Evaluation still a long read. |
| Hierarchy | A | Contrast and scale now encode importance well. |
| Motion | A− | Purposeful, restrained; one flashy touch (count-up) could help load moments. |

**Overall: strong and demo-ready. The ceiling is raised by making the *judging* and *exploring* capabilities as interactive as the *building* one, and by wiring the three into the single cohort → fitness → measurements loop the product promises.**
