import PolleRgiesWordmark from "@/components/PolleRgiesWordmark";
import LegalHomeLink from "@/components/LegalHomeLink";
import SiteFooter from "@/components/SiteFooter";
import { BRAND_NAME } from "@/lib/brand";

export type LegalSection = {
  id: string;
  title: string;
  body: React.ReactNode;
};

export default function LegalPage({
  title,
  effective,
  intro,
  sections,
}: {
  title: string;
  effective: string;
  intro: React.ReactNode;
  sections: LegalSection[];
}) {
  return (
    <main className="min-h-dvh bg-page text-text">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-[860px] items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <LegalHomeLink
            signedInAriaLabel={`${BRAND_NAME} dashboard`}
            signedOutAriaLabel={`${BRAND_NAME} home`}
            className="focus-ring rounded-sm"
          >
            <PolleRgiesWordmark className="text-2xl" />
          </LegalHomeLink>
          <LegalHomeLink
            signedInLabel="Back To Dashboard"
            signedOutLabel="Back To Home"
            signedInAriaLabel="Back to dashboard"
            signedOutAriaLabel="Back to onboarding"
            className="focus-ring rounded-sm text-[13px] text-text-muted underline-offset-4 hover:text-text hover:underline"
          >
          </LegalHomeLink>
        </div>
      </header>

      <article className="mx-auto w-full max-w-[860px] px-5 py-10 sm:px-8 sm:py-14">
        <p className="mb-3 text-[11px] font-medium tracking-[0.14em] text-text-muted uppercase">
          {BRAND_NAME} · Effective {effective}
        </p>
        <h1 className="text-3xl leading-tight font-semibold tracking-[-0.025em] sm:text-4xl">
          {title}
        </h1>
        <div className="mt-4 max-w-[65ch] text-[15px] leading-relaxed text-text-muted">{intro}</div>

        <div className="mt-10 divide-y divide-border border-y border-border">
          {sections.map(({ id, title: sectionTitle, body }) => (
            <section key={id} aria-labelledby={id} className="py-6">
              <h2 id={id} className="text-base font-semibold text-text">
                {sectionTitle}
              </h2>
              <div className="mt-2 max-w-[65ch] space-y-3 text-[14px] leading-relaxed text-text-muted">
                {body}
              </div>
            </section>
          ))}
        </div>
      </article>

      <SiteFooter className="mx-auto w-full max-w-[860px] px-5 pb-10 sm:px-8" />
    </main>
  );
}
