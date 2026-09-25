import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Page Not Found",
};

export default function NotFound() {
  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-bg px-6">
      <div className="w-full max-w-md">
        <p className="text-[13px] text-text-muted" style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
          404
        </p>
        <h1
          className="mt-2 text-3xl tracking-tight text-balance text-text"
          style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
        >
          Page Not Found
        </h1>
        <p className="mt-2 text-sm text-pretty text-text-muted">
          The address may be mistyped, or the page may have moved.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Link
            href="/dashboard"
            className="focus-ring inline-flex items-center gap-1.5 rounded-md bg-text px-3.5 py-2 text-[13px] text-bg transition hover:bg-text/85 active:scale-[0.97]"
          >
            <ArrowLeft size={14} strokeWidth={1.75} />
            Go to Dashboard
          </Link>
          <Link href="/reports" className="focus-ring rounded text-[13px] text-text-muted underline-offset-4 hover:text-text hover:underline">
            Open Reports
          </Link>
        </div>
      </div>
    </main>
  );
}
