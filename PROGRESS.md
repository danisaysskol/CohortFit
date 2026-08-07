# PROGRESS — CohortFit

> Living status tracker for the team + collaborators. **Update this file, not memory.** Keep it honest: if something is untested, say so.
>
> **Project:** CohortFit — Track 2 (Cohort & Data Quality Explorer), Sofstica AI Hackathon 2026.
> **Key docs:** `TENTATIVE_AGILE_PLAN.md` (product plan) · `docs/TRACK2_REQUIREMENTS.md` (what's asked) · `docs/RESEARCH_AND_EXPLORATION.md` (evidence) · `CLAUDE.md` (repo layout & conventions).
> **Repo:** https://github.com/danisaysskol/CohortFit

_Last updated: 2026-08-08._

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

- **Design-system selection.** Presenting **4 warm-light design philosophies** (Apple- + Claude-like) as an interactive options page with editable filters (typeface, size, motion, material, color, overlay/modal). User tweaks + picks → then it's implemented and documented in `FRONTEND_DESIGN_SYSTEM.md`.
- **OpenAI cost-features research** running (background) → will land in `docs/RESEARCH_AND_EXPLORATION.md` §D as a per-task config table.

## ⏳ Pending (next — scrum: build → test → verify → update → next)

- [ ] **Pick design** from the presented options → write `FRONTEND_DESIGN_SYSTEM.md`.
- [ ] **Repo scaffold + Docker:** `backend/` (FastAPI) + `frontend/` (Next.js) + `docker-compose.yml` (one `docker compose up`); `config/` + `.env` from `.env.example`.
- [ ] **M0 — Data spine:** CSV → DuckDB/Parquet loader; schema/DDL introspection.
- [ ] **Frontend from the start:** **Schema Explorer** page first (schema + ER diagram + data with filters & search), then a page per capability so judges can grade progressively.
- [ ] **M1 — Error-injection + scoring harness:** inject/label errors on a *copy*; precision/recall/FPR by table & dimension; patient-grouped folds; leakage note.
- [ ] **M2 — Rule library:** plausibility (reuse MIT `vitalsign.sql`/`chemistry.sql` ranges), missingness, unit, temporal, duplicate — gated on `d_items.param_type`; real-vs-error classifier.
- [ ] **M3 — Cohort IR layer:** OpenAI strict JSON schema (enum columns + `answerable`/`abstain` fields) → validator → DuckDB compiler; surface IR + SQL.
- [ ] **Session mgmt + local store + sandboxed execution:** persist/reload cohort+flag sessions exactly; deterministic query execution (no demo-day surprises).
- [ ] **Scorecard + fix-ledger UI**, safety banner on every page.
- [ ] **Evidence & submission:** evaluation report, safety & data statement, README polish, demo video, slides, ≤1000-char pitch.

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
