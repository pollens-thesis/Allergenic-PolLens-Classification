"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Check, CircleHelp, Crosshair, Loader2, MousePointer2, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  type BoundingBox,
  type DetectedGrain,
  type GrainAnnotation,
  type SpeciesId,
  type SpecimenDetection,
  getTotalGrains,
} from "@/lib/data";
import { findSpecies, useSpeciesCatalog } from "@/lib/species-catalog";
import { deleteGrainAnnotation, saveGrainAnnotation } from "@/lib/store";
import { SessionExpiredError } from "@/lib/api";
import { overlayColor, overlayColors } from "@/lib/slide-colors";
import { CLASSIFIER_SPECIES_IDS, researchSpeciesName } from "@/lib/species-names";

const inputClass =
  "focus-ring min-h-11 w-full rounded-sm border border-border bg-surface px-2 py-2 text-[13px] text-text";

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

type ResizeHandle = "nw" | "ne" | "sw" | "se";
type BoxTarget =
  | { kind: "grain"; grain: DetectedGrain }
  | { kind: "manual"; annotation: GrainAnnotation }
  | { kind: "pending" };
type BoxInteraction = {
  pointerId: number;
  start: { x: number; y: number };
  original: BoundingBox;
  mode: "move" | "resize";
  handle?: ResizeHandle;
  moved: boolean;
  wasSelected: boolean;
};

function pointerPoint(event: { clientX: number; clientY: number }, element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  return {
    x: clamp((event.clientX - rect.left) / Math.max(rect.width, 1)),
    y: clamp((event.clientY - rect.top) / Math.max(rect.height, 1)),
  };
}

function boxFromPoints(start: { x: number; y: number }, end: { x: number; y: number }): BoundingBox {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

function sameBox(left: BoundingBox | null, right: BoundingBox | null): boolean {
  if (!left || !right) return left === right;
  return (Object.keys(left) as Array<keyof BoundingBox>).every(
    (key) => Math.abs(left[key] - right[key]) < 0.00001,
  );
}

function ResizeHandles({
  target,
  box,
  onStart,
  onMove,
  onFinish,
  onCancel,
}: {
  target: BoxTarget;
  box: BoundingBox;
  onStart: (target: BoxTarget, box: BoundingBox, handle: ResizeHandle, event: ReactPointerEvent<HTMLButtonElement>) => void;
  onMove: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onFinish: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onCancel: () => void;
}) {
  const handles: Array<{ key: ResizeHandle; left: string; top: string; cursor: string; label: string }> = [
    { key: "nw", left: "0%", top: "0%", cursor: "nwse-resize", label: "top-left" },
    { key: "ne", left: "100%", top: "0%", cursor: "nesw-resize", label: "top-right" },
    { key: "sw", left: "0%", top: "100%", cursor: "nesw-resize", label: "bottom-left" },
    { key: "se", left: "100%", top: "100%", cursor: "nwse-resize", label: "bottom-right" },
  ];
  return handles.map((handle) => (
    <button
      key={handle.key}
      type="button"
      aria-label={`Resize box from ${handle.label} corner`}
      title={`Resize from ${handle.label} corner`}
      onPointerDown={(event) => onStart(target, box, handle.key, event)}
      onPointerMove={onMove}
      onPointerUp={onFinish}
      onPointerCancel={onCancel}
      onClick={(event) => event.stopPropagation()}
      data-review-keep-selection
      className="focus-ring absolute z-40 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 touch-none rounded-[1px]"
      style={{
        left: `${(box.x + (handle.key === "ne" || handle.key === "se" ? box.width : 0)) * 100}%`,
        top: `${(box.y + (handle.key === "sw" || handle.key === "se" ? box.height : 0)) * 100}%`,
        cursor: handle.cursor,
        background: "var(--plate-paper)",
        border: "2px solid var(--ink)",
        boxShadow: "0 0 0 1px rgba(0,0,0,.65)",
      }}
    />
  ));
}

export default function GrainReviewEditor({
  sampleId,
  slideId,
  imageUrl,
  fileName,
  grains = [],
  detections,
  selectedSpeciesId = null,
  annotations = [],
  sampleDetections = false,
  reviewedDetections,
  summaryContent,
  trailingContent,
  onSaved,
  onRemoved,
}: {
  sampleId: string;
  slideId: string;
  imageUrl?: string;
  fileName: string;
  grains?: DetectedGrain[];
  detections: SpecimenDetection[];
  reviewedDetections?: SpecimenDetection[];
  selectedSpeciesId?: SpeciesId | null;
  annotations?: GrainAnnotation[];
  sampleDetections?: boolean;
  summaryContent?: ReactNode;
  trailingContent?: ReactNode;
  onSaved: (annotation: GrainAnnotation) => void;
  onRemoved: (id: string) => void;
}) {
  const speciesCatalog = useSpeciesCatalog();
  const annotationSpecies = speciesCatalog.filter((species) => CLASSIFIER_SPECIES_IDS.has(species.id));
  const palette = useMemo(() => overlayColors(detections), [detections]);
  const editorRef = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const drawStart = useRef<{ x: number; y: number } | null>(null);
  const boxInteraction = useRef<BoxInteraction | null>(null);
  const suppressPointerClick = useRef(false);
  const [selectedGrainId, setSelectedGrainId] = useState<string | null>(null);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [pendingBox, setPendingBox] = useState<BoundingBox | null>(null);
  const [drawPreview, setDrawPreview] = useState<BoundingBox | null>(null);
  const [boxDraft, setBoxDraft] = useState<BoundingBox | null>(null);
  const [speciesDraft, setSpeciesDraft] = useState<SpeciesId | "">("");
  const [saving, setSaving] = useState(false);

  const selectedGrain = grains.find((grain) => grain.id === selectedGrainId) ?? null;
  const selectedAnnotation = selectedGrain
    ? annotations.find((annotation) => annotation.grainId === selectedGrain.id) ?? null
    : annotations.find((annotation) => annotation.id === selectedAnnotationId) ?? null;
  const selectedManual = selectedAnnotation?.grainId === null ? selectedAnnotation : null;
  const originalSelectedBox = selectedGrain
    ? selectedAnnotation?.box ?? selectedGrain.box
    : selectedManual?.box ?? pendingBox;
  const originalSelectedSpeciesId = selectedGrain
    ? selectedAnnotation?.speciesId ?? selectedGrain.speciesId
    : selectedManual?.speciesId ?? "";
  const boxDraftChanged = boxDraft !== null && !sameBox(boxDraft, originalSelectedBox);
  const speciesDraftChanged = Boolean(selectedGrain || selectedManual) && speciesDraft !== originalSelectedSpeciesId;
  const hasDraftChanges = Boolean(pendingBox) || boxDraftChanged || speciesDraftChanged;
  const modelGrainCount = getTotalGrains(detections);
  const reviewedGrainCount = getTotalGrains(reviewedDetections ?? detections);
  const shownGrains = grains.filter(
    (grain) => selectedSpeciesId === null || grain.speciesId === selectedSpeciesId,
  );

  function clearSelection() {
    if (hasDraftChanges || saving) return;
    setSelectedGrainId(null);
    setSelectedAnnotationId(null);
    setBoxDraft(null);
    setSpeciesDraft("");
  }

  useEffect(() => {
    if ((!selectedGrainId && !selectedAnnotationId && !pendingBox) || hasDraftChanges || saving) return;

    function dismissOnOutsidePointer(event: PointerEvent) {
      const editor = editorRef.current;
      const target = event.target;
      if (!editor || !(target instanceof Element)) return;
      if (editor.contains(target) && target.closest("[data-review-keep-selection]")) return;
      setSelectedGrainId(null);
      setSelectedAnnotationId(null);
      setBoxDraft(null);
      setSpeciesDraft("");
    }

    document.addEventListener("pointerdown", dismissOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", dismissOnOutsidePointer);
  }, [hasDraftChanges, pendingBox, saving, selectedAnnotationId, selectedGrainId]);

  function selectGrain(grain: DetectedGrain) {
    setSelectedGrainId(grain.id);
    setSelectedAnnotationId(null);
    const annotation = annotations.find((entry) => entry.grainId === grain.id);
    setBoxDraft(annotation?.box ?? grain.box);
    setSpeciesDraft(annotation?.speciesId ?? grain.speciesId);
    setPendingBox(null);
  }

  function selectManual(annotation: GrainAnnotation) {
    setSelectedGrainId(null);
    setSelectedAnnotationId(annotation.id);
    setBoxDraft(annotation.box);
    setSpeciesDraft(annotation.speciesId ?? "");
    setPendingBox(null);
  }

  function toggleGrainSelection(grain: DetectedGrain) {
    if (selectedGrainId === grain.id && !hasDraftChanges) {
      clearSelection();
      return;
    }
    selectGrain(grain);
  }

  function toggleManualSelection(annotation: GrainAnnotation) {
    if (selectedAnnotationId === annotation.id && !hasDraftChanges) {
      clearSelection();
      return;
    }
    selectManual(annotation);
  }

  function startBoxInteraction(
    target: BoxTarget,
    original: BoundingBox,
    mode: BoxInteraction["mode"],
    event: ReactPointerEvent<HTMLButtonElement>,
    handle?: ResizeHandle,
  ) {
    if (event.button !== 0 || drawing || saving || !canvasRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    boxInteraction.current = {
      pointerId: event.pointerId,
      start: pointerPoint(event, canvasRef.current),
      original,
      mode,
      handle,
      moved: false,
      wasSelected:
        (target.kind === "grain" && selectedGrainId === target.grain.id) ||
        (target.kind === "manual" && selectedAnnotationId === target.annotation.id),
    };
    suppressPointerClick.current = true;
    if (target.kind === "grain") selectGrain(target.grain);
    else if (target.kind === "manual") selectManual(target.annotation);
    else {
      setSelectedGrainId(null);
      setSelectedAnnotationId(null);
      setBoxDraft(original);
    }
  }

  function startResizeInteraction(
    target: BoxTarget,
    box: BoundingBox,
    handle: ResizeHandle,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    startBoxInteraction(target, box, "resize", event, handle);
  }

  function interactionBoxAt(interaction: BoxInteraction, point: { x: number; y: number }): BoundingBox {
    const deltaX = point.x - interaction.start.x;
    const deltaY = point.y - interaction.start.y;
    const minSize = 0.006;
    if (interaction.mode === "move") {
      return {
        ...interaction.original,
        x: Math.max(0, Math.min(1 - interaction.original.width, interaction.original.x + deltaX)),
        y: Math.max(0, Math.min(1 - interaction.original.height, interaction.original.y + deltaY)),
      };
    }

    const original = interaction.original;
    const right = original.x + original.width;
    const bottom = original.y + original.height;
    const resizeLeft = interaction.handle === "nw" || interaction.handle === "sw";
    const resizeTop = interaction.handle === "nw" || interaction.handle === "ne";
    const left = resizeLeft
      ? Math.max(0, Math.min(right - minSize, original.x + deltaX))
      : original.x;
    const nextRight = resizeLeft
      ? right
      : Math.min(1, Math.max(original.x + minSize, right + deltaX));
    const top = resizeTop
      ? Math.max(0, Math.min(bottom - minSize, original.y + deltaY))
      : original.y;
    const nextBottom = resizeTop
      ? bottom
      : Math.min(1, Math.max(original.y + minSize, bottom + deltaY));
    return { x: left, y: top, width: nextRight - left, height: nextBottom - top };
  }

  function moveBoxInteraction(event: ReactPointerEvent<HTMLButtonElement>) {
    const interaction = boxInteraction.current;
    if (!interaction || interaction.pointerId !== event.pointerId || !canvasRef.current) return;
    const point = pointerPoint(event, canvasRef.current);
    if (Math.abs(point.x - interaction.start.x) + Math.abs(point.y - interaction.start.y) < 0.002) return;
    interaction.moved = true;
    setBoxDraft(interactionBoxAt(interaction, point));
  }

  function finishBoxInteraction(event: ReactPointerEvent<HTMLButtonElement>) {
    const interaction = boxInteraction.current;
    if (!interaction || interaction.pointerId !== event.pointerId) return;
    moveBoxInteraction(event);
    boxInteraction.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!interaction.moved && interaction.mode === "move" && interaction.wasSelected && !hasDraftChanges) {
      clearSelection();
    }
    window.setTimeout(() => { suppressPointerClick.current = false; }, 0);
  }

  function cancelBoxInteraction() {
    boxInteraction.current = null;
    suppressPointerClick.current = false;
  }

  function selectFromPointerClick(select: () => void) {
    if (suppressPointerClick.current) {
      suppressPointerClick.current = false;
      return;
    }
    select();
  }

  function nudgeBox(target: BoxTarget, box: BoundingBox, event: ReactKeyboardEvent<HTMLButtonElement>) {
    const step = event.shiftKey ? 0.02 : 0.005;
    const delta = {
      x: event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0,
      y: event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0,
    };
    if (!delta.x && !delta.y) return;
    event.preventDefault();
    if (target.kind === "grain") selectGrain(target.grain);
    else if (target.kind === "manual") selectManual(target.annotation);
    setBoxDraft((current) => {
      const source = current ?? box;
      return {
        ...source,
        x: Math.max(0, Math.min(1 - source.width, source.x + delta.x)),
        y: Math.max(0, Math.min(1 - source.height, source.y + delta.y)),
      };
    });
  }

  function startDrawing(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drawing || !canvasRef.current || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointerPoint(event, canvasRef.current);
    drawStart.current = point;
    setDrawPreview({ x: point.x, y: point.y, width: 0, height: 0 });
  }

  function moveDrawing(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drawing || !canvasRef.current || !drawStart.current) return;
    setDrawPreview(boxFromPoints(drawStart.current, pointerPoint(event, canvasRef.current)));
  }

  function finishDrawing(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drawing || !canvasRef.current || !drawStart.current) return;
    const box = boxFromPoints(drawStart.current, pointerPoint(event, canvasRef.current));
    drawStart.current = null;
    setDrawPreview(null);
    setDrawing(false);
    if (box.width < 0.006 || box.height < 0.006) {
      toast.error("Draw a box around the full grain.");
      return;
    }
    setSelectedGrainId(null);
    setSelectedAnnotationId(null);
    setPendingBox(box);
    setBoxDraft(box);
    setSpeciesDraft("");
  }

  async function save(
    kind: GrainAnnotation["kind"],
    speciesId: SpeciesId | null,
    grainId: string | null,
    box: BoundingBox,
    existing: GrainAnnotation | null,
  ) {
    if (saving || sampleDetections) return;
    setSaving(true);
    const id = existing?.id ?? crypto.randomUUID();
    try {
      const saved = await saveGrainAnnotation(sampleId, id, {
        slideId,
        grainId,
        kind,
        speciesId,
        box,
      });
      onSaved(saved);
      setPendingBox(null);
      if (kind === "false_positive") {
        // Hide the removed box from the active overlay. It remains in the
        // model-box selector so the researcher can inspect and restore it.
        setSelectedGrainId(null);
        setSelectedAnnotationId(null);
        setBoxDraft(null);
        setSpeciesDraft("");
      } else {
        setSelectedAnnotationId(saved.grainId ? null : saved.id);
      }
      toast.success(
        kind === "false_positive"
          ? "Detection removed from reviewed counts"
          : kind === "missed"
            ? "Missed pollen added to reviewed counts"
            : "Researcher annotation saved",
      );
    } catch (error) {
      if (!(error instanceof SessionExpiredError)) {
        toast.error(error instanceof Error ? error.message : "Couldn't save the annotation.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function removeAnnotation(annotation: GrainAnnotation) {
    if (saving) return;
    setSaving(true);
    try {
      await deleteGrainAnnotation(sampleId, annotation.id);
      onRemoved(annotation.id);
      if (annotation.grainId) {
        const grain = grains.find((entry) => entry.id === annotation.grainId);
        setSelectedGrainId(annotation.grainId);
        setSelectedAnnotationId(null);
        setBoxDraft(grain?.box ?? null);
        setSpeciesDraft(grain?.speciesId ?? "");
      }
      else {
        setSelectedAnnotationId(null);
        setBoxDraft(null);
        setSpeciesDraft("");
      }
      toast.success("Annotation removed; model reading restored");
    } catch (error) {
      if (!(error instanceof SessionExpiredError)) {
        toast.error(error instanceof Error ? error.message : "Couldn't remove the annotation.");
      }
    } finally {
      setSaving(false);
    }
  }

  function cancelChanges() {
    setDrawing(false);
    drawStart.current = null;
    setDrawPreview(null);
    if (pendingBox && !selectedGrain && !selectedManual) {
      setPendingBox(null);
      setSelectedGrainId(null);
      setSelectedAnnotationId(null);
      setBoxDraft(null);
      setSpeciesDraft("");
      return;
    }
    if (selectedGrain) {
      const annotation = annotations.find((entry) => entry.grainId === selectedGrain.id) ?? null;
      setBoxDraft(annotation?.box ?? selectedGrain.box);
      setSpeciesDraft(annotation?.speciesId ?? selectedGrain.speciesId);
      return;
    }
    if (selectedManual) {
      setBoxDraft(selectedManual.box);
      setSpeciesDraft(selectedManual.speciesId ?? "");
    }
  }

  function selectTool() {
    setDrawing(false);
    drawStart.current = null;
    setDrawPreview(null);
  }

  function drawTool() {
    if (saving || pendingBox || hasDraftChanges) return;
    setSelectedGrainId(null);
    setSelectedAnnotationId(null);
    setBoxDraft(null);
    setSpeciesDraft("");
    setDrawing(true);
  }

  function renderBox(box: BoundingBox, speciesId: SpeciesId | null, key: string, selected: boolean, kind?: string) {
    const color = kind === "false_positive" ? "var(--danger)" : overlayColor(palette, speciesId ?? "amaranthus_spinosus");
    return (
      <span
        key={key}
        aria-hidden="true"
        className="pointer-events-none absolute rounded-[1px]"
        style={{
          left: `${box.x * 100}%`, top: `${box.y * 100}%`,
          width: `${box.width * 100}%`, height: `${box.height * 100}%`,
          border: `${selected ? 3 : 2}px ${kind === "missed" || kind === "false_positive" ? "dashed" : "solid"} ${color}`,
          boxShadow: "0 0 0 1px rgba(0,0,0,.6)",
        }}
      />
    );
  }

  const annotationHeading = (
    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
      <h4 className="text-[14px] font-semibold text-text">Researcher Annotations</h4>
      <span className="text-[12px] text-text-muted" style={{ fontFamily: "var(--font-mono)" }}>
        {annotations.length} {annotations.length === 1 ? "annotation" : "annotations"}
      </span>
    </div>
  );

  return (
    <section ref={editorRef} className="grain-review-editor mt-3" aria-label={`Review annotations for ${fileName}`}>
      {sampleDetections ? (
        <>
          {annotationHeading}
          <p className="rounded-sm border border-border bg-surface-sunken px-3 py-2 text-[13px] text-text-muted">
            Sample detections are illustrative and cannot be saved as training annotations.
          </p>
        </>
      ) : (
        <>
          {annotationHeading}
          <div className={`grain-review-workspace ${summaryContent ? "grain-review-has-summary" : ""}`}>
            <div className="min-w-0 w-fit max-w-full">
              {imageUrl && (
                <div className="mb-2 flex w-fit max-w-full flex-wrap rounded-sm border border-border bg-surface p-0.5" role="group" aria-label="Annotation tools">
                  <button
                    type="button"
                    aria-pressed={!drawing}
                    onClick={selectTool}
                    disabled={saving}
                    className={`focus-ring inline-flex items-center gap-1.5 rounded-[2px] min-h-11 px-3 py-2 text-[12px] disabled:opacity-50 ${!drawing ? "bg-accent text-accent-fg" : "text-text-muted hover:bg-surface-sunken"}`}
                  >
                    <MousePointer2 size={13} /> Select / move
                  </button>
                  <button
                    type="button"
                    aria-pressed={drawing}
                    onClick={drawTool}
                    disabled={saving || Boolean(pendingBox) || hasDraftChanges}
                    title={hasDraftChanges ? "Confirm or cancel the current changes first" : undefined}
                    className={`focus-ring inline-flex items-center gap-1.5 rounded-[2px] min-h-11 px-3 py-2 text-[12px] disabled:cursor-not-allowed disabled:opacity-50 ${drawing ? "bg-accent text-accent-fg" : "text-text-muted hover:bg-surface-sunken"}`}
                  >
                    <Crosshair size={13} strokeWidth={1.75} /> Draw missed pollen
                  </button>
                </div>
              )}
              {imageUrl ? (
                <div className="relative isolate overflow-hidden border border-border bg-viewer">
                  <div ref={canvasRef} className="relative mx-auto w-fit max-w-full select-none">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl}
                      alt={`Annotated slide ${fileName}`}
                      className="block h-auto w-auto max-h-[48dvh] max-w-full object-contain lg:max-h-[calc(100dvh_-_13rem)]"
                      draggable={false}
                    />
                    {shownGrains.map((grain) => {
                      const annotation = annotations.find((entry) => entry.grainId === grain.id);
                      const isRemoved = annotation?.kind === "false_positive";
                      if (isRemoved && selectedGrainId !== grain.id) return null;
                      const displaySpeciesId = selectedGrainId === grain.id && speciesDraft
                        ? speciesDraft
                        : annotation?.kind === "corrected" ? annotation.speciesId : grain.speciesId;
                      const box = selectedGrainId === grain.id && boxDraft
                        ? boxDraft
                        : annotation?.box ?? grain.box;
                      const color = annotation?.kind === "false_positive"
                        ? "var(--danger)"
                        : overlayColor(palette, displaySpeciesId ?? grain.speciesId);
                      const isSelected = selectedGrainId === grain.id;
                      const target: BoxTarget = { kind: "grain", grain };
                      const boxSpecies = findSpecies(speciesCatalog, displaySpeciesId ?? grain.speciesId);
                      return (
                        <Fragment key={grain.id}>
                          <button
                            type="button"
                            disabled={saving || (hasDraftChanges && !isSelected)}
                            aria-label={`${grain.id}, ${boxSpecies.scientificName} (${researchSpeciesName(boxSpecies)})${annotation ? `, ${annotation.kind.replaceAll("_", " ")}` : ", not reviewed"}`}
                            aria-pressed={isSelected}
                            title={`${grain.id} · ${boxSpecies.scientificName} (${researchSpeciesName(boxSpecies)}). Drag to move.`}
                            onPointerDown={(event) => startBoxInteraction(target, box, "move", event)}
                            onPointerMove={moveBoxInteraction}
                            onPointerUp={finishBoxInteraction}
                            onPointerCancel={cancelBoxInteraction}
                            onClick={() => selectFromPointerClick(() => toggleGrainSelection(grain))}
                            onKeyDown={(event) => nudgeBox(target, box, event)}
                            data-review-keep-selection
                            className="focus-ring absolute z-20 rounded-[1px] touch-none"
                            style={{
                              left: `${box.x * 100}%`, top: `${box.y * 100}%`,
                              width: `${box.width * 100}%`, height: `${box.height * 100}%`,
                              border: `${isSelected ? 3 : 2}px ${annotation?.kind === "false_positive" ? "dashed" : "solid"} ${color}`,
                              boxShadow: "0 0 0 1px rgba(0,0,0,.65)",
                              background: annotation?.kind === "false_positive" ? "var(--danger-bg)" : "transparent",
                              cursor: isSelected ? "move" : "pointer",
                            }}
                          />
                          {isSelected && annotation?.kind !== "false_positive" && (
                            <ResizeHandles target={target} box={box} onStart={startResizeInteraction} onMove={moveBoxInteraction} onFinish={finishBoxInteraction} onCancel={cancelBoxInteraction} />
                          )}
                        </Fragment>
                      );
                    })}
                    {annotations.filter((entry) => entry.kind === "missed").map((annotation) => {
                      const selected = selectedAnnotationId === annotation.id;
                      const box = selected && boxDraft ? boxDraft : annotation.box;
                      const target: BoxTarget = { kind: "manual", annotation };
                      const species = findSpecies(speciesCatalog, annotation.speciesId ?? "amaranthus_spinosus");
                      return (
                        <Fragment key={annotation.id}>
                          <button
                            type="button"
                            disabled={saving || (hasDraftChanges && !selected)}
                            aria-label={`Missed grain, ${species.scientificName} (${researchSpeciesName(species)})`}
                            aria-pressed={selected}
                            title={`Missed grain · ${species.scientificName} (${researchSpeciesName(species)}). Drag to move.`}
                            onPointerDown={(event) => startBoxInteraction(target, box, "move", event)}
                            onPointerMove={moveBoxInteraction}
                            onPointerUp={finishBoxInteraction}
                            onPointerCancel={cancelBoxInteraction}
                            onClick={() => selectFromPointerClick(() => toggleManualSelection(annotation))}
                            onKeyDown={(event) => nudgeBox(target, box, event)}
                            data-review-keep-selection
                            className="focus-ring absolute z-20 rounded-[1px] touch-none"
                            style={{
                              left: `${box.x * 100}%`, top: `${box.y * 100}%`,
                              width: `${box.width * 100}%`, height: `${box.height * 100}%`,
                              border: `${selected ? 3 : 2}px dashed ${overlayColor(palette, annotation.speciesId ?? "amaranthus_spinosus")}`,
                              background: "rgba(250,250,247,.12)",
                              cursor: selected ? "move" : "pointer",
                            }}
                          />
                          {selected && (
                            <ResizeHandles target={target} box={box} onStart={startResizeInteraction} onMove={moveBoxInteraction} onFinish={finishBoxInteraction} onCancel={cancelBoxInteraction} />
                          )}
                        </Fragment>
                      );
                    })}
                    {pendingBox && (() => {
                      const box = boxDraft ?? pendingBox;
                      const target: BoxTarget = { kind: "pending" };
                      const species = speciesDraft ? findSpecies(speciesCatalog, speciesDraft) : null;
                      return (
                        <Fragment key="pending-box">
                          <button
                            type="button"
                            aria-label={`New missed pollen box${species ? `, ${species.scientificName} (${researchSpeciesName(species)})` : ""}`}
                            title="Drag to move this box"
                            onPointerDown={(event) => startBoxInteraction(target, box, "move", event)}
                            onPointerMove={moveBoxInteraction}
                            onPointerUp={finishBoxInteraction}
                            onPointerCancel={cancelBoxInteraction}
                            onClick={() => selectFromPointerClick(() => setBoxDraft(box))}
                            onKeyDown={(event) => nudgeBox(target, box, event)}
                            data-review-keep-selection
                            className="focus-ring absolute z-20 rounded-[1px] touch-none"
                            style={{
                              left: `${box.x * 100}%`, top: `${box.y * 100}%`,
                              width: `${box.width * 100}%`, height: `${box.height * 100}%`,
                              border: `3px dashed ${overlayColor(palette, speciesDraft || "amaranthus_spinosus")}`,
                              boxShadow: "0 0 0 1px rgba(0,0,0,.6)",
                              background: "rgba(250,250,247,.12)",
                              cursor: "move",
                            }}
                          />
                          <ResizeHandles target={target} box={box} onStart={startResizeInteraction} onMove={moveBoxInteraction} onFinish={finishBoxInteraction} onCancel={cancelBoxInteraction} />
                        </Fragment>
                      );
                    })()}
                    {drawing && (
                      <div
                        className="absolute inset-0 z-30 cursor-crosshair touch-none"
                        onPointerDown={startDrawing}
                        onPointerMove={moveDrawing}
                        onPointerUp={finishDrawing}
                        onPointerCancel={() => {
                          drawStart.current = null;
                          setDrawPreview(null);
                          setDrawing(false);
                        }}
                      />
                    )}
                    {drawing && drawPreview && renderBox(drawPreview, null, "draw-preview", true, "missed")}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-surface px-3 py-2 text-[13px] text-text">
                    <span>Model: {modelGrainCount} · Reviewed pollen: {reviewedGrainCount} · {annotations.length} review changes</span>
                  </div>
                </div>
              ) : (
                <p className="border border-border bg-surface-sunken px-3 py-3 text-[13px] text-text-muted">
                  This slide image is unavailable, so box annotations cannot be made.
                </p>
              )}
              {modelGrainCount > 0 && grains.length === 0 && (
                <p className="mt-2 text-[12.5px] text-text-muted">
                  This report has no saved grain boxes, so its existing model labels cannot be corrected individually. You can still draw boxes around missed grains.
                </p>
              )}
            </div>
            <div
              role="group"
              aria-label={`Annotation controls for ${fileName}`}
              className="grain-review-controls min-w-0 border-t border-border pt-3"
            >
              <div data-review-keep-selection>
                {(pendingBox || selectedManual || selectedGrain) && (
                  <h5 className="mb-2 text-[13px] font-semibold text-text">
                    {pendingBox ? "Identify Missed Pollen" : selectedManual ? "Missed Pollen" : selectedGrain?.id}
                  </h5>
                )}
                {selectedGrain || pendingBox || selectedManual ? (
                  <>
                    {selectedGrain && selectedAnnotation?.kind === "false_positive" && (
                      <p className="mb-3 text-[12.5px] text-danger">
                        Removed from the reviewed pollen count. Restore it below to include it again.
                      </p>
                    )}
                    {selectedGrain && selectedAnnotation?.kind !== "false_positive" && (
                      <p className="mb-3 text-[12.5px] text-text-muted">
                        {(() => {
                          const modelSpecies = findSpecies(speciesCatalog, selectedGrain.speciesId);
                          return <>Model: <span className="italic" style={{ fontFamily: "var(--font-display)" }}>
                            {modelSpecies.scientificName}
                          </span> ({researchSpeciesName(modelSpecies)}) · {Math.round(selectedGrain.confidence * 100)}% model confidence</>;
                        })()}
                      </p>
                    )}
                    {selectedAnnotation?.kind !== "false_positive" && (
                      <label className="mb-3 block">
                        <span className="mb-1 block text-[12.5px] text-text-muted">
                          {pendingBox || selectedManual ? "Identify pollen species" : "Researcher label"}
                        </span>
                        <select
                          value={speciesDraft}
                          onChange={(event) => setSpeciesDraft(event.target.value as SpeciesId | "")}
                          disabled={saving}
                          className={inputClass}
                        >
                          <option value="" disabled>Select a species</option>
                          {annotationSpecies.map((species) => (
                            <option key={species.id} value={species.id}>
                              {species.scientificName} ({researchSpeciesName(species)})
                            </option>
                          ))}
                        </select>
                      </label>
                    )}

                    {selectedGrain && selectedAnnotation?.kind !== "false_positive" && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button" disabled={saving || !speciesDraft || !boxDraft}
                          onClick={() => {
                            const corrected = speciesDraft !== selectedGrain.speciesId;
                            void save(
                              corrected ? "corrected" : "confirmed",
                              corrected ? speciesDraft || null : selectedGrain.speciesId,
                              selectedGrain.id,
                              boxDraft ?? selectedGrain.box,
                              selectedAnnotation,
                            );
                          }}
                          className="focus-ring rounded-sm bg-accent min-h-11 px-3 py-2 text-[12.5px] text-accent-fg disabled:opacity-50"
                        >
                          <Check size={13} className="mr-1 inline" /> Confirm changes
                        </button>
                        <button
                          type="button" disabled={saving}
                          onClick={() => save("false_positive", null, selectedGrain.id, boxDraft ?? selectedGrain.box, selectedAnnotation)}
                          className="focus-ring rounded-sm border border-danger/40 min-h-11 px-3 py-2 text-[12.5px] text-danger hover:bg-danger/5 disabled:opacity-50"
                        >
                          Remove as Non-pollen
                        </button>
                    </div>
                  )}

                  {(pendingBox || selectedManual) && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button" disabled={saving || !speciesDraft || !boxDraft}
                        onClick={() => save("missed", speciesDraft || null, null, boxDraft!, selectedManual)}
                        className="focus-ring rounded-sm bg-accent min-h-11 px-3 py-2 text-[12.5px] text-accent-fg disabled:opacity-50"
                      >
                        {selectedManual ? <><Check size={13} className="mr-1 inline" />Confirm changes</> : "Add Identified Pollen"}
                      </button>
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {hasDraftChanges && (selectedGrain || selectedManual || pendingBox) && (
                      <button
                        type="button" disabled={saving}
                        onClick={cancelChanges}
                        className="focus-ring rounded-sm border border-border min-h-11 px-3 py-2 text-[12.5px] text-text-muted hover:bg-surface-sunken disabled:opacity-50"
                      >
                        Cancel changes
                      </button>
                    )}
                    {selectedGrain && (
                      <button
                        type="button" disabled={saving}
                        onClick={() => save("uncertain", null, selectedGrain.id, boxDraft ?? selectedGrain.box, selectedAnnotation)}
                        className="focus-ring inline-flex items-center gap-1.5 rounded-sm min-h-11 px-2 py-2 text-[12px] text-text-muted hover:bg-surface-sunken"
                      >
                        <CircleHelp size={13} /> Mark Uncertain
                      </button>
                    )}
                    {selectedAnnotation && (
                      <button
                        type="button" disabled={saving}
                        onClick={() => removeAnnotation(selectedAnnotation)}
                        className="focus-ring inline-flex items-center gap-1.5 rounded-sm min-h-11 px-2 py-2 text-[12px] text-text-muted hover:bg-surface-sunken disabled:opacity-50"
                      >
                        {saving ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                        {selectedAnnotation.kind === "false_positive" ? "Restore Detection" : "Reset to Model"}
                      </button>
                    )}
                    {selectedManual && (
                      <button
                        type="button" disabled={saving}
                        onClick={() => removeAnnotation(selectedManual)}
                        className="focus-ring inline-flex items-center gap-1.5 rounded-sm min-h-11 px-2 py-2 text-[12px] text-danger hover:bg-danger/5 disabled:opacity-50"
                      >
                        <Trash2 size={13} /> Remove Missed Grain
                      </button>
                    )}
                  </div>
                  {saving && <p className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-text-muted"><Loader2 size={13} className="animate-spin" /> Saving annotation…</p>}
                </>
              ) : (
                <p className="text-[13px] leading-relaxed text-text-muted">
                  Select a box on the image to review its label, or draw missed pollen.
                </p>
              )}
              </div>
            </div>
            {summaryContent && (
              <div className="grain-review-summary" role="group" aria-label={`Pollen summary for ${fileName}`}>
                <h5 className="mb-3 text-[13px] font-semibold text-text">Pollen Summary</h5>
                {summaryContent}
              </div>
            )}
          </div>
          {trailingContent}

          {annotations.some((annotation) => annotation.kind === "uncertain") && (
            <p className="mt-3 flex items-start gap-1.5 text-[12px] text-text-muted">
              <CircleHelp size={13} className="mt-0.5 shrink-0" />
              Uncertain labels are saved for review context and should be excluded from future training data.
            </p>
          )}
          {annotations.filter((annotation) => annotation.kind === "missed").length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2" aria-label="Manually added missed grains">
              {annotations.filter((annotation) => annotation.kind === "missed").map((annotation, index) => (
                <li key={annotation.id}>
                  <button
                    type="button"
                    disabled={saving || (hasDraftChanges && selectedAnnotationId !== annotation.id)}
                    onClick={() => toggleManualSelection(annotation)}
                    aria-pressed={selectedAnnotationId === annotation.id}
                    className="focus-ring rounded-sm border border-border px-2 py-1 text-[12px] text-text-muted hover:bg-surface-sunken aria-pressed:bg-surface-sunken"
                  >
                    Added M{index + 1} · {findSpecies(speciesCatalog, annotation.speciesId ?? "amaranthus_spinosus").code} · {researchSpeciesName(findSpecies(speciesCatalog, annotation.speciesId ?? "amaranthus_spinosus"))}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
