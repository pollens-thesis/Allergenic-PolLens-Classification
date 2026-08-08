import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import ReportDetail from "@/components/ReportDetail";

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ sampleId: string }>;
}) {
  const { sampleId } = await params;

  return (
    <div className="grid min-h-screen w-full grid-cols-1 bg-panel lg:grid-cols-[15rem_1fr]">
      <Sidebar />

      <main className="min-w-0 px-6 py-8 lg:px-10 lg:py-10">
        <div className="mb-6">
          <Link
            href="/history"
            className="focus-ring mb-3 inline-flex items-center gap-1.5 rounded text-[12.5px] text-ink/55 transition hover:text-ink"
          >
            <ArrowLeft size={14} strokeWidth={1.75} />
            Back to History
          </Link>
          <p
            className="text-[11px] tracking-[0.25em] text-ink/50 uppercase"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Research console
          </p>
          <h1 className="mt-1 text-3xl text-ink" style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}>
            Full report detail
          </h1>
        </div>

        <ReportDetail sampleId={sampleId} />
      </main>
    </div>
  );
}
