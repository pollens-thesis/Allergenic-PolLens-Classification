// ---------------------------------------------------------------------------
// OVERLAY COLOURS — which colour each pollen type's boxes are drawn in.
//
// The catalog's own `Species.color` repeats (9 hues across 23 species), so two
// types on the same slide could be boxed in the same colour. Boxes instead take
// their colour from the Okabe–Ito palette, assigned per report (or per analysis
// batch) in order of abundance: the types actually present always get distinct
// colours, and a type keeps the same colour on every slide of that report.
//
// Okabe & Ito (2008), "Color Universal Design" — chosen to stay distinguishable
// under the common colour-vision deficiencies. Black is left out because it
// disappears against dark specimen backgrounds. Beyond seven types the palette
// cycles; every box also carries its species code, so colour is never the only
// cue (see docs/design-system.md).
//
// Charts and the map keep the catalog colours — this is for image overlays and
// the legends beside them.
// ---------------------------------------------------------------------------

import { sortByAbundance, type SpeciesId, type SpecimenDetection } from "@/lib/data";

export const OVERLAY_PALETTE = [
  "#E69F00", // orange
  "#56B4E9", // sky blue
  "#009E73", // bluish green
  "#F0E442", // yellow
  "#0072B2", // blue
  "#D55E00", // vermillion
  "#CC79A7", // reddish purple
] as const;

export type OverlayColors = Partial<Record<SpeciesId, string>>;

/** Distinct overlay colours for the types in `detections`, most abundant first. */
export function overlayColors(detections: SpecimenDetection[]): OverlayColors {
  const colors: OverlayColors = {};
  [...detections].sort(sortByAbundance).forEach((detection, index) => {
    colors[detection.speciesId] = OVERLAY_PALETTE[index % OVERLAY_PALETTE.length];
  });
  return colors;
}

/** Colour for one type, falling back to the first palette entry for unknown ids. */
export function overlayColor(colors: OverlayColors, speciesId: SpeciesId): string {
  return colors[speciesId] ?? OVERLAY_PALETTE[0];
}

/** Black or white, whichever reads better on top of `hex` (for box labels). */
export function labelTextColor(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  // Relative luminance, sRGB approximation — good enough to pick a label colour.
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 140 ? "#111111" : "#ffffff";
}
