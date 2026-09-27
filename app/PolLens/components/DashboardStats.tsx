import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import type { DashboardSummary } from "@/lib/dashboard";

function MetricCard({
  value,
  label,
  children,
  className = "",
  href,
  busy = false,
}: {
  value: number | null | undefined;
  label: string;
  children: ReactNode;
  className?: string;
  href?: string;
  busy?: boolean;
}) {
  const frame = `card-panel h-full min-w-0 p-4 ${className}`;
  const accessibleValue = value === undefined ? "loading" : value === null ? "unavailable" : value.toLocaleString();

  return href ? (
    <Link
      href={href}
      className="focus-ring group block h-full rounded-card"
      aria-label={`${label}: ${accessibleValue}. Open the pollen map.`}
      aria-busy={busy}
    >
      <div className={`${frame} card-panel-interactive`}>{children}</div>
    </Link>
  ) : (
    <div className={frame} aria-busy={busy}>{children}</div>
  );
}

function Figure({ value, scale = "regular" }: { value: number | null | undefined; scale?: "regular" | "large" }) {
  if (value === undefined) {
    return <span aria-hidden="true" className={`${scale === "large" ? "h-14 w-28" : "h-10 w-20"} animate-pulse rounded-sm bg-surface-sunken`} />;
  }

  return (
    <span
      className={`${scale === "large" ? "text-[3rem] sm:text-[3.5rem]" : "text-[2.5rem]"} leading-none tabular-nums lining-nums text-text`}
      style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}
    >
      {value === null ? "—" : value.toLocaleString()}
    </span>
  );
}

function SecondaryFigure({ value }: { value: number | null | undefined }) {
  if (value === undefined) return <span aria-hidden="true" className="inline-block h-4 w-8 animate-pulse rounded-sm bg-surface" />;
  return <span>{value === null ? "—" : value.toLocaleString()}</span>;
}

function QueueRow({ label, count, href, status }: { label: string; count: number | null | undefined; href?: string; status: "review" | "pending" }) {
  const content = (
    <>
      <span className={status === "review" ? "text-danger" : "text-processing"}>{label}</span>
      <span className="flex items-center gap-2.5">
        <span className="font-medium tabular-nums text-text" style={{ fontFamily: "var(--font-mono)" }}>
          {count === undefined ? <span aria-hidden="true" className="inline-block h-4 w-8 animate-pulse rounded-sm bg-surface-sunken" /> : count === null ? "—" : count.toLocaleString()}
        </span>
        {href && <ArrowUpRight size={14} strokeWidth={1.75} aria-hidden="true" />}
      </span>
    </>
  );
  const className = `flex min-h-11 items-center justify-between gap-3 border-t border-border py-2 text-[13px] ${href ? "focus-ring rounded-sm text-text-muted transition-colors hover:text-text" : ""}`;

  return href ? <Link href={href} className={className}>{content}</Link> : <div className={className}>{content}</div>;
}

function QueueCard({ summary, failed }: { summary: DashboardSummary | null; failed: boolean }) {
  const reviewHref = summary ? `/reports?${new URLSearchParams({ status: "Needs review", from: summary.from, to: summary.to })}` : undefined;
  const pendingHref = summary ? `/reports?${new URLSearchParams({ status: "Pending", from: summary.from, to: summary.to })}` : undefined;

  return (
    <section className="card-panel flex h-full min-w-0 flex-col p-4 sm:p-5" aria-labelledby="queue-card-heading" aria-busy={!summary && !failed}>
      <div className="mb-auto pb-3">
        <h2 id="queue-card-heading" className="text-[14px] font-medium text-text">Needs Attention</h2>
        <p className="mt-1 text-[12px] text-text-muted">Analysis status in this period</p>
      </div>
      <QueueRow label="Needs Review" count={summary?.needsReviewCount ?? (failed ? null : undefined)} href={reviewHref} status="review" />
      <QueueRow label="Pending" count={summary?.pendingCount ?? (failed ? null : undefined)} href={pendingHref} status="pending" />
    </section>
  );
}

export default function DashboardStats({ summary, failed }: { summary: DashboardSummary | null; failed: boolean }) {
  const speciesCount = summary?.topTypes.length ?? 0;
  const metricValue = (value: number | undefined) => summary ? value : failed ? null : undefined;

  return (
    <section aria-label="Collection summary">
      <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          label="Slides"
          value={metricValue(summary?.slideCount)}
          busy={!summary && !failed}
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[14px] font-medium text-text">Slides</h2>
            </div>
            <dl className="mt-auto pt-4">
              <dt className="sr-only">Slides across finalized collections</dt>
              <dd className="flex flex-wrap items-baseline gap-2.5">
                <Figure value={metricValue(summary?.slideCount)} scale="large" />
                <span className="text-[13px] text-text-muted">slides</span>
              </dd>
            </dl>
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3 text-[12px] text-text-muted">
              <span>Across finalized collections</span>
              <span className="shrink-0 font-medium tabular-nums text-text" style={{ fontFamily: "var(--font-mono)" }}>
                <SecondaryFigure value={metricValue(summary?.collectionCount)} />
              </span>
            </div>
          </div>
        </MetricCard>

        <MetricCard
          label="Pollen grains"
          value={metricValue(summary?.grainCount)}
          busy={!summary && !failed}
          className="sm:p-5"
        >
          <div className="flex h-full flex-col">
            <div>
              <h2 className="text-[14px] font-medium text-text">Pollen Grains</h2>
              <dl className="mt-4">
                <dt className="sr-only">Recorded pollen grains</dt>
                <dd className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                  <Figure value={metricValue(summary?.grainCount)} scale="large" />
                  <span className="text-[13px] text-text-muted">grains</span>
                </dd>
              </dl>
            </div>
            <dl className="mt-auto border-t border-border pt-3 text-[12px] text-text-muted">
              <div className="flex items-center justify-between gap-3">
                <dt>Pollen types</dt>
                <dd className="font-medium tabular-nums text-text" style={{ fontFamily: "var(--font-mono)" }}><SecondaryFigure value={metricValue(speciesCount)} /></dd>
              </div>
              {summary && summary.grainCount > 0 && (
                <div className="mt-1.5 flex items-center justify-between gap-3">
                  <dt>Average confidence</dt>
                  <dd className="font-medium tabular-nums text-text" style={{ fontFamily: "var(--font-mono)" }}>{Math.round(summary.avgConfidence * 100)}%</dd>
                </div>
              )}
            </dl>
          </div>
        </MetricCard>

        <QueueCard summary={summary} failed={failed} />
      </div>
      {summary && summary.sampleCount > 0 && (
        <p className="mt-2 text-[12px] text-processing" role="note">Sample detections in {summary.sampleCount} collections; counts are illustrative.</p>
      )}
    </section>
  );
}
