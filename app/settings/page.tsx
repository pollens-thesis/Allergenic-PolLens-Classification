import Sidebar from "@/components/Sidebar";
import SettingsWorkspace from "@/components/SettingsWorkspace";

export default function SettingsPage() {
  return (
    <div className="grid min-h-screen w-full grid-cols-1 bg-bg lg:grid-cols-[15rem_1fr]">
      <Sidebar />

      <main className="min-w-0 px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
        <div className="mb-6">
          <p
            className="text-[12px] tracking-[0.18em] text-text-muted uppercase"
            style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}
          >
            Research console
          </p>
          <h1 className="mt-1 text-3xl text-text" style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>
            Settings
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            The account this browser is signed in with, and the data it has stored.
          </p>
        </div>

        <div className="max-w-3xl">
          <SettingsWorkspace />
        </div>
      </main>
    </div>
  );
}
