import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import HistoryWorkspace from "@/components/HistoryWorkspace";

function HistoryFallback() {
  return (
    <div className="flex items-center justify-center gap-2 rounded-lg border border-panel-line bg-white/60 px-6 py-16 text-[13px] text-ink/65">
      <Loader2 size={16} strokeWidth={1.75} className="animate-spin" />
      Loading reports…
    </div>
  );
}

export default function HistoryPage() {
  return (
    <div className="grid min-h-screen w-full grid-cols-1 bg-panel lg:grid-cols-[15rem_1fr]">
      <Sidebar />

      <main className="min-w-0 px-6 py-8 lg:px-10 lg:py-10">
        <div className="mb-6">
          <p
            className="text-[12px] tracking-[0.25em] text-ink/70 uppercase"
            style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}
          >
            Research console
          </p>
          <h1 className="mt-1 text-3xl text-ink" style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>
            History reports
          </h1>
          <p className="mt-1 text-sm text-ink/70">
            Every saved analysis. Open a report for its images, full results, notes and conditions.
          </p>
        </div>

        {/* HistoryWorkspace reads ?saved= via useSearchParams, which opts the
            subtree into client-side rendering — hence the boundary. */}
        <Suspense fallback={<HistoryFallback />}>
          <HistoryWorkspace />
        </Suspense>
      </main>
    </div>
  );
}
