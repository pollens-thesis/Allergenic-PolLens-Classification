import Link from "next/link";
import clsx from "clsx";
import { ArrowLeft } from "lucide-react";

// ---------------------------------------------------------------------------
// PAGE FRAME — one header and one content column for every signed-in page.
//
// The header is a full-bleed band (its border runs the width of the main
// column) whose contents line up with the page body below it. From `lg` up it
// sticks to the top of the viewport; below that the fixed mobile bar already
// owns the top edge, so the header scrolls away instead of hiding under it.
//
// `width` caps both header and body to the same measure, so a 1920px screen
// doesn't stretch tables and cards edge to edge. Columns stay left-aligned, so
// every page's title starts in the same place beside the rail:
//   wide   — workspaces, tables and the map
//   medium — a single reference table
//   narrow — settings and other single-column forms
// ---------------------------------------------------------------------------

export type PageWidth = "wide" | "medium" | "narrow";

const WIDTH: Record<PageWidth, string> = {
  wide: "max-w-[1440px]",
  medium: "max-w-5xl",
  narrow: "max-w-3xl",
};

const GUTTER = "px-4 sm:px-6 lg:px-10";

export function PageHeader({
  title,
  description,
  back,
  mono = false,
  width = "wide",
}: {
  /** The page's h1 text or a ready-made heading element. */
  title: React.ReactNode;
  description?: React.ReactNode;
  back?: { href: string; label: string };
  /** Set in the mono face, for identifiers such as a sample ID. */
  mono?: boolean;
  width?: PageWidth;
}) {
  return (
    <header
      className={clsx(
        "z-20 border-b border-border bg-bg/90 pt-4 pb-3 backdrop-blur-md sm:pt-5 lg:sticky lg:top-0 lg:pt-5 lg:pb-4",
        GUTTER,
      )}
    >
      <div className={clsx("w-full", WIDTH[width])}>
        {back && (
          <Link
            href={back.href}
            className="focus-ring mb-3 inline-flex items-center gap-1.5 rounded text-[13px] text-text-muted transition-colors hover:text-text"
          >
            <ArrowLeft size={14} strokeWidth={1.75} />
            {back.label}
          </Link>
        )}
        {typeof title === "string" ? (
          <h1
            className={clsx("text-[1.65rem] leading-tight tracking-tight text-balance text-text", mono && "break-all")}
            style={{ fontFamily: mono ? "var(--font-mono)" : "var(--font-display)", fontWeight: 600 }}
          >
            {title}
          </h1>
        ) : (
          title
        )}
        {description && (
          <p className="mt-1 max-w-[64ch] text-[13px] leading-snug text-pretty text-text-muted">{description}</p>
        )}
      </div>
    </header>
  );
}

export function PageBody({
  children,
  width = "wide",
  className,
}: {
  children: React.ReactNode;
  width?: PageWidth;
  className?: string;
}) {
  return (
    <div className={clsx("py-5 sm:py-6", GUTTER)}>
      <div className={clsx("w-full", WIDTH[width], className)}>{children}</div>
    </div>
  );
}
