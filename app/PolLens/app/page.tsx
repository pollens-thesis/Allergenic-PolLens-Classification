import type { Metadata } from "next";
import Link from "next/link";
import PolleRgiesWordmark from "@/components/PolleRgiesWordmark";
import SiteFooter from "@/components/SiteFooter";
import { WelcomeSignInButton, WelcomeSignInProvider } from "@/components/WelcomeSignInDialog";
import { ThemeToggle } from "@/components/AppearanceControls";
import { BRAND_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: { absolute: `${BRAND_NAME} · Allergenic Pollen Research in the Philippines` },
  description:
    "PolleRgies helps research teams identify allergenic pollen in microscope slide images from Philippine air-sampling collections.",
};

const workflow = [
  {
    number: "01",
    title: "Analyze a collection",
    description:
      "Submit microscope slide images from an air-sampling collection for pollen detection and grain counts.",
  },
  {
    number: "02",
    title: "Review detections",
    description:
      "A researcher checks and, when needed, corrects detections before the report is completed.",
  },
  {
    number: "03",
    title: "Keep a shared record",
    description:
      "Store slide images, reviewed counts, collection date, and Philippine location together in a report.",
  },
];

const scopeFacts = [
  {
    label: "Target",
    value: "15 allergenic pollen species",
    detail: "currently in scope",
  },
  {
    label: "Evidence",
    value: "Microscope slide images",
    detail: "from air-sampling collections",
  },
  {
    label: "Geography",
    value: "The Philippines",
    detail: "for collection locations and records",
  },
];

export default function WelcomePage() {
  return (
    <WelcomeSignInProvider>
      <main className="min-h-dvh bg-page text-text">
        <section className="relative isolate overflow-hidden border-b border-border bg-hero-bg">
          <header className="relative z-10 mx-auto flex w-full max-w-[1440px] items-center justify-between gap-4 px-5 py-5 sm:px-8 sm:py-6 lg:px-12 xl:px-16">
            <Link href="/" aria-label={`${BRAND_NAME} home`} className="focus-ring rounded-sm">
              <PolleRgiesWordmark className="text-2xl sm:text-3xl" />
            </Link>
            <div className="flex items-center gap-2 sm:gap-3">
              <ThemeToggle compact />
              <WelcomeSignInButton className="focus-ring inline-flex min-h-11 items-center justify-center rounded-sm bg-accent px-4 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover active:scale-[0.99] sm:px-5">
                Sign In
              </WelcomeSignInButton>
            </div>
          </header>

          <div className="relative z-10 mx-auto grid w-full max-w-[1440px] items-center gap-10 px-5 pb-14 pt-9 sm:px-8 sm:pb-16 sm:pt-12 lg:px-12 lg:pb-20 lg:pt-8 xl:min-h-[570px] xl:grid-cols-[1.05fr_0.95fr] xl:gap-12 xl:px-16">
            <div className="max-w-[690px]">
              <p className="mb-4 text-[11px] font-medium tracking-[0.14em] text-hero-fg-muted uppercase">
                Research workspace · Philippines
              </p>
              <h1 className="max-w-[13ch] text-5xl leading-[1.04] font-semibold tracking-[-0.035em] text-hero-fg sm:text-6xl xl:text-7xl">
                Identify allergenic pollen in microscope slides.
              </h1>
              <p className="mt-5 max-w-[58ch] text-[15px] leading-relaxed text-hero-fg-muted sm:text-base">
                {`${BRAND_NAME} helps approved research teams identify target pollen in microscope slide images from air-sampling collections, review detections and grain counts, and organize findings into reports.`}
              </p>

              <div className="mt-7 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-5">
                <WelcomeSignInButton className="focus-ring inline-flex min-h-12 items-center justify-center rounded-sm bg-accent px-5 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover active:scale-[0.99]">
                  Sign In To {BRAND_NAME}
                </WelcomeSignInButton>
                <span className="text-[12.5px] leading-relaxed text-hero-fg-muted">
                  For UP, MSEUF, and approved research accounts
                </span>
              </div>
            </div>

            <aside
              aria-labelledby="scope-facts-title"
              className="border-y border-hero-fg/20 py-5 sm:py-6 xl:ml-auto xl:w-full xl:max-w-[480px]"
            >
              <h2
                id="scope-facts-title"
                className="text-[11px] font-medium tracking-[0.14em] text-hero-fg-muted uppercase"
              >
                System at a glance
              </h2>
              <dl className="mt-3 divide-y divide-hero-fg/15">
                {scopeFacts.map(({ label, value, detail }) => (
                  <div
                    key={label}
                    className="grid gap-1 py-3 sm:grid-cols-[7rem_1fr] sm:items-baseline sm:gap-4"
                  >
                    <dt className="text-[11px] font-medium tracking-[0.1em] text-hero-fg-muted uppercase">
                      {label}
                    </dt>
                    <dd>
                      <p className="text-[15px] font-medium text-hero-fg">{value}</p>
                      <p className="mt-0.5 text-[12px] leading-relaxed text-hero-fg-muted">
                        {detail}
                      </p>
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 max-w-[48ch] text-[12px] leading-relaxed text-hero-fg-muted">
                Results are reviewed by a researcher before a report is completed.
              </p>
            </aside>
          </div>
        </section>

        <section
          aria-labelledby="workflow-title"
          className="mx-auto w-full max-w-[1440px] px-5 py-12 sm:px-8 sm:py-16 lg:px-12 xl:px-16"
        >
          <div className="grid gap-7 lg:grid-cols-[0.72fr_1.28fr] lg:gap-12">
            <div>
              <p className="mb-3 text-[11px] font-medium tracking-[0.14em] text-text-muted uppercase">
                How it works
              </p>
              <h2
                id="workflow-title"
                className="max-w-[13ch] text-3xl leading-tight font-semibold tracking-[-0.025em] text-text sm:text-4xl"
              >
                From slide image to research record.
              </h2>
              <p className="mt-3 max-w-[45ch] text-sm leading-relaxed text-text-muted">
                The researcher stays responsible for reviewing the model&apos;s findings.
              </p>
            </div>

            <ol className="grid divide-y divide-border border-y border-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {workflow.map(({ number, title, description }) => (
                <li
                  key={number}
                  className="py-5 sm:px-4 sm:py-2 first:sm:pl-0 last:sm:pr-0 lg:px-5"
                >
                  <span className="font-mono text-xs tabular-nums text-text-muted">
                    {number}
                  </span>
                  <h3 className="mt-3 text-[15px] font-semibold text-text">{title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-text-muted">{description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section aria-labelledby="limits-title" className="border-y border-border bg-surface">
          <div className="mx-auto grid w-full max-w-[1440px] gap-7 px-5 py-9 sm:px-8 sm:py-11 lg:grid-cols-[0.72fr_1.28fr] lg:gap-12 lg:px-12 xl:px-16">
            <div>
              <p className="mb-3 text-[11px] font-medium tracking-[0.14em] text-text-muted uppercase">
                Scope and interpretation
              </p>
              <h2
                id="limits-title"
                className="max-w-[13ch] text-2xl leading-tight font-semibold tracking-[-0.025em] text-text sm:text-3xl"
              >
                Built for focused pollen research.
              </h2>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 sm:gap-8">
              <div>
                <h3 className="text-sm font-semibold text-text">What is in scope</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-text-muted">
                  The system currently covers 15 target allergenic pollen species and Philippine
                  collection locations. PolleRgies is focused on allergenic pollen, not general
                  pollen or plant identification.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-text">How to read the counts</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-text-muted">
                  Counts describe grains identified in submitted slide images. They are not ambient
                  air-concentration measurements or a diagnosis of an individual&apos;s allergies.
                </p>
              </div>
            </div>
          </div>
          <p className="mx-auto w-full max-w-[1440px] px-5 pb-8 text-[12px] leading-relaxed text-text-muted sm:px-8 lg:px-12 xl:px-16">
            Reports are shared with signed-in research users. Editing and review are limited to the
            report owner or staff; access is for UP, MSEUF, and approved research accounts.
          </p>
        </section>

        <footer className="mx-auto flex w-full max-w-[1440px] flex-col gap-3 px-5 py-7 text-[12px] text-text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12 xl:px-16">
          <span>{`${BRAND_NAME} · Allergenic pollen identification · Philippines only`}</span>
          <SiteFooter />
        </footer>
      </main>
    </WelcomeSignInProvider>
  );
}
