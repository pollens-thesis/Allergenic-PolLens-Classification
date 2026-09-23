import type { Metadata } from "next";
import { Atkinson_Hyperlegible_Mono, Atkinson_Hyperlegible_Next } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

// Typefaces chosen for legibility evidence, not style (see
// docs/design-system.md): Atkinson Hyperlegible was designed and tested by the
// Braille Institute to keep easily-confused characters (0/O, 1/l/I, 5/S, 8/B)
// distinct — which is exactly what sample IDs, species codes and readings are
// made of. One superfamily for text and data, so the console reads as one
// system; italic is loaded for scientific names.
const atkinson = Atkinson_Hyperlegible_Next({
  variable: "--font-atkinson",
  subsets: ["latin", "latin-ext"],
  style: ["normal", "italic"],
  // next/font has no metrics for Atkinson to size-match a fallback; name one.
  adjustFontFallback: false,
  fallback: ["system-ui", "Segoe UI", "Arial", "sans-serif"],
});

const atkinsonMono = Atkinson_Hyperlegible_Mono({
  variable: "--font-atkinson-mono",
  subsets: ["latin"],
  adjustFontFallback: false,
  fallback: ["ui-monospace", "Consolas", "monospace"],
});

export const metadata: Metadata = {
  title: { default: "PolLens", template: "%s · PolLens" },
  description: "Helping researchers identify pollen allergens from microscope imagery. Sign in to the PolLens research console.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // No `antialiased` on <html> on purpose. It maps to -webkit-font-smoothing,
  // which lightens every stroke on macOS — and this console is mostly small
  // text on a light background, where that thinning is the difference
  // between legible and not.
  return (
    <html
      lang="en"
      className={`${atkinson.variable} ${atkinsonMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster position="bottom-right" theme="light" />
      </body>
    </html>
  );
}
