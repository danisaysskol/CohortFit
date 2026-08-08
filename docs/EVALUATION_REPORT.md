# Evaluation Report — CohortFit (Track 2)

> Required deliverable. Every number here is reproducible from the running system (`docker compose up`, then the `/eval/run`, `/cohort/build`, `/quality/scorecard` endpoints) or from the test suite (`docker compose run --rm backend pytest`, 14 tests). Dataset: MIMIC-IV Clinical Database Demo v2.2 (100 patients). Because there are only 100 patients, results are **illustrative**, not evidence of clinical performance.

## 1. Target user & tables used
Clinical-data researchers/educators defining cohorts and judging data fitness. Tables used: `patients`, `admissions`, `icustays`, `diagnoses_icd` + `d_icd_diagnoses`, `prescriptions`, `labevents`, `chartevents`, `d_items`.

## 2. Cohort-definition correctness
**Protocol.** Gold cohorts with a known answer (hand-verified SQL) vs. the tool's compiled query; exact-set match.

| Query | Gold answer | Tool result | Match |
|---|---|---|---|
| "ICU patients over 65 who died in hospital" | 9 patients (subject_ids 10003400, 10005817, 10007818, 10010471, 10015931, 10017492, 10025463, 10026255, 10037861) | 9, identical set | ✅ exact |
| "age ≥ 65" | 44 patients | 44 | ✅ |
| Provenance funnel for the first query | 100 → 44 → 44 → 9 | 100 → 44 → 44 → 9 | ✅ |

**Abstention.** For out-of-scope requests (e.g. "positive COVID PCR last winter" — not in the data; and calendar-time queries — dates are shifted) the tool sets `answerable=false` with a reason instead of fabricating a query. Verified by test.

## 3. Data-quality detection — injected-error harness
**Baseline to beat:** manual review / fixed hard rules. **Protocol:** inject N labeled errors into a *copy* (seeded, reproducible), run the detector, score against ground truth. Synthetic errors live only in a read-only working copy and are never used to imply clinical performance.

| Check | Injected | TP | FP | FN | Precision | Recall | FPR |
|---|---|---|---|---|---|---|---|
| Temporal (admittime ≥ dischtime), `admissions`, seed 42 | 20 | 20 | 0 | 0 | 1.00 | 1.00 | 0.00 |

**Honest caveat.** This temporal rule is a *strong but easy* case: the real demo has 0 pre-existing violations (275/275 valid), so a swapped-timestamp injection is cleanly separable. We report it as a working, reproducible harness — not a claim that all dimensions are this easy. Near-duplicate and unit-normalization detection are harder and would show lower precision/recall; extending the harness to those is future work.

## 3b. Beating the "dumb version" (baseline contrast)

| The dumb version | CohortFit |
|---|---|
| Fixed thresholds, breaks on anything unusual | Adapts — uses reference ranges + context, gated on `d_items.param_type` |
| Flags everything equally | **Ranks** flags worst-first (severity → kind → volume) |
| Can't tell a real finding from a data error | Separates a genuine extreme value from a typo (finding vs error) |
| Silent, no explanation | Every flag carries a plain-English reason + a source pointer (table/itemid) |
| Reviewer wades through everything | Reports **reviewer time saved** per validated issue |

Quantified on the temporal injected-error benchmark (5 seeds): the dumb "flag every row" rule reaches **precision ≈ 0.07** (recall 1.0 — it flags almost everything), while CohortFit holds **precision 1.00 ± 0.00** at recall 1.00. Same recall, ~14× the precision.

## 4. Real, demo-verifiable quality findings (no injection)
Every flag points to real rows in the 100 patients (via `/quality/scorecard`, 11 findings):

| Dimension | Finding | Table · ref | Class |
|---|---|---|---|
| Plausibility | ABP mean: 14 of 5,560 values outside [0,300] mmHg (observed −23..801) | chartevents · 220052 | data error |
| Plausibility | Temperature (C): 3 values outside [10,50] (observed up to 99) | chartevents · 223762 | data error |
| Units | MCHC in g/dL and % in one column (2,760 rows) | labevents · 51249 | data error |
| Temporal | 2,168 labs charted outside their admission window | labevents | data error |
| Completeness | hadm_id missing on 28,420/107,727 (26.4%) — outpatient labs | labevents · hadm_id | **caveat, not defect** |
| Duplicates | 0 duplicate (subject_id, hadm_id, seq_num) keys | diagnoses_icd | **real finding (clean)** |

**Real-finding-vs-error discipline.** Numeric rules are gated on `d_items.param_type` and reference ranges, so an extreme-but-real lab (e.g. potassium 7.8 mEq/L, flagged abnormal, within a documented range) is reported as a *finding*, not a typo — the exact distinction Track 2 requires.

## 5. Reversible correction
Proposed fixes are reversible and rule-backed (e.g. temperature °F-as-°C: forward `(v−32)/1.8`, reverse `v×1.8+32`), applied to a working copy and logged; ambiguous cases (MCHC units) are review-only. Source data is never modified. **Reversible-correction rate: 1/2 proposed fixes auto-applicable, 1/2 review-only** — by design.

## 6. Reproducibility & leakage control
- **Reproducible:** the cohort IR + compiled SQL + a data-hash are stored; re-running the stored IR reproduces the exact result. The eval harness is seeded. LLM calls use `temperature 0` (best-effort determinism; the real guarantee is the deterministic compiler).
- **Leakage:** all records for a `subject_id` stay in one fold; time-dependent checks use only data at/before an index time; injected synthetic errors are separated and labeled.

## 7. Limitations
100 patients from one Boston center, date-shifted, ICU-centric (all demo patients have an ICU stay). Not sufficient for clinical validity, fairness, or generalization. The keyword NL fallback (used when no OpenAI key is set) handles a limited vocabulary; the OpenAI structured-output path broadens coverage. Metrics are illustrative.
