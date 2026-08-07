"""CohortFit API — wires the data spine, quality engine, cohort layer, and eval harness.

The DuckDB session is built once and reused. Endpoints return JSON the Next.js
frontend renders. Patient-level rows returned here go only to the local UI; the LLM
path (cohort/build) receives schema + the description, per licence-aware minimization.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import __version__
from .config import settings
from .cohort import nl
from .cohort.compiler import CompileError, compile_ir
from .data import schema as schema_mod
from .data.loader import Database
from .eval.inject import run_temporal_eval
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


# The data is frozen, so the scorecard is deterministic — compute once and reuse
# (keeps the Quality page instant during a live demo).
_scorecard_cache: dict[str, Any] | None = None


@app.on_event("startup")
def _warm() -> None:
    global _scorecard_cache
    _scorecard_cache = quality.scorecard(get_db())


class BuildRequest(BaseModel):
    text: str


@app.get("/health")
def health() -> dict[str, Any]:
    db = get_db()
    return {"status": "ok", "version": __version__, "tables": len(db.tables()),
            "data_dir": str(settings.mimic_data_dir), "safety": SAFETY}


@app.get("/schema")
def get_schema() -> dict[str, Any]:
    return {"tables": schema_mod.describe(get_db())}


@app.get("/schema/{table}")
def get_table(table: str, limit: int = 25) -> dict[str, Any]:
    try:
        return schema_mod.sample(get_db(), table, limit=min(limit, 200))
    except KeyError:
        raise HTTPException(status_code=404, detail=f"unknown table: {table}")


@app.post("/cohort/build")
def build_cohort(req: BuildRequest) -> dict[str, Any]:
    ir, method = nl.to_ir(req.text)
    if not ir.answerable:
        return {"answerable": False, "abstain_reason": ir.abstain_reason,
                "method": method, "ir": ir.model_dump(), "safety": SAFETY}
    try:
        result = compile_ir(get_db(), ir)
    except CompileError as e:
        return {"answerable": False, "abstain_reason": str(e), "method": method,
                "ir": ir.model_dump(), "safety": SAFETY}
    return {"method": method, "ir": ir.model_dump(), **result, "safety": SAFETY}


@app.get("/quality/scorecard")
def get_scorecard() -> dict[str, Any]:
    global _scorecard_cache
    if _scorecard_cache is None:
        _scorecard_cache = quality.scorecard(get_db())
    return {**_scorecard_cache, "safety": SAFETY}


@app.get("/quality/fixes")
def get_fixes() -> dict[str, Any]:
    return {**quality.propose_fixes(get_db()), "safety": SAFETY}


@app.get("/eval/run")
def get_eval(n_inject: int = 20, seed: int = 42) -> dict[str, Any]:
    return {"results": [run_temporal_eval(get_db(), n_inject=n_inject, seed=seed)],
            "note": "Synthetic errors injected into a copy only; not real clinical performance.",
            "safety": SAFETY}
