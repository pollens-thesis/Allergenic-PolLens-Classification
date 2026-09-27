import type { Metadata } from "next";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import ReportsWorkspace from "@/components/ReportsWorkspace";
import { PageBody, PageHeader } from "@/components/PageFrame";

export const metadata: Metadata = {
  title: "Reports",
};

function ReportsFallback() {
  return (
    <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-6 py-16 text-[13px] text-text-muted">
      <Loader2 size={16} strokeWidth={1.75} className="animate-spin" />
      Loading reports…
    </div>
  );
}

export default function ReportsPage() {
  return (
    <>
      <PageHeader title="Reports" />
      <PageBody>
        {/* ReportsWorkspace reads ?saved= via useSearchParams, which opts the
            subtree into client-side rendering — hence the boundary. */}
        <Suspense fallback={<ReportsFallback />}>
          <ReportsWorkspace />
        </Suspense>
      </PageBody>
    </>
  );
}
