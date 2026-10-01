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
    <main className="grid min-h-dvh w-full grid-cols-1 lg:grid-cols-[1.06fr_0.94fr]">
      <section className="relative isolate flex min-h-[20rem] w-full flex-col justify-between gap-8 overflow-hidden bg-hero-bg px-6 py-6 sm:min-h-[26rem] sm:px-10 sm:py-9 lg:min-h-dvh lg:px-14 lg:py-10 xl:px-[7vw]">
        <PollenField />

        <div className="relative z-10">
          <Image
            src="/brand/pollens-logo.png"
            alt="PolLens"
            width={2172}
            height={724}
            className="block h-auto w-[150px] sm:w-[178px]"
          />
        </div>

        <div className="relative z-10 flex flex-1 items-center">
          <div className="max-w-[22rem] pb-2">
            <p className="mb-3 text-[12px] font-medium tracking-[0.12em] text-hero-fg-muted uppercase">
              Allergenic pollen research
            </p>
            <h1
              className="text-[2.45rem] leading-[1.03] font-semibold tracking-[-0.045em] text-hero-fg sm:text-6xl lg:text-[3.8rem] xl:text-[4rem]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Pollen Slide
              <br />
              Analysis
            </h1>
            <p className="mt-5 max-w-[25rem] text-[14px] leading-relaxed text-hero-fg-muted sm:text-[15px]">
              Analyze microscope slides, review detections, and maintain shared collection records.
            </p>
          </div>
        </div>

        <div className="relative z-10 border-t border-hero-fg/15 pt-3 text-[12px] text-hero-fg-muted sm:pt-4 sm:text-[13px]">
          Research workspace
        </div>
      </section>

      <section className="flex w-full flex-1 items-center justify-center border-t border-border bg-surface px-6 py-12 sm:px-10 lg:min-h-dvh lg:border-l lg:border-t-0 lg:px-12 lg:py-16 xl:px-20">
        <div className="w-full max-w-[400px]">
          <div className="mb-7 sm:mb-8">
            <p className="mb-3 text-[12px] font-medium tracking-[0.12em] text-text-faint uppercase">
              Research access
            </p>
            <h2 className="text-[1.9rem] leading-tight font-semibold tracking-tight text-text sm:text-[2.15rem]" style={{ fontFamily: "var(--font-display)" }}>
              Sign In To PolLens
            </h2>
            <p className="mt-3 text-[14px] leading-relaxed text-text-muted">
              Continue with the account you use for your research.
            </p>
          </div>

          <SignInForm />

          <p className="mt-7 border-t border-border pt-4 text-[12px] leading-relaxed text-text-muted sm:mt-8 sm:pt-5">
            Access for UP, MSEUF, and approved research accounts.
          </p>
        </div>
      </section>
    </main>
  );
}
