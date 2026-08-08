import type { ReportStatus } from "@/lib/data";

const STYLES: Record<ReportStatus, string> = {
  Completed: "bg-leaf-ink/10 text-leaf-ink",
  Processing: "bg-anther/10 text-anther-ink",
  "Needs review": "bg-ember-ink/10 text-ember-ink",
};

export default function StatusBadge({ status }: { status: ReportStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-medium ${STYLES[status]}`}
      style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}
    >
      {status}
    </span>
  );
}
