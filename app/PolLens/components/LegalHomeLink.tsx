"use client";

import Link from "next/link";
import { isSignedIn } from "@/lib/session";
import { useSettings } from "@/lib/settings";

export default function LegalHomeLink({
  children,
  className,
  signedInLabel,
  signedOutLabel,
  signedInAriaLabel,
  signedOutAriaLabel,
}: {
  children?: React.ReactNode;
  className?: string;
  signedInLabel?: string;
  signedOutLabel?: string;
  signedInAriaLabel: string;
  signedOutAriaLabel: string;
}) {
  const settings = useSettings();
  const signedIn = isSignedIn(settings);
  const label = signedIn ? signedInLabel : signedOutLabel;

  return (
    <Link
      href={signedIn ? "/dashboard" : "/"}
      aria-label={signedIn ? signedInAriaLabel : signedOutAriaLabel}
      className={className}
    >
      {label ?? children}
    </Link>
  );
}
