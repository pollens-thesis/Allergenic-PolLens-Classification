import type { Metadata } from "next";
import AllergenReference from "@/components/AllergenReference";
import { PageBody, PageHeader } from "@/components/PageFrame";

export const metadata: Metadata = {
  title: "Allergen Reference",
};

export default function DatasetPage() {
  return (
    <>
      <PageHeader
        title="Allergen Reference"
        description="The 23 pollen types this console classifies, with how many grains of each were counted in finalized reports. Select a species for its full record."
      />
      <PageBody>
        <AllergenReference />
      </PageBody>
    </>
  );
}
