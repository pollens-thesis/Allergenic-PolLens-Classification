import type { Metadata } from "next";
import Link from "next/link";
import { ScanLine } from "lucide-react";
import DashboardWorkspace from "@/components/DashboardWorkspace";
import { PageBody, PageHeader } from "@/components/PageFrame";
import { buttonVariants } from "@/components/Button";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title={
          <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
            <h1
              className="text-[1.65rem] leading-tight tracking-tight text-text"
              style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
            >
              Dashboard
            </h1>
            <Link
              href="/upload"
              className={`${buttonVariants({ intent: "accent", size: "md" })} focus-ring`}
            >
              <ScanLine size={15} strokeWidth={1.75} />
              Analyze Slides
            </Link>
          </div>
        }
      />

      <PageBody>
        <DashboardWorkspace />
      </PageBody>
    </>
  );
}
