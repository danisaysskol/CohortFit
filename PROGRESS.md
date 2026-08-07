# PROGRESS — CohortFit

> Living status tracker for the team + collaborators. **Update this file, not memory.** Keep it honest: if something is untested, say so.
>
> **Project:** CohortFit — Track 2 (Cohort & Data Quality Explorer), Sofstica AI Hackathon 2026.
> **Key docs:** `TENTATIVE_AGILE_PLAN.md` (product plan) · `docs/TRACK2_REQUIREMENTS.md` (what's asked) · `docs/RESEARCH_AND_EXPLORATION.md` (evidence) · `CLAUDE.md` (repo layout & conventions).
> **Repo:** https://github.com/danisaysskol/CohortFit

_Last updated: 2026-08-08._

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
- **OpenAI pricing confirmed by user** (sol/terra/luna, incl. cached-input + cache-write lines). Cost-features deep-dive (caching mechanics, reasoning effort, Batch/flex) — research in progress.
- **Decisions locked:** see decision log below.

## 🔄 Current (in progress)

- **Working full stack, verified in Docker + browser.** `docker compose up` → FastAPI backend (`:8000`) + Next.js frontend (`:3000`). All 5 pages verified live in claude-in-chrome (screenshots in `docs/ui-screenshots/app-*.jpg`).
- Remaining: reversible **fix-ledger** UI, then the **evidence/submission** docs (evaluation report, safety statement, README polish, pitch).

## ✅ Past — build (done + verified)

- **Design system `FRONTEND_DESIGN_SYSTEM.md`** written; Lab Ledger implemented in `frontend/app/globals.css` with self-hosted Hanken Grotesk + IBM Plex Mono.
- **Repo scaffold + Docker:** `backend/` (FastAPI) + `frontend/` (Next.js 14) + `docker-compose.yml` (one command). Config via pydantic-settings + `.env`.
- **M0 Data spine:** DuckDB view per CSV + schema introspection (`/schema`).
- **M1 Eval harness:** self-seeded error injection (read-only CTE, concurrency-safe) → precision/recall/FPR (`/eval/run`; 20 injected → P/R 1.0, FPR 0).
- **M2 Rule library:** plausibility (single-pass, MIT bounds), units, temporal, completeness, duplicates → R/A/G scorecard; findings tagged data_error/real_finding/caveat (`/quality/scorecard`, warmed + cached → 8ms).
- **M3 Cohort IR layer:** plain-English → validated IR (OpenAI structured-output, keyword fallback offline) → DuckDB compiler with provenance funnel + data-hash (`/cohort/build`; demo phrase → 9 gold subject_ids, funnel 100→44→44→9).
- **Frontend pages:** Schema Explorer (list + search + sample + keys), Cohorts (builder + Provenance Ledger + IR/SQL), Quality (scorecard + findings), Evaluation (metrics), About/Safety. Safety banner on every page.
- **Session/local store + sandboxed execution:** cohort session persists to localStorage (reload-safe); queries run deterministically over the fixed DuckDB store; IR + SQL + data-hash stored.
- **Tests:** 14 pass in Docker (`docker compose run --rm backend pytest`) — data/quality/cohort/eval/api.
- **Two demo-reliability bugs found + fixed:** scorecard 17s → 8ms (single-pass + cache); eval temp-table concurrency race → read-only CTE.

## ⏳ Pending

- [ ] **Reversible fix-ledger UI** (suggest → apply → undo, logged; never mutates source) — supports the brief's "reversible correction rate".
- [ ] **Evidence & submission:** `docs/EVALUATION_REPORT.md`, `docs/SAFETY_STATEMENT.md`, README polish (run instructions + screenshots), ≤1000-char pitch.
- [ ] Human deliverables: demo video + slides (script already in `TENTATIVE_AGILE_PLAN.md`).

## 🖼️ UI screenshots
Latest UI screenshots live in `docs/ui-screenshots/`. **Update them whenever the UI changes** (test in claude-in-chrome, overwrite the "latest" set).

## 📌 Decision log

| Date | Decision | Why |
|---|---|---|
| 2026-08-08 | Claude Code model = **claude-opus-4-8** (`/model claude-opus-4-8`) | Consistency across sessions/collaborators; Opus 5 exists but we standardize on 4.8. |
| 2026-08-08 | **Scrum** process; **frontend from the start**; **multi-page** UI | Continuous build→test→verify; per-capability pages let judges grade progressively. |
| 2026-08-08 | **Docker** required (`docker compose up`) | A collaborator will also run it; reproducible env. |
| 2026-08-08 | Design = Apple/Claude-like, **warm light mode only**, user-selected then documented in `FRONTEND_DESIGN_SYSTEM.md` | User-centric aesthetic; single source of truth for UI. |
| 2026-08-08 | Stack = FastAPI + Next.js | Polished live-demo product; MVP cut line protects scope. |
| 2026-08-08 | LLM = OpenAI only | Strict Structured Outputs + column enums; key in gitignored `.env`. |
| 2026-08-08 | Ace card = demo-verifiable only | Honesty is the pitch; every flag traces to a real 100-patient row. |
| 2026-08-08 | NL → JSON IR → DuckDB (LLM never writes SQL) | Transparent, safe, reproducible; IR is the showable inclusion/exclusion logic. |
| 2026-08-08 | Relaxed "zero patient rows to LLM" → **minimize + disclose** | The brief only requires *minimizing* data sent externally, not zero rows; the strict rule over-constrained creativity. We keep schema+aggregates as default, allow minimal disclosed rows when a task needs them. |
| 2026-08-08 | Design direction = **Lab Ledger** (Hanken Grotesk + IBM Plex Mono, greige paper, prussian accent, hairlines, 6px radius, Provenance Ledger signature) | Kills the four AI-slop tells; reads as a shipped data product. From design R&D (`docs/design-direction.md`). |
