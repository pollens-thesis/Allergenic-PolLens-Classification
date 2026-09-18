"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import clsx from "clsx";
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
import { Button } from "@/components/Button";

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
  "focus-ring rounded-md border border-border bg-surface px-2 py-1.5 text-[13px] text-text";

const rowTransition = { duration: 0.18, ease: [0.16, 1, 0.3, 1] as const };

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
    <td className="py-2.5 pr-3 whitespace-nowrap text-text-muted">
      {formatDate(collectedAt)}
      {time && <span className="mt-0.5 block text-[12.5px] text-text-muted">{formatTime(time)}</span>}
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
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg text-text" style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>
            Saved reports
          </h2>
          <p className="mt-0.5 text-[13px] text-text-muted">
            {filtered.length} of {rows.length} {rows.length === 1 ? "report" : "reports"}
            {picked.size > 0 && ` · ${picked.size} chosen`}
          </p>
        </div>

        <label className="relative sm:w-64">
          <span className="sr-only">Search reports</span>
          <Search
            size={14}
            strokeWidth={1.75}
            className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-text-faint"
          />
          <input
            type="text"
            value={filters.query}
            onChange={(e) => patch({ query: e.target.value })}
            placeholder="Search sample, location, pollen, date"
            className="focus-ring w-full rounded-md border border-border bg-surface py-1.5 pr-3 pl-8 text-[13px] text-text placeholder:text-text-faint"
          />
        </label>
      </div>

      {/* Filters: status, where, and when. Stacked on a phone, one row from md
          up — the status chips scroll sideways rather than wrapping into a
          two-line block that shifts everything below it. */}
      <div className="mb-3 flex flex-col gap-2 md:flex-row md:flex-wrap md:items-end">
        <div className="-mx-1 overflow-x-auto px-1 pb-0.5">
          <div className="flex w-max gap-0.5 rounded-md border border-border bg-surface p-0.5">
            {STATUS_FILTERS.map((option) => {
              const active = filters.status === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => patch({ status: option })}
                  aria-pressed={active}
                  className={clsx(
                    "focus-ring relative rounded px-2 py-1.5 text-[12.5px] whitespace-nowrap sm:px-2.5 sm:text-[13px]",
                    active ? "text-bg" : "text-text-muted transition-colors hover:text-text",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="status-filter-pill"
                      className="absolute inset-0 rounded bg-text"
                      transition={{ type: "spring", stiffness: 500, damping: 40 }}
                    />
                  )}
                  <span className="relative z-10">{option}</span>
                </button>
              );
            })}
          </div>
        </div>

        <label className="flex flex-col gap-1 md:flex-row md:items-center md:gap-1.5">
          <span className="text-[12.5px] text-text-muted">Location</span>
          <select
            value={filters.location}
            onChange={(e) => patch({ location: e.target.value })}
            className={`${controlClass} w-full md:w-auto`}
          >
            <option value={ALL_LOCATIONS}>All locations</option>
            {locations.map((location) => (
              <option key={location} value={location}>
                {location}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-2 md:flex md:items-end md:gap-2">
          <label className="flex flex-col gap-1 md:flex-row md:items-center md:gap-1.5">
            <span className="text-[12.5px] whitespace-nowrap text-text-muted">Collected from</span>
            <input
              type="date"
              value={filters.from}
              max={filters.to || undefined}
              onChange={(e) => patch({ from: e.target.value })}
              className={`${controlClass} w-full md:w-auto`}
            />
          </label>
          <label className="flex flex-col gap-1 md:flex-row md:items-center md:gap-1.5">
            <span className="text-[12.5px] text-text-muted">to</span>
            <input
              type="date"
              value={filters.to}
              min={filters.from || undefined}
              onChange={(e) => patch({ to: e.target.value })}
              className={`${controlClass} w-full md:w-auto`}
            />
          </label>
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="focus-ring flex items-center justify-center gap-1 rounded-md px-2 py-2 text-[13px] text-text-muted transition-colors hover:text-text md:py-1.5"
          >
            <X size={13} strokeWidth={1.75} />
            Clear filters
          </button>
        )}
      </div>

      {/* Only present once something is chosen, so the table is not permanently
          topped by a disabled button. */}
      {picked.size > 0 && (
        <div className="mb-3 flex flex-col gap-2 rounded-md border border-border bg-surface-sunken px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] text-text-muted">
            {picked.size} {picked.size === 1 ? "report" : "reports"} chosen
            {pickedVisible.length !== picked.size &&
              ` · ${picked.size - pickedVisible.length} outside the current filters`}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPicked(new Set())}
              className="focus-ring rounded-md px-2 py-1.5 text-[13px] text-text-muted transition-colors hover:text-text"
            >
              Clear
            </button>
            <Button type="button" onClick={handleGenerate} disabled={building} size="sm">
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
            </Button>
          </div>
        </div>
      )}

      {/* Phones get cards, not a seven-column table sideways-scrolled through a
          360px window: every field a row carries stays on screen, and the whole
          card is the tap target the row is on a desktop. */}
      <ul className="flex flex-col gap-2 lg:hidden">
        <AnimatePresence initial={false}>
          {filtered.map((r) => {
            const time = getCollectionTime(r.collectedAt);
            return (
              <motion.li
                key={r.sampleId}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={rowTransition}
              >
                <div
                  className={clsx(
                    "flex items-start gap-3 rounded-md border px-3 py-3 transition-colors duration-[var(--duration-fast)]",
                    picked.has(r.sampleId)
                      ? "border-accent/40 bg-accent-muted"
                      : "border-border bg-surface",
                  )}
                >
                  {/* Negative margin against inner padding: the box stays 16px
                      but the thing a thumb has to hit is 40. */}
                  <label className="-m-2 shrink-0 cursor-pointer p-2">
                    <span className="sr-only">Choose report {r.sampleId}</span>
                    <input
                      type="checkbox"
                      checked={picked.has(r.sampleId)}
                      onChange={() => togglePicked(r.sampleId)}
                      className="focus-ring mt-1 h-4 w-4 accent-[var(--accent)]"
                    />
                  </label>
                  <Link href={`/reports/${r.sampleId}`} className="focus-ring min-w-0 flex-1 rounded">
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className="text-[13px] text-text"
                        style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}
                      >
                        {r.sampleId}
                      </span>
                      <StatusBadge status={r.status} />
                    </div>
                    <div className="mt-1 text-[13px] text-text">{r.topPollen}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px] text-text-muted">
                      <span>{r.location}</span>
                      <span aria-hidden>·</span>
                      <span>
                        {formatDate(r.collectedAt)}
                        {time && ` · ${formatTime(time)}`}
                      </span>
                    </div>
                    <div className="mt-1.5 text-[12.5px] text-text-muted">
                      <span
                        className="text-text"
                        style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}
                      >
                        {r.totalGrains}
                      </span>{" "}
                      grains
                      {r.slideCount > 1 && ` · ${r.slideCount} slides`}
                      {r.sampleId === highlightId && (
                        <span className="ml-2 rounded-full bg-accent-muted px-2 py-0.5 text-[11.5px] text-[var(--accent-hover)]">
                          just saved
                        </span>
                      )}
                    </div>
                  </Link>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>

      <div className="hidden lg:block">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead>
            <tr
              className="border-b border-border text-[12px] tracking-widest text-text-faint uppercase"
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
                  className="focus-ring h-3.5 w-3.5 accent-[var(--accent)]"
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
            <AnimatePresence initial={false}>
              {filtered.map((r) => (
                <motion.tr
                  key={r.sampleId}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={rowTransition}
                  onClick={(event) => openRow(event, r.sampleId)}
                  className={clsx(
                    "group cursor-pointer border-b border-border/70 transition-colors duration-[var(--duration-fast)] last:border-0",
                    picked.has(r.sampleId) ? "bg-accent-muted" : "hover:bg-surface-sunken",
                  )}
                >
                  <td className="py-2.5 pr-2">
                    <input
                      type="checkbox"
                      checked={picked.has(r.sampleId)}
                      onChange={() => togglePicked(r.sampleId)}
                      aria-label={`Choose report ${r.sampleId}`}
                      className="focus-ring h-3.5 w-3.5 accent-[var(--accent)]"
                    />
                  </td>
                  <td className="py-2.5 pr-3 whitespace-nowrap text-text" style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
                    <Link href={`/reports/${r.sampleId}`} className="focus-ring rounded">
                      {r.sampleId}
                    </Link>
                    {r.sampleId === highlightId && (
                      <span className="ml-2 rounded-full bg-accent-muted px-2 py-0.5 text-[11.5px] text-[var(--accent-hover)]">
                        just saved
                      </span>
                    )}
                  </td>
                  <CollectedCell collectedAt={r.collectedAt} />
                  <td className="py-2.5 pr-3 whitespace-nowrap text-text-muted">{r.location}</td>
                  <td className="py-2.5 pr-3 text-text">
                    {r.topPollen}
                    {r.slideCount > 1 && (
                      <span className="mt-0.5 block text-[12.5px] text-text-muted">
                        across {r.slideCount} slides
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 pr-3 whitespace-nowrap text-text" style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
                    {r.totalGrains}
                  </td>
                  <td className="py-2.5 pr-0">
                    <StatusBadge status={r.status} />
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {/* Outside both renderings, so an empty result says so at either size. */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <p className="text-[13px] text-text-muted">
            {hasActiveFilters
              ? "No reports match those filters."
              : "No reports yet — analyze a specimen to create one."}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="focus-ring inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[13px] text-text-muted transition-colors hover:text-text"
            >
              <X size={13} strokeWidth={1.75} />
              Clear filters
            </button>
          )}
        </div>
      )}

      {rows.length > 0 && picked.size === 0 && (
        <p className="mt-3 text-[12.5px] text-text-faint">
          Tick the reports you want in a summary PDF, or filter first and use the header checkbox to
          take the whole result.
        </p>
      )}
    </div>
  );
}
