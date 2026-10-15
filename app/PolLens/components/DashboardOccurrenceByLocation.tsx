import Link from "next/link";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import type { DashboardSummary, DashboardSpeciesOccurrence } from "@/lib/dashboard";
import { dashboardOccurrenceHref } from "@/lib/dashboard-locations";
import { findSpecies } from "@/lib/species-catalog";
import type { Species } from "@/lib/data";
import SpeciesName from "@/components/SpeciesName";
import { SampleBadge } from "@/components/StatusBadge";

export default function DashboardOccurrenceByLocation({ summary, failed, catalog, species, onSelectLocation }: {
  summary: DashboardSummary | null;
  failed: boolean;
  catalog: Species[];
  species: DashboardSpeciesOccurrence[];
  onSelectLocation: (value: string) => void;
}) {
  const oneLocation = summary?.locationFilter.startsWith("location:");
  function speciesList(location: DashboardSummary["locations"][number]) {
    return <ul className="divide-y divide-border">{species.map((occurrence) => {
      const count = location.occurrences[occurrence.speciesId] ?? 0;
      const content = <><div className="flex min-w-0 items-start justify-between gap-3"><SpeciesName species={findSpecies(catalog, occurrence.speciesId)} commonName={false} className="min-w-0 break-words text-[14px] text-text" /><span className="shrink-0 text-[13px] tabular-nums text-text-muted">{count} of {location.collectionCount}</span></div><div aria-hidden="true" className="mt-2 h-1.5 overflow-hidden rounded-sm bg-surface-sunken"><div className="h-full bg-text" style={{ width: `${location.collectionCount ? count / location.collectionCount * 100 : 0}%` }} /></div></>;
      return <li key={occurrence.speciesId}>{count && summary ? <Link className="focus-ring block min-h-11 rounded-sm py-3 hover:bg-surface-sunken" href={dashboardOccurrenceHref(summary, occurrence.speciesId, location.key)} aria-label={`${findSpecies(catalog, occurrence.speciesId).scientificName}: ${count} of ${location.collectionCount} collections in ${location.label}. Open supporting reports.`}>{content}</Link> : <div className="py-3">{content}</div>}</li>;
    })}</ul>;
  }
  return (
    <section className="card-panel min-w-0 p-4 sm:p-5" aria-labelledby="occurrence-location-heading" aria-busy={!summary && !failed}>
      <div className="flex flex-wrap items-center gap-2"><h2 id="occurrence-location-heading" className="t-plate-title text-text">Pollen Occurrence by Location</h2>{Boolean(summary?.sampleCount) && <SampleBadge />}</div>
      <p className="mt-1 text-[13px] text-text-muted">Collections containing each pollen type, counted once per collection.</p>
      {!summary && !failed ? <div role="status" aria-label="Loading pollen occurrence" className="mt-4 space-y-2">{[0, 1, 2].map((index) => <div key={index} className="h-11 animate-pulse rounded-sm bg-surface-sunken" />)}</div>
        : failed ? <p className="py-8 text-[13px] text-text-muted">Pollen occurrence unavailable. Use Try Again above to reload.</p>
        : !summary?.collectionCount ? <p className="py-8 text-[13px] text-text-muted">No finalized collections in this location and period.</p>
        : species.length === 0 ? <p className="py-8 text-[13px] text-text-muted">No pollen detections recorded in these {summary.collectionCount} collections.</p>
        : <>
          {oneLocation ? <div className="mt-4"><p className="text-[13px] font-medium text-text">{summary.locations[0].label} <span className="font-normal text-text-muted">· {summary.collectionCount} {summary.collectionCount === 1 ? "collection" : "collections"}</span></p>{speciesList(summary.locations[0])}</div> : <>
            <div className="mt-4 divide-y divide-border lg:hidden">{summary.locations.map((location, index) => <details key={location.key} open={index === 0} className="group">
              <summary className="focus-ring flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-sm py-3 [&::-webkit-details-marker]:hidden"><span className="min-w-0 text-[14px] text-text">{location.label}<span className="mt-0.5 block text-[12px] text-text-muted">{location.collectionCount} {location.collectionCount === 1 ? "collection" : "collections"}{location.sampleCount > 0 ? " · Includes sample readings" : ""}</span></span><ChevronDown size={16} strokeWidth={1.75} className="shrink-0 text-text-muted group-open:rotate-180" aria-hidden="true" /></summary>
              {location.collectionCount ? <div className="pb-3">{speciesList(location)}<button type="button" className="focus-ring min-h-11 rounded-sm text-[13px] text-text underline underline-offset-4" onClick={() => onSelectLocation(`location:${location.key}`)}>Use This Location</button></div> : <p className="pb-4 text-[13px] text-text-muted">No collections in this period.</p>}
            </details>)}</div>
            <div className="focus-ring mt-4 hidden max-h-[28rem] overflow-auto rounded-sm lg:block" role="region" aria-label="Pollen occurrence by location, scroll for more species" tabIndex={0}>
              <table className="w-full table-fixed border-separate border-spacing-0 text-left" style={{ minWidth: `${192 + species.length * 112}px`, tableLayout: "fixed" }}>
                <caption className="sr-only">Collections containing each species out of all finalized collections at each location. Pending analyses are excluded.</caption>
                <colgroup><col style={{ width: "192px" }} />{species.map((item) => <col key={item.speciesId} style={{ width: "112px" }} />)}</colgroup>
                <thead><tr><th scope="col" className="sticky top-0 left-0 z-30 w-48 border-r border-b border-border bg-surface p-3 text-[12px] font-medium text-text-muted">Location</th>{species.map((occurrence) => <th key={occurrence.speciesId} scope="col" className="sticky top-0 z-20 border-b border-border bg-surface px-2 py-3 text-center font-normal"><SpeciesName species={findSpecies(catalog, occurrence.speciesId)} commonName={false} className="break-words text-[13px] text-text" /></th>)}</tr></thead>
                <tbody>{summary.locations.map((location) => <tr key={location.key}><th scope="row" className="sticky left-0 z-10 border-r border-b border-border bg-surface px-3 py-2 font-normal"><button type="button" onClick={() => onSelectLocation(`location:${location.key}`)} className="focus-ring min-h-11 rounded-sm text-left text-[13px] leading-snug text-text underline decoration-border-strong underline-offset-4">{location.label}</button><span className="block text-[12px] text-text-muted">{location.collectionCount} {location.collectionCount === 1 ? "collection" : "collections"}</span></th>{species.map((occurrence) => {
                  const count = location.occurrences[occurrence.speciesId] ?? 0;
                  return <td key={occurrence.speciesId} className="border-b border-border p-1 text-center text-[13px] tabular-nums text-text">{count ? <Link href={dashboardOccurrenceHref(summary, occurrence.speciesId, location.key)} className="focus-ring inline-flex min-h-11 items-center gap-1 rounded-sm px-2 underline decoration-border-strong underline-offset-4 hover:bg-surface-sunken" aria-label={`${findSpecies(catalog, occurrence.speciesId).scientificName} in ${location.label}: ${count} of ${location.collectionCount} collections. Open supporting reports.`}>{count} of {location.collectionCount}<ArrowUpRight size={12} aria-hidden="true" /></Link> : <span>{location.collectionCount ? `0 of ${location.collectionCount}` : "—"}</span>}</td>;
                })}</tr>)}</tbody>
              </table>
            </div>
          </>}
          <p className="mt-3 border-t border-border pt-3 text-[12px] text-text-muted">Select an occurrence to open its reports. “0 of N” means none contained the type; “—” means no collections.{summary.sampleCount > 0 && " Includes illustrative sample detections."}</p>
        </>}
    </section>
  );
}
