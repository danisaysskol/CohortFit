"""Structured patient timeline (a Track-1 supporting feature).

Reconstructs a patient's journey from the relational tables as a single time-ordered
list of events — admissions, ICU stays, transfers, procedures — each carrying a link
back to its source table and id. Dates in MIMIC-IV are shifted but internally
consistent per patient, so the *ordering* is real even though the calendar is not.
"""
from __future__ import annotations

from typing import Any

from .loader import Database


def _ev(t: Any, kind: str, label: str, table: str, sid: Any) -> dict[str, Any]:
    return {"t": t, "kind": kind, "label": label, "table": table, "id": str(sid)}


def patient_timeline(db: Database, subject_id: int) -> dict[str, Any]:
    sid = int(subject_id)
    p = db.query("SELECT gender, anchor_age FROM patients WHERE subject_id = ?", [sid])
    if not p:
        raise KeyError(subject_id)

    events: list[dict[str, Any]] = []
    for r in db.query(
        "SELECT hadm_id, admittime, dischtime, deathtime, admission_type, discharge_location "
        "FROM admissions WHERE subject_id = ? ORDER BY admittime", [sid]
    ):
        events.append(_ev(r["admittime"], "admission", f"Admitted — {r['admission_type']}", "admissions", r["hadm_id"]))
        if r["dischtime"]:
            loc = f" to {r['discharge_location']}" if r["discharge_location"] else ""
            events.append(_ev(r["dischtime"], "discharge", f"Discharged{loc}", "admissions", r["hadm_id"]))
        if r["deathtime"]:
            events.append(_ev(r["deathtime"], "death", "Died in hospital", "admissions", r["hadm_id"]))

    for r in db.query(
        "SELECT stay_id, intime, outtime, first_careunit, last_careunit "
        "FROM icustays WHERE subject_id = ? ORDER BY intime", [sid]
    ):
        events.append(_ev(r["intime"], "icu_in", f"ICU admission — {r['first_careunit']}", "icustays", r["stay_id"]))
        if r["outtime"]:
            events.append(_ev(r["outtime"], "icu_out", f"ICU discharge — {r['last_careunit']}", "icustays", r["stay_id"]))

    for r in db.query(
        "SELECT transfer_id, intime, careunit FROM transfers "
        "WHERE subject_id = ? AND careunit IS NOT NULL AND intime IS NOT NULL ORDER BY intime", [sid]
    ):
        events.append(_ev(r["intime"], "transfer", f"Transfer — {r['careunit']}", "transfers", r["transfer_id"]))

    for r in db.query(
        "SELECT CAST(p.chartdate AS TIMESTAMP) AS t, p.icd_code, d.long_title "
        "FROM procedures_icd p LEFT JOIN d_icd_procedures d "
        "ON p.icd_code = d.icd_code AND p.icd_version = d.icd_version "
        "WHERE p.subject_id = ? AND p.chartdate IS NOT NULL ORDER BY p.chartdate", [sid]
    ):
        title = r["long_title"] or f"code {r['icd_code']}"
        events.append(_ev(r["t"], "procedure", f"Procedure — {title}", "procedures_icd", r["icd_code"]))

    events = [e for e in events if e["t"] is not None]
    events.sort(key=lambda e: e["t"])

    labs = int(db.query("SELECT count(*) AS n FROM labevents WHERE subject_id = ?", [sid])[0]["n"])
    meds = int(db.query("SELECT count(DISTINCT drug) AS n FROM prescriptions WHERE subject_id = ?", [sid])[0]["n"])
    diags = db.query(
        "SELECT DISTINCT x.long_title FROM diagnoses_icd di "
        "JOIN d_icd_diagnoses x ON di.icd_code = x.icd_code AND di.icd_version = x.icd_version "
        "WHERE di.subject_id = ? AND x.long_title IS NOT NULL LIMIT 12", [sid]
    )

    return {
        "subject_id": sid,
        "gender": p[0]["gender"],
        "age": p[0]["anchor_age"],
        "labs": labs,
        "meds": meds,
        "diagnoses": [d["long_title"] for d in diags],
        "events": [
            {"time": str(e["t"]), "kind": e["kind"], "label": e["label"],
             "source": {"table": e["table"], "id": e["id"]}}
            for e in events
        ],
    }
