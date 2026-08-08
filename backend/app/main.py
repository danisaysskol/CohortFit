"""CohortFit API — wires the data spine, quality engine, cohort layer, and eval harness.

The DuckDB session is built once and reused. Endpoints return JSON the Next.js
frontend renders. Patient-level rows returned here go only to the local UI; the LLM
path (cohort/build) receives schema + the description, per licence-aware minimization.
"""
from __future__ import annotations

import json
from functools import lru_cache
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from . import __version__
from .config import settings
from .cohort import nl
from .cohort.compiler import CompileError, compile_ir, iter_compile
from .data import schema as schema_mod
from .data import timeline as timeline_mod
from .data.loader import Database
from .eval.inject import run_eval
from .quality import rules as quality

app = FastAPI(title="CohortFit API", version=__version__)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins,
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


@app.on_event("startup")
def _warm() -> None:
    global _scorecard_cache, _schema_cache, _fixes_cache
    db = get_db()
    _schema_cache = {"tables": schema_mod.describe(db)}
    _scorecard_cache = quality.scorecard(db)
    _fixes_cache = quality.propose_fixes(db)


class BuildRequest(BaseModel):
    text: str


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
        return schema_mod.sample(get_db(), table, limit=min(limit, 200))
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
        return schema_mod.explore(get_db(), table, limit=min(limit, 100), offset=max(offset, 0),
                                  col=col, op=op, val=val, search=search)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"unknown table: {table}")


@app.post("/cohort/build")
def build_cohort(req: BuildRequest) -> dict[str, Any]:
    ir, method = nl.to_ir(req.text)
    if not ir.answerable:
        return {"answerable": False, "disposition": ir.disposition,
                "abstain_reason": ir.abstain_reason, "method": method,
                "ir": ir.model_dump(), "safety": SAFETY}
    try:
        result = compile_ir(get_db(), ir)
    except CompileError as e:
        return {"answerable": False, "disposition": "clarify", "abstain_reason": str(e),
                "method": method, "ir": ir.model_dump(), "safety": SAFETY}
    return {"method": method, "disposition": "cohort", "ir": ir.model_dump(),
            **result, "safety": SAFETY}


_DISPOSITION_LABEL = {"clarify": "Needs clarification", "refuse": "Request declined", "abstain": "Cannot answer"}


def _sse(obj: dict[str, Any]) -> str:
    return f"data: {json.dumps(obj)}\n\n"


@app.post("/cohort/stream")
def stream_cohort(req: BuildRequest) -> StreamingResponse:
    """Server-sent stream of the real build steps, so the UI shows the work as it happens."""
    def gen() -> Any:
        yield _sse({"step": "understand", "label": "Reading your request"})
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


@app.get("/quality/fixes")
def get_fixes() -> dict[str, Any]:
    global _fixes_cache
    if _fixes_cache is None:
        _fixes_cache = quality.propose_fixes(get_db())
    return {**_fixes_cache, "safety": SAFETY}


@app.get("/eval/run")
def get_eval(n_inject: int = 20) -> dict[str, Any]:
    return {**run_eval(get_db(), n_inject=n_inject), "safety": SAFETY}
