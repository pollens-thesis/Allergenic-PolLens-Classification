import type { Metadata } from "next";
import Sidebar from "@/components/Sidebar";
import AnalyzeWorkspace from "@/components/AnalyzeWorkspace";

export const metadata: Metadata = {
  title: "Analyze Specimen",
};

export default function UploadPage() {
  return (
    <div className="grid min-h-screen w-full grid-cols-1 bg-bg lg:grid-cols-[15rem_1fr]">
      <Sidebar />

      <main className="min-w-0 px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold tracking-tight text-text" style={{ fontFamily: "var(--font-display)" }}>
            Analyze Specimen
          </h1>
          <p className="mt-1 max-w-prose text-sm text-text-muted">
            Upload one or more microscope images to count and identify the pollen grains they
            contain.
          </p>
        </div>

        <AnalyzeWorkspace />
      </main>
    </div>
  );
}