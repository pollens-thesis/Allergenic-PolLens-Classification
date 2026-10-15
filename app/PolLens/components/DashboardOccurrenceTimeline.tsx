import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { DashboardSummary, DashboardSpeciesOccurrence } from "@/lib/dashboard";
import { dashboardOccurrenceHref } from "@/lib/dashboard-locations";
import type { Species } from "@/lib/data";
import { findSpecies } from "@/lib/species-catalog";
import SpeciesName from "@/components/SpeciesName";
import { SampleBadge } from "@/components/StatusBadge";

export default function DashboardOccurrenceTimeline({ summary, failed, catalog, species }: { summary: DashboardSummary | null; failed: boolean; catalog: Species[]; species: DashboardSpeciesOccurrence[] }) {
  const [selectedSpecies, setSelectedSpecies] = useState("");
  const selected = species.find((item) => item.speciesId === selectedSpecies) ?? species[0];
  return (
    <section className="card-panel min-w-0 p-4 sm:p-5" aria-labelledby="occurrence-time-heading" aria-busy={!summary && !failed}>
      <div className="flex flex-wrap items-center gap-2"><h2 id="occurrence-time-heading" className="t-plate-title text-text">Pollen Occurrence Over Time</h2>{Boolean(summary?.sampleCount) && <SampleBadge />}</div>
      <p className="mt-1 text-[13px] text-text-muted">When each pollen type was recorded in the selected location and period.</p>
      {!summary && !failed ? <div role="status" aria-label="Loading occurrence history" className="mt-4 h-40 animate-pulse rounded-sm bg-surface-sunken" />
        : failed ? <p className="py-8 text-[13px] text-text-muted">Occurrence history unavailable. Use Try Again above to reload.</p>
        : !summary?.collectionCount ? <p className="py-8 text-[13px] text-text-muted">No finalized collections in this location and period.</p>
        : !selected ? <p className="py-8 text-[13px] text-text-muted">No pollen detections recorded in these collections.</p>
        : <>
          <div className="mt-4 md:hidden">
            <label className="flex min-w-0 flex-col gap-1 text-[12px] text-text-muted">Pollen Type<select className="focus-ring min-h-11 w-full min-w-0 rounded-sm border border-border bg-surface px-3 text-[14px] text-text" value={selected.speciesId} onChange={(event) => setSelectedSpecies(event.target.value)}>{species.map((item) => <option key={item.speciesId} value={item.speciesId}>{findSpecies(catalog, item.speciesId).scientificName}</option>)}</select></label>
            <ol className="mt-3 grid grid-cols-2 gap-x-4">{summary.monthly.map((month, index) => {
              const count = selected.monthly[index];
              const content = <><span className="block text-[13px] text-text-muted">{month.month} {month.monthKey.slice(0, 4)}{month.monthKey === summary.currentMonthKey && <span className="ml-1 text-[12px]">(so far)</span>}</span><span className="mt-1 flex items-center gap-1 text-[14px] tabular-nums text-text">{month.collectionCount ? `${count} of ${month.collectionCount}` : "No collections"}{count > 0 && <ArrowUpRight size={13} aria-hidden="true" />}</span></>;
              return <li key={month.monthKey} className="border-b border-border">{count ? <Link href={dashboardOccurrenceHref(summary, selected.speciesId, undefined, month.monthKey)} className="focus-ring block min-h-16 rounded-sm py-3 hover:bg-surface-sunken" aria-label={`${findSpecies(catalog, selected.speciesId).scientificName}, ${month.month} ${month.monthKey.slice(0, 4)}: ${count} of ${month.collectionCount} collections. Open supporting reports.`}>{content}</Link> : <div className="min-h-16 py-3">{content}</div>}</li>;
            })}</ol>
          </div>
          <div className="focus-ring mt-4 hidden max-h-96 overflow-auto rounded-sm md:block" role="region" aria-label="Pollen occurrence by month, scroll for all months and species" tabIndex={0}>
            <table className="w-full table-fixed border-separate border-spacing-0 text-left" style={{ minWidth: `${208 + summary.monthly.length * 64}px`, tableLayout: "fixed" }}>
              <caption className="sr-only">Monthly collections containing each species out of finalized collections in that month. The current month is marked as so far when it falls in the selected period.</caption>
              <colgroup><col style={{ width: "208px" }} />{summary.monthly.map((month) => <col key={month.monthKey} style={{ width: "64px" }} />)}</colgroup>
              <thead><tr><th scope="col" className="sticky top-0 left-0 z-30 w-52 border-r border-b border-border bg-surface px-3 py-2 text-[12px] font-medium text-text-muted">Pollen Type</th>{summary.monthly.map((month) => <th key={month.monthKey} scope="col" className="sticky top-0 z-20 border-b border-border bg-surface px-1 py-2 text-center text-[12px] font-medium text-text">{month.month}<span className="block font-normal text-text-muted">{month.monthKey.slice(0, 4)}</span>{month.monthKey === summary.currentMonthKey && <span className="block font-normal text-text-muted">So far</span>}</th>)}</tr></thead>
              <tbody>{species.map((item) => <tr key={item.speciesId}><th scope="row" className="sticky left-0 z-10 border-r border-b border-border bg-surface px-3 py-2 font-normal"><SpeciesName species={findSpecies(catalog, item.speciesId)} commonName={false} className="break-words text-[14px] text-text" /></th>{item.monthly.map((count, index) => <td key={summary.monthly[index].monthKey} className="border-b border-border p-0.5 text-center text-[13px] tabular-nums text-text">{count ? <Link href={dashboardOccurrenceHref(summary, item.speciesId, undefined, summary.monthly[index].monthKey)} className="focus-ring flex min-h-11 items-center justify-center rounded-sm underline decoration-border-strong underline-offset-4 hover:bg-surface-sunken" aria-label={`${findSpecies(catalog, item.speciesId).scientificName}, ${summary.monthly[index].month} ${summary.monthly[index].monthKey.slice(0, 4)}: ${count} of ${summary.monthly[index].collectionCount} collections. Open supporting reports.`}>{count}/{summary.monthly[index].collectionCount}</Link> : <span>{summary.monthly[index].collectionCount ? `0/${summary.monthly[index].collectionCount}` : "—"}</span>}</td>)}</tr>)}</tbody>
            </table>
          </div>
          <p className="mt-3 border-t border-border pt-3 text-[12px] text-text-muted">Each value is collections containing the type / collections recorded that month. “0” means none contained it; “—” means no collections. The current month is incomplete when it falls in the selected period.{summary.sampleCount > 0 && " Includes illustrative sample detections."}</p>
        </>}
    </section>
  );
}
