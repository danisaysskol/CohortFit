"use client";

// A hand-laid ER diagram of the core MIMIC-IV demo relationships. Not exhaustive —
// it shows the spine (patient → admission → ICU stay) and how event/dictionary tables
// hang off it, so a researcher sees the join paths at a glance.

type Box = { id: string; label: string; x: number; y: number; kind: "spine" | "fact" | "dict" };
type Edge = { from: string; to: string };

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
  // vertical (same column) → bottom-center to top-center; else right-center to left-center
  if (Math.abs(a.x - b.x) < 8) {
    return { x1: a.x + W / 2, y1: a.y + H, x2: b.x + W / 2, y2: b.y };
  }
  return { x1: a.x + W, y1: a.y + H / 2, x2: b.x, y2: b.y + H / 2 };
}

export function Erd() {
  return (
    <div className="tablewrap" style={{ padding: 8 }}>
      <svg viewBox="0 0 648 512" width="100%" role="img" aria-label="Entity relationship diagram" style={{ minWidth: 560 }}>
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
          const fill = b.kind === "dict" ? "color-mix(in srgb, var(--accent) 8%, var(--surface))" : "var(--surface)";
          const stroke = b.kind === "spine" ? "var(--accent)" : "var(--line-strong)";
          return (
            <g key={b.id}>
              <rect x={b.x} y={b.y} width={W} height={H} rx={6} fill={fill} stroke={stroke} strokeWidth={b.kind === "spine" ? 1.5 : 1} />
              <text x={b.x + 12} y={b.y + 17} fontFamily="var(--mono)" fontSize={12} fontWeight={600} fill="var(--ink)">{b.label}</text>
              <text x={b.x + 12} y={b.y + 31} fontFamily="var(--mono)" fontSize={8} fill="var(--faint)">
                {b.kind === "dict" ? "dictionary" : b.kind === "spine" ? "spine" : "event"}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
