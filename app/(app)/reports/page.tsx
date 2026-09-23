import type { Metadata } from "next";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import ReportsWorkspace from "@/components/ReportsWorkspace";

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
    <div className="grid min-h-screen w-full grid-cols-1 bg-bg lg:grid-cols-[15rem_1fr]">
      <Sidebar />

      <main className="min-w-0 px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
        <div className="sticky top-0 z-10 -mx-4 mb-6 border-b border-border px-4 py-4 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10" style={{ background: "color-mix(in srgb, var(--bg) 85%, transparent)" }}>
          <h1 className="text-3xl text-text" style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>
            Reports
          </h1>
          <p className="mt-1 max-w-prose text-sm text-text-muted">
            Every saved analysis. Open a report for its images, full results, notes and conditions.
          </p>
        </div>

        {/* ReportsWorkspace reads ?saved= via useSearchParams, which opts the
            subtree into client-side rendering — hence the boundary. */}
        <Suspense fallback={<ReportsFallback />}>
          <ReportsWorkspace />
        </Suspense>
      </main>
    </div>
  );
}
