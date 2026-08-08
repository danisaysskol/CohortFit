"use client";

import { Icon, IconName } from "./Icon";

// A compact, single-card narrative strip: Context -> Problem -> Method -> Result.
// It gives a page its story (what this is, why it matters, how it works, what we
// found) in one horizontal band, so judges get the framing without extra scrolling.
export type ExplainItem = { k: string; icon: IconName; t: React.ReactNode };

export function Explain({ items }: { items: ExplainItem[] }) {
  return (
    <section className="panel explain rise-in">
      <div className="explain-grid" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
        {items.map((it, i) => (
          <div className="explain-cell" key={i}>
            <div className="explain-k"><Icon name={it.icon} size={13} /> {it.k}</div>
            <div className="explain-t">{it.t}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
