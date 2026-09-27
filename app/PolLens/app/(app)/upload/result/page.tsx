import type { Metadata } from "next";
import AnalysisResultWorkspace from "@/components/AnalysisResultWorkspace";
import { PageBody, PageHeader } from "@/components/PageFrame";

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
    <>
      <PageHeader
        back={{ href: "/upload", label: "Back to Analyze Specimen" }}
        title="Review Analysis"
      />
      <PageBody>
        <AnalysisResultWorkspace sampleId={report ?? null} sampleDetections={sample === "1"} />
      </PageBody>
    </>
  );
}
