"use client";

import { useEffect, useRef } from "react";
import { Icon } from "./Icon";

// A modal side drawer: overlays the page (so results no longer push content or need a
// scroll-into-view), traps focus while open, closes on Escape or a scrim click, and
// returns focus to the trigger on close. role="dialog" + aria-modal for assistive tech.
export function Drawer({ title, onClose, children, wide }:
  { title: React.ReactNode; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    returnTo.current = (document.activeElement as HTMLElement) ?? null;
    const panel = ref.current;
    const focusables = () => panel
      ? Array.from(panel.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])'))
        .filter((el) => el.offsetParent !== null)
      : [];
    const t = setTimeout(() => focusables()[0]?.focus(), 0);

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
      if (e.key !== "Tab") return;
      const f = focusables();
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKey, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";   // no background scroll while modal
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prevOverflow;
      returnTo.current?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="drawer-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={"drawer" + (wide ? " drawer-wide" : "")} ref={ref}
        role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : "Panel"}>
        <div className="drawer-h">
          <span className="lbl lbl-i">{title}</span>
          <button className="btn btn-ghost" onClick={onClose}><Icon name="x" size={12} /> Close</button>
        </div>
        <div className="drawer-b">{children}</div>
      </div>
    </div>
  );
}
