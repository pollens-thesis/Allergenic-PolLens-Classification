import type { Metadata } from "next";
import PollenTrendsWorkspace from "@/components/PollenTrendsWorkspace";
import { PageBody, PageHeader } from "@/components/PageFrame";

export const metadata: Metadata = {
  title: "Pollen Trends",
};

export default function PollenTrendsPage() {
  return (
    <>
      <PageHeader
        title="Pollen Trends"
      />
      <PageBody>
        <PollenTrendsWorkspace />
      </PageBody>
    </>
  );
}
