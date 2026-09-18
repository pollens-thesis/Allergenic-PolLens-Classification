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
    <div className="grid min-h-screen w-full grid-cols-1 bg-bg lg:grid-cols-[15rem_1fr]">
      <Sidebar />

      <main className="min-w-0 px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
        <div className="mb-6">
          <Link
            href="/reports"
            className="focus-ring mb-3 inline-flex items-center gap-1.5 rounded text-[13px] text-text-muted transition-colors hover:text-text"
          >
            <ArrowLeft size={14} strokeWidth={1.75} />
            Back to Reports
          </Link>
          <h1 className="text-3xl text-text" style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>
            Full report detail
          </h1>
        </div>

        <ReportDetail sampleId={sampleId} />
      </main>
    </div>
  );
}
