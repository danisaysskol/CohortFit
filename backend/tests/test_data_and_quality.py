"""Data spine + quality-engine correctness, against measured demo values."""
from __future__ import annotations

import pytest

from app.data import schema as schema_mod
from app.data import timeline as timeline_mod
from app.quality import rules as quality


def test_tables_loaded(db):
    tables = db.tables()
    # hosp + icu tables from the demo
    assert "patients" in tables and "chartevents" in tables and "icustays" in tables
    assert len(tables) >= 30


def test_row_counts_match_measured(db):
    n = {t["table"]: t["rows"] for t in schema_mod.describe(db)}
    assert n["patients"] == 100
    assert n["admissions"] == 275
    assert n["icustays"] == 140


def test_plausibility_flags_arterial_bp_mean(db):
    findings = quality.check_plausibility(db)
    refs = {f.ref for f in findings}
    # ABP mean (220052) has impossible values (-23..801) in the demo
    assert "itemid 220052" in refs
    assert all(f.kind == "data_error" for f in findings)


def test_temporal_offwindow_labs(db):
    findings = quality.check_temporal(db)
    off = [f for f in findings if f.table == "labevents"]
    assert off and off[0].count == 2168


def test_units_flags_mixed_uom(db):
    findings = quality.check_units(db)
    assert any("51249" in f.ref for f in findings)  # MCHC g/dL vs %


def test_scorecard_shape(db):
    sc = quality.scorecard(db)
    dims = {d["dimension"]: d["severity"] for d in sc["dimensions"]}
    assert dims["plausibility"] == "red"
    # Every scored dimension carries one of the three fitness grades. Duplicates is
    # "amber": near-duplicate chartevents groups exist (same patient/stay/itemid/charttime),
    # while the diagnoses_icd primary key is clean.
    assert set(dims) >= {"plausibility", "units", "temporal", "completeness", "duplicates"}
    assert all(v in {"red", "amber", "green"} for v in dims.values())


def test_patient_timeline(db):
    tl = timeline_mod.patient_timeline(db, 10006580)
    assert tl["subject_id"] == 10006580
    assert tl["gender"] in {"M", "F"}
    assert tl["labs"] > 0 and tl["events"]
    # events are time-ordered and each links back to a real source table + id
    times = [e["time"] for e in tl["events"]]
    assert times == sorted(times)
    for e in tl["events"]:
        assert e["source"]["table"] and e["source"]["id"]
    # a diabetes patient carries diabetes context (provenance for a cohort match)
    assert any("diabetes" in d.lower() for d in tl["diagnoses"])


def test_patient_timeline_unknown_subject(db):
    with pytest.raises(KeyError):
        timeline_mod.patient_timeline(db, 999999999)


def test_finding_drill_in(db):
    findings = quality.all_findings(db)
    # the implausible arterial-BP-mean finding must exist and drill to its real rows
    bp = next(f for f in findings if f.id == "plausibility:220052")
    res = quality.find_offending_rows(db, findings, bp.id, limit=50)
    assert res is not None
    assert res["total"] == bp.count and res["shown"] == min(bp.count, 50)
    assert res["shown"] == len(res["rows"]) and res["columns"]
    # every returned row is genuinely out of the plausible range
    for r in res["rows"]:
        assert r["valuenum"] < 0 or r["valuenum"] > 300


def test_finding_drill_in_none_for_clean_or_unknown(db):
    findings = quality.all_findings(db)
    # a green/zero-count finding has nothing to show
    clean = next(f for f in findings if f.id == "duplicates:dx")
    assert clean.count == 0
    assert quality.find_offending_rows(db, findings, clean.id) is None
    # an unknown id resolves to nothing
    assert quality.find_offending_rows(db, findings, "does-not-exist") is None
