import type { Metadata } from "next";
import { Atkinson_Hyperlegible_Mono, Atkinson_Hyperlegible_Next, Source_Serif_4 } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

// Typefaces chosen for legibility evidence, not style (see
// docs/design-system.md): Atkinson Hyperlegible was designed and tested by the
// Braille Institute to keep easily-confused characters (0/O, 1/l/I, 5/S, 8/B)
// distinct — which is exactly what sample IDs, species codes and readings are
// made of. Scientific names are set in the serif italic, so only the upright
// Atkinson is loaded. The Latin subset covers Philippine place names (ñ).
const atkinson = Atkinson_Hyperlegible_Next({
  variable: "--font-atkinson",
  subsets: ["latin"],
  style: ["normal"],
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

// Titles and captions: a journal serif with optical sizes, so page titles and
// small plate captions are each drawn for their size — the atlas voice.
const serif = Source_Serif_4({
  variable: "--font-serif",
  subsets: ["latin"],
  style: ["normal", "italic"],
  // The optical-size axis is what makes one family work from the 3.4rem
  // sign-in title down to 14px captions.
  axes: ["opsz"],
  fallback: ["Georgia", "Cambria", "serif"],
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
      className={`${atkinson.variable} ${atkinsonMono.variable} ${serif.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster position="bottom-right" theme="light" />
      </body>
    </html>
  );
}
