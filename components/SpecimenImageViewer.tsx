"use client";

import { ImageOff, ScanSearch } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import clsx from "clsx";
import {
  sortByAbundance,
  speciesLabel,
  type DetectedGrain,
  type SpeciesId,
  type SpecimenDetection,
} from "@/lib/data";
import { findSpecies, useSpeciesCatalog } from "@/lib/species-catalog";

/**
 * A slide image with the model's boxes drawn over it.
 *
 * Boxes are stored as fractions of the image (see `BoundingBox`), so they are
 * positioned in percentages and stay correct at any rendered size — no need to
 * know the natural pixel dimensions, and nothing to recompute on resize. The
 * image is laid out at its own aspect ratio rather than `object-contain`ed into
 * a fixed box, which is what keeps the overlay aligned with the picture instead
 * of with the letterboxing around it.
 *
 * Selecting a pollen type is the point of the overlay: that type's grains are
 * drawn solid, everything else fades back so the slide stays legible.
 */
export default function SpecimenImageViewer({
  imageUrl,
  fileName,
  grains,
  detections,
  selectedSpeciesId,
  onSelectSpecies,
}: {
  imageUrl?: string;
  fileName: string;
  /** Undefined for records saved before grain boxes were kept. */
  grains?: DetectedGrain[];
  detections: SpecimenDetection[];
  selectedSpeciesId: SpeciesId | null;
  onSelectSpecies: (speciesId: SpeciesId | null) => void;
}) {
  const reduceMotion = useReducedMotion();
  const speciesCatalog = useSpeciesCatalog();
  const boxes = grains ?? [];
  const hasBoxes = boxes.length > 0;
  const shownCount = selectedSpeciesId
    ? boxes.filter((grain) => grain.speciesId === selectedSpeciesId).length
    : boxes.length;
  const chips = [...detections].sort(sortByAbundance);

  return (
    <div>
      {hasBoxes && chips.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          <motion.button
            type="button"
            onClick={() => onSelectSpecies(null)}
            aria-pressed={selectedSpeciesId === null}
            whileTap={reduceMotion ? undefined : { scale: 0.97 }}
            className={clsx(
              "focus-ring relative isolate rounded-full border px-2.5 py-1 text-[12.5px] transition-colors",
              selectedSpeciesId === null
                ? "border-border-strong text-text"
                : "border-border bg-surface/50 text-text-muted hover:border-border-strong hover:text-text",
            )}
          >
            {selectedSpeciesId === null && (
              <motion.span
                layoutId="species-chip-highlight"
                className="absolute inset-0 -z-10 rounded-full bg-surface shadow-sm"
                transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            All types
          </motion.button>
          {chips.map((detection) => {
            const species = findSpecies(speciesCatalog, detection.speciesId);
            const active = selectedSpeciesId === detection.speciesId;
            return (
              <motion.button
                key={detection.speciesId}
                type="button"
                onClick={() => onSelectSpecies(active ? null : detection.speciesId)}
                aria-pressed={active}
                whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                className={clsx(
                  "focus-ring relative isolate flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px] transition-colors",
                  active
                    ? "border-border-strong text-text"
                    : "border-border bg-surface/50 text-text-muted hover:border-border-strong hover:text-text",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="species-chip-highlight"
                    className="absolute inset-0 -z-10 rounded-full bg-surface shadow-sm"
                    transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }}
                  />
                )}
                <span
                  aria-hidden
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: species.color }}
                />
                <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
                  {species.code}
                </span>
                <span className="text-text-faint">{detection.grainCount}</span>
              </motion.button>
            );
          })}
        </div>
      )}

      <div className="overflow-hidden rounded-md border border-border bg-surface">
        {imageUrl ? (
          <div className="relative bg-surface-sunken">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt={`Specimen ${fileName}`} className="block w-full" />

            {boxes.map((grain, index) => {
              const species = findSpecies(speciesCatalog, grain.speciesId);
              const dimmed = selectedSpeciesId !== null && grain.speciesId !== selectedSpeciesId;
              return (
                <motion.button
                  key={grain.id}
                  type="button"
                  onClick={() => onSelectSpecies(dimmed ? grain.speciesId : null)}
                  title={`${speciesLabel(species)} · ${Math.round(grain.confidence * 100)}% confidence`}
                  className="absolute rounded-[2px]"
                  style={{
                    left: `${grain.box.x * 100}%`,
                    top: `${grain.box.y * 100}%`,
                    width: `${grain.box.width * 100}%`,
                    height: `${grain.box.height * 100}%`,
                    border: `2px solid ${species.color}`,
                    boxShadow: dimmed ? "none" : `0 0 0 1px rgba(0,0,0,0.25)`,
                  }}
                  initial={reduceMotion ? false : { opacity: 0, scale: 0.97 }}
                  animate={{ opacity: dimmed ? 0.2 : 1, scale: 1 }}
                  transition={{
                    duration: reduceMotion ? 0 : 0.15,
                    ease: [0.16, 1, 0.3, 1],
                    delay: reduceMotion ? 0 : Math.min(index, 10) * 0.03,
                  }}
                >
                  <span className="sr-only">
                    {species.scientificName} grain, {Math.round(grain.confidence * 100)}% confidence
                  </span>
                </motion.button>
              );
            })}
          </div>
        ) : (
          <div className="flex h-40 w-full flex-col items-center justify-center gap-1.5 bg-surface-sunken text-center">
            <ImageOff size={18} strokeWidth={1.5} className="text-text-faint" />
            <span className="px-3 text-[12.5px] text-text-muted">
              Image not stored for this record
            </span>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-border px-3 py-2 text-[13px] text-text-muted">
          <span className="truncate">{fileName}</span>
          {hasBoxes && (
            <span
              className="shrink-0 text-[12.5px] whitespace-nowrap"
              style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}
            >
              {shownCount}/{boxes.length} boxed
            </span>
          )}
        </div>
      </div>

      {imageUrl && !hasBoxes && (
        <p className="mt-2 flex items-start gap-1.5 text-[12.5px] text-text-muted">
          <ScanSearch size={13} strokeWidth={1.75} className="mt-0.5 shrink-0 text-text-faint" />
          Grain positions weren&apos;t recorded for this slide, so there are no boxes to show.
        </p>
      )}
    </div>
  );
}
