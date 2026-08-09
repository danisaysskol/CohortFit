# CohortFit — Tentative Agile Plan

> **Tentative and modifiable.** This is our working plan, not a contract — we change it as we learn. It is written to be scanned quickly and understood by anyone on the team (7 Cs: clear, concise, concrete, correct, coherent, complete, courteous).
>
> **Track:** Track 2 — Cohort & Data Quality Explorer. **See also:** `docs/TRACK2_REQUIREMENTS.md` (what's asked) and `docs/RESEARCH_AND_EXPLORATION.md` (the evidence behind every number here).

---

## 1. The product in one sentence

**CohortFit turns a plain-English cohort description into a transparent, showable query — who's in, who's out, and why — then scores whether the data are actually fit to trust, telling real clinical findings apart from data errors, and only ever suggesting fixes that are reversible and explained.**

**The hook we sell:** *honesty as the feature.* CohortFit's most valuable job is telling a researcher **when their analysis isn't possible** — before they waste weeks on bad data.

---

## 2. Who it's for (and who it's NOT for)

- **For:** clinical-data **researchers, educators, data teams** who must define a study group and judge data quality before analysis.
- **NOT for:** clinicians making care decisions. No diagnosis, treatment, triage, or emergency use. (This boundary is a scored requirement — see §5.)

---

## 3. Use cases (concrete and verifiable)

Each maps to real numbers in the demo (from `RESEARCH_AND_EXPLORATION.md`), so we can demo them live and measure them.

**UC1 — Build a cohort from plain English, see inclusion *and* exclusion.**
> "ICU patients over 65 who died in hospital."
CohortFit shows: the parsed **inclusion/exclusion logic**, the **generated SQL**, the **count in** (and **why others were excluded**). Verifiable: age ≥ 65 → 44 patients; in-hospital deaths → 15; the intersection is a one-join, sub-second query.

**UC2 — Cohort with a lab/med threshold.**
> "patients who received furosemide" / "patients with potassium > 5.5".
Shows the *administered-vs-ordered* distinction (`emar.event_txt`) and lab thresholds with built-in reference ranges. Teaches a real subtlety: ordered ≠ given.

**UC3 — Data-fitness scorecard for a chosen cohort/table.**
Red / Amber / Green across dimensions: **completeness, plausibility, unit consistency, temporal integrity, duplication**. Each score links to the exact rows behind it.

**UC4 — Flag review: real finding vs. data error.**
A potassium of 7.8 (real, flagged abnormal, has a reference range) is shown as a **plausible-but-extreme clinical value**, *not* an error. An Arterial BP mean of **−23 or 801 mmHg** is shown as a **data error**. The tool explains *why* for each.

**UC5 — Reversible, explained fix (never silent).**
For a Temperature of 99 recorded as °C (really °F), CohortFit **suggests** a unit conversion, shows the rule it's based on, and records it in a **fix ledger** the user can undo. Source data is never mutated.

**UC6 — Graceful abstention (the honesty demo).**
> "patients with a positive COVID PCR" (not in this dataset) or "average value across patients by calendar month" (dates are shifted — not inferable).
CohortFit **abstains**, states *why*, and points to the missing/again-not-supported data — instead of inventing an answer.

---

## 4. Does / Never (the safety + honesty contract)

**CohortFit DOES:**
- Turn plain English into a **visible** cohort query (inclusion + exclusion).
- Score data fitness **red/amber/green** with per-flag drill-down to source rows.
- **Distinguish a real clinical finding from a data-quality flag**, with a stated reason.
- Suggest **only reversible, rule-backed** fixes, logged in an undoable ledger.
- Show **provenance** (table, column, id, time) for every patient-level statement.
- **Abstain** — clearly — when the data don't support an answer.

**CohortFit NEVER:**
- Silently edits or deletes source data.
- Gives medical advice, diagnosis, treatment, triage, or emergency guidance.
- Claims clinical validity, effectiveness, or cross-institution generalization.
- Hides which content is AI-generated vs. from source data.
- Infers calendar dates / seasonality / cross-patient chronology (data are date-shifted).
- Dumps patient-level data to external services. Per the licence we **minimize** what's sent — the LLM path receives only a schema description + the user's text, never patient rows or aggregates, always disclosed — and never upload to a service whose terms disallow it.

**On every screen:** the mandatory banner —
> *Research and educational prototype only. Not for clinical use. Do not use for diagnosis, treatment, triage, or emergency decisions.*

---

## 5. How we ace each rubric line (mapped to weights)

| Category (weight) | How we win it |
|---|---|
| **AI & Data Quality (25%)** — heaviest | AI is **necessary** (parsing free-text cohort descriptions into correct schema logic is not something fixed rules can do); joins/temporal logic are **sound and shown**; **data lineage visible** (IR + SQL + source rows); **leakage controlled** (patient-grouped folds, index-time discipline); **honest evaluation** with baseline + precision/recall/FPR + uncertainty. |
| **Problem & Impact (20%)** | A precise, real pain (researchers waste weeks on unfit data); a realistic user; measurable proxy value (time-to-investigate, issues caught). Scope sized to 100 patients. |
| **Working Product (20%)** | End-to-end FastAPI + Next.js app; core workflows usable; reproducible setup; sensible handling of missing/malformed/out-of-scope inputs (UC6). |
| **Safety & Reliability (15%)** — "free marks" | Banner everywhere; provenance + uncertainty; AI content visually distinct; hallucination/out-of-scope **tested**; human-review boundary stated; licence-respecting (minimize + disclose data sent externally); no unsupported claims. |
| **Innovation (10%)** | The **real-finding-vs-error classifier** + **self-seeded error harness** for honest metrics + **abstention as a first-class feature**. |
| **Pitch & Clarity (10%)** | The 3-minute demo arc in §8; lead with the honest failure case. |

---

## 6. The evaluation harness (our "free shortcut" to real numbers)

Nobody hands us labeled errors — so we **make our own** and measure against them.

1. **Copy, then corrupt.** Take a *copy* of the demo data. Inject a known set of errors: impossible vitals, unit swaps (°F stored as °C), duplicated rows, out-of-window timestamps (flip an `admittime`/`dischtime` — the clean 275/275 baseline makes this a perfect target), null-outs. Every injected error is **logged with ground truth**.
2. **Run CohortFit's checker** over the corrupted copy.
3. **Score:** precision, recall, false-positive rate, **per table** and per dimension. Report **uncertainty** (fold-level variation), not a single number.
4. **Baseline to beat:** the "dumb version" — fixed hard rules / manual scan. We show we catch more, with fewer false positives, because we gate on `param_type` and reference ranges (real-vs-error discipline).

**Cohort-definition correctness (the other required metric).** For the cohort side we build a small set of **gold cohorts** — hand-written SQL for unambiguous queries with a known answer (e.g. "ICU patients over 65 who died in hospital" → **9** patients: subject_ids 10003400, 10005817, 10007818, 10010471, 10015931, 10017492, 10025463, 10026255, 10037861; "age ≥ 65" → 44) — and check the tool's compiled query returns exactly that set. We report exact-match rate + set precision/recall against the gold cohorts, and log ambiguous descriptions the tool correctly abstains on.

**Leakage-prevention paragraph (we will include this verbatim in the evaluation report):**
> All records for a given `subject_id` stay in the same fold; no patient appears in both the rule-tuning and evaluation sets. For any time-dependent check we fix an index time and use only information available at or before it. Injected (synthetic) errors live only in a separate corrupted *copy*, are clearly labeled as synthetic, and are never used to imply real-world clinical performance — matching the brief's rule that synthetic data stay separate from real records.

---

## 7. The "ace card" — verifiable, not hand-wavy

Our differentiator is **credibility**: every flag points at a **real, clickable row** in the 100-patient demo.
- Arterial BP mean (itemid 220052) **−23..801 mmHg** — impossible; shown as a data error.
- Temperature °C (223762) up to **99 °C** — °F mislabeled; suggests reversible conversion.
- SpO2 (220277) **29%**; Inspired Gas Temp (223872) **3715 °C**.
- **MCHC (51249) g/dL vs %** in one column — unit inconsistency.
- **2,168 labevents** charted outside their admission window — temporal misalignment.
- `hospital_expire_flag=1` vs `deathtime` — a cross-column consistency check.

We **cite** documented MIMIC issues (GitHub #941 etc.) and reuse **MIT-authored plausibility ranges** (`vitalsign.sql`) as the *provenance* of our rules — but we never claim to have "re-discovered" a bug we can't show in the demo. **This restraint is the point:** it's exactly the honesty judges reward, and it protects us from an easy takedown.

---

## 8. Demo strategy (3 minutes that land)

**Arc — lead with pain, end on honesty:**
1. **(0:00) The pain (15s):** "A researcher spends weeks defining a cohort, then discovers the data can't support the study." One sentence, one slide.
2. **(0:15) Build a cohort live (45s):** type UC1 in plain English → **show the exclusion logic first** (who got left out and why), then the count. Show the IR **and** the SQL.
3. **(1:00) Data-fitness scorecard (45s):** red/amber/green; click a **red** flag → jump to the actual offending row (−23 mmHg). Then click a **real** extreme lab → show it's flagged as a *finding, not an error*.
4. **(1:45) Reversible fix (20s):** suggest the °F→°C conversion, show the rule, undo it. "We never touch the source."
5. **(2:05) Graceful failure (35s):** ask UC6 (calendar-month question). It **abstains** and explains why. *This is the memorable moment.*
6. **(2:40) Honesty close (20s):** show the evaluation numbers (precision/recall/FPR vs. baseline) and the safety banner. "Its most valuable job is telling you when your analysis isn't possible."

**Attention hook (the line we repeat):** *"Most tools tell you what the data says. CohortFit also tells you when to not believe it."*

**Do:** demo the **failure path**, not just the happy path. **Don't:** overclaim, or show a flag we can't trace to a row.

---

## 9. Build order & milestones (with an MVP cut line)

Ordered so we always have something demoable. The **MVP cut line** marks the minimum that still tells the whole story.

- **M0 — Data spine:** load CSVs → DuckDB/Parquet; schema/DDL introspection; config + `.env`.
- **M1 — Error-injection + scoring harness:** inject/label errors on a copy; precision/recall/FPR reporting. *(Build metrics before the thing being measured — this is our evidence engine.)*
- **M2 — Rule library:** plausibility (reuse MIT ranges), missingness, unit, temporal, duplicate — all gated on `param_type`/dictionaries. Real-vs-error classifier.
- **M3 — Cohort IR layer:** OpenAI strict schema (enum columns + abstain fields) → validator → DuckDB compiler; show IR + SQL.
- ────────── **MVP CUT LINE** (everything above = a complete, honest, demoable Track-2 tool) ──────────
- **M4 — Scorecard UI (Next.js):** red/amber/green, clickable flag rows, IR/SQL viewer, reversible-fix ledger, safety banner. Deploy to Vercel.
- **M5 — Polish & evidence:** evaluation report, safety & data statement, README, demo video, slides, ≤1000-char pitch.

**If time is short**, M4 can be a minimal-but-clean UI over the M0–M3 backend; the story still holds because the substance (honest checks + transparent cohorts + abstention) lives below the cut line.

---

## 10. Risks & open questions

**Risks**
- **Two-language integration cost** (FastAPI + Next.js) — mitigate by freezing the API contract early and keeping the backend demoable on its own.
- **Model tier names/prices** (Terra/Luna/Sol) came from aggregators — **verify on OpenAI's official page** before locking `config`.
- **LLM non-determinism** — mitigated by storing the IR + compiled SQL; re-running the stored IR is exact.
- **Over-scoping the UI** — the MVP cut line protects us.

**Open questions (need user input — will refine this plan):**
- **Submission deadline / time budget?** → sets how far past the MVP cut line we go.
- **Team size (2–5) and who does frontend vs. backend?** → affects parallelization and `PROGRESS.md`.
- **Deploy to Vercel now, or stay local until closer to submission?**
- Confirm the **OpenAI API key + chosen model IDs** to pin in `config`/`.env`.

---

*Change log for this plan lives in `PROGRESS.md`. Update that file, not people's memories.*
