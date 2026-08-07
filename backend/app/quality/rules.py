"""Data-quality checks + scorecard rollup.

Each check returns Findings that point at a table/ref and classify themselves as
`data_error`, `real_finding`, or `caveat` — the real-finding-vs-data-error
discipline the brief demands. Nothing here mutates source data.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any

from ..data.loader import Database
from .ranges import VITAL_RANGES

SEV_ORDER = {"green": 0, "amber": 1, "red": 2}
DIMENSIONS = ["plausibility", "units", "temporal", "completeness", "duplicates"]


@dataclass
class Finding:
    dimension: str
    severity: str  # green | amber | red
    table: str
    detail: str
    count: int
    kind: str  # data_error | real_finding | caveat
    ref: str = ""

    def dict(self) -> dict[str, Any]:
        return asdict(self)


def check_plausibility(db: Database) -> list[Finding]:
    # Single pass over chartevents, joined to a small in-query bounds table.
    # (Per-itemid loops were 11x full scans of 669k rows — far too slow for a live demo.)
    values = ", ".join(f"({iid}, {lo}, {hi})" for iid, (lo, hi, _, _) in VITAL_RANGES.items())
    rows = db.query(
        f"WITH bounds(itemid, lo, hi) AS (VALUES {values}) "
        "SELECT c.itemid AS itemid, "
        "count(*) FILTER (WHERE c.valuenum IS NOT NULL) AS n, "
        "count(*) FILTER (WHERE c.valuenum < b.lo OR c.valuenum > b.hi) AS bad, "
        "min(c.valuenum) AS mn, max(c.valuenum) AS mx "
        "FROM chartevents c JOIN bounds b ON c.itemid = b.itemid "
        "GROUP BY c.itemid"
    )
    out: list[Finding] = []
    for r in rows:
        n, bad = int(r["n"] or 0), int(r["bad"] or 0)
        if n == 0 or bad == 0:
            continue
        lo, hi, label, uom = VITAL_RANGES[int(r["itemid"])]
        out.append(Finding(
            "plausibility", "red", "chartevents",
            f"{label} ({int(r['itemid'])}): {bad} of {n} numeric values outside [{lo},{hi}] {uom} "
            f"(observed {r['mn']}..{r['mx']})",
            bad, "data_error", f"itemid {int(r['itemid'])}",
        ))
    return out


def check_temporal(db: Database) -> list[Finding]:
    out: list[Finding] = []
    bad = int(db.query("SELECT count(*) AS n FROM admissions WHERE admittime >= dischtime")[0]["n"])
    if bad:
        out.append(Finding("temporal", "amber", "admissions",
                           f"{bad} admissions with admittime >= dischtime", bad, "data_error"))
    off = int(db.query(
        "SELECT count(*) AS n FROM labevents l JOIN admissions a USING (hadm_id) "
        "WHERE l.hadm_id IS NOT NULL AND l.charttime IS NOT NULL "
        "AND (l.charttime < a.admittime OR l.charttime > a.dischtime)"
    )[0]["n"])
    if off:
        out.append(Finding("temporal", "amber", "labevents",
                           f"{off} lab results charted outside their admission window",
                           off, "data_error", "charttime vs admittime/dischtime"))
    return out


def check_units(db: Database) -> list[Finding]:
    rows = db.query(
        "SELECT itemid, count(DISTINCT valueuom) AS u, "
        "string_agg(DISTINCT valueuom, ', ') AS uoms, count(*) AS n "
        "FROM labevents WHERE valueuom IS NOT NULL "
        "GROUP BY itemid HAVING count(DISTINCT valueuom) > 1 "
        "ORDER BY n DESC LIMIT 10"
    )
    return [
        Finding("units", "amber", "labevents",
                f"itemid {r['itemid']} recorded in {r['u']} units ({r['uoms']}) across {r['n']} rows",
                int(r["n"]), "data_error", f"itemid {r['itemid']}")
        for r in rows
    ]


def check_completeness(db: Database) -> list[Finding]:
    r = db.query("SELECT count(*) AS n, count(*) FILTER (WHERE hadm_id IS NULL) AS miss FROM labevents")[0]
    n, miss = int(r["n"]), int(r["miss"])
    pct = round(100 * miss / n, 1) if n else 0.0
    sev = "amber" if pct > 10 else "green"
    return [Finding("completeness", sev, "labevents",
                    f"labevents.hadm_id missing on {miss}/{n} rows ({pct}%) — outpatient labs; "
                    f"a caveat, not a defect", miss, "caveat", "hadm_id")]


def check_duplicates(db: Database) -> list[Finding]:
    dups = int(db.query(
        "SELECT count(*) AS d FROM (SELECT subject_id, hadm_id, seq_num "
        "FROM diagnoses_icd GROUP BY 1,2,3 HAVING count(*) > 1)"
    )[0]["d"])
    sev = "green" if dups == 0 else "red"
    kind = "real_finding" if dups == 0 else "data_error"
    return [Finding("duplicates", sev, "diagnoses_icd",
                    f"{dups} duplicate (subject_id, hadm_id, seq_num) keys", dups, kind)]


def all_findings(db: Database) -> list[Finding]:
    return (check_plausibility(db) + check_units(db) + check_temporal(db)
            + check_completeness(db) + check_duplicates(db))


def scorecard(db: Database) -> dict[str, Any]:
    findings = all_findings(db)
    dim_sev = {d: "green" for d in DIMENSIONS}
    for f in findings:
        if SEV_ORDER[f.severity] > SEV_ORDER[dim_sev[f.dimension]]:
            dim_sev[f.dimension] = f.severity
    return {
        "dimensions": [{"dimension": d, "severity": dim_sev[d]} for d in DIMENSIONS],
        "findings": [f.dict() for f in findings],
    }
