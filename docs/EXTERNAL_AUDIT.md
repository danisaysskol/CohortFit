# External Audit — CohortFit (Track 2)

> An independent, skeptical review against `docs/TRACK2_REQUIREMENTS.md` (the faithful
> extract of the two PDFs in `hackathon-instructions/`). Claims were **verified against the
> code and artifacts**, not the team's own README/PROGRESS. Auditor stance: assume nothing;
> reward only what is evidenced.

_Audit date: 2026-08-09 · commit at time of audit: `20106e5`._

## Verdict

**Strong, submission-ready entry with a clear, well-executed thesis — held back by a small
number of fixable over-claims.** The product genuinely does all three Track‑2 prototype
types, runs end-to-end with one command, classifies data-error vs clinical finding, keeps
source data untouched with reversible fixes, and abstains out of scope. The main risk is
**credibility**: the pitch's headline AI claim ("column enums so the model can't hallucinate
a column") is **not what the code implements**, and it has propagated into the submission
description and deck. For a project whose differentiator is *honesty*, that specific
inaccuracy is the highest-value thing to fix before submitting.

**Estimated rubric score: ~86–89 / 100** (justification per category below). The deductions
are concentrated in two fixable places (the enum over-claim; a single-dimension evaluation).

## Rubric scoring (auditor estimate)

| Category | Weight | Est. | Evidence & deductions |
|---|---|---|---|
| Problem & Impact | 20 | 17–18 | Precise problem, realistic research/education user, scope fits the demo. Verified in README + product. |
| **AI & Data Quality** | 25 | 19–21 | AI is necessary (NL→IR→compiler), joins & temporal logic sound, lineage visible, real baseline, honest uncertainty. **−:** the "column enums" guardrail is over-claimed (see F1); evaluation covers only one of five dimensions (see F2). |
| Working Product | 20 | 18–19 | Runs with `docker compose up`; 32 backend tests pass; graceful on empty/invalid/unsupported input (verified by blackbox probing); fast (materialised tables). |
| Safety & Reliability | 15 | 13–14 | Banner on every page, provenance to source rows, AI content marked, abstention tested, reversible/logged fixes, data minimization real. **−:** banner not strictly verbatim (F3); one doc slightly overstates what's sent to the LLM (F4). |
| Innovation | 10 | 8–9 | The cohort → fitness → measurements loop + "honesty as a feature" is a meaningful step over a naive baseline. |
| Pitch & Clarity | 10 | 8–9 | 8-slide deck + 3-min script, honest failure case shown. **−:** the enum over-claim sits in the pitch itself — a code-inspecting judge will catch it. |

## Required deliverables (§4) — all present

- [x] Working prototype — `docker compose up` (FastAPI+DuckDB / Next.js). Verified running.
- [x] Source + run instructions — public repo `github.com/danisaysskol/CohortFit`, README with setup.
- [x] Technical summary — README (target user, data flow, AI method, source tables, choices).
- [x] Evaluation report — `docs/EVALUATION_REPORT.md` (baseline, protocol, metrics, uncertainty, error examples, limitations).
- [x] Safety & data statement — `docs/SAFETY_STATEMENT.md` (intended/prohibited use, lineage, privacy, failure modes, human-review boundary).
- [x] Demo & pitch — deck (`CohortFit_pitch_deck.pptx`) + script (`docs/PITCH_SCRIPT.md`) with one honest failure case. *(Demo video is a human to-do — see `docs/SUBMISSION.md`.)*

## Evaluation protocol (§5) — mostly met, with nuance

- §5.1 exact dataset + tables identified — **met** (README/EVALUATION_REPORT name the tables).
- §5.2 patient-grouped folds (no patient in train & test) — **N/A but mislabelled.** The detector is a fixed rule with **no train/test split**, so folds don't apply; the team reports multi-seed variance instead (reasonable). However `eval/inject.py`'s docstring calls this "patient-grouped, multi-seed evaluation," which **overstates** it — it is seeded re-injection over the same full population, not held-out patient groups. *Recommend softening the comment.*
- §5.3 index time / leakage — **N/A** (no predictive model); acknowledged as future work. Honest.
- §5.4 baseline comparison — **met** (a "flag every row" dumb baseline; `inject.py`).
- §5.5 counts / missingness / uncertainty — **met** (population, injected count, mean±std; missingness on the quality page).
- §5.6 representative errors + absent/ambiguous/out-of-scope behaviour — **met** (real findings + abstain/clarify/refuse, tested).

## Track metrics (§6)

- Cohort-definition correctness — **met** (exact gold-set match, funnel 100→44→44→9).
- Precision / recall / FPR on seeded issues — **met but narrow**: only the temporal check has an injection harness (P/R 1.00, FPR 0). Disclosed honestly, but thin for a 25% category (F2).
- Reproducibility — **met** (IR + SQL + subject_ids export; deterministic compiler; stored recipe).
- Supporting: issue-coverage-by-table **met**; reversible-correction rate **met** (FixLedger, source untouched); time-to-investigate — proxied by "reviewer time saved" (stated, not measured — labelled as such).

## Safety & Responsible AI (§7)

Banner present globally; no patient-specific recommendations; provenance + gaps shown; AI
content visually distinct; hallucination/out-of-scope **tested** (abstains); human-review
boundary described; transformations reversible and logged; data minimization is **real**
(verified: `cohort/nl.py` sends only the user's text + a schema-describing system prompt —
no patient rows). Subgroup composition is acknowledged as a limitation (§7.7). Two minor
inaccuracies: F3, F4.

## Submission (§9)

Working MVP ✓ · public repo + README ✓ · ≤1000-char description ✓ (`docs/SUBMISSION.md`).
Open (human): demo video / links, portal theme, CV upload(s), originality declaration,
single final submission before the (still-to-confirm) deadline.

---

## Findings (severity-ranked, with fixes)

### F1 — HIGH · "column enums" guardrail is over-claimed (accuracy)
**Claim** (deck slide 4, `docs/PITCH_SCRIPT.md`, `docs/SUBMISSION.md`, `SLIDE_PROMPT.md`,
`RESEARCH_AND_EXPLORATION.md`, `CLAUDE.md`): "strict structured outputs **with column enums**,
so the model can't hallucinate a column."
**Reality** (`cohort/ir.py` + `cohort/nl.py`): `response_format=CohortIR`, whose `field` (column)
and `table` are `Optional[str]` — **free strings**. Only *kinds/ops/relations/disposition* are
`Literal`-constrained. A hallucinated column is caught downstream by the **deterministic
compiler** (unknown field → `CompileError` → `clarify`), not by an output enum.
**Why it matters:** the end-to-end guarantee (never runs hallucinated SQL) still holds, but the
*stated mechanism* is wrong, and it sits in the submission blurb and pitch of an honesty-branded
project. A judge who opens `ir.py` will see the mismatch.
**Fix:** reword everywhere to the true mechanism, e.g. *"the model fills a validated query
recipe (its structure and operators are enum-constrained); a deterministic compiler validates
every field against the schema and refuses to run anything it can't ground — so a hallucinated
column produces a clarification, never bad SQL."* Optionally add column/table enums to the IR to
*make the claim true* (small change: `Literal` of real names, or a per-request JSON-schema enum).

### F2 — MEDIUM · Evaluation covers one of five dimensions (depth)
Only the temporal check has an injection harness; its 1.00 scores are the easy, cleanly-separable
case. This is now disclosed honestly on the Evaluation page and in the deck, so it is not
*dishonest* — but it is thin for the heaviest rubric category and invites "is that all?".
**Fix (highest ROI on the 25% category):** add an injection harness for a **harder dimension**
(near-duplicate or unit-variation) that yields **non-perfect** precision/recall — proving the
harness isn't rigged for 1.00 and that detection generalises.

### F3 — LOW · Safety banner not strictly verbatim
`frontend/app/layout.tsx` renders "Research **&** educational prototype only." The mandated
text (§7) uses "**and**". **Fix:** change `&amp;` → `and` in the banner.

### F4 — LOW · Over-stated LLM payload in the safety statement
`docs/SAFETY_STATEMENT.md` says the LLM receives "schema + description + **aggregate summaries**."
The cohort-build path sends no aggregates (`nl.py`). **Fix:** drop "aggregate summaries" (or
scope it to the quality path if/when true).

### F5 — INFO · Human submission items still open
Demo video, portal theme, CV upload, originality declaration, and the confirmed deadline remain
(tracked in `docs/SUBMISSION.md`). Not a defect — flagged so nothing is missed at submission.

## Recommended order before submitting
1. **F1** (rewrite the enum claim; optionally make it true in the IR) — protects the honesty pitch.
2. **F2** (add one harder-dimension injection) — strengthens the 25% category.
3. **F3 / F4** (verbatim banner; trim the payload wording) — quick correctness fixes.
4. **F5** (human deliverables).
