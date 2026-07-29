import type { ReportStatus } from "@/lib/data";

const STYLES: Record<ReportStatus, string> = {
  Completed: "bg-[#3f7a4f]/10 text-[#3f7a4f]",
  Processing: "bg-anther/10 text-anther",
  "Needs review": "bg-[#b3492f]/10 text-[#b3492f]",
};

export default function StatusBadge({ status }: { status: ReportStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${STYLES[status]}`}
      style={{ fontFamily: "var(--font-mono)" }}
    >
      {status}
    </span>
  );
}
