import type { DashboardSummary, DashboardMeasurement } from "@/lib/dashboard";

function range(value: DashboardMeasurement | null, unit: string) {
  if (!value) return "Not recorded";
  const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
  return `${number.format(value.minimum)}${value.maximum !== value.minimum ? `–${number.format(value.maximum)}` : ""}${unit}`;
}

export default function DashboardCollectionConditions({ summary, failed }: { summary: DashboardSummary | null; failed: boolean }) {
  const conditions = summary?.conditions;
  return (
    <section className="card-panel min-w-0 p-4 sm:p-5" aria-labelledby="collection-conditions-heading" aria-busy={!summary && !failed}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div>
          <h2 id="collection-conditions-heading" className="t-plate-title text-text">Collection Conditions</h2>
        </div>
        {summary && Boolean(conditions?.recordedCount) && <p className="text-[12px] text-text-muted">Weather recorded in {conditions?.recordedCount} of {summary.collectionCount} collections.</p>}
      </div>
      {!summary && !failed ? <div role="status" aria-label="Loading collection conditions" className="mt-4 grid gap-3 sm:grid-cols-3">{[0, 1, 2].map((index) => <div key={index} className="h-16 animate-pulse rounded-sm bg-surface-sunken" />)}</div>
        : failed ? <p className="py-8 text-[13px] text-text-muted">Collection conditions unavailable. Use Try Again above to reload.</p>
        : !summary?.collectionCount ? <p className="py-8 text-[13px] text-text-muted">No finalized collections in this location and period.</p>
        : !conditions?.recordedCount ? <p className="py-8 text-[13px] text-text-muted">Weather was not recorded for {summary.collectionCount === 1 ? "this collection" : `these ${summary.collectionCount} collections`}.</p>
        : <>
          <dl className="mt-4 grid border-t border-border sm:grid-cols-3">{[{ label: "Temperature", value: conditions.temperature, unit: "°C" }, { label: "Humidity", value: conditions.humidity, unit: "% RH" }, { label: "Wind Speed", value: conditions.wind, unit: " km/h" }].map((item) => <div key={item.label} className="flex flex-wrap items-start justify-between gap-2 border-b border-border py-3 sm:block sm:border-b-0 sm:border-l sm:px-5 sm:first:border-l-0 sm:first:pl-0"><dt className="text-[13px] text-text-muted">{item.label}</dt><dd className="text-right sm:mt-2 sm:text-left"><span className="block text-[16px] tabular-nums text-text" style={{ fontFamily: "var(--font-mono)" }}>{range(item.value, item.unit)}</span>{item.value && <span className="mt-1 block text-[12px] text-text-muted">{item.value.recordedCount} of {summary.collectionCount} collections</span>}</dd></div>)}</dl>
          <details className="mt-2 sm:border-t sm:border-border"><summary className="focus-ring min-h-11 cursor-pointer rounded-sm py-3 text-[13px] text-text">Weather Condition Breakdown</summary><dl className="grid gap-x-6 sm:grid-cols-3">{conditions.conditions.map((condition) => <div key={condition.label} className="flex items-center justify-between gap-3 border-t border-border py-2 text-[13px]"><dt className="text-text-muted">{condition.label}</dt><dd className="tabular-nums text-text">{condition.collectionCount} {condition.collectionCount === 1 ? "collection" : "collections"}</dd></div>)}</dl></details>
        </>}
    </section>
  );
}
