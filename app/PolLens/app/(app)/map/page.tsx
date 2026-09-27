import type { Metadata } from "next";
import PollenMap from "@/components/PollenMap";
import { PageBody, PageHeader } from "@/components/PageFrame";

export const metadata: Metadata = {
  title: "Pollen Map",
};

export default function PollenMapPage() {
  return (
    <>
      <PageHeader title="Pollen Map" />
      <PageBody>
        <PollenMap />
      </PageBody>
    </>
  );
}
