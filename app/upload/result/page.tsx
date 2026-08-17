import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import AnalysisResultWorkspace from "@/components/AnalysisResultWorkspace";

export default function AnalysisResultPage() {
  return (
    <div className="grid min-h-screen w-full grid-cols-1 bg-panel lg:grid-cols-[15rem_1fr]">
      <Sidebar />

      <main className="min-w-0 px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
        <div className="mb-6">
          <Link
            href="/upload"
            className="focus-ring mb-3 inline-flex items-center gap-1.5 rounded text-[13px] text-ink/70 transition hover:text-ink"
          >
            <ArrowLeft size={14} strokeWidth={1.75} />
            Back to Analyze specimen
          </Link>
          <p
            className="text-[12px] tracking-[0.25em] text-ink/70 uppercase"
            style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}
          >
            Research console
          </p>
          <h1 className="mt-1 text-3xl text-ink" style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>
            Analysis result
          </h1>
          <p className="mt-1 text-sm text-ink/70">
            Everything the analysis found, beside the slide it came from. Add your notes and save
            it as a report.
          </p>
        </div>

        <AnalysisResultWorkspace />
      </main>
    </div>
  );
}
