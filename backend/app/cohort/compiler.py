"""Compile a validated CohortIR into DuckDB SQL and run it.

Produces: the SQL (shown to the user), the Provenance Ledger funnel (running `n`
remaining + delta per criterion), the resulting subject_ids, and a `query_hash`
(a digest of the compiled SQL + IR) so the same request reproduces the exact result.
Values are cast/escaped here — the LLM never writes SQL, and criteria can only
reference the fixed set of tables/columns below.
"""
from __future__ import annotations

import hashlib
import json
from collections.abc import Iterator
from typing import Any

from ..data.loader import Database
from .ir import Criterion, CohortIR

ALLOWED_DEMO_FIELDS = {"anchor_age", "anchor_year", "gender"}
NUMERIC_DEMO_FIELDS = {"anchor_age", "anchor_year"}
ALLOWED_OPS = {">=", "<=", "=", "<", ">"}
# Common antibiotic name fragments, so "not on antibiotics" resolves as a class.
ANTIBIOTICS = ["vancomycin", "cefepime", "ceftriaxone", "cefazolin", "meropenem",
               "piperacillin", "ciprofloxacin", "levofloxacin", "metronidazole",
               "azithromycin", "gentamicin", "ampicillin", "penicillin", "linezolid",
               "clindamycin", "doxycycline", "amoxicillin", "nafcillin", "aztreonam"]


class CompileError(ValueError):
    """Raised when a criterion cannot be compiled (unknown field/op/kind)."""


def _lit(value: str) -> str:
    return value.replace("'", "''")


def _num(value: Any) -> float:
    """Cast an IR value to a float, or raise CompileError.

    The OpenAI path can return a non-numeric or missing `value` (the IR field is a free
    Optional[str]); catching it here turns a would-be 500 into a graceful `clarify`.
    """
    try:
        return float(value)
    except (TypeError, ValueError):
        raise CompileError(f"expected a numeric value, got {value!r}")


def _predicate(c: Criterion) -> tuple[str, str]:
    """Return (SQL boolean over `patients p`, source label for the ledger)."""
    k = c.kind
    if k == "demographic":
        field = c.field or "anchor_age"
        op = c.op or ">="
        if field not in ALLOWED_DEMO_FIELDS:
            raise CompileError(f"unknown demographic field: {field}")
        if op not in ALLOWED_OPS:
            raise CompileError(f"unsupported op: {op}")
        if field in NUMERIC_DEMO_FIELDS:
            return f"p.{field} {op} {_num(c.value)}", f"patients.{field}"
        return f"lower(p.{field}) = lower('{_lit(str(c.value))}')", f"patients.{field}"
    if k == "has_icu_stay":
        return "p.subject_id IN (SELECT subject_id FROM icustays)", "icustays.stay_id"
    if k == "mortality":
        return (
            "p.subject_id IN (SELECT subject_id FROM admissions WHERE hospital_expire_flag = 1)",
            "admissions.hospital_expire_flag=1",
        )
    if k == "diagnosis":
        v = _lit(str(c.value or ""))
        return (
            "p.subject_id IN (SELECT d.subject_id FROM diagnoses_icd d "
            "JOIN d_icd_diagnoses x ON d.icd_code = x.icd_code AND d.icd_version = x.icd_version "
            f"WHERE lower(x.long_title) LIKE lower('%{v}%'))",
            "diagnoses_icd.long_title",
        )
    if k == "medication":
        raw = str(c.value or "").lower().strip()
        if raw in {"antibiotic", "antibiotics"}:
            ors = " OR ".join(f"lower(drug) LIKE '%{a}%'" for a in ANTIBIOTICS)
            return (f"p.subject_id IN (SELECT subject_id FROM prescriptions WHERE {ors})",
                    "prescriptions.drug (antibiotic class)")
        v = _lit(raw)
        return (
            f"p.subject_id IN (SELECT subject_id FROM prescriptions WHERE lower(drug) LIKE lower('%{v}%'))",
            "prescriptions.drug",
        )
    if k == "los_threshold":
        op = c.op or ">"
        if op not in ALLOWED_OPS:
            raise CompileError(f"unsupported op: {op}")
        return (f"p.subject_id IN (SELECT subject_id FROM icustays WHERE los {op} {_num(c.value)})",
                "icustays.los")
    if k == "readmission":
        try:
            days = int(float(c.value))
        except (TypeError, ValueError):
            raise CompileError("readmission requires value=<days>")
        return (
            "p.subject_id IN (SELECT a1.subject_id FROM admissions a1 JOIN admissions a2 "
            "ON a1.subject_id = a2.subject_id AND a2.admittime > a1.dischtime "
            f"AND date_diff('day', a1.dischtime, a2.admittime) <= {days})",
            "admissions self-join",
        )
    if k == "lab_temporal":
        rel = c.relation or "during_icu"
        item = ""
        if c.field:
            try:
                item = f" AND l.itemid = {int(c.field)}"
            except (TypeError, ValueError):
                raise CompileError("lab_temporal field must be an itemid or empty")
        window = ("l.charttime BETWEEN i.intime AND i.outtime" if rel == "during_icu"
                  else "l.charttime < i.intime")
        return (
            "p.subject_id IN (SELECT l.subject_id FROM labevents l JOIN icustays i "
            f"ON l.hadm_id = i.hadm_id WHERE {window}{item})",
            f"labevents ⋈ icustays ({rel})",
        )
    if k in ("lab_threshold", "vital_threshold"):
        source_table = "labevents" if k == "lab_threshold" else "chartevents"
        try:
            itemid = int(str(c.field))
        except (TypeError, ValueError):
            raise CompileError(f"{k} requires field=<itemid>")
        op = c.op or ">"
        if op not in ALLOWED_OPS:
            raise CompileError(f"unsupported op: {op}")
        return (
            f"p.subject_id IN (SELECT subject_id FROM {source_table} "
            f"WHERE itemid = {itemid} AND valuenum {op} {_num(c.value)})",
            f"{source_table}.itemid={itemid}",
        )
    raise CompileError(f"unknown criterion kind: {k}")


def iter_compile(db: Database, ir: CohortIR) -> Iterator[dict[str, Any]]:
    """Compile the IR, yielding one event per real step so the UI can show the work live:
    a `funnel` event per criterion as its count is computed, then `sql`, `patients`, and a
    final `result` event carrying the full payload. `compile_ir` just drains this.
    """
    steps: list[tuple[str, str, str]] = []
    for c in ir.include:
        pred, src = _predicate(c)
        steps.append((c.label, src, pred))
    for c in ir.exclude:
        pred, src = _predicate(c)
        steps.append((f"excluding: {c.label}", src, f"NOT ({pred})"))

    base_n = int(db.query("SELECT count(*) AS n FROM patients")[0]["n"])
    funnel: list[dict[str, Any]] = [
        {"criterion": "All demo patients", "source": "patients", "remaining": base_n, "delta": None}
    ]
    yield {"type": "funnel", **funnel[0]}
    prev = base_n
    cum: list[str] = []
    for label, src, clause in steps:
        cum.append(clause)
        where = " AND ".join(cum)
        n = int(db.query(f"SELECT count(*) AS n FROM patients p WHERE {where}")[0]["n"])
        step = {"criterion": label, "source": src, "remaining": n, "delta": n - prev}
        funnel.append(step)
        yield {"type": "funnel", **step}
        prev = n

    where_all = " AND ".join(cum) if cum else "TRUE"
    sql = f"SELECT DISTINCT p.subject_id FROM patients p WHERE {where_all} ORDER BY p.subject_id"
    yield {"type": "sql", "sql": sql}
    ids = [str(r["subject_id"]) for r in db.query(sql)]

    patients: list[dict[str, Any]] = []
    if ids:
        id_list = ",".join(ids)  # numeric subject_ids from our own query — safe
        patients = db.query(
            "SELECT p.subject_id, p.gender, p.anchor_age AS age, "
            "(SELECT count(*) FROM icustays i WHERE i.subject_id = p.subject_id) AS icu_stays, "
            "(SELECT round(coalesce(sum(los), 0), 1) FROM icustays i WHERE i.subject_id = p.subject_id) AS total_los, "
            "(SELECT count(*) FROM admissions a WHERE a.subject_id = p.subject_id) AS admissions, "
            "(SELECT max(hospital_expire_flag) FROM admissions a WHERE a.subject_id = p.subject_id) AS died "
            f"FROM patients p WHERE p.subject_id IN ({id_list}) ORDER BY p.subject_id LIMIT 500"
        )
    yield {"type": "patients", "count": len(ids)}

    query_hash = hashlib.sha256(
        (sql + "|" + json.dumps(ir.model_dump(), sort_keys=True)).encode()
    ).hexdigest()[:12]
    yield {"type": "result", "result": {
        "sql": sql, "funnel": funnel, "subject_ids": ids, "patients": patients,
        "n": len(ids), "answerable": ir.answerable, "confidence": ir.confidence,
        "query_hash": query_hash,
    }}


def compile_ir(db: Database, ir: CohortIR) -> dict[str, Any]:
    result: dict[str, Any] | None = None
    for ev in iter_compile(db, ir):
        if ev.get("type") == "result":
            result = ev["result"]
    assert result is not None
    return result
