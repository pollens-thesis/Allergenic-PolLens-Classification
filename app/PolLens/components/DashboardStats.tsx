import type { DashboardSummary } from "@/lib/dashboard";

export default function DashboardStats({ summary, failed }: { summary: DashboardSummary | null; failed: boolean }) {
  const confidence = summary && summary.grainCount > 0 ? `${Math.round(summary.avgConfidence * 100)}%` : "—";
  const metrics = [
    { label: "Grains Counted", value: summary?.grainCount.toLocaleString() },
    { label: "Pollen Types", value: summary?.pollenTypeCount.toLocaleString() },
    { label: "Average Model Confidence", value: confidence },
  ];

  return (
    <dl className="card-panel grid min-w-0 grid-cols-3 px-3 py-3 sm:px-5" aria-label="Pollen summary" aria-busy={!summary && !failed}>
      {metrics.map((metric) => (
        <div key={metric.label} className="min-w-0 border-l border-border px-3 first:border-l-0 first:pl-0 last:pr-0 sm:px-5">
          <dt className="min-h-8 text-[12px] leading-4 text-text-muted sm:min-h-0">{metric.label}</dt>
          <dd className="mt-2 text-[20px] leading-6 tabular-nums text-text" style={{ fontFamily: "var(--font-mono)" }}>
            {summary ? metric.value : failed ? "—" : <span aria-hidden="true" className="inline-block h-5 w-12 animate-pulse rounded-sm bg-surface-sunken" />}
            {summary && metric.label === "Average Model Confidence" && summary.grainCount === 0 && <span className="sr-only">No counted grains to calculate model confidence.</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
