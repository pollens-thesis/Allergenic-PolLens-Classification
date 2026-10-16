import type { Metadata } from "next";
import ReviewQueue from "@/components/ReviewQueue";
import { PageBody, PageHeader } from "@/components/PageFrame";

export const metadata: Metadata = {
  title: "Review Queue",
};

export default function ReviewPage() {
  return (
    <>
      <PageHeader
        title="Review Queue"
        description="Reports from researchers that need a verifier before they are shared."
        width="medium"
      />
      <PageBody width="medium">
        <ReviewQueue />
      </PageBody>
    </>
  );
}
