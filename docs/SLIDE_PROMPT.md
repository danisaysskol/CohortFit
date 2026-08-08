# Slide-deck prompt for claude.ai (generates a PPTX)

This file is a ready-to-use prompt for building the CohortFit pitch deck on **claude.ai**.
It is self-contained (all the context and numbers are embedded), so the deck will be
correct even if an attachment isn't read — but attach the files below for richer visuals
and depth.

## How to use
1. Open a new chat on **claude.ai**.
2. **Attach these repo files** (drag-and-drop):
   - `README.md` — overview, architecture, setup.
   - `docs/EVALUATION_REPORT.md` — the numbers/evidence.
   - `docs/SAFETY_STATEMENT.md` — safety text & data lineage.
   - `docs/TRACK2_REQUIREMENTS.md` — the rubric + required pitch content.
   - `docs/SUBMISSION.md` — the 1000-char description.
   - `TENTATIVE_FRONTEND_DESIGN_SYSTEM.md` — palette/type for visual consistency.
   - **Screenshots** to embed (from `docs/ui-screenshots/`): `app-cohorts-workspace.jpg`,
     `cohorts-patient-timeline.jpg`, `quality-finding-drill-in.jpg`, `app-quality.jpg`,
     `app-evaluation.jpg`, `app-schema-erd.jpg`.
3. **Copy everything below the line** into the message and send.

---

# PROMPT — copy from here down

Create a **downloadable PowerPoint (.pptx)** pitch deck for a hackathon project called
**CohortFit**. Make exactly **8 slides** — lean and pitch-ready, not padded. This is a
3-minute demo pitch, so each slide has one clear message and minimal text (headline +
3–5 tight bullets or one visual). Use the attached screenshots on the relevant slides.

## Visual direction (match the product — a warm, honest, data-product look; avoid generic "AI-slop")
- **Light mode only.** Palette: page ground warm greige `#E4E0D5`; card/surface `#FBFAF6`;
  primary accent prussian navy `#1E3A54`; secondary accent terracotta `#AF4E32`; near-black
  ink `#141309` for headings; muted `#524F46`. Status: green `#2F6B4C`, amber `#946009`,
  red `#9C2620`.
- Fonts: a clean grotesk sans for headings/body (e.g. Hanken Grotesk / Inter), a monospace
  (e.g. IBM Plex Mono) for numbers, IDs, and code. Large bold near-black headings; tabular
  figures for stats. Generous whitespace, thin rules, subtle card elevation. No stock photos,
  no emoji, no gradient-purple hero.
- Put the mandatory safety line as a small footer on the title slide (and optionally every
  slide), **verbatim**: “Research and educational prototype only. Not for clinical use. Do
  not use for diagnosis, treatment, triage, or emergency decisions.”

## Project context (use these facts; they are accurate)
- **Challenge:** Sofstica AI Hackathon 2026, “AI for Smarter Patient Care”, **Track 2 —
  Cohort & Data Quality Explorer**. Users = clinical-data **researchers/educators**, NOT
  clinicians making care decisions.
- **Dataset:** MIMIC-IV Clinical Database Demo v2.2 — 100 patients, 275 admissions, 140 ICU
  stays, ~26 relational tables. Date-shifted & de-identified (calendar/seasonality must not
  be inferred).
- **One-liner:** CohortFit turns a plain-English cohort description into a transparent,
  reproducible query, then judges whether that cohort’s data are fit to trust — separating a
  real clinical finding from a data error. Pitch = **honesty as a feature**.
- **How it works (AI is necessary, not decorative):** plain words → a **validated JSON query
  (IR)** via OpenAI GPT-5.6 **strict Structured Outputs with column enums** → a **deterministic
  DuckDB compiler**. **The model never writes executable SQL.** Every patient-level claim
  traces back to a source row; the system **abstains** when the data can’t support an answer.
- **Product (one cohort, one workspace):** build/edit a cohort in plain English, then four
  lenses on the same cohort — **Patients** (matched patients + per-patient event timelines),
  **Query** (visible inclusion/exclusion funnel + IR/SQL + one-click reproducible-recipe
  export), **Data fitness** (the scorecard), **Measurements** (coverage/units/coding). A
  separate page assesses the whole dataset.
- **Data quality (the 25%-weighted core):** a **red/amber/green scorecard across five
  dimensions** — plausibility, units, temporal, completeness, duplicates. Every flag is
  **drillable to the real offending rows** and **classified** as a *data error* vs a *verified
  clinical finding* vs a *documented caveat* (gated on `d_items.param_type` so a text item’s
  null value isn’t miscounted). Fixes are **reversible and rule-backed**; **source data is
  never edited**; issues are also grouped **by table**.
- **Real, demo-verifiable bugs it catches (every one points to a real row):** Arterial BP mean
  (itemid 220052) values −23…**801 mmHg**; Temperature labelled °C (223762) up to **99°C**
  (Fahrenheit mislabeled); **MCHC (51249) recorded in two units** (g/dL and %); **2,168 lab
  results charted outside their admission window**; **9,469 lab rows with the result hidden in
  free-text comments** instead of the value field.
- **Evaluation (honest, reproducible):** cohort-definition correctness — the gold query “ICU
  patients over 65 who died in hospital” returns exactly **9 patients** (funnel 100→44→44→9),
  an exact set match. Data-quality detection via a **seeded error-injection harness** on a
  read-only copy: on the **temporal check**, **precision 1.00, recall 1.00, FPR 0.00 across 5
  seeds**. **Be explicit and honest:** those perfect scores cover **one dimension (temporal) —
  the easy, cleanly-separable case — not all five**; the other four are evidenced by real
  clickable findings, not injection. Against a naive “flag every row” baseline (precision ≈
  0.07 at recall 1.0), CohortFit holds precision 1.00 at the same recall — ~**14× the
  precision**. Reproducibility: the cohort’s IR + SQL + subject_ids export to a re-runnable file.
- **Safety & responsible AI:** research-only banner on every screen; source provenance + data
  gaps shown; AI-generated text kept visually distinct from source data; **abstention tested**
  (out-of-scope → declines with a reason); reversible transforms only; licence-aware **data
  minimization** (schema + aggregates to the LLM by default, never raw patient rows).
- **One honest failure/abstention case (show this):** “which patients were admitted in winter”
  → **abstains** (dates are shifted, so seasonality is unknowable). Also: contradictory “under
  12 AND over 65” → **asks to clarify**; “which patient is most likely to die next” →
  **refuses** (prediction is out of scope).
- **Working product:** full stack runs with **one `docker compose up`** (FastAPI + DuckDB
  backend, Next.js 14 frontend); 32 automated backend tests pass. Repo:
  **https://github.com/danisaysskol/CohortFit**.
- **Limitations:** 100 patients is a small, non-representative educational sample — results are
  **illustrative, not clinical evidence**; no fairness/outcome claims.
- **With more time:** harder-dimension evaluation (near-duplicate/unit checks), leakage /
  index-time guards for predictive cohorts, and validation on a larger dataset.

## The 8 slides (use this order and content)
1. **Title** — “CohortFit” + the one-liner; “Sofstica AI Hackathon 2026 · Track 2 — Cohort &
   Data Quality Explorer”; the GitHub URL; the safety line as a footer.
2. **The problem** — hospital data are rich but hard to trust; before analysis a researcher
   must both **define a cohort** and **judge whether its data are fit**, telling a real finding
   from a data error. (Maps to “Problem & Impact”.)
3. **What it does** — the one-cohort workspace loop: plain English → showable query (who’s in/
   out) → matched patients + timelines → data-fitness verdict → measurements. Embed
   `app-cohorts-workspace.jpg`.
4. **How it works — AI where it’s necessary** — NL → validated JSON IR (strict structured
   outputs, column enums) → deterministic DuckDB SQL; the model never writes SQL; every claim
   traces to a source row; abstains when unsupported. A simple left-to-right pipeline diagram +
   embed `cohorts-patient-timeline.jpg` or a funnel visual. (Maps to the 25% “AI & Data
   Quality”.)
5. **Data quality you can trust** — the red/amber/green 5-dimension scorecard; every flag
   drilled to the **real offending rows**; finding-vs-error classification; reversible,
   rule-backed fixes; source never edited. Call out the real bugs (BP 801 mmHg; MCHC in two
   units; 2,168 mistimed labs). Embed `quality-finding-drill-in.jpg`.
6. **Evaluation & evidence** — cohort correctness (exact gold set = 9); injected-error P/R
   **1.00**, FPR **0** on the temporal check **with the honest one-check caveat**; ~**14×**
   precision vs a dumb baseline; reproducible recipe export. Embed `app-evaluation.jpg`. Use a
   small stat row for the numbers.
7. **Safety, honesty & an honest failure** — research-only boundary; provenance + uncertainty;
   AI content marked; data minimization; and the abstention example (“winter” → abstains;
   contradiction → clarify; prediction → refuse). (Maps to “Safety & Reliability”.)
8. **Limitations, next steps & close** — 100 patients = illustrative only; next = harder-
   dimension eval, leakage/index-time guards, larger dataset; “runs with one command”; repo
   link; a confident one-line close on the honesty differentiator.

## Output
Produce the deck as a **downloadable .pptx** with the 8 slides above, the palette and type
described, the attached screenshots embedded on slides 3–6, real numbers rendered in a mono
font, and the safety line present. Keep text minimal and legible from the back of a room.
