import Sidebar from "@/components/Sidebar";
import AnalyzeWorkspace from "@/components/AnalyzeWorkspace";

export default function UploadPage() {
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
            Analyze specimen
          </h1>
          <p className="mt-1 text-sm text-ink/60">
            Upload one or more microscope images to count and identify the pollen grains they
            contain.
          </p>
        </div>

        <AnalyzeWorkspace />
      </main>
    </div>
  );
}