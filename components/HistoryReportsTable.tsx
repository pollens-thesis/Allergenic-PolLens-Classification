"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
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

export default function HistoryReportsTable({ data }: { data: HistoryReport[] }) {
  const [query, setQuery] = useState("");
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
          <p className="text-[12.5px] text-ink/50">
            {filtered.length} of {data.length} samples
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative">
            <Search
              size={14}
              strokeWidth={1.75}
              className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink/35"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search sample, location, pollen, date…"
              className="focus-ring w-full rounded-md border border-panel-line bg-white py-1.5 pr-7 pl-8 text-[12.5px] text-ink placeholder:text-ink/35 sm:w-64"
            />
            {query.length > 0 && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="focus-ring absolute top-1/2 right-2 -translate-y-1/2 text-ink/35 hover:text-ink"
              >
                <X size={13} strokeWidth={1.75} />
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1 rounded-md border border-panel-line bg-white p-0.5">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={status === s}
                onClick={() => setStatus(s)}
                className={`focus-ring rounded-[5px] px-2.5 py-1 text-[11.5px] whitespace-nowrap transition ${
                  status === s ? "bg-ink text-parchment" : "text-ink/55 hover:text-ink"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-left text-[13px]">
          <thead>
            <tr
              className="border-b border-panel-line text-[10.5px] tracking-widest text-ink/45 uppercase"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              <th className="py-2 pr-3 font-medium">Sample ID</th>
              <th className="py-2 pr-3 font-medium">Collected</th>
              <th className="py-2 pr-3 font-medium">Location</th>
              <th className="py-2 pr-3 font-medium">Top pollen detected</th>
              <th className="py-2 pr-0 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.sampleId} className="border-b border-panel-line/70 last:border-0 hover:bg-panel/40">
                <td className="py-2.5 pr-3 whitespace-nowrap text-ink/85" style={{ fontFamily: "var(--font-mono)" }}>
                  {r.sampleId}
                </td>
                <CollectedCell collectedAt={r.collectedAt} />
                <td className="py-2.5 pr-3 whitespace-nowrap text-ink/70">{r.location}</td>
                <td className="py-2.5 pr-3 text-ink/85">{r.topPollen}</td>
                <td className="py-2.5 pr-0">
                  <StatusBadge status={r.status} />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-[13px] text-ink/45">
                  No samples match that search.
                  {hasActiveFilters && (
                    <>
                      {" "}
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="focus-ring text-ink/70 underline underline-offset-2 hover:text-ink"
                      >
                        Clear filters
                      </button>
                    </>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}