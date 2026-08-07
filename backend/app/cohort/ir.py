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
    "demographic", "has_icu_stay", "mortality", "diagnosis", "lab_threshold", "medication"
]
Op = Literal[">=", "<=", "=", "<", ">"]


class Criterion(BaseModel):
    kind: CriterionKind
    label: str                      # human-readable, shown in the Provenance Ledger
    field: Optional[str] = None     # e.g. "anchor_age", or an itemid for lab_threshold
    op: Optional[Op] = None
    value: Optional[str] = None     # kept as string; the compiler casts safely
    table: Optional[str] = None


class CohortIR(BaseModel):
    entity: Literal["patient"] = "patient"
    include: list[Criterion] = Field(default_factory=list)
    answerable: bool = True
    abstain_reason: Optional[str] = None
    confidence: float = 0.9
