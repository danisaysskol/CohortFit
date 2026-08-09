"""Measurement explorer (Track-2 point 3).

For a cohort (or the whole dataset), summarises the measurements it actually
contains: how well each vital is *covered* (share of ICU stays with a reading),
how values *vary* (range, mean, out-of-range count against reusable plausibility
bounds), which *units* a measurement was recorded in, and how diagnoses are
*coded* (ICD-9 vs ICD-10). Every number is a real query over the fixed store; the
explorer describes the data, it never edits it.
"""
from __future__ import annotations

from typing import Any

from ..data.loader import Database
from .ranges import VITAL_RANGES
from .rules import _scope

# A curated set of common bedside vitals (itemid, human label). Plausibility bounds,
# where we have them, come from the MIT reference ranges in `ranges.py`.
VITALS: list[tuple[int, str]] = [
    (220045, "Heart rate"),
    (220179, "Systolic BP (NBP)"),
    (220180, "Diastolic BP (NBP)"),
    (220052, "Arterial BP mean"),
    (220210, "Respiratory rate"),
    (220277, "SpO2"),
    (223761, "Temperature (F)"),
    (223762, "Temperature (C)"),
]


def _counts(db: Database, subject_ids: list[int] | None) -> dict[str, int]:
    n_stays = int(db.query(f"SELECT count(*) AS n FROM icustays WHERE 1=1{_scope(subject_ids)}")[0]["n"])
    n_adm = int(db.query(f"SELECT count(*) AS n FROM admissions WHERE 1=1{_scope(subject_ids)}")[0]["n"])
    n_pat = len(subject_ids) if subject_ids else int(db.query("SELECT count(*) AS n FROM patients")[0]["n"])
    return {"n_patients": n_pat, "n_stays": n_stays, "n_admissions": n_adm}


def _vitals(db: Database, subject_ids: list[int] | None, n_stays: int) -> list[dict[str, Any]]:
    ids = ", ".join(str(i) for i, _ in VITALS)
    bounds = ", ".join(
        f"({iid}, {VITAL_RANGES[iid][0]}, {VITAL_RANGES[iid][1]})"
        for iid, _ in VITALS if iid in VITAL_RANGES
    ) or "(NULL, NULL, NULL)"
    rows = db.query(
        f"WITH bounds(itemid, lo, hi) AS (VALUES {bounds}) "
        "SELECT c.itemid AS itemid, count(DISTINCT c.stay_id) AS stays_with, "
        "count(*) FILTER (WHERE c.valuenum IS NOT NULL) AS n, "
        "min(c.valuenum) AS mn, max(c.valuenum) AS mx, avg(c.valuenum) AS mean, "
        "string_agg(DISTINCT c.valueuom, ', ') AS units, "
        "count(DISTINCT c.valueuom) FILTER (WHERE c.valueuom IS NOT NULL) AS n_units, "
        "count(*) FILTER (WHERE c.valuenum < b.lo OR c.valuenum > b.hi) AS oor "
        f"FROM chartevents c LEFT JOIN bounds b ON c.itemid = b.itemid "
        f"WHERE c.itemid IN ({ids}){_scope(subject_ids, 'c.subject_id')} "
        "GROUP BY c.itemid"
    )
    by_id = {int(r["itemid"]): r for r in rows}
    out: list[dict[str, Any]] = []
    for iid, label in VITALS:
        r = by_id.get(iid)
        n = int(r["n"] or 0) if r else 0
        stays_with = int(r["stays_with"] or 0) if r else 0
        bound = VITAL_RANGES.get(iid)
        out.append({
            "itemid": iid,
            "label": label,
            "coverage_pct": round(100 * stays_with / n_stays, 1) if n_stays else 0.0,
            "stays_with": stays_with,
            "stays_total": n_stays,
            "n": n,
            "units": [u for u in ((r["units"] or "").split(", ") if r else []) if u],
            "unit_variation": int(r["n_units"] or 0) > 1 if r else False,
            "min": round(float(r["mn"]), 2) if r and r["mn"] is not None else None,
            "max": round(float(r["mx"]), 2) if r and r["mx"] is not None else None,
            "mean": round(float(r["mean"]), 2) if r and r["mean"] is not None else None,
            "plausible": [bound[0], bound[1]] if bound else None,
            "out_of_range": int(r["oor"] or 0) if (r and bound) else None,
        })
    return out


def _labs(db: Database, subject_ids: list[int] | None) -> list[dict[str, Any]]:
    rows = db.query(
        "SELECT l.itemid AS itemid, d.label AS label, count(*) AS n, "
        "string_agg(DISTINCT l.valueuom, ', ') AS units, "
        "count(DISTINCT l.valueuom) FILTER (WHERE l.valueuom IS NOT NULL) AS n_units, "
        "min(l.valuenum) AS mn, max(l.valuenum) AS mx, avg(l.valuenum) AS mean "
        "FROM labevents l LEFT JOIN d_labitems d ON l.itemid = d.itemid "
        f"WHERE l.valuenum IS NOT NULL{_scope(subject_ids, 'l.subject_id')} "
        "GROUP BY l.itemid, d.label ORDER BY n DESC LIMIT 12"
    )
    return [{
        "itemid": int(r["itemid"]),
        "label": r["label"] or f"itemid {r['itemid']}",
        "n": int(r["n"]),
        "units": [u for u in (r["units"] or "").split(", ") if u],
        "unit_variation": int(r["n_units"] or 0) > 1,
        "min": round(float(r["mn"]), 2) if r["mn"] is not None else None,
        "max": round(float(r["mx"]), 2) if r["mx"] is not None else None,
        "mean": round(float(r["mean"]), 2) if r["mean"] is not None else None,
    } for r in rows]


def _coding(db: Database, subject_ids: list[int] | None) -> dict[str, Any]:
    r = db.query(
        "SELECT count(*) FILTER (WHERE icd_version = 9) AS icd9, "
        "count(*) FILTER (WHERE icd_version = 10) AS icd10, count(*) AS total "
        f"FROM diagnoses_icd WHERE 1=1{_scope(subject_ids)}"
    )[0]
    top = db.query(
        "SELECT di.icd_code AS code, di.icd_version AS version, x.long_title AS title, count(*) AS n "
        "FROM diagnoses_icd di LEFT JOIN d_icd_diagnoses x "
        "ON di.icd_code = x.icd_code AND di.icd_version = x.icd_version "
        f"WHERE 1=1{_scope(subject_ids, 'di.subject_id')} "
        "GROUP BY di.icd_code, di.icd_version, x.long_title ORDER BY n DESC LIMIT 10"
    )
    return {
        "icd9": int(r["icd9"] or 0),
        "icd10": int(r["icd10"] or 0),
        "total": int(r["total"] or 0),
        "top": [{
            "code": t["code"], "version": int(t["version"]),
            "title": t["title"] or f"code {t['code']}", "n": int(t["n"]),
        } for t in top],
    }


def _subgroups(db: Database, subject_ids: list[int] | None) -> dict[str, Any]:
    """Subgroup composition (gender, age band) for the cohort. Reported for transparency
    only — 100 date-shifted patients cannot support reliable fairness conclusions."""
    scope = _scope(subject_ids)
    gender = db.query(
        f"SELECT gender AS k, count(*) AS n FROM patients WHERE 1=1{scope} GROUP BY gender ORDER BY gender"
    )
    bands = db.query(
        "SELECT CASE WHEN anchor_age < 50 THEN '<50' WHEN anchor_age < 65 THEN '50–64' "
        "WHEN anchor_age < 80 THEN '65–79' ELSE '80+' END AS k, count(*) AS n "
        f"FROM patients WHERE 1=1{scope} GROUP BY 1 ORDER BY 1"
    )
    return {
        "gender": [{"key": r["k"], "n": int(r["n"])} for r in gender],
        "age_bands": [{"key": r["k"], "n": int(r["n"])} for r in bands],
        "caveat": "Composition only — 100 date-shifted patients cannot support reliable "
                  "fairness or subgroup-performance conclusions.",
    }


def cohort_measurements(db: Database, subject_ids: list[int] | None = None) -> dict[str, Any]:
    counts = _counts(db, subject_ids)
    return {
        **counts,
        "vitals": _vitals(db, subject_ids, counts["n_stays"]),
        "labs": _labs(db, subject_ids),
        "coding": _coding(db, subject_ids),
        "subgroups": _subgroups(db, subject_ids),
    }
