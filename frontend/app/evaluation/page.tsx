"use client";

import { useEffect, useState } from "react";
import { api, EvalResult } from "../lib/api";

export default function EvaluationPage() {
  const [ev, setEv] = useState<EvalResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.runEval().then(setEv).catch((e) => setErr(String(e)));
  }, []);

  const r = ev?.results?.[0];

  return (
    <>
      <div className="page-h">
        <div>
          <h1>Evaluation</h1>
          <p>Nobody hands us labelled errors, so we inject known ones into a copy of the data and measure detection. Reproducible (seeded); synthetic errors never touch source records.</p>
        </div>
      </div>

      {err && !ev && <div className="abstain"><span className="k">Error</span> — {err}. Is the backend running on :8000?</div>}
      {!ev && !err && <div className="loading">Running the injected-error harness…</div>}

      {r && (
        <>
          <div className="metrics">
            <div className="metric"><div className="v">{r.precision}</div><div className="k lbl">Precision</div></div>
            <div className="metric"><div className="v">{r.recall}</div><div className="k lbl">Recall</div></div>
            <div className="metric"><div className="v">{r.f1}</div><div className="k lbl">F1</div></div>
            <div className="metric"><div className="v">{r.false_positive_rate}</div><div className="k lbl">False-positive rate</div></div>
          </div>

          <section className="panel" style={{ marginTop: 18 }}>
            <div className="panel-h"><span className="lbl">Run detail</span><span className="lbl">check: {String(r.check)}</span></div>
            <div className="panel-b">
              <table className="gt">
                <thead><tr><th>Metric</th><th className="num">Value</th></tr></thead>
                <tbody>
                  <tr><td>Table</td><td className="num mono">{String(r.table)}</td></tr>
                  <tr><td>Population</td><td className="num mono">{String(r.population)}</td></tr>
                  <tr><td>Injected errors</td><td className="num mono">{String(r.injected)}</td></tr>
                  <tr><td>Flagged by detector</td><td className="num mono">{String(r.flagged)}</td></tr>
                  <tr><td>True positives</td><td className="num mono">{String(r.tp)}</td></tr>
                  <tr><td>False positives</td><td className="num mono">{String(r.fp)}</td></tr>
                  <tr><td>False negatives</td><td className="num mono">{String(r.fn)}</td></tr>
                  <tr><td>Seed</td><td className="num mono">{String(r.seed)}</td></tr>
                </tbody>
              </table>
              <p className="note"><b>{ev?.note}</b></p>
            </div>
          </section>
        </>
      )}
    </>
  );
}
