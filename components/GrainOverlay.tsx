"use client";

import { motion, useReducedMotion } from "motion/react";
import { speciesLabel, type DetectedGrain, type SpeciesId } from "@/lib/data";
import { findSpecies, useSpeciesCatalog } from "@/lib/species-catalog";
import { labelTextColor, overlayColor, type OverlayColors } from "@/lib/slide-colors";

/**
 * A slide image with the model's grain boxes drawn over it — shared by the
 * inline viewer and the full-screen inspector.
 *
 * Boxes are fractions of the image (`BoundingBox`), so they are positioned in
 * percentages and stay aligned at any rendered size. The image is laid out at
 * its own aspect ratio rather than `object-contain`ed, which is what keeps the
 * overlay on the picture instead of on the letterboxing around it.
 *
 * Only the boxes that match the current selection are drawn: a selected grain
 * shows that grain alone, a selected type shows only that type's grains.
 */
export default function GrainOverlay({
  imageUrl,
  alt,
  grains,
  colors,
  showLabels,
  selectedSpeciesId,
  selectedGrainId,
  onGrainClick,
  imageClassName = "block w-full",
}: {
  imageUrl: string;
  alt: string;
  grains: DetectedGrain[];
  colors: OverlayColors;
  showLabels: boolean;
  selectedSpeciesId: SpeciesId | null;
  selectedGrainId: string | null;
  onGrainClick: (grain: DetectedGrain) => void;
  imageClassName?: string;
}) {
  const reduceMotion = useReducedMotion();
  const speciesCatalog = useSpeciesCatalog();
  const visible = grains.filter((grain) =>
    selectedGrainId
      ? grain.id === selectedGrainId
      : selectedSpeciesId === null || grain.speciesId === selectedSpeciesId,
  );

  return (
    <div className="relative">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl} alt={alt} className={imageClassName} draggable={false} />

      {visible.map((grain, index) => {
        const species = findSpecies(speciesCatalog, grain.speciesId);
        const color = overlayColor(colors, grain.speciesId);
        const confidencePct = Math.round(grain.confidence * 100);
        const selected = grain.id === selectedGrainId;
        return (
          <motion.button
            key={grain.id}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onGrainClick(grain);
            }}
            aria-pressed={selected}
            title={`${grain.id} · ${speciesLabel(species)} · ${confidencePct}% confidence`}
            className="focus-ring absolute rounded-[2px]"
            style={{
              left: `${grain.box.x * 100}%`,
              top: `${grain.box.y * 100}%`,
              width: `${grain.box.width * 100}%`,
              height: `${grain.box.height * 100}%`,
              border: `2px solid ${color}`,
              // A thin dark halo keeps light colours (yellow, sky blue) visible on
              // bright, pale slides — border contrast carries the colour.
              boxShadow: selected
                ? `0 0 0 1px rgba(0,0,0,0.55), 0 0 0 4px ${color}55`
                : "0 0 0 1px rgba(0,0,0,0.55)",
            }}
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{
              duration: reduceMotion ? 0 : 0.12,
              ease: [0.16, 1, 0.3, 1],
              delay: reduceMotion ? 0 : Math.min(index, 10) * 0.02,
            }}
          >
            {showLabels && (
              <span
                aria-hidden
                className="pointer-events-none absolute bottom-full left-[-2px] mb-px rounded-[2px] px-1 text-[10.5px] leading-[15px] whitespace-nowrap tabular-nums"
                style={{
                  backgroundColor: color,
                  color: labelTextColor(color),
                  fontFamily: "var(--font-mono)",
                  fontWeight: 600,
                }}
              >
                {species.code} {confidencePct}%
              </span>
            )}
            <span className="sr-only">
              {grain.id}: {species.scientificName} grain, {confidencePct}% confidence
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
