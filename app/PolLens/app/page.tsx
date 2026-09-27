import type { Metadata } from "next";
import PollenField from "@/components/PollenField";
import SignInForm from "@/components/SignInForm";

export const metadata: Metadata = {
  // The layout's "%s · PolLens" template only applies below the root segment.
  title: { absolute: "Sign In · PolLens" },
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen w-full flex-col lg:flex-row">
      <section className="relative flex w-full flex-col justify-between gap-10 overflow-hidden bg-hero-bg px-6 py-8 sm:px-10 lg:min-h-screen lg:w-[58%] lg:gap-0 lg:px-16 lg:py-10">
        <PollenField />

        <div className="relative z-10 flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-accent/40">
            <span className="h-2 w-2 rounded-full bg-accent" />
          </span>
          <span
            className="text-sm tracking-[0.2em] text-hero-fg/90 uppercase"
            style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}
          >
            PolLens
          </span>
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

        <div className="relative z-10 hidden border-t border-hero-fg/10 pt-4 text-[13px] text-hero-fg-muted sm:block">
          Research workspace · PolLens
        </div>
      </section>

      {/* Right: sign-in card */}
      <section className="flex w-full flex-1 items-center justify-center bg-bg px-6 py-14 lg:w-[42%] lg:px-12">
        <div className="w-full max-w-sm">
          <div className="mb-6">
            <h2 className="text-[1.65rem] font-semibold tracking-tight text-text" style={{ fontFamily: "var(--font-display)" }}>
              Sign In
            </h2>
            <p className="mt-1 text-[13px] leading-relaxed text-text-muted">
              Use your Google or Microsoft research account.
            </p>
          </div>

          <SignInForm />

          <p className="mt-4 text-center text-[12px] text-text-muted">
            Access for UP, MSEUF, and approved research accounts.
          </p>
        </div>
      </section>
    </main>
  );
}
