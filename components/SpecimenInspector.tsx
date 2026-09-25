"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent } from "react";
import Link from "next/link";
import { Dialog } from "@base-ui/react/dialog";
import clsx from "clsx";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Maximize,
  Minus,
  Plus,
  Tag,
  X,
} from "lucide-react";
import {
  getTotalGrains,
  getWeightedAvgConfidence,
  sortByAbundance,
  type DetectedGrain,
  type SpeciesId,
  type SpecimenDetection,
} from "@/lib/data";
import { findSpecies, useSpeciesCatalog } from "@/lib/species-catalog";
import { useReportGrainCounts } from "@/lib/report-grain-counts";
import { overlayColor, overlayColors, type OverlayColors } from "@/lib/slide-colors";
import GrainOverlay from "@/components/GrainOverlay";
import RiskBadge from "@/components/RiskBadge";

export type InspectorSlide = {
  id: string;
  /** Short label shown in the header, e.g. "Slide 2". */
  label: string;
  fileName: string;
  imageUrl?: string;
  grains?: DetectedGrain[];
  detections: SpecimenDetection[];
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 8;

type View = { scale: number; x: number; y: number };
const FIT: View = { scale: 1, x: 0, y: 0 };

const mono = { fontFamily: "var(--font-mono)", fontWeight: 500 } as const;
const sectionLabel = "caption-label text-[14px] mb-2";

/**
 * Full-screen specimen inspector: the slide on the right on a neutral dark
 * surround (the layout of microscopy/pathology viewers such as QuPath), and on
 * the left what the model found plus the reference entry for the selected
 * pollen type, pulled from the same catalog as the Allergen Reference page.
 *
 * Selection works like the inline viewer: a type shows only its boxes, a grain
 * shows only itself. Wheel or the toolbar zooms, dragging pans.
 */
export default function SpecimenInspector({
  open,
  onOpenChange,
  slides,
  colors,
  initialSlideId,
  initialSpeciesId = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slides: InspectorSlide[];
  /** Report-wide overlay colours, so boxes match the page behind the dialog. */
  colors?: OverlayColors;
  initialSlideId?: string;
  initialSpeciesId?: SpeciesId | null;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/50 transition-opacity duration-[var(--duration-base)] ease-[var(--ease-out)] data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
        <Dialog.Popup className="fixed inset-0 z-50 flex flex-col bg-bg outline-none transition-opacity duration-[var(--duration-base)] ease-[var(--ease-out)] data-[starting-style]:opacity-0 data-[ending-style]:opacity-0">
          {open && (
            <InspectorBody
              slides={slides}
              colors={colors}
              initialSlideId={initialSlideId}
              initialSpeciesId={initialSpeciesId}
            />
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function InspectorBody({
  slides,
  colors,
  initialSlideId,
  initialSpeciesId,
}: {
  slides: InspectorSlide[];
  colors?: OverlayColors;
  initialSlideId?: string;
  initialSpeciesId: SpeciesId | null;
}) {
  const speciesCatalog = useSpeciesCatalog();
  const reportCounts = useReportGrainCounts();
  const [slideIndex, setSlideIndex] = useState(() =>
    Math.max(0, slides.findIndex((slide) => slide.id === initialSlideId)),
  );
  const [speciesId, setSpeciesId] = useState<SpeciesId | null>(initialSpeciesId);
  const [grainId, setGrainId] = useState<string | null>(null);
  const [showLabels, setShowLabels] = useState(true);
  const [view, setView] = useState<View>(FIT);
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const drag = useRef<{ x: number; y: number; view: View } | null>(null);
  const [dragging, setDragging] = useState(false);

  const slide = slides[slideIndex];
  const grains = slide.grains ?? [];
  const palette = colors ?? overlayColors(slide.detections);
  const detections = [...slide.detections].sort(sortByAbundance);
  const grain = grainId ? grains.find((g) => g.id === grainId) ?? null : null;
  const focusSpeciesId = grain?.speciesId ?? speciesId ?? detections[0]?.speciesId ?? null;
  const focusSpecies = focusSpeciesId ? findSpecies(speciesCatalog, focusSpeciesId) : null;

  function goToSlide(index: number) {
    setSlideIndex(index);
    setSpeciesId(null);
    setGrainId(null);
    setView(FIT);
    setNatural(null);
  }

  function selectSpecies(id: SpeciesId | null) {
    setGrainId(null);
    setSpeciesId(id);
  }

  function selectGrain(target: DetectedGrain) {
    if (target.id === grainId) {
      setGrainId(null);
      return;
    }
    setGrainId(target.id);
    setSpeciesId(target.speciesId);
  }

  function zoomBy(factor: number) {
    setView((current) => {
      const scale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current.scale * factor));
      return scale === MIN_ZOOM ? FIT : { ...current, scale };
    });
  }

  function handleWheel(event: WheelEvent) {
    zoomBy(event.deltaY < 0 ? 1.15 : 1 / 1.15);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (view.scale === 1 || (event.target as HTMLElement).closest("button")) return;
    drag.current = { x: event.clientX, y: event.clientY, view };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const start = drag.current;
    if (!start) return;
    setView({
      ...start.view,
      x: start.view.x + (event.clientX - start.x),
      y: start.view.y + (event.clientY - start.y),
    });
  }

  function endDrag() {
    drag.current = null;
    setDragging(false);
  }

  const slideGrains = getTotalGrains(slide.detections);
  const slideConfidence = getWeightedAvgConfidence(slide.detections);

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[minmax(20rem,26rem)_1fr] lg:overflow-hidden">
      {/* Left: what the model found, and the reference entry */}
      <aside className="order-2 min-h-0 overflow-y-auto border-r border-border bg-surface lg:order-1">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border bg-surface px-4 py-3">
          <div className="min-w-0">
            <Dialog.Title className="text-[15px] font-semibold text-text">Specimen Inspector</Dialog.Title>
            <p className="truncate text-[12.5px] text-text-muted">
              <span style={mono}>{slide.label}</span> · {slide.fileName}
            </p>
          </div>
          {slides.length > 1 && (
            <div className="flex shrink-0 items-center gap-1">
              <IconButton
                label="Previous Slide"
                disabled={slideIndex === 0}
                onClick={() => goToSlide(slideIndex - 1)}
              >
                <ChevronLeft size={15} />
              </IconButton>
              <span className="text-[12px] text-text-muted tabular-nums" style={mono}>
                {slideIndex + 1}/{slides.length}
              </span>
              <IconButton
                label="Next Slide"
                disabled={slideIndex === slides.length - 1}
                onClick={() => goToSlide(slideIndex + 1)}
              >
                <ChevronRight size={15} />
              </IconButton>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-5 px-4 py-4">
          <dl className="grid grid-cols-3 divide-x divide-border rounded-md border border-border bg-surface-sunken text-center">
            <Stat label="Grains" value={slideGrains} />
            <Stat label="Types" value={slide.detections.length} />
            <Stat label="Avg. Conf." value={`${Math.round(slideConfidence * 100)}%`} />
          </dl>

          {grain && focusSpecies && (
            <section>
              <h3 className={sectionLabel}>Selected Grain</h3>
              <div className="rounded-md border border-border-strong p-3">
                <div className="flex items-center gap-2">
                  <Swatch color={overlayColor(palette, grain.speciesId)} />
                  <span className="text-[14px] font-semibold text-text" style={mono}>{grain.id}</span>
                  <span className="text-[13px] text-text italic">{focusSpecies.scientificName}</span>
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[12.5px]">
                  <dt className="text-text-muted">Confidence</dt>
                  <dd className="text-right text-text tabular-nums" style={mono}>
                    {(grain.confidence * 100).toFixed(1)}%
                  </dd>
                  <dt className="text-text-muted">Position (x, y)</dt>
                  <dd className="text-right text-text tabular-nums" style={mono}>
                    {natural
                      ? `${Math.round(grain.box.x * natural.width)}, ${Math.round(grain.box.y * natural.height)} px`
                      : `${(grain.box.x * 100).toFixed(1)}, ${(grain.box.y * 100).toFixed(1)} %`}
                  </dd>
                  <dt className="text-text-muted">Size (w × h)</dt>
                  <dd className="text-right text-text tabular-nums" style={mono}>
                    {natural
                      ? `${Math.round(grain.box.width * natural.width)} × ${Math.round(grain.box.height * natural.height)} px`
                      : `${(grain.box.width * 100).toFixed(1)} × ${(grain.box.height * 100).toFixed(1)} %`}
                  </dd>
                </dl>
              </div>
            </section>
          )}

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className={clsx(sectionLabel, "mb-0")}>Detections</h3>
              {(speciesId || grainId) && (
                <button
                  type="button"
                  onClick={() => selectSpecies(null)}
                  className="focus-ring rounded px-1.5 py-0.5 text-[12px] text-accent hover:bg-accent-muted"
                >
                  Show All
                </button>
              )}
            </div>
            {detections.length === 0 ? (
              <p className="text-[13px] text-text-muted">No pollen grains detected on this slide.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {detections.map((detection) => {
                  const species = findSpecies(speciesCatalog, detection.speciesId);
                  const active = speciesId === detection.speciesId;
                  const typeGrains = grains.filter((g) => g.speciesId === detection.speciesId);
                  return (
                    <li key={detection.speciesId}>
                      <button
                        type="button"
                        onClick={() => selectSpecies(active && !grainId ? null : detection.speciesId)}
                        aria-pressed={active}
                        className={clsx(
                          "focus-ring flex w-full items-center gap-2.5 rounded-md border px-2.5 py-2 text-left transition-colors",
                          active ? "border-accent bg-accent-muted" : "border-border hover:border-border-strong",
                        )}
                      >
                        <Swatch color={overlayColor(palette, detection.speciesId)} />
                        <span className="w-11 shrink-0 text-[12px] text-text-muted" style={mono}>{species.code}</span>
                        <span className="min-w-0 flex-1 truncate text-[13px] text-text italic">
                          {species.scientificName}
                        </span>
                        <span className="shrink-0 text-[12.5px] text-text tabular-nums" style={mono}>
                          {detection.grainCount}
                        </span>
                        <span className="w-10 shrink-0 text-right text-[12px] text-text-muted tabular-nums" style={mono}>
                          {Math.round(detection.avgConfidence * 100)}%
                        </span>
                      </button>
                      {active && typeGrains.length > 0 && (
                        <ul className="mt-1 mb-1 ml-5 grid grid-cols-3 gap-1">
                          {typeGrains.map((g) => (
                            <li key={g.id}>
                              <button
                                type="button"
                                onClick={() => selectGrain(g)}
                                aria-pressed={g.id === grainId}
                                className={clsx(
                                  "focus-ring flex w-full items-center justify-between rounded border px-1.5 py-1 text-[11.5px] tabular-nums transition-colors",
                                  g.id === grainId
                                    ? "border-accent bg-accent-muted text-text"
                                    : "border-border text-text-muted hover:border-border-strong hover:text-text",
                                )}
                                style={mono}
                              >
                                <span>{g.id}</span>
                                <span>{Math.round(g.confidence * 100)}%</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {focusSpecies && (
            <section>
              <h3 className={sectionLabel}>Pollen Reference</h3>
              <div className="rounded-md border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-text italic">{focusSpecies.scientificName}</p>
                    <p className="text-[12.5px] text-text-muted">
                      {focusSpecies.commonName
                        ? focusSpecies.commonName
                        : "Common name not yet recorded"}
                    </p>
                  </div>
                  <RiskBadge level={focusSpecies.riskLevel} className="shrink-0" />
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[12.5px]">
                  <dt className="text-text-muted">Code</dt>
                  <dd className="text-right text-text" style={mono}>{focusSpecies.code}</dd>
                  <dt className="text-text-muted">Season</dt>
                  <dd className="text-right text-text">
                    {focusSpecies.season || "Not yet recorded"}
                  </dd>
                  <dt className="text-text-muted">Grains in All Reports</dt>
                  <dd className="text-right text-text tabular-nums" style={mono}>
                    {reportCounts === null ? "…" : (reportCounts[focusSpecies.id] ?? 0).toLocaleString()}
                  </dd>
                </dl>
                <Link
                  href={`/dataset#${focusSpecies.id}`}
                  className="focus-ring mt-3 inline-flex items-center gap-1.5 rounded text-[12.5px] text-accent hover:underline"
                >
                  <BookOpen size={13} strokeWidth={1.75} />
                  Open in Allergen Reference
                </Link>
              </div>
            </section>
          )}
        </div>
      </aside>

      {/* Right: the slide */}
      <section className="relative order-1 flex min-h-[55vh] flex-col bg-viewer lg:order-2 lg:min-h-0">
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2 text-white/85">
          <div className="flex items-center gap-1">
            <ViewerButton label="Zoom Out" onClick={() => zoomBy(1 / 1.4)} disabled={view.scale <= MIN_ZOOM}>
              <Minus size={14} />
            </ViewerButton>
            <span className="w-12 text-center text-[12px] tabular-nums" style={mono}>
              {Math.round(view.scale * 100)}%
            </span>
            <ViewerButton label="Zoom In" onClick={() => zoomBy(1.4)} disabled={view.scale >= MAX_ZOOM}>
              <Plus size={14} />
            </ViewerButton>
            <ViewerButton label="Fit to Screen" onClick={() => setView(FIT)}>
              <Maximize size={13} />
            </ViewerButton>
            <span className="mx-1 h-4 w-px bg-white/15" aria-hidden />
            <ViewerButton label="Box Labels" onClick={() => setShowLabels((v) => !v)} pressed={showLabels}>
              <Tag size={13} />
            </ViewerButton>
            {(speciesId || grainId) && (
              <ViewerButton label="Show All Boxes" onClick={() => selectSpecies(null)}>
                <Crosshair size={13} />
              </ViewerButton>
            )}
          </div>
          <Dialog.Close
            aria-label="Close Inspector"
            className="focus-ring inline-flex items-center gap-1.5 rounded px-2 py-1 text-[12.5px] text-white/85 hover:bg-white/10 hover:text-white"
          >
            <X size={15} />
            Close
          </Dialog.Close>
        </div>

        <div
          className={clsx(
            "relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4 touch-none select-none",
            view.scale > 1 && (dragging ? "cursor-grabbing" : "cursor-grab"),
          )}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {slide.imageUrl ? (
            <div
              className="max-h-full max-w-full"
              style={{
                transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
                transformOrigin: "center",
                transition: dragging ? "none" : "transform 120ms var(--ease-out)",
              }}
            >
              <GrainOverlay
                imageUrl={slide.imageUrl}
                alt={`Specimen ${slide.fileName}`}
                grains={grains}
                colors={palette}
                showLabels={showLabels}
                selectedSpeciesId={speciesId}
                selectedGrainId={grainId}
                onGrainClick={selectGrain}
                imageClassName="block max-h-[calc(100vh-7rem)] w-auto max-w-full"
              />
              {/* Natural size, for pixel measurements in the grain card. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={slide.imageUrl}
                alt=""
                hidden
                onLoad={(event) =>
                  setNatural({
                    width: event.currentTarget.naturalWidth,
                    height: event.currentTarget.naturalHeight,
                  })
                }
              />
            </div>
          ) : (
            <p className="text-[13px] text-white/70">Image not stored for this record.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function Swatch({ color }: { color: string }) {
  return <span aria-hidden className="h-3 w-3 shrink-0 rounded-[2px] ring-1 ring-black/20" style={{ backgroundColor: color }} />;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="px-2 py-2">
      <dd className="text-[16px] text-text tabular-nums" style={mono}>{value}</dd>
      <dt className="text-[11.5px] text-text-muted">{label}</dt>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="focus-ring inline-flex h-7 w-7 items-center justify-center rounded border border-border text-text-muted hover:border-border-strong hover:text-text disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function ViewerButton({
  label,
  onClick,
  disabled,
  pressed,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "focus-ring inline-flex h-7 w-7 items-center justify-center rounded hover:bg-white/10 disabled:opacity-35",
        pressed && "bg-white/15 text-white",
      )}
    >
      {children}
    </button>
  );
}
