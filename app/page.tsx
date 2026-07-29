import Link from "next/link";
import PollenField from "@/components/PollenField";
import GoogleIcon from "@/components/GoogleIcon";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen w-full flex-col lg:flex-row">
      {/* Left: darkfield hero */}
      <section className="relative flex min-h-[38vh] w-full flex-col justify-between overflow-hidden bg-field px-8 py-8 lg:min-h-screen lg:w-[58%] lg:px-16 lg:py-12">
        <PollenField />

        <div className="relative z-10 flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-pollen/40">
            <span className="h-2 w-2 rounded-full bg-pollen" />
          </span>
          <span
            className="text-sm tracking-[0.25em] text-parchment/90 uppercase"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            PolLens
          </span>
        </div>

        <div className="relative z-10 max-w-xl">
          <p
            className="mb-4 text-xs tracking-[0.3em] text-pollen uppercase"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Allergen Identification &middot; Research Console
          </p>
          <h1
            className="text-4xl leading-[1.08] text-parchment sm:text-5xl lg:text-[3.4rem]"
            style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}
          >
            Every grain,{" "}
            <em className="not-italic" style={{ color: "var(--pollen-soft)", fontStyle: "italic" }}>
              read
            </em>{" "}
            and classified.
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-sage">
            PolLens helps researchers identify airborne pollen allergens from
            microscope imagery, using a Roboflow-trained detection model.
            Sign in to classify specimens, review model calls, and build a
            dataset that supports future allergen studies.
          </p>
        </div>

        <div
          className="relative z-10 hidden gap-8 border-t border-parchment/10 pt-5 sm:flex"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {[
            ["Classes tracked", "12 taxa"],
            ["Model", "Roboflow · v1"],
            ["Access", "Research use"],
          ].map(([label, value]) => (
            <div key={label}>
              <div className="text-[10px] tracking-widest text-sage/70 uppercase">{label}</div>
              <div className="mt-1 text-sm text-parchment/90">{value}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Right: specimen sign-in card */}
      <section className="flex w-full flex-1 items-center justify-center bg-panel px-6 py-14 lg:w-[42%] lg:px-12">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <p
              className="text-[11px] tracking-[0.25em] text-ink/50 uppercase"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Researcher access
            </p>
            <h2
              className="mt-2 text-3xl text-ink"
              style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}
            >
              Sign in to continue
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink/60">
              Use your Google account to open the console. New accounts are
              registered automatically on first sign-in.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="focus-ring flex w-full items-center justify-center gap-3 rounded-md border border-panel-line bg-white px-5 py-3 text-sm font-medium text-ink shadow-sm transition hover:shadow-md hover:-translate-y-[1px] active:translate-y-0"
          >
            <GoogleIcon />
            Continue with Google
          </Link>

          <div className="my-7 flex items-center gap-3 text-ink/30">
            <span className="h-px flex-1 bg-panel-line" />
            <span className="text-[10px] tracking-widest uppercase" style={{ fontFamily: "var(--font-mono)" }}>
              Field notes
            </span>
            <span className="h-px flex-1 bg-panel-line" />
          </div>

          <ul className="space-y-3 text-[13px] leading-relaxed text-ink/55">
            <li className="flex gap-2.5">
              <span className="mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full bg-anther" />
              Google sign-in is the only supported entry point for this
              thesis build — no password accounts.
            </li>
            <li className="flex gap-2.5">
              <span className="mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full bg-anther" />
              Access is limited to researchers named on the project&apos;s
              consent form.
            </li>
          </ul>

          <p className="mt-10 text-center text-[11px] text-ink/40">
            PolLens &middot; Thesis Project &middot; {new Date().getFullYear()}
          </p>
        </div>
      </section>
    </main>
  );
}
