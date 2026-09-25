"use client";

import { useId, useState } from "react";
import { ImageOff, Maximize2, ScanSearch, Tag } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import clsx from "clsx";
import {
  sortByAbundance,
  type DetectedGrain,
  type SpeciesId,
  type SpecimenDetection,
} from "@/lib/data";
import { findSpecies, useSpeciesCatalog } from "@/lib/species-catalog";
import { overlayColor, overlayColors, type OverlayColors } from "@/lib/slide-colors";
import GrainOverlay from "@/components/GrainOverlay";

/**
 * A slide image with the model's boxes drawn over it, plus the type chips that
 * filter them.
 *
 * Selecting a type shows only that type's boxes; clicking a box isolates that
 * single grain (click it again, or "All Types", to go back). The pollen-type
 * selection is owned by the parent so its detection list stays in sync; the
 * single-grain selection is local, since only the image shows it.
 *
 * Clicking the image itself (not a box) opens the full-screen inspector via
 * `onExpand`.
 */
export default function SpecimenImageViewer({
  imageUrl,
  fileName,
  grains,
  detections,
  colors,
  selectedSpeciesId,
  onSelectSpecies,
  onExpand,
  onImageError,
  caption,
}: {
  imageUrl?: string;
  fileName: string;
  /** Undefined for records saved before grain boxes were kept. */
  grains?: DetectedGrain[];
  detections: SpecimenDetection[];
  /** Report-wide overlay colours; derived from `detections` when omitted. */
  colors?: OverlayColors;
  selectedSpeciesId: SpeciesId | null;
  onSelectSpecies: (speciesId: SpeciesId | null) => void;
  onExpand?: () => void;
  /** Figure caption under the plate; the file name when omitted. */
  caption?: React.ReactNode;
  onImageError?: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const speciesCatalog = useSpeciesCatalog();
  // Off by default at this size, where labels crowd the slide; the colour
  // legend above carries the same information. On in the full-screen inspector.
  const [showLabels, setShowLabels] = useState(false);
  // Each viewer animates its own chip highlight (a report page has several).
  const viewerId = useId();
  // Tagged with the grains array it belongs to, so switching slides (a new
  // array) drops a selection that would otherwise match a same-numbered grain.
  const [grainSelection, setGrainSelection] = useState<{
    source: DetectedGrain[] | undefined;
    id: string;
  } | null>(null);

  const boxes = grains ?? [];
  const hasBoxes = boxes.length > 0;
  const palette = colors ?? overlayColors(detections);
  const selectedGrain =
    grainSelection && grainSelection.source === grains
      ? boxes.find((grain) => grain.id === grainSelection.id) ?? null
      : null;
  // A type picked elsewhere (the detection list) overrides a grain of another type.
  const activeGrainId =
    selectedGrain && (selectedSpeciesId === null || selectedGrain.speciesId === selectedSpeciesId)
      ? selectedGrain.id
      : null;
  const shownCount = activeGrainId
    ? 1
    : selectedSpeciesId
      ? boxes.filter((grain) => grain.speciesId === selectedSpeciesId).length
      : boxes.length;
  const chips = [...detections].sort(sortByAbundance);

  function selectSpecies(speciesId: SpeciesId | null) {
    setGrainSelection(null);
    onSelectSpecies(speciesId);
  }

  function handleGrainClick(grain: DetectedGrain) {
    if (grain.id === activeGrainId) {
      setGrainSelection(null);
      return;
    }
    setGrainSelection({ source: grains, id: grain.id });
    onSelectSpecies(grain.speciesId);
  }

  const chipClass = (active: boolean) =>
    clsx(
      "focus-ring relative isolate flex items-center gap-1.5 rounded border px-2.5 py-1 text-[12.5px] transition-colors",
      active
        ? "border-border-strong text-text"
        : "border-border bg-surface/50 text-text-muted hover:border-border-strong hover:text-text",
    );
  const chipHighlight = (
    <motion.span
      layoutId={`species-chip-${viewerId}`}
      className="absolute inset-0 -z-10 rounded bg-surface shadow-sm"
      transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }}
    />
  );

  return (
    <div>
      {hasBoxes && chips.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          <motion.button
            type="button"
            onClick={() => selectSpecies(null)}
            aria-pressed={selectedSpeciesId === null && !activeGrainId}
            whileTap={reduceMotion ? undefined : { scale: 0.97 }}
            className={chipClass(selectedSpeciesId === null && !activeGrainId)}
          >
            {selectedSpeciesId === null && !activeGrainId && chipHighlight}
            All Types
          </motion.button>
          {chips.map((detection) => {
            const species = findSpecies(speciesCatalog, detection.speciesId);
            const active = selectedSpeciesId === detection.speciesId;
            return (
              <motion.button
                key={detection.speciesId}
                type="button"
                onClick={() => selectSpecies(active && !activeGrainId ? null : detection.speciesId)}
                aria-pressed={active}
                whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                className={chipClass(active)}
              >
                {active && chipHighlight}
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                  style={{ backgroundColor: overlayColor(palette, detection.speciesId) }}
                />
                <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
                  {species.code}
                </span>
                <span className="text-text-faint tabular-nums">{detection.grainCount}</span>
              </motion.button>
            );
          })}
        </div>
      )}

      <div className="overflow-hidden rounded-md border border-border bg-surface">
        {imageUrl ? (
          <div
            className={clsx(
              "group relative bg-viewer",
              onExpand && "cursor-zoom-in",
            )}
            onClick={onExpand}
          >
            <GrainOverlay
              imageUrl={imageUrl}
              alt={`Specimen ${fileName}`}
              grains={boxes}
              colors={palette}
              showLabels={showLabels}
              selectedSpeciesId={selectedSpeciesId}
              selectedGrainId={activeGrainId}
              onGrainClick={handleGrainClick}
              onImageError={onImageError}
            />
            {onExpand && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onExpand();
                }}
                className="focus-ring absolute top-2 right-2 inline-flex items-center gap-1.5 rounded border border-white/20 bg-black/60 px-2 py-1 text-[12px] text-white opacity-90 transition-opacity group-hover:opacity-100 hover:bg-black/75"
              >
                <Maximize2 size={12} strokeWidth={2} />
                Open Inspector
              </button>
            )}
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
          <span className="min-w-0 text-[14px] text-pretty text-text" style={{ fontFamily: "var(--font-display)" }}>
            {caption ?? fileName}
          </span>
          {hasBoxes && (
            <span className="flex shrink-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setShowLabels((value) => !value)}
                aria-pressed={showLabels}
                className={clsx(
                  "focus-ring inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[12px] transition-colors",
                  showLabels ? "text-text" : "text-text-faint hover:text-text",
                )}
              >
                <Tag size={12} strokeWidth={1.75} />
                Labels
              </button>
              <span
                className="text-[12.5px] whitespace-nowrap tabular-nums"
                style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}
              >
                {activeGrainId ? `${activeGrainId} · ` : ""}
                {shownCount}/{boxes.length} shown
              </span>
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
