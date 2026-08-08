"use client";

import { useState } from "react";

// A hand-laid ER diagram of the core MIMIC-IV demo relationships. Not exhaustive —
// it shows the spine (patient → admission → ICU stay) and how event/dictionary tables
// hang off it. Boxes are clickable: click one to see its columns and load it below.

type Box = { id: string; label: string; x: number; y: number; kind: "spine" | "fact" | "dict" };
type Edge = { from: string; to: string; col: string };
export type ColumnInfo = { name: string; type: string };
export type TableKeys = { pk: string[]; fk: { col: string; ref: string }[] };

const VW = 780;
const VH = 640;
const W = 150;
const H = 40;

// Star layout: patients → admissions → icustays down the centre; hospital events fan
// out from admissions, ICU events from icustays, dictionaries at the edges.
const BOXES: Box[] = [
  { id: "patients", label: "patients", x: 315, y: 24, kind: "spine" },
  { id: "admissions", label: "admissions", x: 315, y: 220, kind: "spine" },
  { id: "icustays", label: "icustays", x: 315, y: 416, kind: "spine" },
  // hospital events — left of admissions
  { id: "diagnoses_icd", label: "diagnoses_icd", x: 30, y: 150, kind: "fact" },
  { id: "prescriptions", label: "prescriptions", x: 30, y: 220, kind: "fact" },
  { id: "transfers", label: "transfers", x: 30, y: 290, kind: "fact" },
  // hospital events — right of admissions
  { id: "labevents", label: "labevents", x: 600, y: 150, kind: "fact" },
  { id: "emar", label: "emar", x: 600, y: 220, kind: "fact" },
  { id: "microbiologyevents", label: "microbiologyevents", x: 600, y: 290, kind: "fact" },
  // ICU events — around icustays
  { id: "chartevents", label: "chartevents", x: 30, y: 384, kind: "fact" },
  { id: "inputevents", label: "inputevents", x: 30, y: 454, kind: "fact" },
  { id: "outputevents", label: "outputevents", x: 600, y: 384, kind: "fact" },
  { id: "procedureevents", label: "procedureevents", x: 600, y: 454, kind: "fact" },
  // dictionaries — edges
  { id: "d_icd_diagnoses", label: "d_icd_diagnoses", x: 30, y: 80, kind: "dict" },
  { id: "d_labitems", label: "d_labitems", x: 600, y: 80, kind: "dict" },
  { id: "d_items", label: "d_items", x: 315, y: 566, kind: "dict" },
];

const EDGES: Edge[] = [
  { from: "patients", to: "admissions", col: "subject_id" },
  { from: "admissions", to: "icustays", col: "hadm_id" },
  { from: "admissions", to: "diagnoses_icd", col: "hadm_id" },
  { from: "admissions", to: "prescriptions", col: "hadm_id" },
  { from: "admissions", to: "transfers", col: "hadm_id" },
  { from: "admissions", to: "labevents", col: "hadm_id" },
  { from: "admissions", to: "emar", col: "hadm_id" },
  { from: "admissions", to: "microbiologyevents", col: "hadm_id" },
  { from: "icustays", to: "chartevents", col: "stay_id" },
  { from: "icustays", to: "inputevents", col: "stay_id" },
  { from: "icustays", to: "outputevents", col: "stay_id" },
  { from: "icustays", to: "procedureevents", col: "stay_id" },
  { from: "diagnoses_icd", to: "d_icd_diagnoses", col: "icd_code" },
  { from: "labevents", to: "d_labitems", col: "itemid" },
  { from: "chartevents", to: "d_items", col: "itemid" },
  { from: "inputevents", to: "d_items", col: "itemid" },
  { from: "outputevents", to: "d_items", col: "itemid" },
  { from: "procedureevents", to: "d_items", col: "itemid" },
];

const byId = (id: string) => BOXES.find((b) => b.id === id)!;

// Connect the nearest edges based on the dominant direction between box centres.
function edgePath(a: Box, b: Box) {
  const acx = a.x + W / 2, acy = a.y + H / 2, bcx = b.x + W / 2, bcy = b.y + H / 2;
  const dx = bcx - acx, dy = bcy - acy;
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0
      ? { x1: a.x + W, y1: acy, x2: b.x, y2: bcy }
      : { x1: a.x, y1: acy, x2: b.x + W, y2: bcy };
  }
  return dy > 0
    ? { x1: acx, y1: a.y + H, x2: bcx, y2: b.y }
    : { x1: acx, y1: a.y, x2: bcx, y2: b.y + H };
}

export function Erd({
  columnsByTable = {},
  keysByTable = {},
  onSelect,
  selected,
}: {
  columnsByTable?: Record<string, ColumnInfo[]>;
  keysByTable?: Record<string, TableKeys>;
  onSelect?: (table: string) => void;
  selected?: string | null;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const openBox = open ? byId(open) : null;
  const cols = open ? columnsByTable[open] ?? [] : [];
  const keys = open ? keysByTable[open] ?? { pk: [], fk: [] } : { pk: [], fk: [] };
  const pkSet = new Set(keys.pk);
  const fkMap = new Map(keys.fk.map((f) => [f.col, f.ref]));

  // Popover placed by percentage of the viewBox so it tracks the responsive SVG.
  // Right-half boxes open the popover leftward so it never overflows.
  const onRight = !!openBox && openBox.x + W / 2 > VW / 2;
  const popStyle: React.CSSProperties | undefined = openBox
    ? {
        left: onRight ? `${((openBox.x - 6) / VW) * 100}%` : `${((openBox.x + W + 6) / VW) * 100}%`,
        top: `${(openBox.y / VH) * 100}%`,
        transform: onRight ? "translateX(-100%)" : undefined,
      }
    : undefined;

  return (
    <div className="erd-wrap tablewrap" style={{ position: "relative", padding: 8 }}>
      <svg viewBox={`0 0 ${VW} ${VH}`} width="100%" role="img" aria-label="Entity relationship diagram" style={{ minWidth: 560, display: "block" }}>
        {EDGES.map((e, i) => {
          const p = edgePath(byId(e.from), byId(e.to));
          const mx = (p.x1 + p.x2) / 2;
          const my = (p.y1 + p.y2) / 2;
          return (
            <g key={i}>
              <line x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke="var(--line-strong)" strokeWidth={1} />
              <circle cx={p.x1} cy={p.y1} r={2.5} fill="var(--accent)" />
              <text x={mx} y={my - 8} textAnchor="middle" fontFamily="var(--mono)" fontSize={8.5} fontWeight={600} fill="var(--accent)">{e.col}</text>
              <text x={mx} y={my + 2} textAnchor="middle" fontFamily="var(--mono)" fontSize={7} fill="var(--faint)">1 · ∞</text>
            </g>
          );
        })}
        {BOXES.map((b) => {
          const isSel = selected === b.id || open === b.id;
          const fill = b.kind === "dict" ? "color-mix(in srgb, var(--accent) 8%, var(--surface))" : "var(--surface)";
          const stroke = isSel ? "var(--accent)" : b.kind === "spine" ? "var(--accent)" : "var(--line-strong)";
          return (
            <g key={b.id} style={{ cursor: "pointer" }} role="button" tabIndex={0}
               aria-label={`${b.label} — show columns`}
               onClick={() => { setOpen(open === b.id ? null : b.id); onSelect?.(b.id); }}
               onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { setOpen(open === b.id ? null : b.id); onSelect?.(b.id); } }}>
              <rect x={b.x} y={b.y} width={W} height={H} rx={6} fill={fill} stroke={stroke} strokeWidth={isSel ? 2 : b.kind === "spine" ? 1.5 : 1} />
              <text x={b.x + 12} y={b.y + 17} fontFamily="var(--mono)" fontSize={12} fontWeight={600} fill="var(--ink)">{b.label}</text>
              <text x={b.x + 12} y={b.y + 31} fontFamily="var(--mono)" fontSize={8} fill="var(--faint)">
                {b.kind === "dict" ? "dictionary · click" : b.kind === "spine" ? "spine · click" : "event · click"}
              </text>
            </g>
          );
        })}
      </svg>

      {openBox && (
        <div className="erd-pop" style={popStyle} role="dialog" aria-label={`${openBox.label} columns`}>
          <div className="erd-pop-h">
            <span className="mono">{openBox.label}</span>
            <span className="lbl">{cols.length} cols</span>
            <button className="erd-pop-x" onClick={() => setOpen(null)} aria-label="Close">×</button>
          </div>
          <div className="erd-pop-b">
            {cols.length === 0 && <div className="muted" style={{ fontSize: 12 }}>Loading columns…</div>}
            {cols.map((c) => {
              const isPk = pkSet.has(c.name);
              const ref = fkMap.get(c.name);
              return (
                <div className="erd-col" key={c.name} title={ref ? `foreign key → ${ref}` : isPk ? "primary key" : c.type}>
                  <span>
                    {c.name}
                    {isPk && <span className="keybadge pk">PK</span>}
                    {ref && <span className="keybadge fk">FK</span>}
                  </span>
                  <span className="erd-col-t">{ref ? `→ ${ref.split(".")[0]}` : c.type}</span>
                </div>
              );
            })}
          </div>
          <div className="erd-pop-f lbl">loaded below ↓</div>
        </div>
      )}
    </div>
  );
}
