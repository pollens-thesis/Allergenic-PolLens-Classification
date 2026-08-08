"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  Database,
  Download,
  FileJson,
  FileSpreadsheet,
  Loader2,
  LogOut,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  UserRound,
} from "lucide-react";
import { weatherConditionOptions, type Specimen, type WeatherCondition } from "@/lib/data";
import {
  DEFAULT_SETTINGS,
  getInitials,
  resetSettings,
  updateSettings,
  useSettings,
} from "@/lib/settings";
import { clearAllReports, getStorageSummary, listReports } from "@/lib/store";
import { exportReportsCsv, exportReportsJson } from "@/lib/export";

const fieldClass =
  "focus-ring w-full rounded-md border border-panel-line bg-white px-3 py-2 text-[13px] text-ink placeholder:text-ink/70";

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
    <section className="rounded-lg border border-panel-line bg-white/60 p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-panel">
          <Icon size={16} strokeWidth={1.75} className="text-ink/70" />
        </span>
        <div>
          <h2 className="text-lg text-ink" style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>
            {title}
          </h2>
          <p className="mt-0.5 text-[13px] text-ink/70">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12.5px] text-ink/70">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12px] text-ink/70">{hint}</span>}
    </label>
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
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

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

  /** Settings persist on every keystroke; the tick is just reassurance. */
  function patch(next: Partial<typeof settings>) {
    updateSettings(next);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1200);
  }

  async function handleClearAll() {
    setClearing(true);
    await clearAllReports();
    const [loaded, summary] = await Promise.all([listReports(), getStorageSummary()]);
    setReports(loaded);
    setStorage(summary);
    setClearing(false);
    setConfirmingClear(false);
  }

  const savedReportCount = storage?.reportCount ?? 0;

  return (
    <div className="flex flex-col gap-6">
      {savedFlash && (
        <div
          role="status"
          className="fixed top-5 right-5 z-10 flex items-center gap-2 rounded-md border border-panel-line bg-white px-3 py-2 text-[13px] text-ink/70 shadow-sm"
        >
          <Check size={14} strokeWidth={2} className="text-[#3f7a4f]" />
          Saved
        </div>
      )}

      {/* Profile */}
      <Section
        icon={UserRound}
        title="Profile"
        description="Your name is recorded on every report you save and printed on its PDF."
      >
        <div className="mb-4 flex items-center gap-3">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-full bg-anther/15 text-[15px] text-anther-ink"
            style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}
          >
            {getInitials(settings.displayName)}
          </span>
          <div className="leading-tight">
            <div className="text-[14px] text-ink">{settings.displayName || "Unnamed"}</div>
            <div className="text-[13px] text-ink/70">
              {settings.institution || "No institution set"}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Display name">
            <input
              type="text"
              value={settings.displayName}
              onChange={(e) => patch({ displayName: e.target.value })}
              placeholder="e.g. Niño Elma"
              className={fieldClass}
            />
          </Field>
          <Field label="Role">
            <input
              type="text"
              value={settings.role}
              onChange={(e) => patch({ role: e.target.value })}
              placeholder="e.g. Undergraduate researcher"
              className={fieldClass}
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={settings.email}
              onChange={(e) => patch({ email: e.target.value })}
              placeholder="you@university.edu"
              className={fieldClass}
            />
          </Field>
          <Field label="Institution">
            <input
              type="text"
              value={settings.institution}
              onChange={(e) => patch({ institution: e.target.value })}
              placeholder="e.g. Southern Luzon State University"
              className={fieldClass}
            />
          </Field>
        </div>
      </Section>

      {/* Analysis defaults */}
      <Section
        icon={SlidersHorizontal}
        title="Analysis defaults"
        description="Applied when you start a new batch, so a repeat site isn't retyped every time. You can still change any of it per batch."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Default location" hint="Prefills the Location field on the Analyze screen.">
            <input
              type="text"
              value={settings.defaultLocation}
              onChange={(e) => patch({ defaultLocation: e.target.value })}
              placeholder="e.g. Lucena City, Quezon"
              className={fieldClass}
            />
          </Field>
          <Field label="Default weather condition">
            <select
              value={settings.defaultWeatherCondition}
              onChange={(e) =>
                patch({ defaultWeatherCondition: e.target.value as WeatherCondition })
              }
              className={fieldClass}
            >
              {weatherConditionOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-md border border-panel-line bg-white px-3 py-2.5">
          <input
            type="checkbox"
            checked={settings.autoStampCollectionTime}
            onChange={(e) => patch({ autoStampCollectionTime: e.target.checked })}
            className="focus-ring mt-0.5 h-4 w-4 shrink-0 accent-[#23261f]"
          />
          <span>
            <span className="block text-[13px] text-ink">Stamp collection time automatically</span>
            <span className="mt-0.5 block text-[12.5px] text-ink/65">
              Fills the date and time with &ldquo;now&rdquo; when you add the first image. Turn this
              off if you usually analyze slides well after collecting them, and would rather enter
              the real moment yourself.
            </span>
          </span>
        </label>

        <button
          type="button"
          onClick={() => {
            resetSettings();
            setSavedFlash(true);
            window.setTimeout(() => setSavedFlash(false), 1200);
          }}
          className="focus-ring mt-4 inline-flex items-center gap-1.5 rounded-md border border-panel-line bg-white px-3 py-1.5 text-[13px] text-ink/70 transition hover:text-ink"
        >
          <RotateCcw size={13} strokeWidth={1.75} />
          Reset all settings to defaults
        </button>
      </Section>

      {/* Data and storage */}
      <Section
        icon={Database}
        title="Data & storage"
        description="Reports are saved in this browser. Export them to keep a copy elsewhere or to analyze them in other software."
      >
        <div className="mb-4 grid grid-cols-3 gap-3 rounded-md bg-panel/60 px-3 py-3 text-center">
          <div>
            <div className="text-[17px] text-ink" style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
              {storage ? savedReportCount : "—"}
            </div>
            <div className="text-[12px] text-ink/65">Saved here</div>
          </div>
          <div>
            <div className="text-[17px] text-ink" style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
              {storage ? storage.imageCount : "—"}
            </div>
            <div className="text-[12px] text-ink/65">Slide images</div>
          </div>
          <div>
            <div className="text-[17px] text-ink" style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
              {storage ? formatBytes(storage.approxBytes) : "—"}
            </div>
            <div className="text-[12px] text-ink/65">Approx. size</div>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={!reports}
            onClick={() => reports && exportReportsJson(reports)}
            className="focus-ring flex flex-1 items-center justify-center gap-2 rounded-md border border-panel-line bg-white px-3 py-2 text-[13px] text-ink/75 transition hover:text-ink disabled:opacity-50"
          >
            <FileJson size={14} strokeWidth={1.75} />
            Export JSON backup
          </button>
          <button
            type="button"
            disabled={!reports}
            onClick={() => reports && exportReportsCsv(reports)}
            className="focus-ring flex flex-1 items-center justify-center gap-2 rounded-md border border-panel-line bg-white px-3 py-2 text-[13px] text-ink/75 transition hover:text-ink disabled:opacity-50"
          >
            <FileSpreadsheet size={14} strokeWidth={1.75} />
            Export CSV for analysis
          </button>
        </div>
        {/* The text lives in its own span: as bare children of a flex row the
            runs either side of {count} become separate flex items and the
            spaces around the number are lost. */}
        <p className="mt-2 flex items-start gap-1.5 text-[12.5px] text-ink/70">
          <Download size={12} strokeWidth={1.75} className="mt-0.5 shrink-0" />
          <span>
            Exports cover all {reports?.length ?? 0}{" "}
            reports, including the sample records that ship with the app. Slide images
            aren&apos;t included — download a report&apos;s PDF for those.
          </span>
        </p>

        <div className="mt-5 rounded-md border border-[#b3492f]/25 bg-[#b3492f]/5 p-3.5">
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={15} strokeWidth={1.75} className="mt-0.5 shrink-0 text-[#b3492f]" />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-ink">Clear locally saved reports</div>
              <p className="mt-0.5 text-[12.5px] text-ink/70">
                Permanently deletes the {savedReportCount}{" "}
                {savedReportCount === 1 ? "report" : "reports"}{" "}
                saved in this browser, and their slide images. The sample records that ship with
                the app stay. This cannot be undone — export a backup first.
              </p>

              {!confirmingClear ? (
                <button
                  type="button"
                  disabled={savedReportCount === 0}
                  onClick={() => setConfirmingClear(true)}
                  className="focus-ring mt-2.5 inline-flex items-center gap-1.5 rounded-md border border-[#b3492f]/30 bg-white px-3 py-1.5 text-[13px] text-[#b3492f] transition hover:bg-[#b3492f]/5 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Trash2 size={13} strokeWidth={1.75} />
                  Clear saved reports
                </button>
              ) : (
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <span className="text-[13px] text-ink/70">Delete {savedReportCount}?</span>
                  <button
                    type="button"
                    disabled={clearing}
                    onClick={handleClearAll}
                    className="focus-ring inline-flex items-center gap-1.5 rounded-md bg-[#b3492f] px-3 py-1.5 text-[13px] font-medium text-parchment transition hover:opacity-90 disabled:opacity-60"
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
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingClear(false)}
                    className="focus-ring rounded-md border border-panel-line bg-white px-3 py-1.5 text-[13px] text-ink/70 transition hover:text-ink"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </Section>

      {/* Account */}
      <Section
        icon={LogOut}
        title="Account"
        description="Sign-in is not connected to a real provider yet, so this only returns you to the landing page."
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-[13px] text-ink/70">
            Signed in as{" "}
            <span className="text-ink">{settings.displayName || DEFAULT_SETTINGS.displayName}</span>
            {settings.email && <span className="text-ink/70"> · {settings.email}</span>}
          </div>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="focus-ring inline-flex items-center justify-center gap-1.5 rounded-md border border-panel-line bg-white px-3 py-2 text-[13px] text-ink/70 transition hover:text-ink"
          >
            <LogOut size={14} strokeWidth={1.75} />
            Sign out
          </button>
        </div>
      </Section>
    </div>
  );
}
