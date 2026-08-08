"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ActiveCohort, Measurements as MData, readActiveCohort } from "../lib/api";
import { CohortFitness } from "../components/CohortFitness";
import { Measurements } from "../components/Measurements";
import { Icon } from "../components/Icon";

// APPROACH B — one workspace, three lenses on the active cohort.
export default function WorkspacePage() {
  const [cohort, setCohort] = useState<ActiveCohort | null>(null);
  const [tab, setTab] = useState<"fitness" | "measurements">("fitness");
  const [meas, setMeas] = useState<MData | null>(null);

  useEffect(() => { setCohort(readActiveCohort()); }, []);
  useEffect(() => {
    if (cohort && tab === "measurements" && !meas) api.cohortMeasurements(cohort.subject_ids).then(setMeas).catch(() => {});
  }, [cohort, tab, meas]);

  return (
    <>
      <div className="page-h">
        <div>
          <h1>Cohort workspace</h1>
          <p>Build a cohort, then judge its data fitness and explore its measurements — one cohort, three lenses, on a single screen.</p>
        </div>
      </div>

      {!cohort ? (
        <div className="abstain">
          <span className="k">No active cohort</span> — build one first, then return here.
          <div className="note"><Link href="/cohorts" className="kw">Go to the Cohort builder →</Link></div>
        </div>
      ) : (
        <>
          <div className="cohort-banner">
            <Icon name="users" size={18} style={{ color: "var(--accent)" }} />
            <span className="cb-n">{cohort.n}</span>
            <span className="cb-q">“{cohort.text}”</span>
            <span style={{ marginLeft: "auto" }} className="codetabs">
              <button aria-pressed={tab === "fitness"} onClick={() => setTab("fitness")}>Data fitness</button>
              <button aria-pressed={tab === "measurements"} onClick={() => setTab("measurements")}>Measurements</button>
            </span>
          </div>

          {tab === "fitness" && <CohortFitness subjectIds={cohort.subject_ids} />}
          {tab === "measurements" && (meas ? <Measurements data={meas} /> : <div className="loading">Summarising this cohort&rsquo;s measurements…</div>)}
        </>
      )}
    </>
  );
}
