"use client";

import { useEffect, useRef, useState } from "react";
import { LucideIcon } from "lucide-react";
import { animate, useReducedMotion } from "motion/react";

interface StatCardProps {
  label: string;
  value: string;
  sublabel?: string;
  /** Kept for callers; the ruled plate reads without decorative icons. */
  icon?: LucideIcon;
}

export default function StatCard({ label, value, sublabel }: StatCardProps) {
  const [display, setDisplay] = useState(value);
  const prevValue = useRef(value);
  const mounted = useRef(false);
  const reduceMotion = useReducedMotion();

  // Count up between numeric values on change, but never on first mount —
  // an entrance count-up on page load reads as loading jank, not polish.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      prevValue.current = value;
      return;
    }
    if (value === prevValue.current) return;

    const from = parseFloat(prevValue.current);
    const to = parseFloat(value);
    const prefix = value.match(/^\D*/)?.[0] ?? "";
    const suffix = value.match(/\D*$/)?.[0] ?? "";

    if (reduceMotion || Number.isNaN(from) || Number.isNaN(to)) {
      setDisplay(value);
      prevValue.current = value;
      return;
    }

    const controls = animate(from, to, {
      duration: 0.5,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(`${prefix}${Math.round(v)}${suffix}`),
    });
    prevValue.current = value;
    return () => controls.stop();
  }, [value, reduceMotion]);

  return (
    // One cell of a ruled plate (DashboardStats draws the hairlines between cells).
    <div className="bg-surface p-5">
      <span className="caption-label text-[15px]">{label}</span>
      <div className="mt-2 text-4xl text-text lining-nums tabular-nums" style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>
        {display}
      </div>
      {sublabel && <div className="mt-1 text-[13px] text-text-muted">{sublabel}</div>}
    </div>
  );
}
