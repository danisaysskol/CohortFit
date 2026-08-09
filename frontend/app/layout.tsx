import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "./components/Nav";

export const metadata: Metadata = {
  title: "CohortFit — Cohort & Data Quality Explorer",
  description:
    "Plain-English cohorts with visible inclusion/exclusion logic, and a data-fitness scorecard that tells real findings from data errors. Research prototype.",
};

const SAFETY =
  "Not for clinical use. Do not use for diagnosis, treatment, triage, or emergency decisions.";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="wrap">
          <header className="bar">
            <div className="brand">
              <span className="wm">
                Cohort<b>Fit</b>
              </span>
              <span className="tag">MIMIC-IV DEMO v2.2 · 100 PATIENTS</span>
            </div>
            <Nav />
          </header>
          <div className="safety" role="note">
            <span className="tick" aria-hidden="true" />
            <span>
              <span className="k">Research and educational prototype only.</span> {SAFETY}
            </span>
          </div>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
