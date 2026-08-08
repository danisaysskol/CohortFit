"""Cohort compiler correctness + evaluation harness."""
from __future__ import annotations

from app.cohort import nl
from app.cohort.compiler import compile_ir
from app.cohort.nl import _keyword_ir
from app.eval.inject import run_eval, run_temporal_eval

GOLD_COHORT = {
    "10003400", "10005817", "10007818", "10010471", "10015931",
    "10017492", "10025463", "10026255", "10037861",
}


def test_keyword_ir_parses_demo_phrase():
    ir, method = nl.to_ir("ICU patients over 65 who died in hospital")
    kinds = [c.kind for c in ir.include]
    assert kinds == ["demographic", "has_icu_stay", "mortality"]
    assert ir.answerable and method.startswith("keyword")


def test_compiled_cohort_matches_gold(db):
    ir, _ = nl.to_ir("ICU patients over 65 who died in hospital")
    result = compile_ir(db, ir)
    assert result["n"] == 9
    assert set(result["subject_ids"]) == GOLD_COHORT
    # provenance funnel: 100 -> 44 -> 44 -> 9
    remaining = [step["remaining"] for step in result["funnel"]]
    assert remaining == [100, 44, 44, 9]


def test_abstains_on_unsupported():
    ir, _ = nl.to_ir("patients with a positive COVID PCR last winter")
    assert ir.answerable is False and ir.abstain_reason


# --- Honesty behaviors (keyword path; deterministic) ---

def test_number_not_grabbed_as_age():
    # Regression: "potassium over 5.5" must NOT become age >= 5 (which returned all 100).
    ir = _keyword_ir("patients with potassium over 5.5")
    kinds = [c.kind for c in ir.include]
    assert "lab_threshold" in kinds
    assert not any(c.kind == "demographic" and c.field == "anchor_age" for c in ir.include)


def test_refuses_prediction():
    ir = _keyword_ir("which patient is most likely to die next")
    assert ir.disposition == "refuse" and not ir.answerable


def test_abstains_on_seasonality():
    ir = _keyword_ir("which patients were admitted in winter")
    assert ir.disposition == "abstain" and not ir.answerable


def test_clarifies_negation():
    ir = _keyword_ir("ICU patients who did not receive antibiotics")
    assert ir.disposition == "clarify" and not ir.answerable


def test_parses_gender_and_age():
    ir = _keyword_ir("female patients older than 70")
    fields = {(c.field, c.op, c.value) for c in ir.include if c.kind == "demographic"}
    assert ("gender", "=", "F") in fields
    assert ("anchor_age", ">=", "70") in fields


def test_temporal_eval_recovers_injected_errors(db):
    r = run_temporal_eval(db, n_inject=20, seed=42)
    assert r["injected"] == 20
    assert r["recall"] == 1.0 and r["precision"] == 1.0
    assert r["false_positive_rate"] == 0.0


def test_eval_multiseed_and_baseline(db):
    ev = run_eval(db, n_inject=20, seeds=(42, 7, 13))
    assert len(ev["runs"]) == 3
    # our gated rule: perfect precision across folds
    assert ev["aggregate"]["precision"]["mean"] == 1.0
    # dumb baseline flags everything -> precision far below ours
    assert ev["baseline"]["precision"] < 0.2
    assert ev["baseline"]["recall"] == 1.0
