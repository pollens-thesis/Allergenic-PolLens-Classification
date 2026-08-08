import Sidebar from "@/components/Sidebar";
import SettingsWorkspace from "@/components/SettingsWorkspace";

export default function SettingsPage() {
  return (
    <div className="grid min-h-screen w-full grid-cols-1 bg-panel lg:grid-cols-[15rem_1fr]">
      <Sidebar />

      <main className="min-w-0 px-6 py-8 lg:px-10 lg:py-10">
        <div className="mb-6">
          <p
            className="text-[11px] tracking-[0.25em] text-ink/50 uppercase"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Research console
          </p>
          <h1 className="mt-1 text-3xl text-ink" style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}>
            Settings
          </h1>
          <p className="mt-1 text-sm text-ink/60">
            Your profile, the defaults applied to new analyses, and the data stored in this browser.
          </p>
        </div>

        <div className="max-w-3xl">
          <SettingsWorkspace />
        </div>
      </main>
    </div>
  );
}
