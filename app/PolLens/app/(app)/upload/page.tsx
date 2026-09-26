import type { Metadata } from "next";
import AnalyzeWorkspace from "@/components/AnalyzeWorkspace";
import { PageBody, PageHeader } from "@/components/PageFrame";

export const metadata: Metadata = {
  title: "Analyze Specimen",
};

export default function UploadPage() {
  return (
    <>
      <PageHeader
        title="Analyze Specimen"
        description="Upload one or more microscope images to count and identify the pollen grains they contain."
      />
      <PageBody>
        <AnalyzeWorkspace />
      </PageBody>
    </>
  );
}
