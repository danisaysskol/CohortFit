"""Cohort compiler correctness + evaluation harness."""
from __future__ import annotations

from app.cohort import nl
from app.cohort.compiler import compile_ir
from app.eval.inject import run_temporal_eval

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


def test_temporal_eval_recovers_injected_errors(db):
    r = run_temporal_eval(db, n_inject=20, seed=42)
    assert r["injected"] == 20
    assert r["recall"] == 1.0 and r["precision"] == 1.0
    assert r["false_positive_rate"] == 0.0
