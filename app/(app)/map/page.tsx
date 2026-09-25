import type { Metadata } from "next";
import PollenMap from "@/components/PollenMap";
import { PageBody, PageHeader } from "@/components/PageFrame";

export const metadata: Metadata = {
  title: "Pollen Map",
};

export default function PollenMapPage() {
  return (
    <>
      <PageHeader
        title="Pollen Map"
        description="Where each pollen type is turning up. Provinces are shaded by how many grains have been counted in them — open one to see which of its towns the pollen came from."
      />
      <PageBody>
        <PollenMap />
      </PageBody>
    </>
  );
}
