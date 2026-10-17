import Link from "next/link";
import clsx from "clsx";
import { CONTACT_EMAIL } from "@/lib/brand";

const LINK =
  "focus-ring rounded-sm underline-offset-4 hover:text-text hover:underline";

/** Privacy Policy, Terms of Service and the project contact — on every page. */
export default function SiteFooter({ className }: { className?: string }) {
  return (
    <footer className={clsx("flex justify-end text-right text-[12px] text-text-muted", className)}>
      <nav aria-label="Legal and contact" className="flex flex-wrap justify-end gap-x-5 gap-y-2">
        <Link href="/privacy" className={LINK}>
          Privacy Policy
        </Link>
        <Link href="/terms" className={LINK}>
          Terms Of Service
        </Link>
        <a href={`mailto:${CONTACT_EMAIL}`} className={LINK}>
          {CONTACT_EMAIL}
        </a>
      </nav>
    </footer>
  );
}
