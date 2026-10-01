"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import clsx from "clsx";
import {
  ChevronLeft,
  ChevronRight,
  FileDown,
  FileSpreadsheet,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  aggregateSlideDetections,
  formatCollectedAt,
  formatTime,
  getCollectionDate,
  getCollectionTime,
  toReportRow,
  type ReportStatus,
  type Specimen,
  isFinalised,
} from "@/lib/data";
import { downloadSelectionReportPdf } from "@/lib/pdf";
import { exportReportsXlsx } from "@/lib/export";
import { getDashboardLocationOptions, matchesDashboardLocation } from "@/lib/dashboard-locations";
import { findSpecies, useSpeciesCatalog } from "@/lib/species-catalog";
import StatusBadge, { SampleBadge } from "@/components/StatusBadge";
import SpeciesName from "@/components/SpeciesName";
import { Button, buttonVariants } from "@/components/Button";

// Keep Finalized for dashboard deep links; it is not offered as a Reports filter.
type StatusFilter = ReportStatus | "All" | "Finalized";
const STATUS_FILTERS: StatusFilter[] = ["All", "Pending", "Needs review", "Completed"];

const ALL_LOCATIONS = "all";
const REPORTS_PAGE_SIZE = 10;

type Filters = {
  query: string;
  status: StatusFilter;
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
  "focus-ring min-h-11 min-w-0 rounded-md border border-border bg-surface px-2 text-[13px] text-text";

/** Case- and accent-insensitive form for search: "Baños" matches "banos". */
function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/**
 * Every Reports field is searchable: report/sample name, location, collection
 * date, lifecycle status and all pollen detections, not just the most abundant.
 */
function searchText(report: Specimen, catalog: ReturnType<typeof useSpeciesCatalog>): string {
  const species = aggregateSlideDetections(report.slides).map((d) => {
    const sp = findSpecies(catalog, d.speciesId);
    return `${d.speciesId} ${sp.code} ${sp.scientificName} ${sp.commonName}`;
  });
  return fold(
    [
      report.sampleId,
      report.reportName ?? "",
      report.location,
      report.collectedAt,
      formatDate(report.collectedAt),
      formatCollectedAt(report.collectedAt),
      report.status,
      ...species,
    ].join(
      " | ",
    ),
  );
}

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
  initialStatus = "All",
  initialFrom = "",
  initialTo = "",
  initialLocationScope = "all",
}: {
  reports: Specimen[];
  /** Sample id to flag as just generated, e.g. after redirecting from the result page. */
  highlightId?: string | null;
  /** Prefills the search box — the Pollen map links here filtered by town. */
  initialQuery?: string;
  /** Dashboard links prefill the review status and inclusive collection dates. */
  initialStatus?: StatusFilter;
  initialFrom?: string;
  initialTo?: string;
  /** Exact dashboard area/location scope, kept visible in the location control. */
  initialLocationScope?: string;
}) {
  const catalog = useSpeciesCatalog();
  const scopedLocation = useMemo(() => {
    const options = getDashboardLocationOptions(reports);
    return [...options.provinces, ...options.locations].find((option) => option.value === initialLocationScope);
  }, [reports, initialLocationScope]);
  const [filters, setFilters] = useState<Filters>({
    ...NO_FILTERS, query: initialQuery, status: initialStatus, from: initialFrom, to: initialTo, location: scopedLocation?.value ?? ALL_LOCATIONS,
  });
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [building, setBuilding] = useState<"pdf" | "xlsx" | null>(null);
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

  const haystacks = useMemo(
    () => new Map(reports.map((report) => [report.sampleId, searchText(report, catalog)])),
    [reports, catalog],
  );

  // Filters on every keystroke — a partial word ("cand") is enough.
  const filtered = useMemo(() => {
    const queryTerms = fold(filters.query.trim()).split(/\s+/).filter(Boolean);
    return rows.filter((r) => {
      // ISO dates compare correctly as plain strings, so the range needs no
      // parsing and cannot be shifted by a timezone.
      const date = getCollectionDate(r.collectedAt);
      return (
        (filters.status === "All" || (filters.status === "Finalized" ? isFinalised(bySampleId.get(r.sampleId)!) : r.status === filters.status)) &&
        (filters.location === ALL_LOCATIONS || (scopedLocation && filters.location === scopedLocation.value ? matchesDashboardLocation(r.location, scopedLocation.value) : r.location === filters.location)) &&
        (filters.from === "" || date >= filters.from) &&
        (filters.to === "" || date <= filters.to) &&
        (queryTerms.length === 0 || queryTerms.every((term) => (haystacks.get(r.sampleId) ?? "").includes(term)))
      );
    });
  }, [rows, filters, haystacks, scopedLocation, bySampleId]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / REPORTS_PAGE_SIZE));
  const page = Math.min(currentPage, pageCount);
  const pageStart = (page - 1) * REPORTS_PAGE_SIZE;
  const pageReports = filtered.slice(pageStart, pageStart + REPORTS_PAGE_SIZE);
  const filteredIds = useMemo(
    () => new Set(filtered.map((report) => report.sampleId)),
    [filtered],
  );

  const hasActiveFilters =
    filters.query.trim() !== "" ||
    filters.status !== "All" ||
    filters.location !== ALL_LOCATIONS ||
    filters.from !== "" ||
    filters.to !== "";

  function patch(next: Partial<Filters>) {
    setCurrentPage(1);
    setFilters((current) => ({ ...current, ...next }));
  }

  function clearFilters() {
    setCurrentPage(1);
    setFilters({ ...NO_FILTERS });
  }

  /**
   * The whole row opens the report. The sample id stays a real link — it is
   * what keyboard focus lands on, and what a middle-click or "open in new tab"
   * needs — and the checkbox is for choosing, not opening, so a click that
   * landed on either is left alone.
   */
  function openRow(event: React.MouseEvent<HTMLTableRowElement>, sampleId: string) {
    if (event.target instanceof HTMLElement && event.target.closest("a, input, label, [data-no-open]")) return;
    router.push(`/reports/${sampleId}`);
  }

  const visibleIds = pageReports.map((r) => r.sampleId);
  const pickedVisible = visibleIds.filter((id) => picked.has(id));
  const pickedInFilters = [...picked].filter((id) => filteredIds.has(id)).length;
  const hasCompletedSelection = [...picked].some((id) => bySampleId.get(id)?.status === "Completed");
  const nonCompletedSelectedCount = [...picked].filter((id) => {
    const status = bySampleId.get(id)?.status;
    return status !== undefined && status !== "Completed";
  }).length;
  const allVisiblePicked = visibleIds.length > 0 && pickedVisible.length === visibleIds.length;

  function togglePicked(sampleId: string) {
    setPicked((current) => {
      const next = new Set(current);
      if (!next.delete(sampleId)) next.add(sampleId);
      return next;
    });
  }

  /** Select-all applies to the current page; earlier pages stay selected. */
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
  /** Only Completed reports are exportable; Pending and Needs Review are held back. */
  function chosenReports(): { reports: Specimen[]; skipped: number } {
    const all = [...picked]
      .map((id) => bySampleId.get(id))
      .filter((report): report is Specimen => report !== undefined);
    const reports = all
      .filter((report) => report.status === "Completed")
      .sort((a, b) => b.collectedAt.localeCompare(a.collectedAt));
    return { reports, skipped: all.length - reports.length };
  }

  async function handleGenerate(format: "pdf" | "xlsx") {
    const { reports: chosen, skipped } = chosenReports();
    if (chosen.length === 0) {
      toast.error("Exports are locked until reports are Completed. Mark the selected reports Completed first.");
      return;
    }
    if (skipped > 0) {
      toast.info(
        `${skipped} Pending or Needs Review ${skipped === 1 ? "report was" : "reports were"} left out; mark them Completed to export them.`,
      );
    }

    setBuilding(format);
    try {
      if (format === "pdf") await downloadSelectionReportPdf({ reports: chosen });
      else await exportReportsXlsx(chosen);
    } catch {
      toast.error(format === "pdf" ? "Couldn't build the PDF. Try again." : "Couldn't build the Excel file. Try again.");
    } finally {
      setBuilding(null);
    }
  }

  return (
    <div className="card-panel p-4 sm:p-5">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {/* The page title already says "Reports"; this card's heading is its count. */}
          <h2 className="sr-only">Reports</h2>
          <p className="t-plate-title text-text lining-nums">
            {filtered.length} of {rows.length} {rows.length === 1 ? "report" : "reports"}
            {picked.size > 0 && ` · ${picked.size} selected`}
          </p>
        </div>

        <label className="relative w-full sm:w-80">
          <span className="sr-only">Search all report fields</span>
          <Search
            size={14}
            strokeWidth={1.75}
            className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-text-faint"
          />
          <input
            type="text"
            value={filters.query}
            onChange={(e) => patch({ query: e.target.value })}
            placeholder="Search reports, places, dates, pollen, status"
            className="focus-ring min-h-11 w-full rounded-md border border-border bg-surface py-2 pr-3 pl-8 text-[13px] text-text placeholder:text-text-faint"
          />
        </label>
      </div>

      <div className="mb-4 grid min-w-0 grid-cols-1 items-end gap-x-3 gap-y-3 sm:grid-cols-2 2xl:grid-cols-[minmax(21rem,1.15fr)_minmax(12rem,0.75fr)_minmax(19rem,1.3fr)_auto]">
        <fieldset className="flex min-w-0 flex-col gap-1">
          <legend className="text-[12.5px] text-text-muted">
            {filters.status === "Finalized" ? "Status · Completed + Needs Review" : "Status"}
          </legend>
          <div className="flex h-12 max-w-full flex-wrap gap-0.5 rounded-md border border-border bg-surface p-px">
              {STATUS_FILTERS.map((option) => {
                const active = filters.status === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => patch({ status: option })}
                    aria-pressed={active}
                    aria-label={option === "Needs review" ? "Needs Review" : option}
                    className={clsx(
                      "focus-ring relative h-full min-h-11 rounded px-2 text-[12px] whitespace-nowrap sm:px-2.5 sm:text-[13px]",
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
                    <span className="relative z-10">{option === "Needs review" ? "Needs Review" : option}</span>
                  </button>
                );
              })}
          </div>
        </fieldset>

        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-[12.5px] text-text-muted">Location</span>
          <select
            value={filters.location}
            onChange={(e) => patch({ location: e.target.value })}
            className={`${controlClass} h-12 w-full bg-surface`}
          >
            <option value={ALL_LOCATIONS}>All Locations</option>
            {scopedLocation && <option value={scopedLocation.value}>{scopedLocation.label} (Dashboard)</option>}
            {locations.map((location) => (
              <option key={location} value={location}>
                {location}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="min-w-0 xl:col-span-1">
          <legend className="mb-1 text-[12.5px] text-text-muted">Collection Date</legend>
          <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
            <label className="flex min-w-0 items-center gap-1.5">
              <span className="w-8 shrink-0 text-[12.5px] text-text-muted">From</span>
              <input
                type="date"
                aria-label="Collected From"
                value={filters.from}
                max={filters.to || undefined}
                onChange={(e) => patch({ from: e.target.value })}
                className={`${controlClass} w-full flex-1 bg-surface`}
              />
            </label>
            <label className="flex min-w-0 items-center gap-1.5">
              <span className="w-8 shrink-0 text-[12.5px] text-text-muted">To</span>
              <input
                type="date"
                aria-label="Collected To"
                value={filters.to}
                min={filters.from || undefined}
                onChange={(e) => patch({ to: e.target.value })}
                className={`${controlClass} w-full flex-1 bg-surface`}
              />
            </label>
          </div>
        </fieldset>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="focus-ring flex min-h-11 items-center justify-center gap-1 rounded-md px-2 text-[13px] text-text-muted transition-colors hover:text-text 2xl:justify-self-end"
          >
            <X size={13} strokeWidth={1.75} />
            Clear Filters
          </button>
        )}
      </div>

      {/* Only present once something is chosen, so the table is not permanently
          topped by a disabled button. */}
      {picked.size > 0 && (
        <div className="mb-3 flex flex-col gap-2 rounded-md border border-border bg-surface-sunken px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] text-text-muted">
            {picked.size} {picked.size === 1 ? "report" : "reports"} selected
            {pickedInFilters > pickedVisible.length &&
              ` · ${pickedInFilters - pickedVisible.length} on other pages`}
            {picked.size > pickedInFilters &&
              ` · ${picked.size - pickedInFilters} outside current filters`}
            {!hasCompletedSelection ? (
              <span className="mt-1 block text-[12px]">Exports unlock when selected reports are Completed.</span>
            ) : nonCompletedSelectedCount > 0 ? (
              <span className="mt-1 block text-[12px]">
                {nonCompletedSelectedCount} Pending or Needs Review{" "}
                {nonCompletedSelectedCount === 1 ? "report is" : "reports are"} excluded until Completed.
              </span>
            ) : null}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPicked(new Set())}
              className="focus-ring rounded-md px-2 py-1.5 text-[13px] text-text-muted transition-colors hover:text-text"
            >
              Clear Selection
            </button>
            <Button
              type="button"
              intent="secondary"
              onClick={() => handleGenerate("xlsx")}
              disabled={building !== null || !hasCompletedSelection}
              size="sm"
            >
              {building === "xlsx" ? (
                <Loader2 size={14} strokeWidth={1.75} className="animate-spin" />
              ) : (
                <FileSpreadsheet size={14} strokeWidth={1.75} />
              )}
              Export Excel
            </Button>
            <Button
              type="button"
              onClick={() => handleGenerate("pdf")}
              disabled={building !== null || !hasCompletedSelection}
              size="sm"
            >
              {building === "pdf" ? (
                <>
                  <Loader2 size={14} strokeWidth={1.75} className="animate-spin" />
                  Building PDF…
                </>
              ) : (
                <>
                  <FileDown size={14} strokeWidth={1.75} />
                  Download Summary PDF
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Phones get cards, not a seven-column table sideways-scrolled through a
          360px window: every field a row carries stays on screen, and the whole
          card is the tap target the row is on a desktop. */}
      <ul className="flex flex-col gap-2 xl:hidden">
        <AnimatePresence initial={false}>
          {pageReports.map((r) => {
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
                    <span className="sr-only">Select report {r.sampleId}</span>
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
                        className="min-w-0 break-words text-[13px] font-medium text-text"
                      >
                        {r.reportName || r.sampleId}
                      </span>
                      <span className="flex items-center gap-1.5">
                        {r.sampleDetections && <SampleBadge />}
                        <StatusBadge status={r.status} />
                      </span>
                    </div>
                    {r.reportName && (
                      <div className="mt-0.5 text-[11.5px] text-text-faint" style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
                        {r.sampleId}
                      </div>
                    )}
                    <div className="mt-1 text-[13px] text-text">
                      {r.topSpecies ? <SpeciesName species={r.topSpecies} /> : r.topPollen}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px] text-text-muted">
                      <span>{r.location || "No location recorded"}</span>
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
                        {r.totalGrains.toLocaleString()}
                      </span>{" "}
                      grains
                      {r.slideCount > 1 && ` · ${r.slideCount} slides`}
                      {r.sampleId === highlightId && (
                        <span className="ml-2 rounded-full bg-accent-muted px-2 py-0.5 text-[12px] text-[var(--accent-hover)]">
                          Just Generated
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

      <div className="hidden overflow-x-auto xl:block">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead>
            <tr
              className="caption-label text-[13px] border-b border-border"
              
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
                  aria-label="Select all reports shown"
                  className="focus-ring h-3.5 w-3.5 accent-[var(--accent)]"
                />
              </th>
              <th className="py-2 pr-3 font-medium">Report / Sample ID</th>
              <th className="py-2 pr-3 font-medium">Collected</th>
              <th className="py-2 pr-3 font-medium">Location</th>
              <th className="py-2 pr-3 font-medium">Top Pollen Detected</th>
              <th className="py-2 pr-6 text-right font-medium">Total Grains</th>
              <th className="py-2 pr-0 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {pageReports.map((r) => (
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
                  <td className="py-2.5 pr-2" data-no-open>
                    <input
                      type="checkbox"
                      checked={picked.has(r.sampleId)}
                      onChange={() => togglePicked(r.sampleId)}
                      aria-label={`Select report ${r.sampleId}`}
                      className="focus-ring h-3.5 w-3.5 accent-[var(--accent)]"
                    />
                  </td>
                  <td className="py-2.5 pr-3 text-text">
                    <Link href={`/reports/${r.sampleId}`} className="focus-ring rounded">
                      <span className="block font-medium">{r.reportName || r.sampleId}</span>
                      {r.reportName && (
                        <span className="mt-0.5 block text-[11.5px] text-text-faint" style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
                          {r.sampleId}
                        </span>
                      )}
                    </Link>
                    {r.sampleId === highlightId && (
                      <span className="ml-2 rounded-full bg-accent-muted px-2 py-0.5 text-[12px] text-[var(--accent-hover)]">
                        Just Generated
                      </span>
                    )}
                  </td>
                  <CollectedCell collectedAt={r.collectedAt} />
                  <td className="py-2.5 pr-3 whitespace-nowrap text-text-muted">{r.location || "No location recorded"}</td>
                  <td className="py-2.5 pr-3 text-text">
                    {r.topSpecies ? <SpeciesName species={r.topSpecies} /> : r.topPollen}
                    {r.slideCount > 1 && (
                      <span className="mt-0.5 block text-[12.5px] text-text-muted">
                        across {r.slideCount} slides
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 pr-6 text-right whitespace-nowrap text-text" style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
                    {r.totalGrains.toLocaleString()}
                  </td>
                  <td className="py-2.5 pr-0">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <StatusBadge status={r.status} />
                      {r.sampleDetections && <SampleBadge />}
                    </span>
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
          <p className="text-[14px] text-text-muted">
            {hasActiveFilters
              ? "No reports match those filters."
              : "No reports yet — analyze slides to create one."}
          </p>
          {!hasActiveFilters && (
            <Link
              href="/upload"
              className={`${buttonVariants({ intent: "accent", size: "sm" })} focus-ring`}
            >
              Analyze Slides
            </Link>
          )}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="focus-ring inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[13px] text-text-muted transition-colors hover:text-text"
            >
              <X size={13} strokeWidth={1.75} />
              Clear Filters
            </button>
          )}
        </div>
      )}

      {filtered.length > 0 && (
        <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12.5px] text-text-muted lining-nums" aria-live="polite">
            Showing {pageStart + 1}–{pageStart + pageReports.length} of {filtered.length} reports
          </p>
          {pageCount > 1 && (
            <nav className="flex items-center gap-1 self-start sm:self-auto" aria-label="Reports pages">
              <button
                type="button"
                onClick={() => setCurrentPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="focus-ring inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-[13px] text-text-muted transition-colors hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft size={15} strokeWidth={1.75} />
                Previous
              </button>
              <span className="px-2 text-[12.5px] text-text-muted lining-nums">
                {page} of {pageCount}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage(Math.min(pageCount, page + 1))}
                disabled={page === pageCount}
                className="focus-ring inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-[13px] text-text-muted transition-colors hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
                <ChevronRight size={15} strokeWidth={1.75} />
              </button>
            </nav>
          )}
        </div>
      )}

    </div>
  );
}
