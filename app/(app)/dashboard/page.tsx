import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ScanLine } from "lucide-react";
import DashboardGreeting from "@/components/DashboardGreeting";
import DashboardStats from "@/components/DashboardStats";
import DashboardRecentReports from "@/components/DashboardRecentReports";
import PollenCountChart from "@/components/PollenCountChart";
import { PageBody, PageHeader } from "@/components/PageFrame";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardPage() {
  return (
    <>
      <PageHeader title={<DashboardGreeting />} />

      <PageBody className="flex flex-col gap-6">
        {/* Primary action: Start New Analysis */}
        <Link
          href="/upload"
          className="focus-ring group flex flex-col gap-4 rounded-lg border border-border bg-surface px-6 py-5 transition-[border-color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:border-border-strong active:scale-[0.99] sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface-sunken">
              <ScanLine size={20} strokeWidth={1.75} className="text-text" />
            </span>
            <div>
              <div className="t-plate-title text-text">
                Start New Analysis
              </div>
              <div className="text-[13px] text-text-muted">
                Upload one or more slide images to count and identify the pollen grains they contain
              </div>
            </div>
          </div>
          <span className="flex items-center gap-1.5 self-start rounded-md bg-accent px-3.5 py-2 text-[13px] text-accent-fg transition group-hover:bg-[var(--accent-hover)] sm:self-auto">
            Analyze Slides
            <ArrowRight size={14} strokeWidth={1.75} />
          </span>
        </Link>

        {/* Quick stats */}
        <DashboardStats />

        {/* History beside the latest work once there is room for both; the
            chart keeps the wider share because its x-axis needs it. */}
        <div className="grid grid-cols-1 items-start gap-6 2xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <PollenCountChart />
          {/* A quick preview, not the full filterable workspace — see /reports for that. */}
          <DashboardRecentReports />
        </div>
      </PageBody>
    </>
  );
}
