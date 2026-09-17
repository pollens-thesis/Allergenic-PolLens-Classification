import { cva } from "class-variance-authority";
import type { ReportStatus } from "@/lib/data";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-medium",
  {
    variants: {
      status: {
        Completed: "bg-success-bg text-success",
        Processing: "bg-processing-bg text-processing",
        "Needs review": "bg-danger-bg text-danger",
      } as Record<ReportStatus, string>,
    },
  },
);

export default function StatusBadge({ status }: { status: ReportStatus }) {
  return (
    <span
      className={badgeVariants({ status })}
      style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}
    >
      {status}
    </span>
  );
}
