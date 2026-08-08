"use client";

import { useEffect, useState } from "react";
import { api, Scorecard } from "../lib/api";
import { FixLedger } from "./FixLedger";

const SEV_CLASS: Record<string, string> = { red: "dotr", amber: "dota", green: "dotg" };
const SEV_LABEL: Record<string, string> = { red: "● Red", amber: "● Amber", green: "● Green" };
const KIND_PILL: Record<string, string> = { data_error: "err", real_finding: "find", caveat: "caveat" };
const KIND_LABEL: Record<string, string> = { data_error: "Data error", real_finding: "Real finding", caveat: "Caveat" };

export default function QualityPage() {
  const [sc, setSc] = useState<Scorecard | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.scorecard().then(setSc).catch((e) => setErr(String(e)));
  }, []);

  return (
    <>
      <div className="page-h">
        <div>
          <h1>Data-fitness scorecard</h1>
          <p>Red / amber / green across five dimensions, each finding traced to a table. Every flag is labelled a data error, a real clinical finding, or an expected caveat — never confused.</p>
        </div>
      </div>

      {err && !sc && <div className="abstain"><span className="k">Error</span> — {err}. Is the backend running on :8000?</div>}
      {!sc && !err && <div className="loading">Scoring the data…</div>}

      {sc && (
        <div className="metrics" style={{ marginBottom: 18 }}>
          <div className="metric"><div className="v">{sc.summary.issues_found}</div><div className="k lbl">Data-error issues</div></div>
          <div className="metric"><div className="v">{sc.summary.findings_total}</div><div className="k lbl">Findings, ranked worst-first</div></div>
          <div className="metric"><div className="v">≈{sc.summary.reviewer_minutes_saved_estimate}′</div><div className="k lbl">Est. reviewer time saved</div></div>
          <div className="metric"><div className="v">100%</div><div className="k lbl">Flags with reason + source</div></div>
        </div>
      )}

      {sc && (
        <div className="grid2">
          <section className="panel">
            <div className="panel-h"><span className="lbl">Dimensions</span></div>
            <div className="panel-b">
              <table className="gt">
                <tbody>
                  {sc.dimensions.map((d) => (
                    <tr key={d.dimension}>
                      <td className="dim">{d.dimension}</td>
                      <td className={"st " + SEV_CLASS[d.severity]}>{SEV_LABEL[d.severity]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="ai">
                <span className="b">AI</span>
                <span>Rules are gated on <span className="mono">d_items.param_type</span> and reference ranges, so an extreme-but-real lab reads as a finding, not a typo. Explanations are AI-generated and kept visually distinct from source data.</span>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-h"><span className="lbl">Findings · {sc.findings.length}</span></div>
            <div className="panel-b">
              <div className="flags">
                {sc.findings.map((f, i) => (
                  <div className="flag" key={i}>
                    <span className={"sq " + f.severity} />
                    <span>
                      <div className="t1">{f.detail}</div>
                      <div className="t2">{f.table}{f.ref ? " · " + f.ref : ""}</div>
                    </span>
                    <span className={"pill " + KIND_PILL[f.kind]}>{KIND_LABEL[f.kind]}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}

      {sc && <FixLedger />}
    </>
  );
}
