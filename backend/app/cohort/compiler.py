"""Compile a validated CohortIR into DuckDB SQL and run it.

Produces: the SQL (shown to the user), the Provenance Ledger funnel (running `n`
remaining + delta per criterion), the resulting subject_ids, and a data-hash so a
stored IR reproduces the exact result. Values are cast/escaped here — the LLM never
writes SQL, and criteria can only reference the fixed set of tables/columns below.
"""
from __future__ import annotations

import hashlib
import json
from typing import Any

from ..data.loader import Database
from .ir import Criterion, CohortIR

ALLOWED_DEMO_FIELDS = {"anchor_age", "anchor_year", "gender"}
NUMERIC_DEMO_FIELDS = {"anchor_age", "anchor_year"}
ALLOWED_OPS = {">=", "<=", "=", "<", ">"}


class CompileError(ValueError):
    """Raised when a criterion cannot be compiled (unknown field/op/kind)."""


def _lit(value: str) -> str:
    return value.replace("'", "''")


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
            return f"p.{field} {op} {float(c.value)}", f"patients.{field}"
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
        v = _lit(str(c.value or ""))
        return (
            f"p.subject_id IN (SELECT subject_id FROM prescriptions WHERE lower(drug) LIKE lower('%{v}%'))",
            "prescriptions.drug",
        )
    if k == "lab_threshold":
        try:
            itemid = int(str(c.field))
        except (TypeError, ValueError):
            raise CompileError("lab_threshold requires field=<itemid>")
        op = c.op or ">"
        if op not in ALLOWED_OPS:
            raise CompileError(f"unsupported op: {op}")
        return (
            f"p.subject_id IN (SELECT subject_id FROM labevents "
            f"WHERE itemid = {itemid} AND valuenum {op} {float(c.value)})",
            f"labevents.itemid={itemid}",
        )
    raise CompileError(f"unknown criterion kind: {k}")


def compile_ir(db: Database, ir: CohortIR) -> dict[str, Any]:
    preds: list[str] = []
    sources: list[str] = []
    labels: list[str] = []
    for c in ir.include:
        p, src = _predicate(c)
        preds.append(p)
        sources.append(src)
        labels.append(c.label)

    base_n = int(db.query("SELECT count(*) AS n FROM patients")[0]["n"])
    funnel: list[dict[str, Any]] = [
        {"criterion": "All demo patients", "source": "patients", "remaining": base_n, "delta": None}
    ]
    prev = base_n
    cum: list[str] = []
    for label, src, pred in zip(labels, sources, preds):
        cum.append(pred)
        where = " AND ".join(cum)
        n = int(db.query(f"SELECT count(*) AS n FROM patients p WHERE {where}")[0]["n"])
        funnel.append({"criterion": label, "source": src, "remaining": n, "delta": n - prev})
        prev = n

    where_all = " AND ".join(preds) if preds else "TRUE"
    sql = f"SELECT DISTINCT p.subject_id FROM patients p WHERE {where_all} ORDER BY p.subject_id"
    ids = [str(r["subject_id"]) for r in db.query(sql)]
    data_hash = hashlib.sha256(
        (sql + "|" + json.dumps(ir.model_dump(), sort_keys=True)).encode()
    ).hexdigest()[:12]
    return {
        "sql": sql,
        "funnel": funnel,
        "subject_ids": ids,
        "n": len(ids),
        "answerable": ir.answerable,
        "confidence": ir.confidence,
        "data_hash": data_hash,
    }
