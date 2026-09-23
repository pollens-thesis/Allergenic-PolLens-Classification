"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import { formatCollectedAt, toReportRow, type Specimen } from "@/lib/data";
import { listReports } from "@/lib/store";
import StatusBadge from "@/components/StatusBadge";

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

  useEffect(() => {
    let cancelled = false;
    listReports().then((all) => {
      if (!cancelled) setReports(all);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg text-text" style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>
          Saved Reports
        </h2>
        <Link
          href="/reports"
          className="focus-ring flex items-center gap-1 rounded text-[13px] text-text-muted transition-colors hover:text-text"
        >
          View All
          <ArrowRight size={13} strokeWidth={1.75} />
        </Link>
      </div>

      {reports === null ? (
        <div className="flex items-center justify-center gap-2 py-10 text-[13px] text-text-muted">
          <Loader2 size={16} strokeWidth={1.75} className="animate-spin" />
          Loading reports…
        </div>
      ) : reports.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-text-muted">
          No reports yet — analyze a specimen to create one.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {reports.slice(0, RECENT_COUNT).map((specimen) => {
            const row = toReportRow(specimen);
            return (
              <li key={row.sampleId}>
                <Link
                  href={`/reports/${row.sampleId}`}
                  className="focus-ring -mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-surface-sunken"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="shrink-0 text-[13px] text-text"
                      style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}
                    >
                      {row.sampleId}
                    </span>
                    <span className="truncate text-[13px] text-text-muted">{row.location}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="hidden text-[12.5px] text-text-faint sm:inline">
                      {formatCollectedAt(row.collectedAt)}
                    </span>
                    <StatusBadge status={row.status} />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
