"use client";

import { useState } from "react";

// A hand-laid ER diagram of the core MIMIC-IV demo relationships. Not exhaustive —
// it shows the spine (patient → admission → ICU stay) and how event/dictionary tables
// hang off it. Boxes are clickable: click one to see its columns and load it below.

type Box = { id: string; label: string; x: number; y: number; kind: "spine" | "fact" | "dict" };
type Edge = { from: string; to: string };
export type ColumnInfo = { name: string; type: string };

const VW = 648;
const VH = 512;
const W = 152;
const H = 40;

const BOXES: Box[] = [
  { id: "patients", label: "patients", x: 24, y: 30, kind: "spine" },
  { id: "admissions", label: "admissions", x: 24, y: 130, kind: "spine" },
  { id: "icustays", label: "icustays", x: 24, y: 300, kind: "spine" },
  { id: "diagnoses_icd", label: "diagnoses_icd", x: 250, y: 20, kind: "fact" },
  { id: "labevents", label: "labevents", x: 250, y: 80, kind: "fact" },
  { id: "prescriptions", label: "prescriptions", x: 250, y: 140, kind: "fact" },
  { id: "emar", label: "emar", x: 250, y: 200, kind: "fact" },
  { id: "transfers", label: "transfers", x: 250, y: 260, kind: "fact" },
  { id: "chartevents", label: "chartevents", x: 250, y: 330, kind: "fact" },
  { id: "inputevents", label: "inputevents", x: 250, y: 390, kind: "fact" },
  { id: "outputevents", label: "outputevents", x: 250, y: 450, kind: "fact" },
  { id: "d_icd_diagnoses", label: "d_icd_diagnoses", x: 480, y: 20, kind: "dict" },
  { id: "d_labitems", label: "d_labitems", x: 480, y: 80, kind: "dict" },
  { id: "d_items", label: "d_items", x: 480, y: 360, kind: "dict" },
];

const EDGES: Edge[] = [
  { from: "patients", to: "admissions" },
  { from: "admissions", to: "icustays" },
  { from: "admissions", to: "diagnoses_icd" },
  { from: "admissions", to: "labevents" },
  { from: "admissions", to: "prescriptions" },
  { from: "admissions", to: "emar" },
  { from: "admissions", to: "transfers" },
  { from: "icustays", to: "chartevents" },
  { from: "icustays", to: "inputevents" },
  { from: "icustays", to: "outputevents" },
  { from: "diagnoses_icd", to: "d_icd_diagnoses" },
  { from: "labevents", to: "d_labitems" },
  { from: "chartevents", to: "d_items" },
];

const byId = (id: string) => BOXES.find((b) => b.id === id)!;

function edgePath(a: Box, b: Box) {
  if (Math.abs(a.x - b.x) < 8) return { x1: a.x + W / 2, y1: a.y + H, x2: b.x + W / 2, y2: b.y };
  return { x1: a.x + W, y1: a.y + H / 2, x2: b.x, y2: b.y + H / 2 };
}

export function Erd({
  columnsByTable = {},
  onSelect,
  selected,
}: {
  columnsByTable?: Record<string, ColumnInfo[]>;
  onSelect?: (table: string) => void;
  selected?: string | null;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const openBox = open ? byId(open) : null;
  const cols = open ? columnsByTable[open] ?? [] : [];

  // Popover placed by percentage of the viewBox so it tracks the responsive SVG.
  const popStyle = openBox
    ? {
        left: `${((openBox.x + W + 6) / VW) * 100}%`,
        top: `${(openBox.y / VH) * 100}%`,
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
              <text x={mx} y={my - 3} textAnchor="middle" fontFamily="var(--mono)" fontSize={8} fill="var(--faint)">1 · ∞</text>
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
            {cols.map((c) => (
              <div className="erd-col" key={c.name}>
                <span>{c.name}</span>
                <span className="erd-col-t">{c.type}</span>
              </div>
            ))}
          </div>
          <div className="erd-pop-f lbl">loaded below ↓</div>
        </div>
      )}
    </div>
  );
}
