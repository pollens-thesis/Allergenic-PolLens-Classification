import { cva } from "class-variance-authority";
import type { ReportStatus } from "@/lib/data";

const badgeVariants = cva(
  "inline-flex items-center whitespace-nowrap rounded px-2.5 py-1 text-[12px] font-medium",
  {
    variants: {
      status: {
        Pending: "bg-processing-bg text-processing",
        Completed: "bg-success-bg text-success",
        "Needs review": "bg-danger-bg text-danger",
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
