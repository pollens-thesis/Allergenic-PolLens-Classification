"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  FileJson,
  FileSpreadsheet,
  Loader2,
  LogOut,
  Sheet,
} from "lucide-react";
import { type Specimen } from "@/lib/data";
import { displayName } from "@/lib/account";
import { useSettings } from "@/lib/settings";
import { signOut } from "@/lib/session";
import { listReports } from "@/lib/store";
import { exportReportsCsv, exportReportsJson, exportReportsXlsx } from "@/lib/export";
import { buttonVariants } from "@/components/Button";

export default function SettingsWorkspace() {
  const settings = useSettings();

  const [reports, setReports] = useState<Specimen[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listReports()
      .then((loaded) => {
        if (!cancelled) setReports(loaded);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const completedReports = reports?.filter((report) => report.status === "Completed") ?? [];
  const nonCompletedCount = reports ? reports.length - completedReports.length : 0;
  const name = displayName(settings);
  const reportCount = reports ? completedReports.length : loadFailed ? "—" : "…";
  const excludedCount = reports ? nonCompletedCount : loadFailed ? "—" : "…";

  return (
    <div className="card-panel divide-y divide-border overflow-hidden">
      <section className="p-4 sm:p-5">
        <h2 className="t-plate-title text-text">Data Export</h2>

        <div
          className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-text-muted"
          aria-live="polite"
          aria-busy={!reports && !loadFailed}
        >
          <p>
            <span className="text-text" style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
              {reportCount}
            </span>{" "}
            Completed
          </p>
          <p>
            <span className="text-text" style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
              {excludedCount}
            </span>{" "}
            Pending or Needs Review
          </p>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <button
            type="button"
            aria-label="Export completed reports as Excel"
            disabled={!reports || completedReports.length === 0 || exporting}
            onClick={async () => {
              setExporting(true);
              try {
                await exportReportsXlsx(completedReports);
                toast.success("Exported as Excel");
              } catch {
                toast.error("Couldn't build the Excel file. Try again.");
              } finally {
                setExporting(false);
              }
            }}
            className={`${buttonVariants({ intent: "secondary", size: "sm" })} focus-ring min-h-11 w-full`}
          >
            {exporting ? (
              <Loader2 size={14} strokeWidth={1.75} className="animate-spin" />
            ) : (
              <Sheet size={14} strokeWidth={1.75} />
            )}
            <span>Excel</span>
          </button>
          <button
            type="button"
            aria-label="Export completed reports as CSV"
            disabled={!reports || completedReports.length === 0}
            onClick={() => {
              exportReportsCsv(completedReports);
              toast.success("Exported as CSV");
            }}
            className={`${buttonVariants({ intent: "secondary", size: "sm" })} focus-ring min-h-11 w-full`}
          >
            <FileSpreadsheet size={14} strokeWidth={1.75} />
            <span>CSV</span>
          </button>
          <button
            type="button"
            aria-label="Export completed reports as JSON"
            disabled={!reports || completedReports.length === 0}
            onClick={() => {
              exportReportsJson(completedReports);
              toast.success("Exported as JSON");
            }}
            className={`${buttonVariants({ intent: "secondary", size: "sm" })} focus-ring min-h-11 w-full`}
          >
            <FileJson size={14} strokeWidth={1.75} />
            <span>JSON</span>
          </button>
        </div>

        {loadFailed && (
          <p role="alert" className="mt-2 text-[13px] text-text-muted">
            Reports couldn&apos;t load. Reload to try again.
          </p>
        )}
      </section>

      <section className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <h2 className="t-plate-title mb-3 text-text">Profile</h2>
            <p className="truncate text-[15px] font-medium text-text">{name}</p>
            <p className="mt-0.5 break-all text-[13px] text-text-muted">
              {settings.email || "Not signed in"}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end sm:gap-1.5">
            <button
              type="button"
              disabled={signingOut}
              onClick={async () => {
                setSigningOut(true);
                await signOut();
                // A full load, not a client push: drops in-memory data from this
                // account (e.g. the live species catalog) along with the session.
                window.location.replace("/");
              }}
              className={`${buttonVariants({ intent: "caution", size: "md" })} focus-ring`}
            >
              {signingOut ? (
                <Loader2 size={14} strokeWidth={1.75} className="animate-spin" />
              ) : (
                <LogOut size={14} strokeWidth={1.75} />
              )}
              {signingOut ? "Signing Out…" : "Sign Out"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
