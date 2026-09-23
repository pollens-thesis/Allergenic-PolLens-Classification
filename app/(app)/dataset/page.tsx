import type { Metadata } from "next";
import Sidebar from "@/components/Sidebar";
import AllergenReference from "@/components/AllergenReference";

export const metadata: Metadata = {
  title: "Allergen Reference",
};

export default function DatasetPage() {
  return (
    <div className="grid min-h-screen w-full grid-cols-1 bg-bg lg:grid-cols-[15rem_1fr]">
      <Sidebar />

      <main className="min-w-0 px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
        <div className="mb-6">
          <h1 className="text-3xl text-text" style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>
            Allergen Reference
          </h1>
          <p className="mt-1 max-w-prose text-sm text-text-muted">
            The full taxonomic scope this console classifies against, with how many
            grains of each you&apos;ve detected across your saved reports.
          </p>
        </div>

        <AllergenReference />
      </main>
    </div>
  );
}
