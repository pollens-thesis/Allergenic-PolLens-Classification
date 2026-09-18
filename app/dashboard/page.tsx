import Link from "next/link";
import { ArrowRight, ScanLine } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import DashboardGreeting from "@/components/DashboardGreeting";
import DashboardStats from "@/components/DashboardStats";
import DashboardRecentReports from "@/components/DashboardRecentReports";
import PollenCountChart from "@/components/PollenCountChart";
import { dashboardStats, historicalPollenCounts } from "@/lib/data";

export default function DashboardPage() {
  return (
    <div className="grid min-h-screen w-full grid-cols-1 bg-bg lg:grid-cols-[15rem_1fr]">
      <Sidebar />

      <main className="min-w-0">
        {/* Sticky, blurred header — this page's content scrolls under it. */}
        <div
          className="sticky top-0 z-10 border-b border-border px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-8"
          style={{
            backdropFilter: "blur(12px)",
            background: "color-mix(in srgb, var(--bg) 85%, transparent)",
          }}
        >
          <DashboardGreeting />
        </div>

        <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
          {/* Primary action: Start New Analysis */}
          <Link
            href="/upload"
            className="focus-ring group mb-6 flex flex-col gap-4 rounded-md border border-border bg-text px-6 py-5 transition-[background-color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:bg-text/85 active:scale-[0.97] active:bg-text/90 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/20">
                <ScanLine size={20} strokeWidth={1.75} className="text-accent" />
              </span>
              <div>
                <div className="text-[15px] font-medium text-bg">Start new analysis</div>
                <div className="text-[13px] text-bg/75">
                  Upload a microscope image to count and identify the pollen grains it contains
                </div>
              </div>
            </div>
            <span className="flex items-center gap-1.5 self-start rounded-md bg-bg/10 px-3.5 py-2 text-[13px] text-bg transition group-hover:bg-bg/15 sm:self-auto">
              Begin
              <ArrowRight size={14} strokeWidth={1.75} />
            </span>
          </Link>

          {/* Quick stats */}
          <DashboardStats initial={dashboardStats} />

          {/* Historical pollen counts */}
          <div className="mb-6">
            <PollenCountChart initial={historicalPollenCounts} />
          </div>

          {/* A quick preview, not the full filterable workspace — see /reports for that. */}
          <DashboardRecentReports />
        </div>
      </main>
    </div>
  );
}
