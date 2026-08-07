# Track 2 Requirements — Faithful Extract of the Hackathon Instructions

> This file is the single source of truth for **what the hackathon asks**, extracted from the two official PDFs in `hackathon-instructions/` so we never need to reopen them:
> - `AI_for_Smarter_Patient_Care.pdf` — the challenge brief (SGTDP, August 2026).
> - `1786131372914_Sofstica-Submission-Criteria.pdf` — Sofstica submission requirements.
>
> Our selected track is **Track 2 — Cohort & Data Quality Explorer**.

---

## 1. Challenge at a glance

- **Challenge:** Build a transparent AI prototype that helps people explore, validate, or model structured hospital data.
- **Dataset:** MIMIC-IV Clinical Database Demo v2.2 — deidentified hospital and ICU records for **100 patients**.
- **Intended users:** Clinical-data **researchers, educators, and healthcare data teams** — **NOT** clinicians making patient-care decisions.
- **Scope:** A focused, testable proof of concept sized for a short-format hackathon.
- **Required outcome:** A working prototype, reproducible pipeline, evaluation results, and an explicit safety & limitations statement.

### Challenge statement (paraphrased faithfully)
Hospital data are rich but hard to use — a single admission spans many linked tables (labs, medications, diagnoses, procedures, transfers, time-stamped ICU observations). Before the data can support credible research, teams must reconstruct context, check data quality, prevent leakage, and communicate uncertainty. Build an AI-powered prototype that makes the supplied structured clinical data easier to **inspect, validate, or study**. The strongest projects solve **one well-defined problem**, use AI for a **necessary** part of the solution, preserve a **clear trail back to the source data**, and **evaluate performance honestly**.

This is a **research and education** challenge. The dataset is too small/narrow to establish clinical effectiveness, safety, generalizability, or outcome improvements. **Projects must not provide diagnosis, treatment, triage, or emergency guidance.**

---

## 2. Track 2 — Cohort & Data Quality Explorer (our track)

> Build a tool that helps researchers **define a cohort** and **identify whether the underlying data are fit** for a stated analysis.

Possible prototypes named in the brief:
1. **Natural-language-to-structured cohort queries** with **visible inclusion and exclusion logic**.
2. **Detection** of missing, duplicated, inconsistent, implausible, or **temporally misaligned** records.
3. An **explainable explorer** for measurement coverage, unit variation, coding patterns, and data provenance.

**The strict rules for Track 2 (non-negotiable):**
- The product **must distinguish a true clinical finding from a data-quality flag.**
- It **must not silently "correct" or delete** source records.
- **Any suggested correction must be reversible and supported by a documented rule.**

---

## 3. Supplied dataset & rules

The dataset is **MIMIC-IV Clinical Database Demo v2.2**, an openly available subset of MIMIC-IV.

The supplied data:
1. Cover **100 patients** from one tertiary academic medical center in Boston, USA.
2. Are retrospective, deidentified hospital and ICU data as relational CSV tables.
3. Include demographics, admissions, transfers, diagnoses, procedures, lab measurements, medication-related events, and ICU observations (subject to coverage/missingness).
4. Use **deidentified identifiers and date shifting** — **calendar dates, seasonality, and cross-patient chronology must not be inferred.**
5. **Exclude free-text clinical notes** (MIMIC-IV-Note is not part of this challenge).

These are a **small, non-representative educational sample** — insufficient for clinical validity, subgroup fairness, treatment effectiveness, or cross-institution performance.

**Challenge rules:**
1. Use the organizer-supplied frozen copy of MIMIC-IV Demo v2.2 as the primary patient-level dataset.
2. Public documentation, code systems, and non-patient reference data may be used **if source and version are cited**.
3. Pretrained models and **synthetic test cases are permitted if clearly identified**; synthetic data must stay **separate** from real records and may not imply real-world clinical performance.
4. Do **not** add external patient-level data unless organizers provide it to every team.
5. Follow the **PhysioNet licence** and attribution; **no reidentification**; do not upload patient-level rows to a service whose terms don't permit it.
6. **Clearly disclose** all models, external services, generated data, manual labels, and human-authored rules.

---

## 4. Required deliverables (from the brief)

1. **Working prototype** — end-to-end demonstration of the selected track using the supplied data.
2. **Source code & run instructions** — reproducible repo/package: dependencies, configuration, and **random seeds** where applicable.
3. **Technical summary** — concise README/brief covering target user, data flow, AI method, **source tables**, assumptions, and design choices.
4. **Evaluation report** — baseline, test protocol, track metrics, results, uncertainty, **error examples**, and **known limitations**.
5. **Safety & data statement** — intended use, prohibited use, **data lineage**, privacy handling, **failure modes**, and human-review boundary.
6. **Demo & pitch** — clear walkthrough of the problem, product, evaluation evidence, and **one honest failure case**.

---

## 5. Evaluation protocol (all teams)

1. Evaluate on the **exact** organizer-supplied dataset version; **identify the tables and fields used**.
2. **Keep all records for a `subject_id` in the same fold.** No patient may appear in both train and test.
3. For time-dependent tasks: define an **index time** and use only information available **at or before** it. **Report and remove label leakage.**
4. **Compare the AI method with a simple, relevant baseline** or rule-based approach.
5. Report **sample counts, exclusions, missingness, outcome prevalence (where relevant), and uncertainty** — not just a single headline score.
6. Include **representative errors** and show behavior when data are **absent, ambiguous, or out of scope**.

> Because there are only 100 patients, model results are **illustrative**. Use patient-grouped cross-validation or the organizer split, report fold-level variation / confidence intervals, and **avoid claims that small numerical differences establish superiority.**

---

## 6. Track-specific metrics (Track 2)

**Required metrics:**
- **Cohort-definition correctness.**
- **Precision, recall, and false-positive rate** on documented or **organizer-seeded quality issues**.
- **Reproducibility of results.**

**Useful supporting measures:**
- Issue coverage by table.
- Time to investigate.
- **Reversible correction rate.**

> Raw metrics are not comparable across tracks. Judges assess whether the **metric matches the stated problem** and whether the **evidence supports the team's claims**.

---

## 7. Safety & Responsible AI (mandatory)

**Every prototype must display this notice prominently (verbatim):**

> **Research and educational prototype only. Not for clinical use. Do not use for diagnosis, treatment, triage, or emergency decisions.**

Teams must also:
1. Avoid patient-specific recommendations, treatment rankings, or claims of improved outcomes.
2. Show **source provenance, data gaps, and uncertainty** for patient-level outputs.
3. Make **AI-generated content visually distinguishable** from source data.
4. **Test hallucination and out-of-scope behavior** — the system should **abstain** when the record doesn't support an answer.
5. Describe where **human review** is required; prevent automated clinical action.
6. **Preserve original data, log transformations, and make cleaning/imputation reversible.**
7. Report subgroup composition while acknowledging 100 patients cannot support reliable fairness conclusions.
8. Respect the licence, **minimize data sent to external services**, and never attempt reidentification.

---

## 8. Judging rubric & weights

| Category | Weight | What judges assess |
|---|---|---|
| **Problem & Impact** | **20%** | A precise, data-supported problem; a realistic research/education user; measurable proxy value; scope appropriate to the demo dataset. |
| **AI & Data Quality** | **25%** | AI is **necessary not decorative**; joins and temporal logic are sound; data lineage is visible; leakage is controlled; evaluation, baselines, and uncertainty are appropriate. |
| **Working Product** | **20%** | A functional end-to-end prototype with usable core workflows, reproducible setup, and sensible handling of missing/malformed/unsupported inputs. |
| **Safety & Reliability** | **15%** | Clear research-only boundaries, provenance, uncertainty, failure testing, human review, privacy & licence compliance, no unsupported clinical claims. |
| **Innovation** | **10%** | A meaningful, well-justified improvement over a simple baseline, with thoughtful use of AI suited to the problem. |
| **Pitch & Clarity** | **10%** | Clear communication of problem, data, method, live demo, evidence, tradeoffs, limitations, and next validation step. |
| **Total** | **100%** | |

> **AI & Data Quality (25%) is the single heaviest category** — our tool is squarely aimed at it. Problem & Impact and Working Product (20% each) are next. Safety (15%) is largely "free marks" if we follow §7.

---

## 9. Sofstica submission requirements

- **Submission portal + deadline:** Submit within the official window; the portal auto-closes at the deadline. **No late or incomplete submissions.** *(Exact date TBD — confirm and record in `PROGRESS.md`.)*
- **Project Theme:** Select the correct hackathon theme from the dropdown (used during evaluation).
- **Working Prototype (MVP):** Must include a **functional prototype** demonstrating the core solution. **UI mockups, wireframes, presentations, or incomplete implementations alone may be disqualified.**
- **Project Description (max 1,000 characters):** Concise pitch covering: (1) **what you built**, (2) **the problem it addresses**, (3) **how it works**, (4) **what you'd improve/add with more time**.
- **Public GitHub repository:** Complete source code + comprehensive **README** (what, problem, how it works, future improvements) **and setup/installation instructions, config, dependencies** so reviewers can build, run, and evaluate.
- **Project Links (one or more):** Live application/demo; **demo video** (YouTube/Loom); presentation slides or supporting docs.
- **Resume/CV upload:** Individual = 1 CV; Team = one CV per member (**min 2, max 5**), combined ≤ 5 MB.
- **One submission only:** One final submission per individual/team; **once submitted, it's final and cannot be modified.**
- **Eligibility & Originality Declaration:** Acknowledge before submitting.

---

## 10. Resources (cite these)

- MIMIC-IV Clinical Database Demo v2.2 — dataset/docs/licence/citation: https://physionet.org/content/mimic-iv-demo/2.2/
- Permanent dataset DOI: https://doi.org/10.13026/dp1f-ex47
- Official MIMIC-IV documentation: https://mimic.mit.edu/docs/IV/
- Official schema overview: https://mimic.mit.edu/docs/IV/about/schema-overview.html
- Official MIMIC code repository: https://github.com/MIT-LCP/mimic-code

> Cite the dataset version and any external resources used. The demo page contains the required citation text and current licence information.
