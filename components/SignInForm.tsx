"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronLeft } from "lucide-react";
import GoogleIcon from "@/components/GoogleIcon";
import { accountName, institutionFromEmail } from "@/lib/account";
import { updateSettings } from "@/lib/settings";

/**
 * Stands in for Google's account chooser.
 *
 * The provider is not wired up yet, but the address it would return is what
 * the whole profile is derived from, so the mock has to ask for one — signing
 * in with nothing would leave the console with no idea who saved a report. The
 * preview underneath shows what it read from the address before you commit to
 * it, which is also the clearest way to explain that the name is not typed.
 */
export default function SignInForm() {
  const router = useRouter();
  const [choosing, setChoosing] = useState(false);
  const [email, setEmail] = useState("");

  const trimmed = email.trim().toLowerCase();
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  const institution = valid ? institutionFromEmail(trimmed) : null;

  function signIn() {
    if (!valid) return;
    updateSettings({ email: trimmed });
    router.push("/dashboard");
  }

  if (!choosing) {
    return (
      <button
        type="button"
        onClick={() => setChoosing(true)}
        className="focus-ring flex w-full items-center justify-center gap-3 rounded-md border border-panel-line bg-white px-5 py-3 text-sm font-medium text-ink shadow-sm transition hover:-translate-y-[1px] hover:shadow-md active:translate-y-0"
      >
        <GoogleIcon />
        Continue with Google
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        signIn();
      }}
      className="rounded-md border border-panel-line bg-white p-4 shadow-sm"
    >
      <div className="mb-3 flex items-center gap-2.5">
        <GoogleIcon />
        <span className="text-[13px] font-medium text-ink">Choose an account</span>
      </div>

      <label className="block">
        <span className="mb-1 block text-[12.5px] text-ink/70">Institution email</span>
        <input
          type="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="pollen.lab@slsu.edu.ph"
          className="focus-ring w-full rounded-md border border-panel-line bg-white px-3 py-2 text-[13px] text-ink placeholder:text-ink/60"
        />
      </label>

      <p className="mt-2 text-[12.5px] leading-relaxed text-ink/70">
        {valid ? (
          <>
            Reports will be filed under{" "}
            <span className="font-medium text-ink">{accountName(trimmed)}</span>
            {institution ? "." : " — this address is not on an institution domain."}
          </>
        ) : (
          "The console takes its name from this address, so use the mailbox your institution works from."
        )}
      </p>

      <div className="mt-3.5 flex items-center gap-2">
        <button
          type="submit"
          disabled={!valid}
          className="focus-ring inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-[13px] font-medium text-parchment transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Continue
          <ArrowRight size={14} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={() => setChoosing(false)}
          className="focus-ring inline-flex items-center gap-1 rounded-md px-2 py-2 text-[13px] text-ink/70 transition hover:text-ink"
        >
          <ChevronLeft size={14} strokeWidth={1.75} />
          Back
        </button>
      </div>
    </form>
  );
}
