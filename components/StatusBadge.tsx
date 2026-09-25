import { cva } from "class-variance-authority";
import type { ReportStatus } from "@/lib/data";

// Each status is a stamp with its own pattern as well as its colour, so the
// three read apart in greyscale, in print and for colour-blind readers:
// Pending is a dashed outline (not yet signed off), Completed a solid stamp,
// Needs Review a hatched one.
const badgeVariants = cva(
  "inline-flex items-center whitespace-nowrap rounded-sm border px-2 py-0.5 text-[12px] font-medium",
  {
    variants: {
      status: {
        Pending: "border-dashed border-processing text-processing",
        Completed: "border-success bg-success-bg text-success",
        "Needs review":
          "border-danger text-danger bg-[repeating-linear-gradient(135deg,var(--danger-bg)_0_4px,transparent_4px_8px)]",
      } satisfies Record<ReportStatus, string>,
    },
  },
);

/** A report's lifecycle status (Pending → Completed ⇄ Needs Review). */
export default function StatusBadge({ status }: { status: ReportStatus }) {
  return (
    <span
      className={badgeVariants({ status })}
      style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}
    >
      {status === "Needs review" ? "Needs Review" : status}
    </span>
  );
}
