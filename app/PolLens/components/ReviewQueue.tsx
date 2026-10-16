"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CircleCheck, CloudOff, Loader2, ShieldAlert } from "lucide-react";
import { formatCollectedAt, getReportGrains, type Specimen } from "@/lib/data";
import { SessionExpiredError } from "@/lib/api";
import { useSettings } from "@/lib/settings";
import { listReports } from "@/lib/store";
import { Button } from "@/components/Button";
import { SampleBadge } from "@/components/StatusBadge";

/**
 * Reports waiting for a verifier, oldest collection first so none is forgotten.
 * Opening one shows the slides and counts with the Approve and Decline actions.
 */
export default function ReviewQueue() {
  const { role } = useSettings();
  const [reports, setReports] = useState<Specimen[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const canReview = role === "verifier" || role === "admin";

  useEffect(() => {
    if (!canReview) return;
    let cancelled = false;
    listReports({ verification: "Awaiting" })
      .then((loaded) => {
        if (cancelled) return;
        // Only submitted reports this person can rule on (not their own).
        setReports(loaded.filter((report) => report.canVerify).sort((a, b) => a.collectedAt.localeCompare(b.collectedAt)));
      })
      .catch((err: unknown) => {
        if (cancelled || err instanceof SessionExpiredError) return;
        setError(err instanceof Error ? err.message : "Couldn't load the review queue.");
      });
    return () => {
      cancelled = true;
    };
  }, [canReview, attempt]);

  // The role arrives from the server just after sign-in.
  if (role === undefined) return <Loading label="Checking your access…" />;

  if (!canReview) {
    return (
      <div className="card-panel flex flex-col items-center gap-3 px-6 py-16 text-center">
        <ShieldAlert size={22} strokeWidth={1.5} className="text-text-faint" />
        <p className="max-w-md text-[13.5px] text-text-muted">
          The review queue is for verifiers and admins. Ask an admin if you should be one.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card-panel flex flex-col items-center gap-3 px-6 py-16 text-center">
        <CloudOff size={22} strokeWidth={1.5} className="text-text-faint" />
        <p className="text-[13.5px] text-text-muted">{error}</p>
        <Button
          type="button"
          intent="secondary"
          size="sm"
          onClick={() => {
            setError(null);
            setAttempt((n) => n + 1);
          }}
        >
          Try Again
        </Button>
      </div>
    );
  }

  if (reports === null) return <Loading label="Loading the review queue…" />;

  if (reports.length === 0) {
    return (
      <div className="card-panel flex flex-col items-center gap-3 px-6 py-16 text-center">
        <CircleCheck size={22} strokeWidth={1.5} className="text-success" />
        <p className="text-[13.5px] text-text-muted">Nothing is waiting for verification.</p>
      </div>
    );
  }

  return (
    <div className="card-panel overflow-hidden">
      <p className="border-b border-border px-4 py-3 text-[13px] text-text-muted" aria-live="polite">
        {reports.length} {reports.length === 1 ? "report is" : "reports are"} waiting for verification.
      </p>
      <ul className="divide-y divide-border">
        {reports.map((report) => (
          <li key={report.sampleId}>
            <Link
              href={`/reports/${report.sampleId}`}
              className="focus-ring flex flex-col gap-1 px-4 py-3 transition-colors hover:bg-surface-hover sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <span className="min-w-0">
                <span className="block break-words text-[13.5px] font-medium text-text">
                  {report.reportName || report.location || "No location recorded"}
                </span>
                <span className="mt-0.5 block text-[12.5px] text-text-muted">
                  {report.location || "No location recorded"} · Collected {formatCollectedAt(report.collectedAt)}
                </span>
              </span>
              <span className="flex flex-wrap items-center gap-2 text-[12.5px] text-text-muted">
                {report.sampleDetections && <SampleBadge />}
                <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>{report.sampleId}</span>
                <span>
                  {report.slides.length} {report.slides.length === 1 ? "slide" : "slides"} ·{" "}
                  {getReportGrains(report).toLocaleString()} grains
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <div className="card-panel flex items-center justify-center gap-2 px-6 py-16 text-[13px] text-text-muted">
      <Loader2 size={16} strokeWidth={1.75} className="animate-spin" />
      {label}
    </div>
  );
}
