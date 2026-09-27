"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Database,
  Download,
  FileJson,
  FileSpreadsheet,
  Loader2,
  LogOut,
  Mail,
  Sheet,
  UserRound,
} from "lucide-react";
import { isFinalised, type Specimen } from "@/lib/data";
import { displayName, getInitials, institutionFromEmail } from "@/lib/account";
import { useSettings } from "@/lib/settings";
import { signOut } from "@/lib/session";
import { listReports } from "@/lib/store";
import { exportReportsCsv, exportReportsJson, exportReportsXlsx } from "@/lib/export";
import { buttonVariants } from "@/components/Button";

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof UserRound;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card-panel p-4 sm:p-5">
      <div className="mb-3 flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-sunken">
          <Icon size={16} strokeWidth={1.75} className="text-text-muted" />
        </span>
        <div>
          <h2 className="t-plate-title text-text">
            {title}
          </h2>
          <p className="mt-0.5 text-[13px] text-text-muted">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

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

  const finalised = reports?.filter(isFinalised) ?? [];
  const name = displayName(settings);
  const institution = institutionFromEmail(settings.email);

  return (
    <div className="flex flex-col gap-6">
      {/* Profile */}
      <Section
        icon={UserRound}
        title="Profile"
        description="Signed-in research account."
      >
        <div className="flex items-center gap-3.5 rounded-md border border-border bg-surface px-3.5 py-3">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-muted text-[15px] text-accent"
            style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}
          >
            {getInitials(name)}
          </span>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[15px] font-medium text-text">{name}</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[13px] text-text-muted">
              <Mail size={13} strokeWidth={1.75} className="shrink-0 text-text-faint" />
              <span className="truncate">{settings.email || "Not signed in"}</span>
            </div>
          </div>
        </div>

        <p className="t-prose mt-3 text-text-muted">
          Default researcher for new reports. Change it on a report when needed.{" "}
          {institution ? (
            <>
              Institution: <span className="font-medium text-text">{institution}</span>.
            </>
          ) : (
            <>No institution domain detected.</>
          )}
        </p>
      </Section>

      {/* Data export */}
      <Section
        icon={Database}
        title="Data Export"
        description="Download finalized shared reports."
      >
        <div className="card-well mb-4 grid grid-cols-2 gap-3 px-3 py-3 text-center">
          <div>
            <div className="text-lg text-text" style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
              {reports ? finalised.length : loadFailed ? "—" : "…"}
            </div>
            <div className="text-[12px] text-text-muted">Finalized Reports</div>
          </div>
          <div>
            <div className="text-lg text-text" style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
              {reports ? reports.length - finalised.length : loadFailed ? "—" : "…"}
            </div>
            <div className="text-[12px] text-text-muted">Pending (Not Exported)</div>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={!reports || finalised.length === 0 || exporting}
            onClick={async () => {
              setExporting(true);
              try {
                await exportReportsXlsx(finalised);
                toast.success("Exported as Excel");
              } catch {
                toast.error("Couldn't build the Excel file. Try again.");
              } finally {
                setExporting(false);
              }
            }}
            className={`${buttonVariants({ intent: "secondary", size: "md" })} focus-ring flex-1`}
          >
            {exporting ? <Loader2 size={14} strokeWidth={1.75} className="animate-spin" /> : <Sheet size={14} strokeWidth={1.75} />}
            Export Excel
          </button>
          <button
            type="button"
            disabled={!reports || finalised.length === 0}
            onClick={() => {
              exportReportsCsv(finalised);
              toast.success("Exported as CSV");
            }}
            className={`${buttonVariants({ intent: "secondary", size: "md" })} focus-ring flex-1`}
          >
            <FileSpreadsheet size={14} strokeWidth={1.75} />
            Export CSV
          </button>
          <button
            type="button"
            disabled={!reports || finalised.length === 0}
            onClick={() => {
              exportReportsJson(finalised);
              toast.success("Exported as JSON");
            }}
            className={`${buttonVariants({ intent: "secondary", size: "md" })} focus-ring flex-1`}
          >
            <FileJson size={14} strokeWidth={1.75} />
            Export JSON
          </button>
        </div>
        <p className="mt-2 flex max-w-[68ch] items-start gap-1.5 text-[13px] text-text-muted">
          <Download size={12} strokeWidth={1.75} className="mt-0.5 shrink-0" />
          <span>
            {loadFailed
              ? "Couldn't reach the server to load reports. Reload the page to try again."
              : "Includes all researchers. Slide images are in report PDFs."}
          </span>
        </p>
      </Section>

      {/* Account */}
      <Section
        icon={LogOut}
        title="Account"
        description="Your reports stay on the server when you sign out."
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-[13px] text-text-muted">
            Signed in as <span className="text-text">{name}</span>
            {settings.email && <span className="text-text-muted"> · {settings.email}</span>}
          </div>
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
      </Section>
    </div>
  );
}
