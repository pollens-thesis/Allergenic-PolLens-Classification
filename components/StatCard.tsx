"use client";

import { useEffect, useRef, useState } from "react";
import { LucideIcon } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import clsx from "clsx";
import { animate, useReducedMotion } from "motion/react";

const iconVariants = cva("shrink-0", {
  variants: {
    variant: {
      default: "text-text-muted",
      accent: "text-accent",
    },
  },
  defaultVariants: { variant: "default" },
});

interface StatCardProps extends VariantProps<typeof iconVariants> {
  label: string;
  value: string;
  sublabel?: string;
  icon: LucideIcon;
}

export default function StatCard({ label, value, sublabel, icon: Icon, variant }: StatCardProps) {
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
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <span className="caption-label text-[15px]">{label}</span>
        <Icon size={16} strokeWidth={1.75} className={clsx(iconVariants({ variant }))} />
      </div>
      <div className="mt-2 text-4xl text-text lining-nums tabular-nums" style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>
        {display}
      </div>
      {sublabel && <div className="mt-1 text-[13px] text-text-muted">{sublabel}</div>}
    </div>
  );
}
