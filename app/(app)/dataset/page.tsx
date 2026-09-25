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
        width="medium"
        title="Allergen Reference"
        description="The full taxonomic scope this console classifies against, with how many grains of each detected across all completed reports."
      />
      <PageBody width="medium">
        <AllergenReference />
      </PageBody>
    </>
  );
}
