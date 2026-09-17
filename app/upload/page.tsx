import Sidebar from "@/components/Sidebar";
import AnalyzeWorkspace from "@/components/AnalyzeWorkspace";

export default function UploadPage() {
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
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-text" style={{ fontFamily: "var(--font-display)" }}>
            Analyze specimen
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Upload one or more microscope images to count and identify the pollen grains they
            contain.
          </p>
        </div>

        <AnalyzeWorkspace />
      </main>
    </div>
  );
}