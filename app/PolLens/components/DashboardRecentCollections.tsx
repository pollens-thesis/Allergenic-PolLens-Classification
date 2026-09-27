import Link from "next/link";
import { ArrowUpRight, Inbox } from "lucide-react";
import {
  aggregateSlideDetections,
  formatCollectedAt,
  getReportGrains,
  getSpecies,
  getTopDetection,
  type Specimen,
} from "@/lib/data";
import StatusBadge, { SampleBadge } from "@/components/StatusBadge";
import SpeciesName from "@/components/SpeciesName";

function CollectionRow({ report }: { report: Specimen }) {
  const top = getTopDetection(aggregateSlideDetections(report.slides));
  const species = top ? getSpecies(top.speciesId) : null;
  const grainCount = getReportGrains(report);

  return (
    <li>
      <Link
        href={`/reports/${report.sampleId}`}
        className="focus-ring grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 rounded-sm px-2 py-3 transition-colors hover:bg-surface-sunken sm:grid-cols-[minmax(8rem,1.1fr)_minmax(8rem,1fr)_minmax(7rem,0.9fr)_auto]"
      >
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[13px] font-medium text-text" style={{ fontFamily: "var(--font-mono)" }}>{report.sampleId}</span>
            {report.sampleDetections && <SampleBadge />}
          </div>
          <span className="mt-1 block truncate text-[12px] text-text-muted">{report.location || "Location not recorded"}</span>
        </div>
        <div className="hidden min-w-0 sm:block">
          {species ? <SpeciesName species={species} commonName={false} className="block truncate text-[13px] text-text" /> : <span className="text-[13px] text-text-muted">No detections recorded</span>}
          <span className="mt-1 block text-[12px] text-text-muted">{formatCollectedAt(report.collectedAt)}</span>
        </div>
        <div className="flex flex-col items-end gap-1 sm:items-start">
          <span className="text-[12px] text-text">{report.slides.length} {report.slides.length === 1 ? "slide" : "slides"} <span className="text-text-faint">·</span> {grainCount.toLocaleString()} {grainCount === 1 ? "grain" : "grains"}</span>
          <span className="text-[12px] text-text-muted sm:hidden">{formatCollectedAt(report.collectedAt)}</span>
          <StatusBadge status={report.status} />
        </div>
        <ArrowUpRight size={15} strokeWidth={1.75} className="hidden text-text-faint sm:block" aria-hidden="true" />
      </Link>
    </li>
  );
}

export default function DashboardRecentCollections({ collections }: { collections: Specimen[] }) {
  return (
    <section aria-labelledby="recent-collections-heading" className="card-panel min-w-0 p-3 sm:p-5">
      <div className="mb-2 flex items-end justify-between gap-3 px-2">
        <div>
          <h2 id="recent-collections-heading" className="t-plate-title text-text">Recent Collections</h2>
          <p className="mt-0.5 text-[12px] text-text-muted">Latest finalized records in this period</p>
        </div>
        <Link href="/reports" className="focus-ring inline-flex shrink-0 items-center gap-1 rounded-sm text-[12px] text-text-muted hover:text-text">
          All reports <ArrowUpRight size={13} strokeWidth={1.75} aria-hidden="true" />
        </Link>
      </div>
      {collections.length === 0 ? (
        <div className="flex items-center gap-2 px-2 py-7 text-[13px] text-text-muted">
          <Inbox size={16} strokeWidth={1.5} aria-hidden="true" />
          No finalized collections in this period.
        </div>
      ) : (
        <ol className="divide-y divide-border">
          {collections.map((report) => <CollectionRow key={report.sampleId} report={report} />)}
        </ol>
      )}
    </section>
  );
}
