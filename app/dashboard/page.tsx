import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, ScanLine } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import DashboardStats from "@/components/DashboardStats";
import PollenCountChart from "@/components/PollenCountChart";
import HistoryWorkspace from "@/components/HistoryWorkspace";
import { dashboardStats, historicalPollenCounts } from "@/lib/data";

export default function DashboardPage() {
  return (
    <div className="grid min-h-screen w-full grid-cols-1 bg-panel lg:grid-cols-[15rem_1fr]">
      <Sidebar />

      <main className="min-w-0 px-6 py-8 lg:px-10 lg:py-10">
        {/* Top bar */}
        <div className="mb-6">
          <p
            className="text-[11px] tracking-[0.25em] text-ink/50 uppercase"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Research console
          </p>
          <h1 className="mt-1 text-3xl text-ink" style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}>
            Welcome back, Researcher
          </h1>
        </div>

        {/* Primary action: Start New Analysis */}
        <Link
          href="/upload"
          className="focus-ring group mb-6 flex flex-col gap-4 rounded-lg border border-ink/10 bg-ink px-6 py-5 transition hover:opacity-95 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-pollen/15">
              <ScanLine size={20} strokeWidth={1.75} className="text-pollen" />
            </span>
            <div>
              <div className="text-[15px] font-medium text-parchment">Start new analysis</div>
              <div className="text-[13px] text-parchment/60">
                Upload a microscope image to count and identify the pollen grains it contains
              </div>
            </div>
          </div>
          <span className="flex items-center gap-1.5 self-start rounded-md bg-parchment/10 px-3.5 py-2 text-[13px] text-parchment transition group-hover:bg-parchment/15 sm:self-auto">
            Begin
            <ArrowRight size={14} strokeWidth={1.75} />
          </span>
        </Link>

        {/* Quick stats */}
        <DashboardStats initial={dashboardStats} />

        {/* Historical pollen counts */}
        <div className="mb-6">
          <PollenCountChart data={historicalPollenCounts} />
        </div>

        {/* History reports — same live list as the History page. */}
        <Suspense
          fallback={
            <div className="flex items-center justify-center gap-2 rounded-lg border border-panel-line bg-white/60 px-6 py-16 text-[13px] text-ink/45">
              <Loader2 size={16} strokeWidth={1.75} className="animate-spin" />
              Loading reports…
            </div>
          }
        >
          <HistoryWorkspace />
        </Suspense>
      </main>
    </div>
  );
}
