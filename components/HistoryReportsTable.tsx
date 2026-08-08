"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, X, ChevronRight } from "lucide-react";
import {
  formatCollectedAt,
  formatTime,
  getCollectionDate,
  getCollectionTime,
  type HistoryReport,
  type ReportStatus,
} from "@/lib/data";
import StatusBadge from "@/components/StatusBadge";

const STATUS_FILTERS: (ReportStatus | "All")[] = ["All", "Completed", "Processing", "Needs review"];

function formatDate(collectedAt: string) {
  // Local midnight — a bare "2026-07-29" parses as UTC and renders a day early
  // for anyone west of Greenwich.
  return new Date(`${getCollectionDate(collectedAt)}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Collection date, with the recorded time on a quieter second line. */
function CollectedCell({ collectedAt }: { collectedAt: string }) {
  const time = getCollectionTime(collectedAt);
  return (
    <td className="py-2.5 pr-3 whitespace-nowrap text-ink/70">
      {formatDate(collectedAt)}
      {time && <span className="mt-0.5 block text-[11.5px] text-ink/40">{formatTime(time)}</span>}
    </td>
  );
}

export default function HistoryReportsTable({
  data,
  highlightId,
  initialQuery = "",
}: {
  data: HistoryReport[];
  /** Sample id to flag as just saved, e.g. after redirecting from Analyze. */
  highlightId?: string | null;
  /** Prefills the search box — the Pollen map links here filtered by town. */
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState<ReportStatus | "All">("All");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.filter((r) => {
      const matchesStatus = status === "All" || r.status === status;
      const matchesQuery =
        q.length === 0 ||
        r.sampleId.toLowerCase().includes(q) ||
        r.location.toLowerCase().includes(q) ||
        r.topPollen.toLowerCase().includes(q) ||
        formatCollectedAt(r.collectedAt).toLowerCase().includes(q);
      return matchesStatus && matchesQuery;
    });
  }, [data, query, status]);

  const hasActiveFilters = query.trim().length > 0 || status !== "All";

  function clearFilters() {
    setQuery("");
    setStatus("All");
  }

  return (
    <div className="rounded-lg border border-panel-line bg-white/60 p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg text-ink" style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}>
            History reports
          </h2>
          <p className="mt-0.5 text-[12.5px] text-ink/50">
            {filtered.length} of {data.length} {data.length === 1 ? "report" : "reports"}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="relative">
            <Search
              size={14}
              strokeWidth={1.75}
              className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink/35"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search sample, location, pollen, date"
              className="focus-ring w-full rounded-md border border-panel-line bg-white py-1.5 pr-3 pl-8 text-[13px] text-ink placeholder:text-ink/35 sm:w-64"
            />
          </label>

          <div className="flex gap-0.5 rounded-md border border-panel-line bg-white p-0.5">
            {STATUS_FILTERS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setStatus(option)}
                className={`focus-ring rounded px-2.5 py-1 text-[12px] transition ${
                  status === option ? "bg-ink text-parchment" : "text-ink/55 hover:text-ink"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full min-w-[52rem] border-collapse text-left text-[13px]">
          <thead>
            <tr
              className="border-b border-panel-line text-[11px] tracking-widest text-ink/45 uppercase"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              <th className="py-2 pr-3 font-medium">Sample ID</th>
              <th className="py-2 pr-3 font-medium">Collected</th>
              <th className="py-2 pr-3 font-medium">Location</th>
              <th className="py-2 pr-3 font-medium">Top pollen detected</th>
              <th className="py-2 pr-3 font-medium">Total grains</th>
              <th className="py-2 pr-3 font-medium">Status</th>
              <th className="py-2 pr-0 font-medium sr-only">Open</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr
                key={r.sampleId}
                className={`group border-b border-panel-line/70 transition last:border-0 hover:bg-panel/40 ${
                  r.sampleId === highlightId ? "bg-anther/8" : ""
                }`}
              >
                <td className="py-2.5 pr-3 whitespace-nowrap text-ink/85" style={{ fontFamily: "var(--font-mono)" }}>
                  <Link href={`/history/${r.sampleId}`} className="focus-ring rounded hover:underline">
                    {r.sampleId}
                  </Link>
                  {r.sampleId === highlightId && (
                    <span className="ml-2 rounded-full bg-anther/15 px-2 py-0.5 text-[10px] text-anther">
                      just saved
                    </span>
                  )}
                </td>
                <CollectedCell collectedAt={r.collectedAt} />
                <td className="py-2.5 pr-3 whitespace-nowrap text-ink/70">{r.location}</td>
                <td className="py-2.5 pr-3 text-ink/85">
                  {r.topPollen}
                  {r.slideCount > 1 && (
                    <span className="mt-0.5 block text-[11.5px] text-ink/40">
                      across {r.slideCount} slides
                    </span>
                  )}
                </td>
                <td className="py-2.5 pr-3 whitespace-nowrap text-ink/85" style={{ fontFamily: "var(--font-mono)" }}>
                  {r.totalGrains}
                </td>
                <td className="py-2.5 pr-3">
                  <StatusBadge status={r.status} />
                </td>
                <td className="py-2.5 pr-0 text-right">
                  <Link
                    href={`/history/${r.sampleId}`}
                    aria-label={`Open full report ${r.sampleId}`}
                    className="focus-ring inline-flex items-center gap-1 rounded px-1.5 py-1 text-[12px] text-ink/45 transition group-hover:text-ink"
                  >
                    View
                    <ChevronRight size={13} strokeWidth={1.75} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <p className="text-[13px] text-ink/50">
              {hasActiveFilters
                ? "No reports match those filters."
                : "No reports yet — analyze a specimen to create one."}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="focus-ring inline-flex items-center gap-1.5 rounded-md border border-panel-line bg-white px-2.5 py-1.5 text-[12px] text-ink/70 transition hover:text-ink"
              >
                <X size={13} strokeWidth={1.75} />
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
