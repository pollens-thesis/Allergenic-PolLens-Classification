import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Source_Serif_4 } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

// A technical sans carries controls and running text. Keep the serif for
// scientific names, where it helps the binomial read as a distinct data type.
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  weight: "variable",
  subsets: ["latin", "latin-ext"],
  fallback: ["system-ui", "Segoe UI", "Arial", "sans-serif"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  weight: ["400", "500", "600"],
  subsets: ["latin", "latin-ext"],
  fallback: ["ui-monospace", "Consolas", "monospace"],
});

// Serif italic is reserved for binomials and botanical names.
const serif = Source_Serif_4({
  variable: "--font-serif",
  subsets: ["latin"],
  style: ["normal", "italic"],
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
      className={`${plexSans.variable} ${plexMono.variable} ${serif.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster position="bottom-right" theme="light" />
      </body>
    </html>
  );
}
