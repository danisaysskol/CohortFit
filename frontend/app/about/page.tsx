import { Icon, IconName } from "../components/Icon";

function Capability({ icon, title, children }: { icon: IconName; title: string; children: React.ReactNode }) {
  return (
    <div className="cap">
      <span className="cap-i"><Icon name={icon} size={16} /></span>
      <div>
        <div className="cap-t">{title}</div>
        <div className="cap-b">{children}</div>
      </div>
    </div>
  );
}

export default function AboutPage() {
  return (
    <>
      <div className="page-h">
        <div>
          <h1>What CohortFit does</h1>
          <p>A tool for researchers to define patient groups and judge whether the data can be trusted — built on the MIMIC-IV demo (100 de-identified patients). Not for patient care.</p>
        </div>
      </div>

      {/* Response types — the behaviours the tool can produce */}
      <section className="panel">
        <div className="panel-h"><span className="lbl lbl-i"><Icon name="spark" size={13} /> How it answers a request</span></div>
        <div className="panel-b caps">
          <Capability icon="users" title="Builds a cohort">
            When the request maps to the data, it builds a query, shows the included/excluded logic step by step, and lists the matched patients.
          </Capability>
          <Capability icon="search" title="Asks you to clarify">
            When a request is vague (&ldquo;sick patients&rdquo;, &ldquo;high blood pressure&rdquo;) or self-contradictory, it asks for the missing detail instead of guessing.
          </Capability>
          <Capability icon="info" title="Says it cannot answer">
            When the data genuinely can&rsquo;t support the request — season or calendar year (dates are shifted), or comparing hospitals (one site only) — it declines and explains why.
          </Capability>
          <Capability icon="shield" title="Declines out-of-scope requests">
            It refuses predictions, treatment advice, and any attempt to re-identify a patient. This is a research tool, not a clinical one.
          </Capability>
        </div>
      </section>

      {/* Data-quality behaviour */}
      <section className="panel" style={{ marginTop: 18 }}>
        <div className="panel-h"><span className="lbl lbl-i"><Icon name="shield" size={13} /> How it judges data quality</span></div>
        <div className="panel-b caps">
          <Capability icon="alert" title="Sorts real problems from real findings">
            Every flag is labelled a <b>data error</b> (a recording mistake), a <b>verified finding</b> (a genuine extreme value), or a <b>caveat</b> (an expected quirk) — a truly unusual lab is never mistaken for a typo.
          </Capability>
          <Capability icon="chart" title="Rates fitness at a glance">
            Five checks — plausibility, units, timing, completeness, duplicates — each rated <b>critical</b>, <b>review</b>, or <b>clean</b>, with the most severe shown first.
          </Capability>
          <Capability icon="check" title="Suggests only reversible fixes">
            A proposed fix (e.g. a mislabelled temperature) is applied to a working copy and logged so you can undo it. The source data is never changed.
          </Capability>
          <Capability icon="link" title="Traces every claim to its source">
            Each finding points to its table and item id; each cohort row is drawn straight from the records — nothing is a black box.
          </Capability>
        </div>
      </section>

      {/* Improvement over baseline */}
      <section className="panel" style={{ marginTop: 18 }}>
        <div className="panel-h"><span className="lbl lbl-i"><Icon name="chart" size={13} /> Why it beats a fixed-rule checker</span></div>
        <div className="panel-b">
          <div className="tablewrap">
            <table className="gt">
              <thead><tr><th>A fixed-rule checker</th><th>CohortFit</th></tr></thead>
              <tbody>
                <tr><td className="muted">Uses fixed thresholds; breaks on anything unusual</td><td>Adapts using reference ranges and context</td></tr>
                <tr><td className="muted">Flags everything the same</td><td>Ranks problems so the worst are seen first</td></tr>
                <tr><td className="muted">Can&rsquo;t tell a real finding from an error</td><td>Separates a genuine extreme value from a mistake</td></tr>
                <tr><td className="muted">Gives no explanation</td><td>Explains each flag in plain words with a source link</td></tr>
              </tbody>
            </table>
          </div>
          <p className="note">On the injected-error benchmark, a fixed rule reaches about 0.07 precision — it flags almost everything — while CohortFit stays at 1.00. See the Evaluation page.</p>
        </div>
      </section>

      {/* Boundaries */}
      <section className="panel" style={{ marginTop: 18 }}>
        <div className="panel-h"><span className="lbl lbl-i"><Icon name="info" size={13} /> Scope &amp; data handling</span></div>
        <div className="panel-b">
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8, fontSize: 13.5 }}>
            <li>For researchers and educators — <b>not</b> for patient-care decisions. No diagnosis, treatment, or triage.</li>
            <li>Dates in MIMIC-IV are shifted, so real-world time and season are never inferred.</li>
            <li>The model receives the schema and your description — not raw patient records. Nothing is sent to re-identify anyone.</li>
            <li>Dataset: MIMIC-IV Clinical Database Demo v2.2 (100 patients), used under the PhysioNet licence.</li>
          </ul>
        </div>
      </section>

      <div className="abstain" style={{ marginTop: 18 }}>
        <span className="k">Required notice</span> — Research and educational prototype only. Not for clinical use. Do not use for diagnosis, treatment, triage, or emergency decisions.
      </div>
    </>
  );
}
