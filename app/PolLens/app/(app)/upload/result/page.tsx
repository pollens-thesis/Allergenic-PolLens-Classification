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
        title="Analysis Result"
        description="Everything the analysis found, beside the slide it came from. Add your notes, check the details, then generate the report."
      />
      <PageBody>
        <AnalysisResultWorkspace sampleId={report ?? null} sampleDetections={sample === "1"} />
      </PageBody>
    </>
  );
}
