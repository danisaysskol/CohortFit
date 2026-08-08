"use client";

import { Icon } from "../components/Icon";

export type StepStatus = "pending" | "running" | "done" | "error";
export type Step = { key: string; label: string; status: StepStatus; meta?: string };

function Marker({ status }: { status: StepStatus }) {
  if (status === "done") return <span className="stp-dot done"><Icon name="check" size={11} /></span>;
  if (status === "running") return <span className="stp-dot running"><span className="spin" /></span>;
  if (status === "error") return <span className="stp-dot error"><Icon name="x" size={11} /></span>;
  return <span className="stp-dot pending" />;
}

export function StepTrace({ steps }: { steps: Step[] }) {
  return (
    <div className="steptrace">
      {steps.map((s, i) => (
        <div className={"stp-row " + s.status} key={s.key}>
          <div className="stp-mark">
            <Marker status={s.status} />
            {i < steps.length - 1 && <span className={"stp-line" + (s.status === "done" ? " filled" : "")} />}
          </div>
          <div className="stp-body">
            <span className="stp-label">{s.label}</span>
            {s.meta && <span className="stp-meta">{s.meta}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
