"""CohortFit API — wires the data spine, quality engine, cohort layer, and eval harness.

The DuckDB session is built once and reused. Endpoints return JSON the Next.js
frontend renders. Patient-level rows returned here go only to the local UI; the LLM
path (cohort/build) receives schema + the description, per licence-aware minimization.

Logging: the store is read-only, so there are no data mutations to log. What we log is
request decisions (cohort disposition, method, size), compile errors, and eval runs —
enough to audit behaviour without recording patient rows.
"""
from __future__ import annotations

import json
import logging
from functools import lru_cache
from typing import Any

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from . import __version__
from .config import settings
from .cohort import nl
from .cohort.compiler import CompileError, compile_ir, iter_compile
from .ratelimit import rate_limit
from .data import schema as schema_mod
from .data import timeline as timeline_mod
from .data.loader import Database
from .eval.inject import run_eval
from .quality import measure
from .quality import rules as quality

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("cohortfit")

app = FastAPI(title="CohortFit API", version=__version__)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_methods=["*"],
    allow_headers=["*"],
)

SAFETY = ("Research and educational prototype only. Not for clinical use. "
          "Do not use for diagnosis, treatment, triage, or emergency decisions.")


@lru_cache(maxsize=1)
def get_db() -> Database:
    return Database()


# The data is frozen, so these are deterministic — compute once and reuse so every
# page is instant during a live demo (schema row-counts and the scorecard are the
# only slow queries; we warm them at startup).
_scorecard_cache: dict[str, Any] | None = None
_schema_cache: dict[str, Any] | None = None
_fixes_cache: dict[str, Any] | None = None
_findings_cache: list[quality.Finding] | None = None


@app.on_event("startup")
def _warm() -> None:
    global _scorecard_cache, _schema_cache, _fixes_cache, _findings_cache
    db = get_db()
    _schema_cache = {"tables": schema_mod.describe(db)}
    _findings_cache = quality.all_findings(db)
    _scorecard_cache = quality.scorecard(db, _findings_cache)
    _fixes_cache = quality.propose_fixes(db)
    logger.info("startup: %d tables loaded, %d findings, %d fixes proposed (source is read-only)",
                len(db.tables()), len(_findings_cache), len(_fixes_cache["fixes"]))


class BuildRequest(BaseModel):
    text: str


class CohortScope(BaseModel):
    subject_ids: list[int] = []


class CohortDrill(BaseModel):
    subject_ids: list[int] = []
    finding_id: str
    limit: int = 50


@app.get("/health")
def health() -> dict[str, Any]:
    db = get_db()
    return {"status": "ok", "version": __version__, "tables": len(db.tables()),
            "data_dir": str(settings.mimic_data_dir), "safety": SAFETY}


@app.get("/schema")
def get_schema() -> dict[str, Any]:
    global _schema_cache
    if _schema_cache is None:
        _schema_cache = {"tables": schema_mod.describe(get_db())}
    return _schema_cache


@app.get("/schema/{table}")
def get_table(table: str, limit: int = 25) -> dict[str, Any]:
    try:
        return schema_mod.sample(get_db(), table, limit=min(max(limit, 1), 200))
    except KeyError:
        raise HTTPException(status_code=404, detail=f"unknown table: {table}")


@app.get("/explore/{table}")
def explore_table(
    table: str,
    limit: int = 25,
    offset: int = 0,
    col: str | None = None,
    op: str | None = None,
    val: str | None = None,
    search: str | None = None,
) -> dict[str, Any]:
    try:
        return schema_mod.explore(get_db(), table, limit=min(max(limit, 1), 100), offset=max(offset, 0),
                                  col=col, op=op, val=val, search=search)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"unknown table: {table}")


_EMPTY_REASON = "Please describe a patient group — the request was empty."


@app.post("/cohort/build", dependencies=[Depends(rate_limit)])
def build_cohort(req: BuildRequest) -> dict[str, Any]:
    if not req.text.strip():
        return {"answerable": False, "disposition": "clarify", "abstain_reason": _EMPTY_REASON,
                "method": "guard", "ir": {}, "safety": SAFETY}
    if len(req.text) > settings.max_cohort_text_chars:
        return {"answerable": False, "disposition": "clarify",
                "abstain_reason": f"Description too long (max {settings.max_cohort_text_chars} characters). "
                                  "Please shorten it to a concise cohort description.",
                "method": "guard", "ir": {}, "safety": SAFETY}
    ir, method = nl.to_ir(req.text)
    if not ir.answerable:
        logger.info("cohort/build: disposition=%s method=%s len=%d (not answerable)",
                    ir.disposition, method, len(req.text))
        return {"answerable": False, "disposition": ir.disposition,
                "abstain_reason": ir.abstain_reason, "method": method,
                "ir": ir.model_dump(), "safety": SAFETY}
    try:
        result = compile_ir(get_db(), ir)
    except CompileError as e:
        logger.warning("cohort/build: compile error (method=%s): %s", method, e)
        return {"answerable": False, "disposition": "clarify", "abstain_reason": str(e),
                "method": method, "ir": ir.model_dump(), "safety": SAFETY}
    logger.info("cohort/build: disposition=cohort method=%s n=%d query_hash=%s",
                method, result["n"], result.get("query_hash"))
    return {"method": method, "disposition": "cohort", "ir": ir.model_dump(),
            **result, "safety": SAFETY}


_DISPOSITION_LABEL = {"clarify": "Needs clarification", "refuse": "Request declined", "abstain": "Cannot answer"}


def _sse(obj: dict[str, Any]) -> str:
    return f"data: {json.dumps(obj)}\n\n"


@app.post("/cohort/stream", dependencies=[Depends(rate_limit)])
def stream_cohort(req: BuildRequest) -> StreamingResponse:
    """Server-sent stream of the real build steps, so the UI shows the work as it happens."""
    def gen() -> Any:
        yield _sse({"step": "understand", "label": "Reading your request"})
        if not req.text.strip():
            yield _sse({"step": "decision", "disposition": "clarify",
                        "label": "Needs clarification", "reason": _EMPTY_REASON})
            yield _sse({"step": "done", "result": {
                "answerable": False, "disposition": "clarify", "abstain_reason": _EMPTY_REASON,
                "method": "guard", "ir": {}, "safety": SAFETY}})
            return
        if len(req.text) > settings.max_cohort_text_chars:
            reason = (f"Description too long (max {settings.max_cohort_text_chars} characters). "
                      "Please shorten it to a concise cohort description.")
            yield _sse({"step": "decision", "disposition": "clarify",
                        "label": "Needs clarification", "reason": reason})
            yield _sse({"step": "done", "result": {
                "answerable": False, "disposition": "clarify", "abstain_reason": reason,
                "method": "guard", "ir": {}, "safety": SAFETY}})
            return
        ir, method = nl.to_ir(req.text)
        if not ir.answerable:
            yield _sse({"step": "decision", "disposition": ir.disposition,
                        "label": _DISPOSITION_LABEL.get(ir.disposition, "Cannot answer"),
                        "reason": ir.abstain_reason})
            yield _sse({"step": "done", "result": {
                "answerable": False, "disposition": ir.disposition,
                "abstain_reason": ir.abstain_reason, "method": method,
                "ir": ir.model_dump(), "safety": SAFETY}})
            return
        criteria = [c.label for c in ir.include] + [f"not {c.label}" for c in ir.exclude]
        yield _sse({"step": "criteria", "label": "Understood the criteria",
                    "criteria": criteria, "method": method})
        yield _sse({"step": "validate", "label": "Checked the criteria against the schema"})
        try:
            for ev in iter_compile(get_db(), ir):
                if ev["type"] == "funnel":
                    yield _sse({"step": "funnel", "funnel": {k: ev[k] for k in
                                ("criterion", "source", "remaining", "delta")}})
                elif ev["type"] == "sql":
                    yield _sse({"step": "sql", "label": "Built the query"})
                elif ev["type"] == "patients":
                    yield _sse({"step": "patients", "label": "Loaded the matched patients",
                                "count": ev["count"]})
                elif ev["type"] == "result":
                    yield _sse({"step": "done", "result": {
                        "method": method, "disposition": "cohort", "ir": ir.model_dump(),
                        **ev["result"], "safety": SAFETY}})
        except CompileError as e:
            yield _sse({"step": "decision", "disposition": "clarify",
                        "label": "Needs clarification", "reason": str(e)})
            yield _sse({"step": "done", "result": {
                "answerable": False, "disposition": "clarify", "abstain_reason": str(e),
                "method": method, "ir": ir.model_dump(), "safety": SAFETY}})

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.get("/patient/{subject_id}/timeline")
def get_patient_timeline(subject_id: int) -> dict[str, Any]:
    try:
        return {**timeline_mod.patient_timeline(get_db(), subject_id), "safety": SAFETY}
    except KeyError:
        raise HTTPException(status_code=404, detail=f"unknown subject_id: {subject_id}")


@app.get("/quality/scorecard")
def get_scorecard() -> dict[str, Any]:
    global _scorecard_cache
    if _scorecard_cache is None:
        _scorecard_cache = quality.scorecard(get_db())
    return {**_scorecard_cache, "safety": SAFETY}


# A cohort's scoped findings/measurements are deterministic, so compute once per cohort
# and reuse across the scorecard, its drill-ins, and repeat visits (the scoped scan over
# chartevents is the slow part — this keeps every call after the first instant).
_cohort_findings: dict[tuple[int, ...], list[quality.Finding]] = {}
_cohort_measure: dict[tuple[int, ...], dict[str, Any]] = {}


def _cohort_key(ids: list[int]) -> tuple[int, ...]:
    return tuple(sorted(set(int(i) for i in ids)))


def _findings_for(ids: list[int]) -> list[quality.Finding]:
    key = _cohort_key(ids)
    if key not in _cohort_findings:
        _cohort_findings[key] = quality.all_findings(get_db(), subject_ids=list(key) or None)
    return _cohort_findings[key]


@app.post("/cohort/quality")
def cohort_quality(req: CohortScope) -> dict[str, Any]:
    """The data-fitness scorecard restricted to one cohort's patients — so a judge sees
    whether *their* cohort is fit to trust, not just the whole dataset."""
    findings = _findings_for(req.subject_ids)
    return {**quality.scorecard(get_db(), findings=findings),
            "n_patients": len(req.subject_ids), "scoped": bool(req.subject_ids), "safety": SAFETY}


@app.post("/cohort/quality/rows")
def cohort_quality_rows(req: CohortDrill) -> dict[str, Any]:
    """Offending rows for one flag, restricted to the cohort. Reuses the cohort's cached
    findings so the SQL and rows both carry the cohort filter without recomputing."""
    findings = _findings_for(req.subject_ids)
    res = quality.find_offending_rows(get_db(), findings, req.finding_id, min(req.limit, 200))
    if res is None:
        raise HTTPException(status_code=404, detail=f"no offending rows for finding: {req.finding_id}")
    return {**res, "safety": SAFETY}


@app.post("/cohort/measurements")
def cohort_measurements(req: CohortScope) -> dict[str, Any]:
    """Measurement coverage, unit variation, value range, and diagnosis coding for a
    cohort (Track-2 point 3). Describes the data; never edits it."""
    key = _cohort_key(req.subject_ids)
    if key not in _cohort_measure:
        _cohort_measure[key] = measure.cohort_measurements(get_db(), subject_ids=list(key) or None)
    return {**_cohort_measure[key], "scoped": bool(req.subject_ids), "safety": SAFETY}


@app.get("/quality/finding/{finding_id}/rows")
def get_finding_rows(finding_id: str, limit: int = 50) -> dict[str, Any]:
    """The actual rows behind one data-quality flag — so a finding is never taken on trust."""
    global _findings_cache
    if _findings_cache is None:
        _findings_cache = quality.all_findings(get_db())
    res = quality.find_offending_rows(get_db(), _findings_cache, finding_id, min(limit, 200))
    if res is None:
        raise HTTPException(status_code=404, detail=f"no offending rows for finding: {finding_id}")
    return {**res, "safety": SAFETY}


@app.get("/quality/fixes")
def get_fixes() -> dict[str, Any]:
    global _fixes_cache
    if _fixes_cache is None:
        _fixes_cache = quality.propose_fixes(get_db())
    return {**_fixes_cache, "safety": SAFETY}


@app.get("/eval/run", dependencies=[Depends(rate_limit)])
def get_eval(n_inject: int = 20) -> dict[str, Any]:
    result = run_eval(get_db(), n_inject=n_inject)
    logger.info("eval/run: n_inject=%d checks=%s overall_precision=%.3f",
                n_inject, [c["dimension"] for c in result["checks"]],
                result["overall"]["precision"]["mean"])
    return {**result, "safety": SAFETY}
