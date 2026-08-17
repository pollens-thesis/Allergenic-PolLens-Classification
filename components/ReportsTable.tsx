"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileDown, Loader2, Search, X } from "lucide-react";
import {
  formatCollectedAt,
  formatTime,
  getCollectionDate,
  getCollectionTime,
  toReportRow,
  type ReportStatus,
  type Specimen,
} from "@/lib/data";
import { downloadSelectionReportPdf } from "@/lib/pdf";
import StatusBadge from "@/components/StatusBadge";

const STATUS_FILTERS: (ReportStatus | "All")[] = ["All", "Completed", "Processing", "Needs review"];

const ALL_LOCATIONS = "all";

type Filters = {
  query: string;
  status: ReportStatus | "All";
  location: string;
  /** Inclusive collection-date bounds, "YYYY-MM-DD" or "" for open-ended. */
  from: string;
  to: string;
};

const NO_FILTERS: Filters = {
  query: "",
  status: "All",
  location: ALL_LOCATIONS,
  from: "",
  to: "",
};

const controlClass =
  "focus-ring rounded-md border border-panel-line bg-white px-2 py-1.5 text-[13px] text-ink";

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
      {time && <span className="mt-0.5 block text-[12.5px] text-ink/70">{formatTime(time)}</span>}
    </td>
  );
}

export default function ReportsTable({
  reports,
  highlightId,
  initialQuery = "",
}: {
  reports: Specimen[];
  /** Sample id to flag as just saved, e.g. after redirecting from Analyze. */
  highlightId?: string | null;
  /** Prefills the search box — the Pollen map links here filtered by town. */
  initialQuery?: string;
}) {
  const [filters, setFilters] = useState<Filters>({ ...NO_FILTERS, query: initialQuery });
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [building, setBuilding] = useState(false);
  const router = useRouter();

  const rows = useMemo(() => reports.map(toReportRow), [reports]);
  const bySampleId = useMemo(
    () => new Map(reports.map((report) => [report.sampleId, report])),
    [reports],
  );

  /** Every location that appears in the data, so the filter can only ask for
   *  places that exist rather than offering a dead end. */
  const locations = useMemo(
    () =>
      [...new Set(rows.map((r) => r.location).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    return rows.filter((r) => {
      // ISO dates compare correctly as plain strings, so the range needs no
      // parsing and cannot be shifted by a timezone.
      const date = getCollectionDate(r.collectedAt);
      return (
        (filters.status === "All" || r.status === filters.status) &&
        (filters.location === ALL_LOCATIONS || r.location === filters.location) &&
        (filters.from === "" || date >= filters.from) &&
        (filters.to === "" || date <= filters.to) &&
        (q.length === 0 ||
          r.sampleId.toLowerCase().includes(q) ||
          r.location.toLowerCase().includes(q) ||
          r.topPollen.toLowerCase().includes(q) ||
          formatCollectedAt(r.collectedAt).toLowerCase().includes(q))
      );
    });
  }, [rows, filters]);

  const hasActiveFilters =
    filters.query.trim() !== "" ||
    filters.status !== "All" ||
    filters.location !== ALL_LOCATIONS ||
    filters.from !== "" ||
    filters.to !== "";

  function patch(next: Partial<Filters>) {
    setFilters((current) => ({ ...current, ...next }));
  }

  function clearFilters() {
    setFilters({ ...NO_FILTERS });
  }

  /**
   * The whole row opens the report. The sample id stays a real link — it is
   * what keyboard focus lands on, and what a middle-click or "open in new tab"
   * needs — and the checkbox is for choosing, not opening, so a click that
   * landed on either is left alone.
   */
  function openRow(event: React.MouseEvent<HTMLTableRowElement>, sampleId: string) {
    if (event.target instanceof HTMLElement && event.target.closest("a, input, label")) return;
    router.push(`/reports/${sampleId}`);
  }

  const visibleIds = filtered.map((r) => r.sampleId);
  const pickedVisible = visibleIds.filter((id) => picked.has(id));
  const allVisiblePicked = visibleIds.length > 0 && pickedVisible.length === visibleIds.length;

  function togglePicked(sampleId: string) {
    setPicked((current) => {
      const next = new Set(current);
      if (!next.delete(sampleId)) next.add(sampleId);
      return next;
    });
  }

  /** Select-all applies to what the filters are showing, not the whole table. */
  function toggleAllVisible() {
    setPicked((current) => {
      const next = new Set(current);
      if (allVisiblePicked) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
  }

  /**
   * Build one document from the chosen reports. Selection survives a change of
   * filter — you can search one location, pick from it, search another, and
   * pick more — so the export works from the picked set rather than the rows
   * on screen.
   */
  async function handleGenerate() {
    const chosen = [...picked]
      .map((id) => bySampleId.get(id))
      .filter((report): report is Specimen => report !== undefined)
      .sort((a, b) => b.collectedAt.localeCompare(a.collectedAt));
    if (chosen.length === 0) return;

    setBuilding(true);
    try {
      await downloadSelectionReportPdf({ reports: chosen });
    } finally {
      setBuilding(false);
    }
  }

  return (
    <div className="rounded-lg border border-panel-line bg-white/60 p-5">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg text-ink" style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>
            Saved reports
          </h2>
          <p className="mt-0.5 text-[13px] text-ink/70">
            {filtered.length} of {rows.length} {rows.length === 1 ? "report" : "reports"}
            {picked.size > 0 && ` · ${picked.size} chosen`}
          </p>
        </div>

        <label className="relative sm:w-64">
          <span className="sr-only">Search reports</span>
          <Search
            size={14}
            strokeWidth={1.75}
            className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink/55"
          />
          <input
            type="text"
            value={filters.query}
            onChange={(e) => patch({ query: e.target.value })}
            placeholder="Search sample, location, pollen, date"
            className="focus-ring w-full rounded-md border border-panel-line bg-white py-1.5 pr-3 pl-8 text-[13px] text-ink placeholder:text-ink/70"
          />
        </label>
      </div>

      {/* Filters: status, where, and when. */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex gap-0.5 rounded-md border border-panel-line bg-white p-0.5">
          {STATUS_FILTERS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => patch({ status: option })}
              aria-pressed={filters.status === option}
              className={`focus-ring rounded px-2.5 py-1 text-[13px] transition ${
                filters.status === option ? "bg-ink text-parchment" : "text-ink/70 hover:text-ink"
              }`}
            >
              {option}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-1.5">
          <span className="text-[12.5px] text-ink/70">Location</span>
          <select
            value={filters.location}
            onChange={(e) => patch({ location: e.target.value })}
            className={controlClass}
          >
            <option value={ALL_LOCATIONS}>All locations</option>
            {locations.map((location) => (
              <option key={location} value={location}>
                {location}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1.5">
          <span className="text-[12.5px] text-ink/70">Collected from</span>
          <input
            type="date"
            value={filters.from}
            max={filters.to || undefined}
            onChange={(e) => patch({ from: e.target.value })}
            className={controlClass}
          />
        </label>
        <label className="flex items-center gap-1.5">
          <span className="text-[12.5px] text-ink/70">to</span>
          <input
            type="date"
            value={filters.to}
            min={filters.from || undefined}
            onChange={(e) => patch({ to: e.target.value })}
            className={controlClass}
          />
        </label>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="focus-ring flex items-center gap-1 rounded-md px-2 py-1.5 text-[13px] text-ink/65 transition hover:text-ink"
          >
            <X size={13} strokeWidth={1.75} />
            Clear filters
          </button>
        )}
      </div>

      {/* Only present once something is chosen, so the table is not permanently
          topped by a disabled button. */}
      {picked.size > 0 && (
        <div className="mb-3 flex flex-col gap-2 rounded-md border border-ink/15 bg-panel/60 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] text-ink/80">
            {picked.size} {picked.size === 1 ? "report" : "reports"} chosen
            {pickedVisible.length !== picked.size &&
              ` · ${picked.size - pickedVisible.length} outside the current filters`}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPicked(new Set())}
              className="focus-ring rounded-md px-2 py-1.5 text-[13px] text-ink/65 transition hover:text-ink"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={building}
              className="focus-ring flex items-center justify-center gap-2 rounded-md bg-ink px-3 py-2 text-[13px] font-medium text-parchment transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {building ? (
                <>
                  <Loader2 size={14} strokeWidth={1.75} className="animate-spin" />
                  Building report…
                </>
              ) : (
                <>
                  <FileDown size={14} strokeWidth={1.75} />
                  Generate report
                </>
              )}
            </button>
          </div>
        </div>
      )}

      <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full min-w-[52rem] border-collapse text-left text-[13px]">
          <thead>
            <tr
              className="border-b border-panel-line text-[12px] tracking-widest text-ink/65 uppercase"
              style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}
            >
              <th className="w-8 py-2 pr-2">
                <input
                  type="checkbox"
                  checked={allVisiblePicked}
                  ref={(node) => {
                    // Partially chosen reads as neither on nor off.
                    if (node) {
                      node.indeterminate = pickedVisible.length > 0 && !allVisiblePicked;
                    }
                  }}
                  onChange={toggleAllVisible}
                  disabled={visibleIds.length === 0}
                  aria-label="Choose every report matching the filters"
                  className="focus-ring h-3.5 w-3.5 accent-[#23261f]"
                />
              </th>
              <th className="py-2 pr-3 font-medium">Sample ID</th>
              <th className="py-2 pr-3 font-medium">Collected</th>
              <th className="py-2 pr-3 font-medium">Location</th>
              <th className="py-2 pr-3 font-medium">Top pollen detected</th>
              <th className="py-2 pr-3 font-medium">Total grains</th>
              <th className="py-2 pr-0 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr
                key={r.sampleId}
                onClick={(event) => openRow(event, r.sampleId)}
                className={`group cursor-pointer border-b border-panel-line/70 transition last:border-0 hover:bg-panel/40 ${
                  r.sampleId === highlightId ? "bg-anther/8" : ""
                } ${picked.has(r.sampleId) ? "bg-panel/70" : ""}`}
              >
                <td className="py-2.5 pr-2">
                  <input
                    type="checkbox"
                    checked={picked.has(r.sampleId)}
                    onChange={() => togglePicked(r.sampleId)}
                    aria-label={`Choose report ${r.sampleId}`}
                    className="focus-ring h-3.5 w-3.5 accent-[#23261f]"
                  />
                </td>
                <td className="py-2.5 pr-3 whitespace-nowrap text-ink/85" style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
                  <Link href={`/reports/${r.sampleId}`} className="focus-ring rounded">
                    {r.sampleId}
                  </Link>
                  {r.sampleId === highlightId && (
                    <span className="ml-2 rounded-full bg-anther/15 px-2 py-0.5 text-[11.5px] text-anther-ink">
                      just saved
                    </span>
                  )}
                </td>
                <CollectedCell collectedAt={r.collectedAt} />
                <td className="py-2.5 pr-3 whitespace-nowrap text-ink/70">{r.location}</td>
                <td className="py-2.5 pr-3 text-ink/85">
                  {r.topPollen}
                  {r.slideCount > 1 && (
                    <span className="mt-0.5 block text-[12.5px] text-ink/70">
                      across {r.slideCount} slides
                    </span>
                  )}
                </td>
                <td className="py-2.5 pr-3 whitespace-nowrap text-ink/85" style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
                  {r.totalGrains}
                </td>
                <td className="py-2.5 pr-0">
                  <StatusBadge status={r.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <p className="text-[13px] text-ink/70">
              {hasActiveFilters
                ? "No reports match those filters."
                : "No reports yet — analyze a specimen to create one."}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="focus-ring inline-flex items-center gap-1.5 rounded-md border border-panel-line bg-white px-2.5 py-1.5 text-[13px] text-ink/70 transition hover:text-ink"
              >
                <X size={13} strokeWidth={1.75} />
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {rows.length > 0 && picked.size === 0 && (
        <p className="mt-3 text-[12.5px] text-ink/65">
          Tick the reports you want in a summary PDF, or filter first and use the header checkbox to
          take the whole result.
        </p>
      )}
    </div>
  );
}
