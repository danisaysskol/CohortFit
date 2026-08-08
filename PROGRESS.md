# PROGRESS — CohortFit

> Living status tracker for the team + collaborators. **Update this file, not memory.** Keep it honest: if something is untested, say so.
>
> **Project:** CohortFit — Track 2 (Cohort & Data Quality Explorer), Sofstica AI Hackathon 2026.
> **Key docs:** `TENTATIVE_AGILE_PLAN.md` (product plan) · `docs/TRACK2_REQUIREMENTS.md` (what's asked) · `docs/RESEARCH_AND_EXPLORATION.md` (evidence) · `CLAUDE.md` (repo layout & conventions).
> **Repo:** https://github.com/danisaysskol/CohortFit

_Last updated: 2026-08-08 — The cohort → data-fitness → measurements loop is live. Built cohort-scoped quality + a measurement explorer on the backend, implemented and evaluated three UI approaches (A toggle / B workspace / C explore-first) against pre-set criteria, and synthesized to the **Workspace** (B): build a cohort on Cohorts, then a CTA opens a one-screen workspace showing that cohort's fitness scorecard and its measurement coverage/units/coding. Verified end-to-end; 30 backend tests pass. Next: human deliverables (demo, slides, submission)._

---

## 🌟 North Star (grade every increment against this)

**Goal:** do what 99.9% of teams won't — ship a system whose **every minute detail is deliberate** and whose **behavior, not just its features, is engineered and evidenced**. Judges should notice that nothing was left to "good enough." Full statement in [`README.md`](README.md#-north-star--what-999-of-teams-wont-do).

The eight commitments (self-check on each feature): 1) honest quantified eval (precision/recall/FPR + uncertainty) · 2) real-finding-vs-data-error gating on `param_type` · 3) abstention demoed as a feature · 4) provenance to the exact row · 5) reproducibility (IR + SQL + data-hash) · 6) licence-aware data minimization (minimize + disclose what's sent externally; schema + aggregates by default) · 7) system behavior at the edges (missing/ambiguous/duplicate/mis-timed/out-of-scope) · 8) craft in every detail (measured numbers, bespoke non-AI-slop design, tracked screenshots, dead-code hygiene, clean commits).

> **Working rule:** if a change doesn't move us toward the North Star, reconsider it. Every PR/commit should be defensible as "a judge would notice the care here."

---

## ✅ Past (done)

- **Data ready:** `mimic-iv-clinical-database-demo-2.2.zip` extracted; all `.csv.gz` decompressed to `.csv` in place → `mimic-iv-clinical-database-demo-2.2/` (100 patients / 275 admissions / 140 ICU stays).
- **Docs ready:** official MIMIC-IV documentation copied to `mimic-iv-docs/` (66 files, from `docs/iv/` in `mimic.mit.edu-main.zip`).
- **Upstream code available:** `mimic-code-main/` present locally (gitignored; required — see `README.md`).
- **Git/GitHub:** repo initialized and pushed to `danisaysskol/CohortFit`; `.gitignore` excludes `mimic-code-main/` + source zips; **no co-author trailers** policy in effect (history cleaned).
- **Requirements captured:** both hackathon PDFs extracted into `docs/TRACK2_REQUIREMENTS.md` (rubric weights, metrics, safety text, Sofstica submission rules).
- **R&D complete (grounded, cited):** data map, DQ opportunity catalogue with real values, documented-bug citations, and OpenAI model/method decisions → `docs/RESEARCH_AND_EXPLORATION.md`.
- **Product plan drafted:** `TENTATIVE_AGILE_PLAN.md` (use cases, Does/Never, rubric mapping, eval harness, demo arc, build order + MVP cut line).
- **claude-in-chrome verified:** end-to-end (tab context → navigate → screenshot) works — ready for UI testing.
- **R&D doc expanded:** added a from-scratch explainer (§0, zero-context reader) and **real sample rows** from every key table.
- **OpenAI pricing confirmed by user** (terra/luna; sol never used — too expensive). Cost-features: prompt caching + `reasoning_effort=low`.
- **Decisions locked:** see decision log below.

## 🔧 Course-correction (2026-08-08, after testing + real API key)

Honest reconciliation vs. the plan/prompts (nothing architectural diverged; two real gaps surfaced and are fixed, several remain):
- **OpenAI was never actually being called.** No key was configured, so `/cohort/build` silently used the keyword fallback the whole time. I implemented the OpenAI path but failed to *verify it ran*. **Fixed:** with the key in `.env`, the only bug was `temperature=0` (gpt-5.6 reasoning models only allow the default) → removed it (+`reasoning_effort=low`); now `method=openai` verified live (demo phrase → the 9 gold ids; a fake drug name → OpenAI *abstains*).
- **The `software-testing` agent (46 cases logged in `docs/test-cases/`) found real correctness bugs** in the keyword parser: a **number-grab** ("potassium over 5.5" → age≥5 → all 100) and **silent partial-parsing** (confident over-inclusive cohorts). **Fixed:** the parser now detects lab/vital thresholds (numbers no longer mis-read as age), parses gender + under-N + diagnosis, and **refuses / abstains / clarifies** for out-of-scope, ambiguous, negation, aggregation, temporal, and cross-hospital queries instead of lying. Disposition is surfaced in the UI.
- **`.env` audit** (user asked): no real `.env` was ever deleted — it was never committed/pushed, is gitignored, and the only `.env` I'd touched was a one-line throwaway (`test`) created+removed in a single gitignore-verification command. The user's key is intact and safe.

## 🔄 Current

- **Working full stack, now OpenAI-driven + honest.** `docker compose up` → FastAPI (`:8000`) + Next.js (`:3000`); 6 pages verified; 15 backend tests pass; pages < 200ms. Additions since MVP: flag **ranking** (worst-first), **reviewer-time-saved**, eval **baseline + multi-seed uncertainty**, disposition-aware UI, SQL-tab **wrap fix**.
- **Still genuinely pending** (see below) — the Schema **ERD + free data explorer** you asked for is NOT built yet (current Schema page only samples rows), plus missing DQ checks, an OpenAI-path test re-run, a UI-clarity pass, and the dumb-vs-tool table.

## ✅ Past — build (done + verified)

- **Design system `TENTATIVE_FRONTEND_DESIGN_SYSTEM.md`** written; Lab Ledger implemented in `frontend/app/globals.css` with self-hosted Hanken Grotesk + IBM Plex Mono.
- **Repo scaffold + Docker:** `backend/` (FastAPI) + `frontend/` (Next.js 14) + `docker-compose.yml` (one command). Config via pydantic-settings + `.env`.
- **M0 Data spine:** DuckDB view per CSV + schema introspection (`/schema`).
- **M1 Eval harness:** self-seeded error injection (read-only CTE, concurrency-safe) → precision/recall/FPR (`/eval/run`; 20 injected → P/R 1.0, FPR 0).
- **M2 Rule library:** plausibility (single-pass, MIT bounds), units, temporal, completeness, duplicates → R/A/G scorecard; findings tagged data_error/real_finding/caveat (`/quality/scorecard`, warmed + cached → 8ms).
- **M3 Cohort IR layer:** plain-English → validated IR (OpenAI structured-output, keyword fallback offline) → DuckDB compiler with provenance funnel + data-hash (`/cohort/build`; demo phrase → 9 gold subject_ids, funnel 100→44→44→9).
- **Frontend pages:** Schema Explorer (list + search + sample + keys), Cohorts (builder + Provenance Ledger + IR/SQL), Quality (scorecard + findings), Evaluation (metrics), About/Safety. Safety banner on every page.
- **Session/local store + sandboxed execution:** cohort session persists to localStorage (reload-safe); queries run deterministically over the fixed DuckDB store; IR + SQL + data-hash stored.
- **Tests:** 14 pass in Docker (`docker compose run --rm backend pytest`) — data/quality/cohort/eval/api.
- **Two demo-reliability bugs found + fixed:** scorecard 17s → 8ms (single-pass + cache); eval temp-table concurrency race → read-only CTE.

## ✅ Past — evidence & submission (done)

- **Reversible fix-ledger** built + verified (apply/undo, forward+reverse logged, source untouched).
- **`docs/EVALUATION_REPORT.md`** — cohort correctness (gold = 9), injected-error metrics (P/R 1.0, honest caveat), real findings, reproducibility, limitations.
- **`docs/SAFETY_STATEMENT.md`** — intended/prohibited use, data lineage, licence-aware minimization, failure modes, human-review boundary.
- **README polished** — quick start (`docker compose up`), architecture, verified screenshots, ≤1000-char pitch, doc index.

## ⏳ Pending (refreshed 2026-08-08)

**Done this wave (OpenAI + joins + DQ + UI):**
- [x] **OpenAI live & verified** — `method=openai` (gpt-5.6-terra, structured outputs, `reasoning_effort=low`, no temperature). Never the sol tier. Confirmed against current docs via Context7.
- [x] **Multi-table joins / temporal / negation / LOS / readmission** (rubric "joins and temporal logic are sound") — IR `exclude` + kinds `los_threshold`/`lab_temporal`/`readmission`; compiler runs labevents⋈icustays temporal joins + admissions self-join. Verified live (NOT-antibiotics 24, LOS>7 18, lab-before-ICU 61, readmit≤30 26, diabetes 35, potassium>5.5 32).
- [x] **Honest dispositions** — refuse / abstain / clarify (contradiction, seasonality, cross-hospital, prediction) surfaced in the UI.
- [x] **Missing DQ checks added** — results-hidden-in-comments (9,469 rows/144 itemids — the documented MIMIC finding), storetime<charttime, per-stay HR completeness, near-duplicate. 14 findings now.
- [x] **Schema ERD + reusable modern data explorer** — `DataTable`/`FilterBar`/`useTableExplorer` (removable type-aware filter chips, add-filter composer, sortable sticky table). Verified.
- [x] **Dumb-vs-tool** table (About + EVALUATION_REPORT); eval **baseline + multi-seed uncertainty**; flag **ranking** + reviewer-time-saved.
- [x] **CLAUDE.md project tree** + keep-updated instruction; Windows HMR polling fix.

- [x] **Re-ran the 46-case suite through OpenAI** → `docs/test-cases/{results.json,RESULTS.md}` refreshed: **43 pass / 2 partial / 1 fail** (was 21/13/12), `method=openai`, counts CSV-verified. Fixed the two issues it surfaced (storetime check now scans chartevents=54,144 and always surfaces; "high blood pressure" → clarify).
- [x] **Clickable ERD** — click a table box → column dropdown (name+type); also loads that table in the explorer.

**Done (UI-clarity + reliability):**
- [x] **Quality & Evaluation redesigned as dashboards** — Quality: overall verdict + headline stats + 5 dimension tiles + severity-distribution chart + ranked findings. Evaluation: metric tiles with plain-English meanings + CohortFit-vs-baseline bar chart + confusion matrix. Reusable chart primitives in `components/charts.tsx`.
- [x] **Formal, professional copy** across all pages.
- [x] **Schema map PK/FK awareness** — ERD edges labeled with the join column; column popover badges PK/FK; explorer chips show PK/FK → reference.
- [x] **Concurrency bug fixed (demo-safety)** — DuckDB connection isn't thread-safe; concurrent requests corrupted results. Now a fresh cursor per query; verified under 8 concurrent calls.
- [x] Removed the Batch-API idea (not feasible for a hackathon).

**Done (brought the UI to life — Confident + high contrast):**
- [x] **Reusable icon set** (`Icon.tsx`) used across nav, buttons, tiles, findings, ERD.
- [x] **Visual energy** — filled accent buttons with hover-lift + press, input focus glow, tinted panel headers (contrast), coloured headline numbers, spinner, warm second accent, transitions.
- [x] **Cohorts** — auto-focused hero input; **patient results table** (gender/age/ICU stays/LOS/admissions/death), not just subject_ids.
- [x] **Schema map = star layout** — patients/admissions/icustays centred, all FK edges attached + labelled; PK/FK badges; clickable tables → column dropdown.

**Done (Track-1 supporting feature — patient journey):**
- [x] **Patient Timeline** — click any matched patient in the Cohorts table → a time-ordered journey of that patient's real events (admissions, ICU in/out, transfers, procedures, death) with each event linked to its **source table + id**, plus a header (gender/age, lab/med/event counts) and their **diagnoses** (provenance for why they matched the cohort). Backend `/patient/{subject_id}/timeline` (`backend/app/data/timeline.py`); frontend `frontend/app/cohorts/Timeline.tsx`. Verified in-browser (subject 10006580: F/63, 12 events, diabetes + insulin diagnoses shown). Dates are shifted (MIMIC de-identification) so the panel states the calendar is not real but event **order** is. The instructions allow supporting features from another track; this is the Track-1 "patient journey" view, and it doubles as row-level provenance for a cohort match.

**Done (Quality drill-in — a flag is never taken on trust):**
- [x] **Finding drill-in** — click any data-quality flag on the Quality page → a panel shows the **actual offending rows** in the demo dataset, the **exact SQL** that found them, and a "showing N of TOTAL" count. E.g. clicking "ABP mean (220052)" reveals subject 10020944 with an arterial BP mean of 801 mmHg (down to −23). Each finding carries a stable `id`, a `drillable` flag, and its own `sample_sql`; green/zero-count checks aren't drillable. Backend `/quality/finding/{id}/rows` (`quality.find_offending_rows`, capped, read-only, source never modified); frontend renders it inline on `quality/page.tsx`. Verified in-browser + covered by tests (30 pass). This makes the honesty pitch tangible: every claimed error traces to a real, inspectable row.

**Done (design v2 — contrast, scale, tactility, discoverability, motion):**
- [x] **Higher contrast + larger type** — near-black `--ink`/`--ink-strong` for headings & data (was taupe); page titles 22→31px/800; headline numbers 24→31–33px; darker `--muted`. Fixes "everything feels like light creme".
- [x] **Material tactility** — deeper greige ground + two-token elevation (`--elev-1` resting cards, `--elev-2` focus surfaces); sticky input gets blur + shadow. Cards now lift.
- [x] **Discoverability (features speak for themselves)** — hint banners ("Select any patient to open their full event timeline…"), persistent row CTAs (`TIMELINE →`, `INSPECT`) that fill on hover and show active state (`VIEWING`, `HIDE`), and panel-header prompts ("SELECT A ROW TO INSPECT").
- [x] **Motion with purpose** — opening a timeline or a finding drill-in smooth-scrolls the result into view (kills the "scroll so much" problem) + a short pop-in; `prefers-reduced-motion` honoured.
- [x] **Design doc renamed** `FRONTEND_DESIGN_SYSTEM.md` → `TENTATIVE_FRONTEND_DESIGN_SYSTEM.md`, rewritten with the Apple+Material philosophy, new tokens, elevation, motion, discoverability. References updated across CLAUDE.md/README/globals.css.

**Done (page-switch latency — fixed at the root):**
- [x] **Production build** — root cause was the Next.js **dev server compiling each route on first visit** (multi-second). The Docker frontend now does `next build` + `output:standalone` + `next start` (multi-stage Dockerfile; source bind-mount removed). Measured page loads dropped to **20–210ms cold, ~20ms warm** (was multiple seconds). Nav uses `next/link`, so prod prefetches routes on hover/viewport. **Dev-loop note:** after editing frontend code, rebuild: `docker compose up -d --build frontend`.
- [x] **Client-side caching** — the demo dataset is frozen, so every GET is deterministic; API responses are cached in `sessionStorage` keyed by path (instant repeat visits, one round-trip per session).

**Done (compact layouts + control audit + narrative context):**
- [x] **Cohorts layout** — tried three layouts (split / tabbed / result-first); kept **tabbed**: matched patients + Recipe + SQL share one compact panel (patients full-width) instead of three stacked panels. Funnel above still shows the transparent query.
- [x] **Quality layout** — distribution panel no longer stretches (align-items:start); gaps trimmed.
- [x] **Prominent segmented control** — the Patients/Recipe/SQL toggle is now a tactile track with an accent-filled active pill (was a tiny mono switch).
- [x] **Control audit** (same class of fix, app-wide): schema **table selector** active state now has an accent bar + bold + elevation (was a faint border); **sort headers** read as clickable (hover fill, clearer carets); the table-filter **input** got a focus glow. Bolder panel subheadings.
- [x] **Quality & Evaluation narrative** — a compact `Explain` strip (Context → Problem → Method → Result) tells each page's story in one band without adding scroll. Reusable `components/Explain.tsx`.

**Done (interactivity critique → acted on, then removed):**
- [x] Wrote an honest attention/interactivity critique (six heuristics; per-page; what works / lags / improve / remove), **implemented its declutter + control recommendations** (dimension tiles now filter findings; redundant hint/prompt signals removed; Evaluation per-seed table collapsed; `openai` chip clarified), then **deleted the critique doc** now that it is consumed. Headline it surfaced: interactivity is still **lopsided** — Cohorts is richly interactive while Quality/Evaluation lean read-only; the top-value next step is cohort-scoped, cross-linked quality + measurement views.

**Done (the big one — Track-2 points 2 & 3 made interactive & cohort-scoped):**
- [x] **Shared backend** — every quality check takes optional `subject_ids` (scope to a cohort or the whole dataset; 30 tests still green); new `measure.py` for measurement coverage / unit variation / value-range-vs-bounds / ICD-9/10 coding, cohort-scoped. Endpoints: `POST /cohort/quality`, `/cohort/quality/rows`, `/cohort/measurements`.
- [x] **Built all three UI approaches and evaluated each in-browser against the pre-set criteria** (Track-2 fit / loop-coherence / demo-impact / honesty / cost-safety):
  - **A** — dataset↔cohort toggle on the Quality page (score 85).
  - **B** — a dedicated **Workspace**: one screen, cohort banner + Data-fitness / Measurements lenses (score **93**).
  - **C** — measurement-first Explore page (score 70; dropped the scorecard verdict, had a fetch race).
- [x] **Synthesis → selected B.** A's value is fully contained in B (both use the shared `CohortFitness` + `Measurements` components), so keeping B removed duplication rather than losing anything; C dropped. Reverted A (Quality is clean whole-dataset again), deleted C. Added a cohort→Workspace cross-link CTA on the Cohorts page. **The loop is live:** build a cohort → "Judge this cohort's data fitness & explore its measurements →" → Workspace shows the cohort's scorecard (e.g. plausibility flips green for the 9-patient gold cohort) and its measurement coverage/units/coding. Verified end-to-end.

**Done (perf + IA + honesty polish):**
- [x] **Cohort-view latency fixed at the root** — the loader registered CSVs as DuckDB *views* (re-parsed on every query); materialising them into in-memory tables dropped cohort/quality **23s→0.27s** and cohort/measurements **9.9s→0.36s** (cached repeats ~10ms). Also replaced a correlated NOT EXISTS with an anti-join and cached each cohort's scoped findings/measurements.
- [x] **Navbar merged & focused** — Workspace merged into **Data fitness** (one page with a Whole-dataset ↔ This-cohort toggle + the cohort's measurements); nav is now **Cohorts (first) · Data fitness · Schema · Evaluation · About** (5 tabs). Cohorts CTA lands directly on the cohort scope.
- [x] **Evaluation honesty** — a prominent scope banner states the perfect scores cover **one check (temporal integrity)**, not all five dimensions; the other four are evidenced by real findings, not injection. Prevents the P/R 1.00 tiles reading as a whole-system claim.

**Next:**
- [ ] Human deliverables (demo video, slides, submission, CVs).

**Human-only:**
- [ ] Demo video + slides (3-min script in `TENTATIVE_AGILE_PLAN.md`), Sofstica portal submission, CVs.

## 🖼️ UI screenshots
Latest UI screenshots live in `docs/ui-screenshots/`. **Update them whenever the UI changes** (test in claude-in-chrome, overwrite the "latest" set).

## 📌 Decision log

| Date | Decision | Why |
|---|---|---|
| 2026-08-08 | Claude Code model = **claude-opus-4-8** (`/model claude-opus-4-8`) | Consistency across sessions/collaborators; Opus 5 exists but we standardize on 4.8. |
| 2026-08-08 | **Scrum** process; **frontend from the start**; **multi-page** UI | Continuous build→test→verify; per-capability pages let judges grade progressively. |
| 2026-08-08 | **Docker** required (`docker compose up`) | A collaborator will also run it; reproducible env. |
| 2026-08-08 | Design = Apple/Claude-like, **warm light mode only**, user-selected then documented in `TENTATIVE_FRONTEND_DESIGN_SYSTEM.md` | User-centric aesthetic; single source of truth for UI. |
| 2026-08-08 | **Design v2:** blend Apple clarity with Google **Material** (focus on user, material as metaphor, motion with purpose) | Judges scan fast; higher contrast, larger type, tactile elevation, explicit affordances, and purposeful motion make features self-evident. |
| 2026-08-08 | Stack = FastAPI + Next.js | Polished live-demo product; MVP cut line protects scope. |
| 2026-08-08 | LLM = OpenAI only | Strict Structured Outputs + column enums; key in gitignored `.env`. |
| 2026-08-08 | Ace card = demo-verifiable only | Honesty is the pitch; every flag traces to a real 100-patient row. |
| 2026-08-08 | NL → JSON IR → DuckDB (LLM never writes SQL) | Transparent, safe, reproducible; IR is the showable inclusion/exclusion logic. |
| 2026-08-08 | Relaxed "zero patient rows to LLM" → **minimize + disclose** | The brief only requires *minimizing* data sent externally, not zero rows; the strict rule over-constrained creativity. We keep schema+aggregates as default, allow minimal disclosed rows when a task needs them. |
| 2026-08-08 | Design direction = **Lab Ledger** (Hanken Grotesk + IBM Plex Mono, greige paper, prussian accent, Provenance Ledger signature; later evolved with Material tactility) | Kills the four AI-slop tells; reads as a shipped data product. Codified in `TENTATIVE_FRONTEND_DESIGN_SYSTEM.md`. |
