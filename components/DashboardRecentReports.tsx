"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CloudOff, Loader2 } from "lucide-react";
import { formatCollectedAt, toReportRow, type Specimen } from "@/lib/data";
import { listReports } from "@/lib/store";
import StatusBadge, { SampleBadge } from "@/components/StatusBadge";
import { buttonVariants } from "@/components/Button";

const RECENT_COUNT = 5;

/**
 * A condensed preview of the most recent saved reports — not the full
 * filterable workspace /reports already shows. The dashboard used to embed
 * that entire table (search, status/location/date filters, PDF export)
 * under the exact same "Saved reports" heading /reports already has;
 * this replaces it with a quick, scannable list and a link to the real thing.
 */
export default function DashboardRecentReports() {
  const [reports, setReports] = useState<Specimen[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listReports()
      .then((all) => {
        if (!cancelled) setReports(all);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load reports.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="t-plate-title text-text">
          Recent Reports
        </h2>
        <Link
          href="/reports"
          className="focus-ring flex items-center gap-1 rounded text-[13px] text-text-muted transition-colors hover:text-text"
        >
          View All
          <ArrowRight size={13} strokeWidth={1.75} />
        </Link>
      </div>

      {error ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="flex items-center gap-2 text-[14px] text-text-muted">
            <CloudOff size={15} strokeWidth={1.75} className="shrink-0 text-text-faint" />
            {error}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className={`${buttonVariants({ intent: "secondary", size: "sm" })} focus-ring`}
          >
            Try Again
          </button>
        </div>
      ) : reports === null ? (
        <div className="flex items-center justify-center gap-2 py-10 text-[13px] text-text-muted">
          <Loader2 size={16} strokeWidth={1.75} className="animate-spin" />
          Loading reports…
        </div>
      ) : reports.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-[14px] text-text-muted">No reports yet — analyze slides to create one.</p>
          <Link
            href="/upload"
            className={`${buttonVariants({ intent: "accent", size: "sm" })} focus-ring`}
          >
            Analyze Slides
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {reports.slice(0, RECENT_COUNT).map((specimen) => {
            const row = toReportRow(specimen);
            return (
              <li key={row.sampleId}>
                <Link
                  href={`/reports/${row.sampleId}`}
                  className="focus-ring -mx-2 flex items-start justify-between gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-surface-sunken"
                >
                  {/* Two lines, so the place and date stay readable in a narrow column. */}
                  <div className="min-w-0">
                    <span
                      className="block text-[13px] text-text"
                      style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}
                    >
                      {row.sampleId}
                    </span>
                    <span className="mt-0.5 block truncate text-[13px] text-text-muted">
                      {row.location || "No location recorded"}
                      <span className="text-text-faint"> · {formatCollectedAt(row.collectedAt)}</span>
                    </span>
                  </div>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {row.sampleDetections && <SampleBadge />}
                    <StatusBadge status={row.status} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
