"""The cohort Intermediate Representation (IR).

The LLM emits this object (or our keyword fallback builds it); it is NOT executable
SQL. It is validated and then compiled deterministically to DuckDB SQL, so the query
is transparent, safe, and reproducible. `answerable`/`abstain_reason` make abstention
explicit rather than letting the model invent a query.
"""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

CriterionKind = Literal[
    "demographic", "has_icu_stay", "mortality", "diagnosis",
    "lab_threshold", "vital_threshold", "medication",
]
Op = Literal[">=", "<=", "=", "<", ">"]
# How the tool responds. Only "cohort" runs a query; the rest are honest non-answers.
Disposition = Literal["cohort", "clarify", "refuse", "abstain"]


class Criterion(BaseModel):
    kind: CriterionKind
    label: str                      # human-readable, shown in the Provenance Ledger
    field: Optional[str] = None     # e.g. "anchor_age", or an itemid for lab/vital_threshold
    op: Optional[Op] = None
    value: Optional[str] = None     # kept as string; the compiler casts safely
    table: Optional[str] = None


class CohortIR(BaseModel):
    entity: Literal["patient"] = "patient"
    include: list[Criterion] = Field(default_factory=list)
    answerable: bool = True
    disposition: Disposition = "cohort"
    abstain_reason: Optional[str] = None
    confidence: float = 0.9
