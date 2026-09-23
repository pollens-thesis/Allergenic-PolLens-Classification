import type { Metadata } from "next";
import { Inter, IBM_Plex_Mono, IBM_Plex_Serif } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

// Page-identity headings only — same Plex superfamily as the mono face
// above, so data/labels (mono) and headings (serif) read as one system
// instead of a third, unrelated typeface. Body copy stays on Inter.
const plexSerif = IBM_Plex_Serif({
  variable: "--font-plex-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
      className={`${inter.variable} ${plexMono.variable} ${plexSerif.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster position="bottom-right" theme="light" />
      </body>
    </html>
  );
}
