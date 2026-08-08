"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api, streamCohort, CohortResult, PatientTimeline, FunnelStep, Measurements as MData } from "../lib/api";
import { Icon, IconName } from "../components/Icon";
import { CohortFitness } from "../components/CohortFitness";
import { Measurements } from "../components/Measurements";
import { StepTrace, Step } from "./StepTrace";
import { Timeline } from "./Timeline";

const EXAMPLES: { t: string; neg?: boolean }[] = [
  { t: "ICU patients over 65 who died in hospital" },
  { t: "patients with a diabetes diagnosis" },
  { t: "ICU patients not on antibiotics" },
  { t: "which patients were admitted in winter", neg: true },
  { t: "show me the sick patients", neg: true },
  { t: "which patient is most likely to die next", neg: true },
];

const PLAN: Step[] = [
  { key: "understand", label: "Reading your request", status: "pending" },
  { key: "criteria", label: "Identifying criteria", status: "pending" },
  { key: "validate", label: "Checking against the schema", status: "pending" },
  { key: "run", label: "Running the query", status: "pending" },
  { key: "patients", label: "Loading matched patients", status: "pending" },
];
const STORE_KEY = "cohortfit:last-cohort";

type Lens = "patients" | "query" | "fitness" | "measurements";
const LENSES: { k: Lens; label: string; icon: IconName }[] = [
  { k: "patients", label: "Patients", icon: "users" },
  { k: "query", label: "Query", icon: "hash" },
  { k: "fitness", label: "Data fitness", icon: "shield" },
  { k: "measurements", label: "Measurements", icon: "activity" },
];

export default function CohortsPage() {
  const [text, setText] = useState(EXAMPLES[0].t);
  const [res, setRes] = useState<CohortResult | null>(null);
  const [steps, setSteps] = useState<Step[]>(PLAN);
  const [live, setLive] = useState<FunnelStep[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [lens, setLens] = useState<Lens>("patients");
  const [qsub, setQsub] = useState<"ir" | "sql">("ir");
  const [meas, setMeas] = useState<MData | null>(null);
  const [tl, setTl] = useState<PatientTimeline | null>(null);
  const [tlLoading, setTlLoading] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const tlRef = useRef<HTMLElement>(null);

  const sids = useMemo(() => (res?.subject_ids ?? []).map(Number), [res]);

  function openTimeline(id: string) {
    setTlLoading(id); setTl(null);
    api.patientTimeline(id).then(setTl).catch(() => {}).finally(() => setTlLoading(null));
  }

  useEffect(() => { if (tl) tlRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [tl]);

  // Load the cohort's measurements lazily, the first time that lens is opened.
  useEffect(() => {
    if (lens === "measurements" && res?.answerable && sids.length && !meas) {
      api.cohortMeasurements(sids).then(setMeas).catch(() => {});
    }
  }, [lens, res, sids, meas]);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
    try {
      const saved = localStorage.getItem(STORE_KEY);
      if (saved) {
        const { text: t, res: r } = JSON.parse(saved);
        if (t) setText(t);
        if (r) { setRes(r); setLive(r.funnel ?? []); setSteps(PLAN.map((s) => ({ ...s, status: "done" }))); }
      }
    } catch { /* ignore */ }
  }, []);

  function setStep(key: string, status: Step["status"], meta?: string) {
    setSteps((prev) => prev.map((s) => (s.key === key ? { ...s, status, meta: meta ?? s.meta } : s)));
  }

  async function build(q?: string) {
    const query = (q ?? text).trim();
    if (!query || loading) return;   // never submit an empty request
    if (query !== text) setText(query);
    setLoading(true); setErr(null); setRes(null); setShowAll(false); setTl(null); setMeas(null); setLens("patients");
    setLive([]);
    setSteps(PLAN.map((s, i) => ({ ...s, status: i === 0 ? "running" : "pending", meta: undefined })));
    try {
      await streamCohort(query, (ev) => {
        switch (ev.step) {
          case "understand": setStep("understand", "running"); break;
          case "criteria":
            setStep("understand", "done");
            setStep("criteria", "done", (ev.criteria as string[]).join(" · "));
            setStep("validate", "running");
            break;
          case "validate": setStep("validate", "done"); setStep("run", "running"); break;
          case "funnel": {
            const f = ev.funnel as NonNullable<CohortResult["funnel"]>[number];
            setLive((prev) => [...prev, f]);
            setStep("run", "running", `${f.remaining} remaining`);
            break;
          }
          case "patients":
            setStep("run", "done");
            setStep("patients", "done", `${ev.count as number} patients`);
            break;
          case "decision":
            setSteps((prev) => prev.map((s) => (s.status === "running" ? { ...s, status: "done" } : s)));
            break;
          case "done": {
            const r = ev.result as CohortResult;
            setSteps((prev) => prev.map((s) => (s.status !== "error" ? { ...s, status: "done" } : s)));
            setRes(r); setLive(r.funnel ?? []); setLoading(false);
            try { localStorage.setItem(STORE_KEY, JSON.stringify({ text: query, res: r })); } catch { /* ignore */ }
            break;
          }
        }
      });
    } catch (e) {
      setErr(String(e)); setLoading(false);
      setSteps((prev) => prev.map((s) => (s.status === "running" ? { ...s, status: "error" } : s)));
    }
  }

  function exportRecipe() {
    if (!res) return;
    const recipe = {
      tool: "CohortFit", dataset: "MIMIC-IV Clinical Database Demo v2.2",
      description: text, method: res.method, disposition: res.disposition,
      n_matched: res.n, subject_ids: res.subject_ids, ir: res.ir, sql: res.sql,
      note: "Reproducible cohort recipe. Re-running this IR (or the SQL) on the frozen demo reproduces the same subject_id set. The model never wrote the SQL — a deterministic compiler did.",
    };
    const blob = new Blob([JSON.stringify(recipe, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `cohort-${res.n}-patients.json`; a.click();
    URL.revokeObjectURL(url);
  }

  const patients = (res?.patients ?? []) as Record<string, unknown>[];
  const shown = showAll ? patients : patients.slice(0, 10);
  const funnel = live.length ? live : res?.funnel ?? [];
  const dispLabel = res && !res.answerable
    ? (({ refuse: "Request declined", clarify: "Needs clarification", abstain: "Cannot answer" } as Record<string, string>)[res.disposition ?? "abstain"] ?? "Cannot answer")
    : "";

  return (
    <>
      <div className="page-h" style={{ marginBottom: 10 }}>
        <div>
          <h1>Cohort workspace</h1>
          <p>Describe a patient group in plain words, then work with it in one place — who is in and out, the query behind it, whether its data are fit, and its measurements. Edit and rebuild any time without leaving.</p>
        </div>
      </div>

      {/* Sticky editable cohort bar */}
      <div className="ask-sticky">
        <div className="hero-ask">
          <label className="field hero-field">
            <Icon name="search" size={17} style={{ color: "var(--accent)", flex: "0 0 auto" }} />
            <input ref={inputRef} value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") build(); }}
              placeholder="e.g. ICU patients over 65 who died in hospital"
              maxLength={300}
              aria-label="Describe the cohort in plain words" />
          </label>
          <button className="btn hero-btn" onClick={() => build()} disabled={loading || !text.trim()}
            title={!text.trim() ? "Describe a patient group first" : ""}>
            {loading ? <span className="spin" /> : <Icon name="play" size={14} />}
            {loading ? "Building" : res ? "Update cohort" : "Build cohort"}
          </button>
        </div>
        <div className="chips" style={{ marginTop: 8 }}>
          {EXAMPLES.map((ex) => (
            <button key={ex.t} className={"chip chip-btn" + (ex.neg ? " chip-neg" : "")} onClick={() => build(ex.t)} disabled={loading}>
              {ex.neg && <Icon name="shield" size={10} style={{ verticalAlign: -1, marginRight: 3 }} />}{ex.t}
            </button>
          ))}
          {res?.method && <span className="chip" style={{ marginLeft: "auto" }} title={res.method === "openai" ? "Interpreted by the language model into a validated recipe" : "Interpreted offline by the keyword parser"}><Icon name="spark" size={11} style={{ color: "var(--accent)" }} /> {res.method === "openai" ? "GPT-5.6" : "offline parser"}</span>}
        </div>
      </div>

      {err && <div className="abstain" style={{ marginTop: 14 }}><span className="k">Connection error</span> — {err}. Confirm the backend is running on port 8000.</div>}

      {/* Live build trace (only while building) */}
      {loading && (
        <div className="grid2" style={{ marginTop: 16, gridTemplateColumns: "300px 1fr" }}>
          <section className="panel">
            <div className="panel-h"><span className="lbl lbl-i"><Icon name="activity" size={13} /> Live steps</span></div>
            <div className="panel-b"><StepTrace steps={steps} /></div>
          </section>
          <section className="panel">
            <div className="panel-h"><span className="lbl lbl-i"><Icon name="filter" size={13} /> Inclusion &amp; exclusion</span></div>
            <div className="panel-b">
              {funnel.length > 0 ? <Funnel funnel={funnel} done={false} /> : <div className="loading">Waiting for the first step…</div>}
            </div>
          </section>
        </div>
      )}

      {res && !res.answerable && (
        <div className="abstain" style={{ marginTop: 14 }}>
          <span className="k">{dispLabel}</span> — {res.abstain_reason}
          <div className="note">When a request is out of scope, ambiguous, or unsupported, CohortFit says so and explains why, rather than returning an answer the data cannot support.</div>
        </div>
      )}

      {/* One cohort, four lenses */}
      {res && res.answerable && (
        <>
          <div className="lens-bar rise-in">
            <span className="codetabs">
              {LENSES.map((l) => (
                <button key={l.k} aria-pressed={lens === l.k} onClick={() => setLens(l.k)}>
                  <Icon name={l.icon} size={12} style={{ verticalAlign: -1, marginRight: 5 }} />{l.label}
                </button>
              ))}
            </span>
            <span className="lbl"><b style={{ color: "var(--accent)", fontSize: 13 }}>{res.n}</b> patients matched</span>
          </div>

          {lens === "patients" && (
            <section className="panel">
              <div className="panel-h"><span className="lbl lbl-i"><Icon name="users" size={13} /> Matched patients</span><span className="lbl">select a row for its timeline</span></div>
              <div className="panel-b">
                <div className="tablewrap" style={{ maxHeight: 440, overflowY: "auto" }}>
                  <table className="gt">
                    <thead><tr><th>subject_id</th><th>sex</th><th className="num">age</th><th className="num">ICU stays</th><th className="num">days in ICU</th><th className="num">admissions</th><th>outcome</th><th></th></tr></thead>
                    <tbody>
                      {shown.map((p, i) => {
                        const active = tl?.subject_id === Number(p.subject_id);
                        return (
                          <tr key={i} className={"row-click" + (active ? " row-on" : "")} onClick={() => openTimeline(String(p.subject_id))} title="View patient timeline">
                            <td className="mono">
                              {tlLoading === String(p.subject_id) ? <span className="spin" style={{ verticalAlign: -1 }} /> : <Icon name="activity" size={11} style={{ color: "var(--accent)", verticalAlign: -1, marginRight: 5 }} />}
                              {String(p.subject_id)}
                            </td>
                            <td className="mono">{String(p.gender)}</td>
                            <td className="num mono">{String(p.age)}</td>
                            <td className="num mono">{String(p.icu_stays)}</td>
                            <td className="num mono">{String(p.total_los)}</td>
                            <td className="num mono">{String(p.admissions)}</td>
                            <td>{Number(p.died) === 1
                              ? <span className="pill err"><Icon name="alert" size={10} style={{ verticalAlign: -1 }} /> Died in hospital</span>
                              : <span className="pill find"><Icon name="check" size={10} style={{ verticalAlign: -1 }} /> Survived</span>}</td>
                            <td><span className="rowcta">{active ? "Viewing" : "Timeline"} <Icon name="arrow" size={11} /></span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {patients.length > 10 && (
                  <button className="btn btn-ghost" style={{ marginTop: 10 }} onClick={() => setShowAll((v) => !v)}>
                    <Icon name="chevron" size={13} /> {showAll ? "Show fewer" : `Show all ${patients.length}`}
                  </button>
                )}
              </div>
            </section>
          )}

          {lens === "query" && (
            <section className="panel">
              <div className="panel-h">
                <span className="lbl lbl-i"><Icon name="filter" size={13} /> Inclusion &amp; exclusion</span>
                <button className="btn btn-ghost btn-sm" onClick={exportRecipe}><Icon name="arrow" size={12} /> Export recipe</button>
              </div>
              <div className="panel-b">
                <Funnel funnel={funnel} done={true} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, marginBottom: 10 }}>
                  <span className="codetabs">
                    <button aria-pressed={qsub === "ir"} onClick={() => setQsub("ir")}>Recipe (IR)</button>
                    <button aria-pressed={qsub === "sql"} onClick={() => setQsub("sql")}>SQL</button>
                  </span>
                </div>
                <div style={{ maxHeight: 420, overflow: "auto" }}>
                  <pre><code>{qsub === "ir" ? JSON.stringify(res.ir, null, 2) : res.sql || "—"}</code></pre>
                </div>
                <p className="note">The model proposes a structured recipe from the schema and your words; a deterministic compiler turns it into the SQL. The model never writes executable SQL. <b>Export recipe</b> saves the IR + SQL + the exact subject_ids so the cohort is reproducible.</p>
              </div>
            </section>
          )}

          {lens === "fitness" && <CohortFitness subjectIds={sids} />}

          {lens === "measurements" && (meas ? <Measurements data={meas} /> : <div className="loading">Summarising this cohort&rsquo;s measurements…</div>)}
        </>
      )}

      {tl && (
        <section className="panel panel-pop" ref={tlRef} style={{ marginTop: 16 }}>
          <div className="panel-h">
            <span className="lbl lbl-i"><Icon name="activity" size={13} /> Patient timeline · <span className="mono" style={{ textTransform: "none" }}>{tl.subject_id}</span></span>
            <button className="btn btn-ghost" onClick={() => setTl(null)}><Icon name="x" size={12} /> Close</button>
          </div>
          <div className="panel-b">
            <div className="chips" style={{ marginTop: 0, marginBottom: 10 }}>
              <span className="chip"><b>{tl.gender}</b> · age {tl.age}</span>
              <span className="chip">{tl.labs.toLocaleString()} labs</span>
              <span className="chip">{tl.meds} medications</span>
              <span className="chip">{tl.events.length} events</span>
            </div>
            {tl.diagnoses.length > 0 && (
              <div className="chips" style={{ marginTop: 0, marginBottom: 12 }}>
                {tl.diagnoses.slice(0, 8).map((d, i) => <span key={i} className="chip" style={{ textTransform: "none" }}>{d}</span>)}
              </div>
            )}
            <div style={{ maxHeight: 440, overflow: "auto", paddingRight: 6 }}>
              <Timeline events={tl.events} />
            </div>
            <p className="note">Dates in MIMIC-IV are shifted, so the calendar is not real — but the order of a patient&rsquo;s events is. Each event links to its source table and id.</p>
          </div>
        </section>
      )}
    </>
  );
}

function Funnel({ funnel, done }: { funnel: FunnelStep[]; done: boolean }) {
  return (
    <div className="ledger">
      <div className="lh"><span>Criterion</span><span>Source</span><span>Remaining</span><span>Δ</span></div>
      {funnel.map((s, i) => (
        <div className={done && i === funnel.length - 1 ? "lr total" : "lr"} key={i}>
          <span className="crit">{s.criterion}</span>
          <span className="src">{s.source}</span>
          <span className="n">{s.remaining}</span>
          <span className={"d" + (s.delta ? "" : " zero")}>{s.delta == null ? "—" : s.delta === 0 ? "0" : s.delta}</span>
        </div>
      ))}
    </div>
  );
}
