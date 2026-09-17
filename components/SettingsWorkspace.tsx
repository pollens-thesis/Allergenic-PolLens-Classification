"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { toast } from "sonner";
import {
  AlertTriangle,
  Database,
  Download,
  FileJson,
  FileSpreadsheet,
  Loader2,
  LogOut,
  Mail,
  Trash2,
  UserRound,
} from "lucide-react";
import type { Specimen } from "@/lib/data";
import { accountName, getInitials, institutionFromEmail } from "@/lib/account";
import { resetSettings, useSettings } from "@/lib/settings";
import { clearAllReports, getStorageSummary, listReports } from "@/lib/store";
import { exportReportsCsv, exportReportsJson } from "@/lib/export";
import { Button } from "@/components/Button";

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
    <section className="rounded-lg border border-border bg-surface p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-sunken">
          <Icon size={16} strokeWidth={1.75} className="text-text-muted" />
        </span>
        <div>
          <h2 className="text-lg text-text" style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>
            {title}
          </h2>
          <p className="mt-0.5 text-[13px] text-text-muted">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SettingsWorkspace() {
  const settings = useSettings();
  const router = useRouter();

  const [reports, setReports] = useState<Specimen[] | null>(null);
  const [storage, setStorage] = useState<{
    reportCount: number;
    imageCount: number;
    approxBytes: number;
  } | null>(null);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listReports(), getStorageSummary()]).then(([loaded, summary]) => {
      if (cancelled) return;
      setReports(loaded);
      setStorage(summary);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleClearAll() {
    setClearing(true);
    await clearAllReports();
    const [loaded, summary] = await Promise.all([listReports(), getStorageSummary()]);
    setReports(loaded);
    setStorage(summary);
    setClearing(false);
    setClearDialogOpen(false);
  }

  const savedReportCount = storage?.reportCount ?? 0;
  const name = accountName(settings.email);
  const institution = institutionFromEmail(settings.email);

  return (
    <div className="flex flex-col gap-6">
      {/* Profile */}
      <Section
        icon={UserRound}
        title="Profile"
        description="Read from the account you signed in with. Reports you save are filed under this name and it is printed on their PDFs."
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

        <p className="mt-3 text-[12.5px] leading-relaxed text-text-muted">
          {institution ? (
            <>
              <span className="font-medium text-text">{institution}</span>{" "}
              comes from the domain of that address, so the name on a report always matches the account that saved it. To
              file under a different institution, sign in with that institution&rsquo;s mailbox.
            </>
          ) : settings.email ? (
            <>
              This address is not on an institution domain, so the console uses the mailbox&rsquo;s
              own name. Signing in with an institution address — <code>name@mseuf.edu.ph</code> —
              files reports under that institution instead.
            </>
          ) : (
            <>
              No account is signed in on this browser, so reports fall back to a generic name. Sign
              in from the landing page to file them under your institution.
            </>
          )}
        </p>
      </Section>

      {/* Data and storage */}
      <Section
        icon={Database}
        title="Data & storage"
        description="Reports are saved in this browser. Export them to keep a copy elsewhere or to analyze them in other software."
      >
        <div className="mb-4 grid grid-cols-3 gap-3 rounded-md bg-surface-sunken px-3 py-3 text-center">
          <div>
            <div className="text-[17px] text-text" style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
              {storage ? savedReportCount : "—"}
            </div>
            <div className="text-[12px] text-text-muted">Saved here</div>
          </div>
          <div>
            <div className="text-[17px] text-text" style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
              {storage ? storage.imageCount : "—"}
            </div>
            <div className="text-[12px] text-text-muted">Slide images</div>
          </div>
          <div>
            <div className="text-[17px] text-text" style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
              {storage ? formatBytes(storage.approxBytes) : "—"}
            </div>
            <div className="text-[12px] text-text-muted">Approx. size</div>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={!reports}
            onClick={() => {
              if (!reports) return;
              exportReportsJson(reports);
              toast.success("Exported as JSON");
            }}
            className="focus-ring flex flex-1 items-center justify-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text-muted transition-[color,border-color] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:text-text hover:border-border-strong active:scale-[0.97] disabled:opacity-50"
          >
            <FileJson size={14} strokeWidth={1.75} />
            Export JSON backup
          </button>
          <button
            type="button"
            disabled={!reports}
            onClick={() => {
              if (!reports) return;
              exportReportsCsv(reports);
              toast.success("Exported as CSV");
            }}
            className="focus-ring flex flex-1 items-center justify-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text-muted transition-[color,border-color] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:text-text hover:border-border-strong active:scale-[0.97] disabled:opacity-50"
          >
            <FileSpreadsheet size={14} strokeWidth={1.75} />
            Export CSV for analysis
          </button>
        </div>
        {/* The text lives in its own span: as bare children of a flex row the
            runs either side of {count} become separate flex items and the
            spaces around the number are lost. */}
        <p className="mt-2 flex items-start gap-1.5 text-[12.5px] text-text-muted">
          <Download size={12} strokeWidth={1.75} className="mt-0.5 shrink-0" />
          <span>
            Exports cover all {reports?.length ?? 0}{" "}
            reports, including the sample records that ship with the app. Slide images
            aren&apos;t included — download a report&apos;s PDF for those.
          </span>
        </p>

        <div className="mt-5 rounded-md border border-danger/25 bg-danger-bg p-3.5">
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={15} strokeWidth={1.75} className="mt-0.5 shrink-0 text-danger" />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-text">Clear locally saved reports</div>
              <p className="mt-0.5 text-[12.5px] text-text-muted">
                Permanently deletes the {savedReportCount}{" "}
                {savedReportCount === 1 ? "report" : "reports"}{" "}
                saved in this browser, and their slide images. The sample records that ship with
                the app stay. This cannot be undone — export a backup first.
              </p>

              <AlertDialog.Root open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
                <AlertDialog.Trigger
                  disabled={savedReportCount === 0}
                  className="focus-ring mt-2.5 inline-flex items-center gap-1.5 rounded-md border border-danger/30 bg-surface px-3 py-1.5 text-[13px] text-danger transition-[background-color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:bg-danger-bg active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Trash2 size={13} strokeWidth={1.75} />
                  Clear saved reports
                </AlertDialog.Trigger>
                <AlertDialog.Portal>
                  <AlertDialog.Backdrop className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity duration-[var(--duration-base)] ease-[var(--ease-out)] data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
                  <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-surface p-5 shadow-lg outline-none transition-all duration-[var(--duration-base)] ease-[var(--ease-out)] data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0">
                    <AlertDialog.Title className="text-[15px] font-medium text-text">
                      Clear all saved reports?
                    </AlertDialog.Title>
                    <AlertDialog.Description className="mt-2 text-[13px] leading-relaxed text-text-muted">
                      This permanently deletes the {savedReportCount}{" "}
                      {savedReportCount === 1 ? "report" : "reports"} saved in this browser, along
                      with their slide images. The sample records that ship with the app stay. This
                      cannot be undone.
                    </AlertDialog.Description>
                    <div className="mt-4 flex justify-end gap-2">
                      <AlertDialog.Close
                        disabled={clearing}
                        className="focus-ring rounded-md border border-border bg-surface px-3 py-1.5 text-[13px] text-text-muted transition-[color,border-color] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:text-text hover:border-border-strong active:scale-[0.97]"
                      >
                        Cancel
                      </AlertDialog.Close>
                      <Button
                        type="button"
                        intent="destructive"
                        size="sm"
                        disabled={clearing}
                        onClick={handleClearAll}
                      >
                        {clearing ? (
                          <>
                            <Loader2 size={13} strokeWidth={1.75} className="animate-spin" />
                            Deleting…
                          </>
                        ) : (
                          <>
                            <Trash2 size={13} strokeWidth={1.75} />
                            Yes, delete them
                          </>
                        )}
                      </Button>
                    </div>
                  </AlertDialog.Popup>
                </AlertDialog.Portal>
              </AlertDialog.Root>
            </div>
          </div>
        </div>
      </Section>

      {/* Account */}
      <Section
        icon={LogOut}
        title="Account"
        description="Sign-in is not connected to a real provider yet, so signing out just forgets the account stored in this browser. Your saved reports stay."
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-[13px] text-text-muted">
            {settings.email ? (
              <>
                Signed in as <span className="text-text">{name}</span>
                <span className="text-text-muted"> · {settings.email}</span>
              </>
            ) : (
              "No account signed in on this browser."
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              resetSettings();
              router.push("/");
            }}
            className="focus-ring inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text-muted transition-[color,border-color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:text-text hover:border-border-strong active:scale-[0.97]"
          >
            <LogOut size={14} strokeWidth={1.75} />
            Sign out
          </button>
        </div>
      </Section>
    </div>
  );
}
