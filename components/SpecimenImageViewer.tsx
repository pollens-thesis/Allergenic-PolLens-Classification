"use client";

import { ImageOff, ScanSearch } from "lucide-react";
import {
  getSpecies,
  sortByAbundance,
  type DetectedGrain,
  type SpeciesId,
  type SpecimenDetection,
} from "@/lib/data";

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
          <button
            type="button"
            onClick={() => onSelectSpecies(null)}
            aria-pressed={selectedSpeciesId === null}
            className={`focus-ring rounded-full border px-2.5 py-1 text-[12.5px] transition ${
              selectedSpeciesId === null
                ? "border-ink/25 bg-white text-ink"
                : "border-panel-line bg-white/50 text-ink/70 hover:border-ink/20 hover:text-ink"
            }`}
          >
            All types
          </button>
          {chips.map((detection) => {
            const species = getSpecies(detection.speciesId);
            const active = selectedSpeciesId === detection.speciesId;
            return (
              <button
                key={detection.speciesId}
                type="button"
                onClick={() => onSelectSpecies(active ? null : detection.speciesId)}
                aria-pressed={active}
                className={`focus-ring flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px] transition ${
                  active
                    ? "border-ink/25 bg-white text-ink"
                    : "border-panel-line bg-white/50 text-ink/70 hover:border-ink/20 hover:text-ink"
                }`}
              >
                <span
                  aria-hidden
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: species.color }}
                />
                <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
                  {species.code}
                </span>
                <span className="text-ink/65">{detection.grainCount}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="overflow-hidden rounded-md border border-panel-line bg-white">
        {imageUrl ? (
          <div className="relative bg-panel">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt={`Specimen ${fileName}`} className="block w-full" />

            {boxes.map((grain) => {
              const species = getSpecies(grain.speciesId);
              const dimmed = selectedSpeciesId !== null && grain.speciesId !== selectedSpeciesId;
              return (
                <button
                  key={grain.id}
                  type="button"
                  onClick={() => onSelectSpecies(dimmed ? grain.speciesId : null)}
                  title={`${species.genus} (${species.commonName}) · ${Math.round(grain.confidence * 100)}% confidence`}
                  className="absolute rounded-[2px] transition-opacity"
                  style={{
                    left: `${grain.box.x * 100}%`,
                    top: `${grain.box.y * 100}%`,
                    width: `${grain.box.width * 100}%`,
                    height: `${grain.box.height * 100}%`,
                    border: `2px solid ${species.color}`,
                    boxShadow: dimmed ? "none" : `0 0 0 1px rgba(0,0,0,0.25)`,
                    opacity: dimmed ? 0.2 : 1,
                  }}
                >
                  <span className="sr-only">
                    {species.genus} grain, {Math.round(grain.confidence * 100)}% confidence
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex h-40 w-full flex-col items-center justify-center gap-1.5 bg-panel/50 text-center">
            <ImageOff size={18} strokeWidth={1.5} className="text-ink/55" />
            <span className="px-3 text-[12.5px] text-ink/70">
              Image not stored for this record
            </span>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-panel-line px-3 py-2 text-[13px] text-ink/70">
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
        <p className="mt-2 flex items-start gap-1.5 text-[12.5px] text-ink/65">
          <ScanSearch size={13} strokeWidth={1.75} className="mt-0.5 shrink-0 text-ink/55" />
          Grain positions weren&apos;t recorded for this slide, so there are no boxes to show.
        </p>
      )}
    </div>
  );
}
