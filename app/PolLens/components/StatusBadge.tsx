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

/** A report's lifecycle status (Pending → Needs Review → Completed). */
export default function StatusBadge({ status }: { status: ReportStatus }) {
  return (
    <span className={badgeVariants({ status })}>
      {status === "Needs review" ? "Needs Review" : status}
    </span>
  );
}

/**
 * Marks a report whose counts are the server's built-in sample reading (the
 * trained model wasn't deployed when it was analyzed), wherever the report
 * appears — so a sample count is never read as a result.
 */
export function SampleBadge() {
  return (
    <span
      className="inline-flex items-center whitespace-nowrap rounded-sm border border-dotted border-border-strong px-2 py-0.5 text-[12px] font-medium text-text-muted"
      title="Sample detections: the server's built-in example reading, not results"
    >
      Sample
    </span>
  );
}
