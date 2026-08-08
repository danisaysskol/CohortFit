"use client";

import { useEffect, useRef, useState } from "react";
import { api, CohortResult } from "../lib/api";
import { Icon } from "../components/Icon";

const EXAMPLES = [
  "ICU patients over 65 who died in hospital",
  "patients with a diabetes diagnosis",
  "ICU patients not on antibiotics",
  "patients with potassium over 5.5",
];
const STORE_KEY = "cohortfit:last-cohort";

export default function CohortsPage() {
  const [text, setText] = useState(EXAMPLES[0]);
  const [res, setRes] = useState<CohortResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<"ir" | "sql">("ir");
  const [showAll, setShowAll] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
    try {
      const saved = localStorage.getItem(STORE_KEY);
      if (saved) {
        const { text: t, res: r } = JSON.parse(saved);
        if (t) setText(t);
        if (r) setRes(r);
      }
    } catch { /* ignore */ }
  }, []);

  async function build(q?: string) {
    const query = q ?? text;
    if (q) setText(q);
    setLoading(true);
    setErr(null);
    setShowAll(false);
    try {
      const r = await api.buildCohort(query);
      setRes(r);
      try { localStorage.setItem(STORE_KEY, JSON.stringify({ text: query, res: r })); } catch { /* ignore */ }
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }

  const patients = (res?.patients ?? []) as Record<string, unknown>[];
  const shown = showAll ? patients : patients.slice(0, 12);
  const label = res && !res.answerable
    ? ({ refuse: "Refused", clarify: "Needs clarification", abstain: "Abstained" }[res.disposition ?? "abstain"] ?? "Abstained")
    : "";

  return (
    <>
      <div className="page-h">
        <div>
          <h1>Cohort builder</h1>
          <p>Describe a patient cohort in plain language. CohortFit builds a transparent query, shows who is included and excluded, and lists the matched patients.</p>
        </div>
      </div>

      {/* Hero input */}
      <div className="hero-ask">
        <label className="field hero-field">
          <Icon name="search" size={17} style={{ color: "var(--accent)", flex: "0 0 auto" }} />
          <input ref={inputRef} value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && build()}
            placeholder="e.g. ICU patients over 65 who died in hospital"
            aria-label="Describe the cohort in plain language" />
        </label>
        <button className="btn hero-btn" onClick={() => build()} disabled={loading}>
          {loading ? <span className="spin" /> : <Icon name="play" size={14} />}
          {loading ? "Building" : "Build cohort"}
        </button>
      </div>
      <div className="chips" style={{ marginTop: 10 }}>
        {EXAMPLES.map((ex) => (
          <button key={ex} className="chip chip-btn" onClick={() => build(ex)}>{ex}</button>
        ))}
        {res?.method && <span className="chip" style={{ marginLeft: "auto" }}><Icon name="spark" size={11} style={{ color: "var(--accent)" }} /> {res.method}</span>}
      </div>

      {err && <div className="abstain" style={{ marginTop: 14 }}><span className="k">Error</span> — {err}. Confirm the backend is running on port 8000.</div>}

      {res && !res.answerable && (
        <div className="abstain" style={{ marginTop: 14 }}>
          <span className="k">{label}</span> — {res.abstain_reason}
          <div className="note">By design, when a request is out of scope, ambiguous, or unsupported, CohortFit declines and explains why rather than returning an unsupported answer.</div>
        </div>
      )}

      {res && res.answerable && res.funnel && (
        <div className="grid2" style={{ marginTop: 18, gridTemplateColumns: "1fr 1fr" }}>
          {/* Provenance ledger */}
          <section className="panel">
            <div className="panel-h"><span className="lbl lbl-i"><Icon name="filter" size={13} /> Provenance</span><span className="lbl">{res.n} match</span></div>
            <div className="panel-b">
              <div className="ledger">
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
            </div>
          </section>

          {/* Query view */}
          <section className="panel">
            <div className="panel-h">
              <span className="lbl lbl-i"><Icon name="hash" size={13} /> Query</span>
              <span className="codetabs">
                <button aria-pressed={tab === "ir"} onClick={() => setTab("ir")}>Recipe</button>
                <button aria-pressed={tab === "sql"} onClick={() => setTab("sql")}>SQL</button>
              </span>
            </div>
            <div className="panel-b">
              {tab === "ir" && <pre><code>{JSON.stringify(res.ir, null, 2)}</code></pre>}
              {tab === "sql" && <pre><code>{res.sql || "—"}</code></pre>}
            </div>
          </section>
        </div>
      )}

      {/* Patient results table */}
      {res && res.answerable && patients.length > 0 && (
        <section className="panel" style={{ marginTop: 18 }}>
          <div className="panel-h">
            <span className="lbl lbl-i"><Icon name="users" size={13} /> Matched patients</span>
            <span className="lbl">{patients.length} shown</span>
          </div>
          <div className="panel-b">
            <div className="tablewrap">
              <table className="gt">
                <thead>
                  <tr>
                    <th>subject_id</th><th>gender</th><th className="num">age</th>
                    <th className="num">ICU stays</th><th className="num">total LOS (d)</th>
                    <th className="num">admissions</th><th>in-hospital death</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((p, i) => (
                    <tr key={i}>
                      <td className="mono">{String(p.subject_id)}</td>
                      <td className="mono">{String(p.gender)}</td>
                      <td className="num mono">{String(p.age)}</td>
                      <td className="num mono">{String(p.icu_stays)}</td>
                      <td className="num mono">{String(p.total_los)}</td>
                      <td className="num mono">{String(p.admissions)}</td>
                      <td>{Number(p.died) === 1
                        ? <span className="pill err"><Icon name="alert" size={10} style={{ verticalAlign: -1 }} /> Died</span>
                        : <span className="pill find"><Icon name="check" size={10} style={{ verticalAlign: -1 }} /> Survived</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {patients.length > 12 && (
              <button className="btn btn-ghost" style={{ marginTop: 10 }} onClick={() => setShowAll((v) => !v)}>
                <Icon name="chevron" size={13} /> {showAll ? "Show fewer" : `Show all ${patients.length}`}
              </button>
            )}
            <p className="note">Patient rows are served to this local interface only; the AI cohort path receives the schema and your description, not raw records.</p>
          </div>
        </section>
      )}
    </>
  );
}
