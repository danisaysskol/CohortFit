"use client";

import { Icon, IconName } from "../components/Icon";
import { TimelineEvent } from "../lib/api";

const KIND: Record<string, { icon: IconName; label: string }> = {
  admission: { icon: "database", label: "Admission" },
  discharge: { icon: "arrow", label: "Discharge" },
  death: { icon: "alert", label: "Death" },
  icu_in: { icon: "activity", label: "ICU admission" },
  icu_out: { icon: "activity", label: "ICU discharge" },
  transfer: { icon: "link", label: "Transfer" },
  procedure: { icon: "flask", label: "Procedure" },
};

export function Timeline({ events }: { events: TimelineEvent[] }) {
  return (
    <div className="tl">
      {events.map((e, i) => {
        const k = KIND[e.kind] ?? { icon: "info" as IconName, label: e.kind };
        return (
          <div className="tl-row" key={i}>
            <div className="tl-mark">
              <span className={"tl-dot k-" + e.kind}><Icon name={k.icon} size={11} /></span>
              {i < events.length - 1 && <span className="tl-line" />}
            </div>
            <div className="tl-body">
              <div className="tl-top">
                <span className="tl-label">{e.label}</span>
                <span className="tl-time">{e.time.slice(0, 16).replace("T", " ")}</span>
              </div>
              <span className="tl-src">{e.source.table} · {e.source.id}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
