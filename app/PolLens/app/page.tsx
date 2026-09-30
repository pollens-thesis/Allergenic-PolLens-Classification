import type { Metadata } from "next";
import Image from "next/image";
import PollenField from "@/components/PollenField";
import SignInForm from "@/components/SignInForm";

export const metadata: Metadata = {
  // The layout's "%s · PolLens" template only applies below the root segment.
  title: { absolute: "Sign In · PolLens" },
};

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh w-full flex-col lg:flex-row">
      <section className="relative flex min-h-[22rem] w-full flex-col justify-between gap-10 overflow-hidden bg-hero-bg px-6 py-7 sm:min-h-[24rem] sm:px-10 sm:py-9 lg:min-h-dvh lg:w-[58%] lg:gap-0 lg:px-16 lg:py-10">
        <PollenField />

        <div className="relative z-10">
          <Image
            src="/brand/pollens-logo.png"
            alt="PolLens"
            width={2172}
            height={724}
            className="block h-auto w-[185px]"
          />
        </div>

        <div className="relative z-10 max-w-xl">
          <h1
            className="text-4xl leading-[1.08] font-semibold tracking-tight text-hero-fg sm:text-5xl lg:text-[3.4rem]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Pollen slide analysis
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-hero-fg-muted">
            Analyze microscope slides, review detections, and maintain shared collection records.
          </p>
        </div>

        <div className="relative z-10 border-t border-hero-fg/10 pt-4 text-[13px] text-hero-fg-muted">
          Research workspace
        </div>
      </section>

      <section className="flex w-full flex-1 items-center justify-center border-t border-border bg-bg px-5 py-10 sm:px-10 lg:min-h-dvh lg:w-[42%] lg:border-l lg:border-t-0 lg:px-12 lg:py-12">
        <div className="w-full max-w-[440px] border border-border bg-surface px-6 py-7 sm:px-8 sm:py-8">
          <div className="mb-6">
            <h2 className="text-[1.65rem] font-semibold tracking-tight text-text" style={{ fontFamily: "var(--font-display)" }}>
              Sign In
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-text-muted">
              Use your Google or Microsoft research account.
            </p>
          </div>

          <SignInForm />

          <p className="mt-6 border-t border-border pt-4 text-[12px] leading-relaxed text-text-muted">
            Access for UP, MSEUF, and approved research accounts.
          </p>
        </div>
      </section>
    </main>
  );
}
