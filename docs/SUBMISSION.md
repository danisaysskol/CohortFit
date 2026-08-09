# Submission — CohortFit (Sofstica AI Hackathon 2026, Track 2)

## Project description (≤ 1,000 characters)

> Paste this into the portal's "Project Description" field. Current length: **999 / 1000**. Covers the four required points: what you built · the problem · how it works · what you'd improve.

CohortFit (Track 2) turns a plain-English cohort description into a transparent, reproducible query, then judges whether that cohort's data are fit to trust.

Problem: hospital data are rich but hard to use — before analysis a researcher must define a cohort AND judge whether its data support it, telling a real finding from a data error.

How: plain words → a validated JSON query (OpenAI strict structured outputs; the model never writes SQL) → a deterministic DuckDB compiler that validates every field. You get the inclusion/exclusion funnel, matched patients with event timelines, a red/amber/green fitness scorecard across five dimensions (every flag drillable to the real offending rows, classified data-error vs finding), and measurement coverage, unit variation and coding. Fixes are reversible and rule-backed; source data is never edited; it abstains when unsupported. Research/education only.

More time: harder-dimension evaluation, leakage/index-time guards, validation on a larger dataset.

---

## Submission checklist (from `docs/TRACK2_REQUIREMENTS.md` §9)

- [x] **Working prototype (MVP)** — runs with one `docker compose up` (FastAPI + Next.js). Not a mockup.
- [x] **Public GitHub repo + README** — https://github.com/danisaysskol/CohortFit ; README covers what/problem/how/future + setup, config, dependencies.
- [x] **Project description (≤1000 chars)** — above.
- [ ] **Project links** — live demo URL and/or **demo video** (YouTube/Loom); slides/supporting docs. *(human)*
- [ ] **Project theme** — select the correct hackathon theme in the portal dropdown. *(human)*
- [ ] **Resume/CV upload** — 1 per member (team min 2, max 5), combined ≤ 5 MB. *(human)*
- [ ] **Eligibility & Originality declaration** — acknowledge before submitting. *(human)*
- [ ] **One final submission** — cannot be modified once submitted; submit before the deadline (portal auto-closes). *(human — confirm the exact deadline)*

## Supporting evidence to cite in the pitch
- Evaluation: `docs/EVALUATION_REPORT.md` (cohort correctness, injected-error P/R/FPR with the honest one-check caveat, dumb-vs-tool contrast).
- Safety & data lineage: `docs/SAFETY_STATEMENT.md`.
- One honest failure/abstention case: e.g. "which patients were admitted in winter" → abstains (dates are shifted).
