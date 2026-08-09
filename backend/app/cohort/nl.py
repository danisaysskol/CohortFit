"""Plain-English -> CohortIR.

Uses OpenAI Structured Outputs when a key is configured; otherwise a transparent,
*honest* keyword parser: it refuses / abstains / asks for clarification on requests it
can't safely answer, instead of returning a confident but wrong cohort. Both paths
return the same validated IR that the compiler runs.
"""
from __future__ import annotations

import re

from ..config import settings
from .ir import CohortIR, Criterion

_DRUGS = ["furosemide", "insulin", "warfarin", "heparin", "vancomycin",
          "norepinephrine", "propofol", "fentanyl", "potassium chloride",
          "morphine", "aspirin", "metoprolol", "lorazepam"]

_DISEASES = ["diabetes", "sepsis", "heart failure", "pneumonia", "hypertension",
             "stroke", "myocardial infarction", "copd", "kidney", "renal failure",
             "cancer", "atrial fibrillation"]

# name -> labevents itemid (best-effort common analytes)
_LABS = {
    "potassium": 50971, "sodium": 50983, "creatinine": 50912, "glucose": 50931,
    "hemoglobin": 51222, "hematocrit": 51221, "wbc": 51301, "white blood cell": 51301,
    "platelet": 51265, "lactate": 50813, "bicarbonate": 50882, "chloride": 50902,
    "calcium": 50893, "magnesium": 50960,
}
# name -> chartevents itemid (ICU vitals)
_VITALS = {
    "heart rate": 220045, "spo2": 220277, "oxygen saturation": 220277,
    "respiratory rate": 220210, "temperature": 223762,
}

_OP_WORDS = [
    (">=", ["at least", ">=", "greater than or equal"]),
    ("<=", ["at most", "<=", "less than or equal", "no more than"]),
    (">", ["over", "above", "greater than", "more than", ">", "higher than"]),
    ("<", ["under", "below", "less than", "lower than", "<", "younger than"]),
    ("=", ["equal to", "exactly"]),
]
_OP_ALT = "|".join(re.escape(w) for _, ws in _OP_WORDS for w in ws)


def _op_of(word: str) -> str:
    for op, words in _OP_WORDS:
        if word in words:
            return op
    return ">"


def _nonanswer(disposition: str, reason: str) -> CohortIR:
    return CohortIR(include=[], answerable=False, disposition=disposition,
                    abstain_reason=reason, confidence=0.0)


def _keyword_ir(text: str) -> CohortIR:
    t = " " + text.lower().strip() + " "
    crit: list[Criterion] = []

    # 1) REFUSE — out-of-scope prediction / advice / re-identification
    if any(w in t for w in ["most likely to die", "predict", "risk of", "who will die",
                            "prognos", "which patient is most"]):
        return _nonanswer("refuse", "That asks for a clinical prediction / risk ranking, "
                          "which is out of scope for a research data-quality tool and cannot "
                          "be supported by 100 patients.")
    if any(w in t for w in ["what treatment", "should receive", "how should i treat",
                            "diagnose", "prescribe for", "medical advice", "what medication should"]):
        return _nonanswer("refuse", "No diagnosis, treatment, or medical advice. This is a "
                          "research-only tool. See the safety notice.")
    if any(w in t for w in ["real name", "address of", "reidentif", "re-identif",
                            "identity of", "who is subject", "phone number"]):
        return _nonanswer("refuse", "The data is de-identified; re-identification is prohibited "
                          "by the PhysioNet licence.")

    # 2) ABSTAIN — the data genuinely can't support it
    if any(w in t for w in [" winter", " summer", " spring", " autumn", " fall ", " season"]):
        return _nonanswer("abstain", "Calendar dates are shifted (into 2100-2200), so season is "
                          "unknowable — this can't be answered.")
    if re.search(r"\b(19|20)\d{2}\b", t):
        return _nonanswer("abstain", "Exact calendar years are meaningless here — dates are "
                          "shifted per patient. anchor_year_group only gives a coarse range.")
    if any(w in t for w in ["other hospital", "across hospital", "between hospital",
                            "cross-hospital", "compared to other", "compare mortality between"]):
        return _nonanswer("abstain", "This is a single-center dataset; cross-hospital comparison "
                          "is impossible.")

    # 3) CLARIFY — ambiguous terms we must not guess
    if re.search(r"\bsick\b", t) and not any(d in t for d in _DISEASES):
        return _nonanswer("clarify", "What does 'sick' mean here — a diagnosis, an abnormal lab, "
                          "an ICU admission, or a severity score? Please specify.")
    if ("blood pressure" in t or " bp " in t) and not re.search(r"\d", t):
        return _nonanswer("clarify", "Which blood-pressure threshold, and which source — a charted "
                          "ICU reading or an outpatient OMR reading? Please specify.")
    if re.search(r"\brecent\b", t):
        return _nonanswer("clarify", "'Recent' relative to today is undefined (dates are shifted). "
                          "Did you mean 'most recent per patient'?")

    # 4) CLARIFY — recognizable but unsupported query shapes (don't fake an answer)
    if re.search(r"\b(not|without|never)\b", t) or re.search(r"\bno (antibiotic|drug|medication|prescription)", t):
        return _nonanswer("clarify", "Negation ('patients WITHOUT X') needs an anti-join, which "
                          "isn't supported yet. Try the positive form, or split the query.")
    if re.search(r"\b(average|mean|median|how many|count|total|number of|percentage|proportion|rate of)\b", t):
        return _nonanswer("clarify", "That asks for a statistic. CohortFit returns a cohort "
                          "(a patient set), not an aggregate — yet.")
    if re.search(r"\breadmit", t) or re.search(r"within \d+ day", t) or \
       re.search(r"(before|after|prior to|during).{0,20}(admit|discharge|icu|stay)", t) or \
       "drawn before" in t:
        return _nonanswer("clarify", "Temporal-relationship queries (readmission, before/after/"
                          "during a stay) need a time-window join that isn't supported yet.")

    # 5) PARSE cohort criteria ------------------------------------------------
    work = t  # numbers consumed by measures are blanked so they can't be read as age

    def add_thresholds(names: dict[str, int], kind: str) -> None:
        nonlocal work
        for name, itemid in names.items():
            # measure ... op ... number   (bounded gap)
            m = re.search(re.escape(name) + r"[^0-9]{0,25}?(" + _OP_ALT + r")\s*(\d+\.?\d*)", work)
            if not m:
                # number ... op? ... measure  (e.g. "> 120 heart rate") — rarer; skip for safety
                continue
            op = _op_of(m.group(1))
            val = m.group(2)
            crit.append(Criterion(kind=kind, field=str(itemid), op=op, value=val,
                                  label=f"{name} {op} {val}"))
            work = work[:m.start(2)] + " " * (m.end(2) - m.start(2)) + work[m.end(2):]

    add_thresholds(_LABS, "lab_threshold")
    add_thresholds(_VITALS, "vital_threshold")

    # gender
    if re.search(r"\b(female|women|woman)\b", work):
        crit.append(Criterion(kind="demographic", field="gender", op="=", value="F", label="female"))
    elif re.search(r"\b(male|men|man)\b", work):
        crit.append(Criterion(kind="demographic", field="gender", op="=", value="M", label="male"))

    # age (over/under), using only numbers not consumed by measures
    age_min = age_max = None
    m = re.search(r"(?:over|older than|above|aged|age|at least)\s*(\d{1,3})", work)
    if m and int(m.group(1)) <= 120:
        age_min = int(m.group(1))
        crit.append(Criterion(kind="demographic", field="anchor_age", op=">=", value=str(age_min),
                              label=f"age ≥ {age_min}"))
    m = re.search(r"(?:under|younger than|below|less than)\s*(\d{1,3})\s*(?:years|y/o|yo|year|$| )", work)
    if m and int(m.group(1)) <= 120:
        age_max = int(m.group(1))
        crit.append(Criterion(kind="demographic", field="anchor_age", op="<", value=str(age_max),
                              label=f"age < {age_max}"))

    # contradiction: age_min >= age_max (e.g. under 12 AND over 65)
    if age_min is not None and age_max is not None and age_min >= age_max:
        return _nonanswer("clarify", f"Contradictory age range (≥ {age_min} and < {age_max}). "
                          "Also note the demo is an adult population.")

    if " icu" in work or "intensive care" in work:
        crit.append(Criterion(kind="has_icu_stay", label="has an ICU stay"))
    if any(w in work for w in ["died", "death", "mortal", "expired", "deceased", "passed away"]):
        crit.append(Criterion(kind="mortality", label="died in hospital"))
    for disease in _DISEASES:
        if disease in work:
            crit.append(Criterion(kind="diagnosis", value=disease, label=f"diagnosed with {disease}"))
    for drug in _DRUGS:
        if drug in work:
            crit.append(Criterion(kind="medication", value=drug, label=f"received {drug}"))

    if not crit:
        return _nonanswer("clarify", "I couldn't map this to the available tables. Try naming a "
                          "concrete filter — an age, gender, ICU stay, diagnosis, medication, "
                          "or a lab/vital threshold.")

    return CohortIR(include=crit, answerable=True, disposition="cohort", confidence=0.6)


def _itemid_reference() -> str:
    labs = ", ".join(f"{n}={i}" for n, i in _LABS.items())
    vitals = ", ".join(f"{n}={i}" for n, i in _VITALS.items())
    return f"Lab itemids (labevents): {labs}. Vital itemids (chartevents): {vitals}."


_SYSTEM_PROMPT = (
    "Convert a plain-English patient-cohort description into a CohortIR over MIMIC-IV "
    "(100-patient demo; every patient has an ICU stay). Supported criterion kinds:\n"
    "- demographic: field=anchor_age|anchor_year|gender, op, value (gender value 'F'/'M')\n"
    "- has_icu_stay; mortality (died in hospital)\n"
    "- diagnosis: value=disease text matched against ICD long_title\n"
    "- medication: value=drug name, or the literal 'antibiotics' for the antibiotic class\n"
    "- lab_threshold / vital_threshold: field=itemid, op, value\n"
    "- los_threshold: op, value (ICU length of stay in days)\n"
    "- lab_temporal: relation=during_icu|before_icu, optional field=itemid\n"
    "- readmission: value=<days> (readmitted within N days of a prior discharge)\n"
    "Put anti-join criteria (patients WITHOUT X, e.g. 'not on antibiotics') in `exclude`.\n"
    "Use the correct itemid from this reference: " + _itemid_reference() + "\n"
    "Treat vague vital descriptions without a numeric threshold (e.g. 'high blood pressure', "
    "'low oxygen') as ambiguous → disposition='clarify' (ask for the threshold and the source: "
    "charted ICU reading vs outpatient OMR); do NOT map them to a diagnosis.\n"
    "Set disposition='refuse' for prediction/advice/re-identification; 'abstain' when the data "
    "can't support it (seasonality, exact calendar year, cross-hospital); 'clarify' for ambiguous "
    "terms, contradictions, or unsupported shapes (aggregation/averages/counts). Set answerable=false "
    "for any non-'cohort' disposition. Only emit criteria you can ground in the schema."
)


def _openai_ir(text: str, model: str) -> CohortIR:
    """Structured-output IR via OpenAI. Only called when a key is configured.

    gpt-5.6 reasoning models reject a custom temperature, so we don't send one —
    reproducibility comes from the deterministic IR->SQL compiler.
    """
    from openai import OpenAI

    client = OpenAI(api_key=settings.openai_api_key)
    completion = client.beta.chat.completions.parse(
        model=model,
        reasoning_effort=settings.openai_reasoning_effort,
        messages=[{"role": "system", "content": _SYSTEM_PROMPT}, {"role": "user", "content": text}],
        response_format=CohortIR,
    )
    return completion.choices[0].message.parsed or _keyword_ir(text)


def to_ir(text: str) -> tuple[CohortIR, str]:
    """Return (ir, method), disclosed to the UI. Tries the primary model, then the
    configured fallback model, then the transparent keyword parser — so a model outage
    degrades gracefully instead of failing the request."""
    if settings.openai_api_key:
        try:
            return _openai_ir(text, settings.openai_model_primary), "openai"
        except Exception:
            try:
                return _openai_ir(text, settings.openai_model_fallback), "openai-fallback"
            except Exception:
                return _keyword_ir(text), "keyword-fallback (openai error)"
    return _keyword_ir(text), "keyword-fallback"
