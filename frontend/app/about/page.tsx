export default function AboutPage() {
  return (
    <>
      <div className="page-h">
        <div>
          <h1>About &amp; safety</h1>
          <p>What CohortFit is, what it will and won&apos;t do, and how it handles your data.</p>
        </div>
      </div>

      <div className="grid2">
        <section className="panel">
          <div className="panel-h"><span className="lbl">What it does</span></div>
          <div className="panel-b">
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7, fontSize: 13.5 }}>
              <li>Turns plain-English cohort descriptions into a visible query (inclusion + exclusion), shown as a provenance ledger.</li>
              <li>Scores data fitness red / amber / green, with each flag traced to its source table.</li>
              <li>Distinguishes a real clinical finding from a data-quality error.</li>
              <li>Suggests only reversible, rule-backed fixes — never mutating source data.</li>
              <li>Abstains, clearly, when the data can&apos;t support a request.</li>
            </ul>
          </div>
        </section>

        <section className="panel">
          <div className="panel-h"><span className="lbl">Boundaries &amp; data</span></div>
          <div className="panel-b">
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7, fontSize: 13.5 }}>
              <li>For clinical-data researchers &amp; educators — <b>not</b> for patient-care decisions.</li>
              <li>No diagnosis, treatment, triage, or emergency guidance; no claims of clinical validity.</li>
              <li>Calendar dates are shifted in MIMIC-IV; we never infer real-world chronology.</li>
              <li>Licence-aware: we minimise data sent to external services — schema and aggregates by default, only the minimal rows a task needs, disclosed.</li>
              <li>Dataset: MIMIC-IV Clinical Database Demo v2.2 (100 patients). Cite via PhysioNet.</li>
            </ul>
          </div>
        </section>
      </div>

      <div className="abstain" style={{ marginTop: 18 }}>
        <span className="k">Required notice</span> — Research and educational prototype only. Not for clinical use. Do not use for diagnosis, treatment, triage, or emergency decisions.
      </div>
    </>
  );
}
