import type { Metadata } from "next";
import ReportDetail from "@/components/ReportDetail";
import { PageBody, PageHeader } from "@/components/PageFrame";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sampleId: string }>;
}): Promise<Metadata> {
  const { sampleId } = await params;
  return { title: `Report ${sampleId}` };
}

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ sampleId: string }>;
}) {
  const { sampleId } = await params;

  return (
    <>
      <PageHeader back={{ href: "/reports", label: "Back to Reports" }} title={sampleId} mono />
      <PageBody>
        <ReportDetail sampleId={sampleId} />
      </PageBody>
    </>
  );
}
