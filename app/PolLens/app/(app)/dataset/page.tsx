import type { Metadata } from "next";
import AllergenReference from "@/components/AllergenReference";
import { PageBody, PageHeader } from "@/components/PageFrame";

export const metadata: Metadata = {
  title: "Allergen Reference",
};

export default function DatasetPage() {
  return (
    <>
      <PageHeader title="Allergen Reference" />
      <PageBody>
        <AllergenReference />
      </PageBody>
    </>
  );
}
