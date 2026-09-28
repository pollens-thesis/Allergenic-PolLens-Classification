import Link from "next/link";
import { ArrowUpRight, Inbox } from "lucide-react";
import { aggregateSlideDetections, formatCollectedAt, getReportGrains, getTopDetection, type Specimen, type Species } from "@/lib/data";
import { findSpecies } from "@/lib/species-catalog";
import StatusBadge, { SampleBadge } from "@/components/StatusBadge";
import SpeciesName from "@/components/SpeciesName";

function CollectionRow({ report, catalog }: { report: Specimen; catalog: Species[] }) {
  const top = getTopDetection(aggregateSlideDetections(report.slides));
  const species = top && top.grainCount > 0 ? findSpecies(catalog, top.speciesId) : null;
  const grainCount = getReportGrains(report);

  return (
    <li>
      <Link href={`/reports/${report.sampleId}`} className="focus-ring grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-sm py-2 transition-colors hover:bg-surface-sunken">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="break-words text-[13px] font-medium text-text">{report.reportName || report.sampleId}</span>
            {report.sampleDetections && <SampleBadge />}
          </div>
          {report.reportName && <span className="mt-0.5 block text-[11.5px] text-text-faint" style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>{report.sampleId}</span>}
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-text-muted">
            <span className="break-words">{report.location || "Location not recorded"}</span>
            <span>{formatCollectedAt(report.collectedAt)}</span>
          </div>
          {species ? <SpeciesName species={species} commonName={false} className="mt-1 block break-words text-[13px] text-text" /> : <span className="mt-1 block text-[13px] text-text-muted">No detections recorded</span>}
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="text-right text-[12px] text-text"><span className="block sm:inline">{report.slides.length} {report.slides.length === 1 ? "slide" : "slides"}</span><span className="hidden text-text-faint sm:inline"> · </span><span className="block sm:inline">{grainCount.toLocaleString()} {grainCount === 1 ? "grain" : "grains"}</span></span>
          <StatusBadge status={report.status} />
        </div>
      </Link>
    </li>
  );
}

export default function DashboardRecentCollections({ collections, failed, catalog, reportsHref = "/reports" }: {
  collections: Specimen[] | null;
  failed: boolean;
  catalog: Species[];
  reportsHref?: string;
}) {
  return (
    <section aria-labelledby="recent-collections-heading" aria-busy={!collections && !failed} className="card-panel flex h-full min-w-0 flex-col p-4 sm:p-5">
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div>
          <h2 id="recent-collections-heading" className="t-plate-title text-text">Recent Collections</h2>
        </div>
        <Link href={reportsHref} className="focus-ring inline-flex min-h-11 shrink-0 items-center gap-1 rounded-sm text-[12px] text-text-muted hover:text-text">All Reports <ArrowUpRight size={13} strokeWidth={1.75} aria-hidden="true" /></Link>
      </div>
      {!collections && !failed ? (
        <div role="status" aria-label="Loading recent collections" className="space-y-3 py-3">{[0, 1, 2, 3, 4].map((index) => <div key={index} className="h-16 animate-pulse rounded-sm bg-surface-sunken" />)}</div>
      ) : failed ? (
        <p className="py-8 text-[13px] text-text-muted">Recent collections unavailable. Use Try Again above to reload.</p>
      ) : collections?.length === 0 ? (
        <div className="flex items-center gap-2 py-7 text-[13px] text-text-muted"><Inbox size={16} strokeWidth={1.5} aria-hidden="true" />No finalized collections in this location and period.</div>
      ) : (
        <ol className="divide-y divide-border">{collections?.slice(0, 5).map((report) => <CollectionRow key={report.sampleId} report={report} catalog={catalog} />)}</ol>
      )}
    </section>
  );
}
