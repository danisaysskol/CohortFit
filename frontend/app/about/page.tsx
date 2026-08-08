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

      <section className="panel" style={{ marginTop: 18 }}>
        <div className="panel-h"><span className="lbl">Improvement over a fixed-rule baseline</span></div>
        <div className="panel-b">
          <div className="tablewrap">
            <table className="gt">
              <thead><tr><th>Fixed-rule baseline</th><th>CohortFit</th></tr></thead>
              <tbody>
                <tr><td className="muted">Fixed thresholds; fails on anything unusual</td><td>Adapts using reference ranges and context (gated on <span className="mono">param_type</span>)</td></tr>
                <tr><td className="muted">Flags every candidate equally</td><td>Ranks findings so the most severe are reviewed first</td></tr>
                <tr><td className="muted">Cannot distinguish a genuine finding from a data error</td><td>Separates a genuine extreme value from a recording error</td></tr>
                <tr><td className="muted">Provides no explanation</td><td>Attaches a plain-language reason and a source pointer to every finding</td></tr>
                <tr><td className="muted">Requires the reviewer to inspect everything</td><td>Reports estimated review time saved per validated issue</td></tr>
              </tbody>
            </table>
          </div>
          <p className="note">Quantified on the Detection Performance page: on the injected-error benchmark, the fixed-rule baseline reaches a precision of approximately 0.07 (it flags almost everything), whereas CohortFit maintains a precision of 1.00.</p>
        </div>
      </section>

      <div className="abstain" style={{ marginTop: 18 }}>
        <span className="k">Required notice</span> — Research and educational prototype only. Not for clinical use. Do not use for diagnosis, treatment, triage, or emergency decisions.
      </div>
    </>
  );
}
