import clsx from "clsx";
import type { Species } from "@/lib/data";

const RISK_STYLES: Record<Species["riskLevel"], string> = {
  High: "bg-danger-bg text-danger",
  Moderate: "bg-processing-bg text-processing",
  Low: "bg-success-bg text-success",
  // Neutral on purpose: no data is not a finding.
  "Not assessed": "bg-surface-sunken text-text-muted",
};

/** A species' allergenic risk. "Not Assessed" until real data is entered in admin. */
export default function RiskBadge({
  level,
  suffix = true,
  className,
}: {
  level: Species["riskLevel"];
  /** Append "Risk" ("High Risk"); not for "Not assessed". */
  suffix?: boolean;
  className?: string;
}) {
  const label =
    level === "Not assessed" ? "Risk Not Assessed" : suffix ? `${level} Risk` : level;
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded px-2 py-0.5 text-[12px] font-medium whitespace-nowrap",
        RISK_STYLES[level],
        className,
      )}
    >
      {label}
    </span>
  );
}
