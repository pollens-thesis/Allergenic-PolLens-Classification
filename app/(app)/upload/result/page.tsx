import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import AnalysisResultWorkspace from "@/components/AnalysisResultWorkspace";

export const metadata: Metadata = {
  title: "Analysis Result",
};

export default async function AnalysisResultPage({
  searchParams,
}: {
  searchParams: Promise<{ report?: string; sample?: string }>;
}) {
  const { report, sample } = await searchParams;

  return (
    <div className="grid min-h-screen w-full grid-cols-1 bg-bg lg:grid-cols-[15rem_1fr]">
      <Sidebar />

      <main className="min-w-0 px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
        <div
          className="sticky top-0 z-10 mb-6 -mx-4 border-b border-border px-4 pt-6 pb-4 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10"
          style={{ background: "color-mix(in srgb, var(--bg) 85%, transparent)" }}
        >
          <Link
            href="/upload"
            className="focus-ring mb-3 inline-flex items-center gap-1.5 rounded text-[13px] text-text-muted transition hover:text-text"
          >
            <ArrowLeft size={14} strokeWidth={1.75} />
            Back to Analyze Specimen
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight text-text" style={{ fontFamily: "var(--font-display)" }}>
            Analysis Result
          </h1>
          <p className="mt-1 max-w-prose text-sm text-text-muted">
            Everything the analysis found, beside the slide it came from. Add your notes, check the
            details, then generate the report.
          </p>
        </div>

        <AnalysisResultWorkspace sampleId={report ?? null} sampleDetections={sample === "1"} />
      </main>
    </div>
  );
}
