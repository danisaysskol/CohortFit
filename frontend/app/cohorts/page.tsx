"use client";

import { useEffect, useState } from "react";
import { api, CohortResult } from "../lib/api";

const EXAMPLES = [
  "ICU patients over 65 who died in hospital",
  "patients who received furosemide",
  "patients with a positive COVID PCR last winter",
];
const STORE_KEY = "cohortfit:last-cohort";

export default function CohortsPage() {
  const [text, setText] = useState(EXAMPLES[0]);
  const [res, setRes] = useState<CohortResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<"ir" | "sql">("ir");

  // Restore the last session so a reload never loses the demo state.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORE_KEY);
      if (saved) {
        const { text: t, res: r } = JSON.parse(saved);
        if (t) setText(t);
        if (r) setRes(r);
      }
    } catch {
      /* ignore malformed storage */
    }
  }, []);

  async function build(q?: string) {
    const query = q ?? text;
    if (q) setText(q);
    setLoading(true);
    setErr(null);
    try {
      const r = await api.buildCohort(query);
      setRes(r);
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify({ text: query, res: r }));
      } catch {
        /* storage full / unavailable — non-fatal */
      }
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="page-h">
        <div>
          <h1>Cohort builder</h1>
          <p>Describe a patient group in plain English. CohortFit shows the query, who is included, and who is excluded — with a provenance trail. It abstains when the data can&apos;t answer.</p>
        </div>
      </div>

      <div className="grid2">
        <section className="panel">
          <div className="panel-h">
            <span className="lbl">Plain English → query</span>
            {res?.method && <span className="lbl">via {res.method}</span>}
          </div>
          <div className="panel-b">
            <div style={{ display: "flex", gap: 8 }}>
              <label className="field" style={{ flex: 1 }}>
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && build()}
                  aria-label="Describe the cohort in plain English"
                />
              </label>
              <button className="btn" onClick={() => build()} disabled={loading}>
                {loading ? "…" : "Build"}
              </button>
            </div>
            <div className="chips">
              {EXAMPLES.map((ex) => (
                <button key={ex} className="chip" style={{ cursor: "pointer" }} onClick={() => build(ex)}>
                  {ex}
                </button>
              ))}
            </div>

            {err && <div className="abstain"><span className="k">Error</span> — {err}. Is the backend running on :8000?</div>}

            {res && !res.answerable && (() => {
              const label = { refuse: "Refused", clarify: "Needs clarification", abstain: "Abstained" }[res.disposition ?? "abstain"] ?? "Abstained";
              return (
                <div className="abstain">
                  <span className="k">{label}</span> — {res.abstain_reason}
                  <div className="note">This is by design: when a request is out of scope, ambiguous, or unsupported, CohortFit says so instead of inventing an answer.</div>
                </div>
              );
            })()}

            {res && res.answerable && res.funnel && (
              <>
                <div className="ledger" aria-label="Provenance ledger">
                  <div className="lh"><span>Criterion</span><span>Source</span><span>Remaining</span><span>Δ</span></div>
                  {res.funnel.map((s, i) => (
                    <div className={i === res.funnel!.length - 1 ? "lr total" : "lr"} key={i}>
                      <span className="crit">{s.criterion}</span>
                      <span className="src">{s.source}</span>
                      <span className="n">{s.remaining}</span>
                      <span className={"d" + (s.delta ? "" : " zero")}>{s.delta == null ? "—" : s.delta === 0 ? "0" : s.delta}</span>
                    </div>
                  ))}
                </div>
                <p className="note"><b>{res.n}</b> patients match · every count is measured from the demo, not estimated · confidence {res.confidence}.</p>
                {res.n === 0 && (
                  <div className="abstain" style={{ marginTop: 10 }}>
                    <span className="k">Valid empty result</span> — the query ran correctly and matched 0 patients. That&apos;s an answer, not an error (e.g. the demo is an adult population).
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-h">
            <span className="lbl">Generated query — reviewable</span>
            <span className="codetabs">
              <button aria-pressed={tab === "ir"} onClick={() => setTab("ir")}>Recipe (IR)</button>
              <button aria-pressed={tab === "sql"} onClick={() => setTab("sql")}>SQL</button>
            </span>
          </div>
          <div className="panel-b">
            {!res && <div className="loading">Build a cohort to see its recipe and SQL.</div>}
            {res && tab === "ir" && <pre><code>{JSON.stringify(res.ir, null, 2)}</code></pre>}
            {res && tab === "sql" && (
              <pre><code>{res.sql || "— (no SQL: abstained)"}</code></pre>
            )}
            {res?.subject_ids && res.subject_ids.length > 0 && (
              <p className="note"><b>subject_ids:</b> <span className="mono">{res.subject_ids.join(", ")}</span></p>
            )}
            <div className="ai">
              <span className="b">AI</span>
              <span>The recipe (IR) is proposed by the model from the schema and your text; our compiler turns it into the SQL above. The model does not write executable SQL. Stored IR + SQL + data-hash make the result reproducible.</span>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
