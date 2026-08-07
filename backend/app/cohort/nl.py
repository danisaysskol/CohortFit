"""Plain-English -> CohortIR.

Uses OpenAI Structured Outputs when a key is configured; otherwise a transparent
keyword fallback so the tool works offline (and the method is always disclosed to the
caller). Both paths return the SAME validated IR object, which the compiler then runs.
"""
from __future__ import annotations

import re

from ..config import settings
from .ir import CohortIR, Criterion

_DRUGS = ["furosemide", "insulin", "warfarin", "heparin", "vancomycin",
          "norepinephrine", "propofol", "fentanyl", "potassium chloride"]


def _keyword_ir(text: str) -> CohortIR:
    t = text.lower().strip()
    crit: list[Criterion] = []

    m = re.search(r"(?:over|older than|above|age[d]?\s*(?:>=?|of)?)\s*(\d{1,3})", t)
    if m:
        age = int(m.group(1))
        crit.append(Criterion(kind="demographic", field="anchor_age", op=">=",
                              value=str(age), label=f"age ≥ {age}"))

    if "icu" in t or "intensive care" in t:
        crit.append(Criterion(kind="has_icu_stay", label="has an ICU stay"))

    if any(w in t for w in ["died", "death", "mortal", "expire", "deceased", "passed away"]):
        crit.append(Criterion(kind="mortality", label="died in hospital"))

    for drug in _DRUGS:
        if drug in t:
            crit.append(Criterion(kind="medication", value=drug, label=f"received {drug}"))

    answerable = len(crit) > 0
    return CohortIR(
        include=crit,
        answerable=answerable,
        abstain_reason=None if answerable else
        "No supported cohort criteria were recognized in the description.",
        confidence=0.6 if answerable else 0.0,
    )


def _openai_ir(text: str) -> CohortIR:
    """Structured-output IR via OpenAI. Only called when a key is configured."""
    from openai import OpenAI

    client = OpenAI(api_key=settings.openai_api_key)
    system = (
        "You convert a plain-English patient-cohort description into a CohortIR. "
        "Only use the supported criterion kinds: demographic (field=anchor_age|anchor_year|gender), "
        "has_icu_stay, mortality, diagnosis (value=free text matched against ICD long_title), "
        "medication (value=drug name), lab_threshold (field=itemid, op, value). "
        "Set answerable=false with an abstain_reason if the request needs data not in these tables. "
        "Never invent columns."
    )
    completion = client.beta.chat.completions.parse(
        model=settings.openai_model_primary,
        temperature=settings.openai_temperature,
        messages=[{"role": "system", "content": system},
                  {"role": "user", "content": text}],
        response_format=CohortIR,
    )
    parsed = completion.choices[0].message.parsed
    return parsed or _keyword_ir(text)


def to_ir(text: str) -> tuple[CohortIR, str]:
    """Return (ir, method). method is 'openai' or 'keyword-fallback' (disclosed to the UI)."""
    if settings.openai_api_key:
        try:
            return _openai_ir(text), "openai"
        except Exception:
            # Fall back transparently rather than failing the request.
            return _keyword_ir(text), "keyword-fallback (openai error)"
    return _keyword_ir(text), "keyword-fallback"
