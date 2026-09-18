import PollenField from "@/components/PollenField";
import SignInForm from "@/components/SignInForm";
import { speciesCatalog } from "@/lib/data";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen w-full flex-col lg:flex-row">
      {/* Left: dark hero */}
      <section className="relative flex min-h-[38vh] w-full flex-col justify-between overflow-hidden bg-hero-bg px-8 py-8 lg:min-h-screen lg:w-[58%] lg:px-16 lg:py-12">
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
            Every grain,{" "}
            <span className="text-[var(--hero-grain-soft)]">read</span> and
            classified.
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-hero-fg-muted">
            PolLens helps researchers identify airborne pollen allergens from
            microscope imagery, using a Roboflow-trained detection model.
            Sign in to classify specimens, review model calls, and build a
            dataset that supports future allergen studies.
          </p>
        </div>

        <div
          className="relative z-10 hidden gap-8 border-t border-hero-fg/10 pt-5 sm:flex"
          style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}
        >
          {[
            ["Classes tracked", `${speciesCatalog.length} taxa`],
            ["Model", "Roboflow · v1"],
            ["Access", "Research use"],
          ].map(([label, value]) => (
            <div key={label}>
              <div className="text-[11.5px] tracking-widest text-hero-fg-muted uppercase">{label}</div>
              <div className="mt-1 text-sm text-hero-fg/90">{value}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Right: sign-in card */}
      <section className="flex w-full flex-1 items-center justify-center bg-bg px-6 py-14 lg:w-[42%] lg:px-12">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-3xl font-semibold tracking-tight text-text">
              Sign in to continue
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-text-muted">
              Sign in with the account your institution works from. The console
              takes its name from that address.
            </p>
          </div>

          <SignInForm />

          <div className="my-7 flex items-center gap-3 text-text-faint">
            <span className="h-px flex-1 bg-border" />
            <span className="text-[11.5px] tracking-widest uppercase" style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
              Field notes
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <ul className="space-y-3 text-[13px] leading-relaxed text-text-muted">
            <li className="flex gap-2.5">
              <span className="mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              Google sign-in is the only supported entry point for this
              thesis build — no password accounts.
            </li>
            <li className="flex gap-2.5">
              <span className="mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              Access is limited to researchers named on the project&apos;s
              consent form.
            </li>
          </ul>

          <p className="mt-10 text-center text-[12px] text-text-faint">
            PolLens &middot; Thesis Project &middot; {new Date().getFullYear()}
          </p>
        </div>
      </section>
    </main>
  );
}
