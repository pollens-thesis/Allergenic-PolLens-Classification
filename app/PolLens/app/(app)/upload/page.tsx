import type { Metadata } from "next";
import AnalyzeWorkspace from "@/components/AnalyzeWorkspace";
import { PageBody, PageHeader } from "@/components/PageFrame";

export const metadata: Metadata = {
  title: "Analyze Specimen",
};

export default function UploadPage() {
  return (
    <>
      <PageHeader title="Analyze Specimen" />
      <PageBody>
        <AnalyzeWorkspace />
      </PageBody>
    </>
  );
}
