"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  CloudOff,
  CloudSun,
  FileCheck2,
  FlaskConical,
  Loader2,
  Microscope,
  Plus,
  Trash2,
} from "lucide-react";
import {
  aggregateSlideDetections,
  formatCollectedAt,
  getTotalGrains,
  getWeightedAvgConfidence,
  sortByAbundance,
  speciesLabel,
  weatherConditionOptions,
  type SpeciesId,
  type Specimen,
  type SpecimenDetection,
  type WeatherCondition,
  type WeatherConditions,
} from "@/lib/data";
import { findSpecies, useSpeciesCatalog } from "@/lib/species-catalog";
import { deleteReport, getReport, updateReport, type ReportPatch } from "@/lib/store";
import { SessionExpiredError } from "@/lib/api";
import { displayName } from "@/lib/account";
import { useSettings } from "@/lib/settings";
import SpecimenImageViewer from "@/components/SpecimenImageViewer";
import SpecimenInspector from "@/components/SpecimenInspector";
import LocationSearch, { findPlace, loadPlaces, type Place } from "@/components/LocationSearch";
import { fetchWeather } from "@/lib/analysis";
import RiskBadge from "@/components/RiskBadge";
import { overlayColor, overlayColors, type OverlayColors } from "@/lib/slide-colors";
import { Button } from "@/components/Button";
import { toast } from "sonner";

const fieldClass =
  "focus-ring w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text placeholder:text-text-faint";

const sectionHeadingClass = "mb-2 text-[12px] tracking-[0.2em] text-text-muted uppercase";

const AUTOSAVE_MS = 600;

const EMPTY_WEATHER: WeatherConditions = {
  condition: "Sunny",
  temperatureC: null,
  humidityPct: null,
  windKph: null,
};

/**
 * One pollen type found on a slide: how many grains, and how sure the model is.
 * The row is the control for the overlay — selecting it boxes that type's
 * grains on the image beside it.
 */
function DetectionRow({
  detection,
  colors,
  selected,
  onSelect,
}: {
  detection: SpecimenDetection;
  /** Overlay colours, so the swatch matches this type's boxes on the image. */
  colors: OverlayColors;
  selected: boolean;
  onSelect: () => void;
}) {
  const speciesCatalog = useSpeciesCatalog();
  const species = findSpecies(speciesCatalog, detection.speciesId);
  const confidencePct = Math.round(detection.avgConfidence * 100);

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={`focus-ring block w-full rounded-md border px-3 py-2.5 text-left transition ${
          selected
            ? "border-border-strong bg-surface shadow-[inset_3px_0_0_0_var(--accent)]"
            : "border-border bg-surface hover:border-border-strong"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <span
              aria-hidden
              className="mt-1.5 h-3 w-3 shrink-0 rounded-[2px] ring-1 ring-black/20"
              style={{ backgroundColor: overlayColor(colors, detection.speciesId) }}
            />
            <div className="min-w-0">
              <div
                className="text-[11.5px] tracking-widest text-text-muted uppercase"
                style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}
              >
                {species.code}
              </div>
              <div className="truncate text-[14px] font-semibold tracking-tight text-text italic">
                {species.scientificName}
              </div>
              {species.commonName && (
                <div className="truncate text-[13px] text-text-muted">{species.commonName}</div>
              )}
            </div>
          </div>

          <div className="shrink-0 text-right">
            <div className="text-[14px] text-text" style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
              {detection.grainCount}
            </div>
            <div className="text-[12px] text-text-muted">
              {detection.grainCount === 1 ? "grain" : "grains"}
            </div>
            <RiskBadge level={species.riskLevel} className="mt-1.5" />
          </div>
        </div>

        <div className="mt-2.5">
          <div className="mb-1 flex items-center justify-between text-[12.5px] text-text-muted">
            <span>Avg. Confidence</span>
            <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>{confidencePct}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
            <div className="h-full rounded-full bg-accent" style={{ width: `${confidencePct}%` }} />
          </div>
        </div>
      </button>
    </li>
  );
}

/** Number input that keeps an empty box as `null` rather than 0. */
function MeasurementField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number | null;
  onChange: (next: number | null) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12.5px] text-text-muted">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        value={value ?? ""}
        placeholder="—"
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className={fieldClass}
      />
    </label>
  );
}

function SummaryTile({ value, label }: { value: string | number; label: string }) {
  return (
    <div>
      <div className="text-[17px] text-text" style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
        {value}
      </div>
      <div className="text-[12px] text-text-muted">{label}</div>
    </div>
  );
}

type SaveState = "idle" | "saving" | "saved" | "failed";

/** `newer` wins field by field; per-slide notes are merged, not replaced. */
function mergePatch(older: ReportPatch, newer: ReportPatch): ReportPatch {
  const merged: ReportPatch = { ...older, ...newer };
  if (older.notes || newer.notes) merged.notes = { ...older.notes, ...newer.notes };
  return merged;
}

/**
 * A Pending report — what the model found, straight after Analyze stored it on
 * the server. The researcher reviews the reading beside each slide, writes
 * notes and corrects the collection details (every edit saves automatically),
 * then generates the report, which marks it Completed. Because it lives on the
 * server, it can be resumed later from any device (Analyze lists your pending
 * analyses).
 */
export default function AnalysisResultWorkspace({
  sampleId,
  sampleDetections = false,
}: {
  sampleId: string | null;
  /** True when the detections came from the backend's mock mode. */
  sampleDetections?: boolean;
}) {
  // undefined = loading; null = nothing to show (no id, or not found).
  const [report, setReport] = useState<Specimen | null | undefined>(sampleId ? undefined : null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Which pollen type the image overlay is isolating; null shows every box.
  const [highlighted, setHighlighted] = useState<SpeciesId | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [location, setLocation] = useState("");
  const [researcher, setResearcher] = useState("");
  const [collectedDate, setCollectedDate] = useState("");
  const [collectedTime, setCollectedTime] = useState("");
  const [weather, setWeather] = useState<WeatherConditions | null>(null);
  // The location as a known place (with coordinates), so weather can be looked up.
  const [place, setPlace] = useState<Place | null>(null);
  const [fillingWeather, setFillingWeather] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  // Bumped on every edit; the autosave timer restarts from the latest one.
  const [editVersion, setEditVersion] = useState(0);
  // Edits made since the last successful save; the autosave sends these.
  const dirty = useRef<ReportPatch>({});
  // Saves run one at a time, in order, so an older PATCH can never land after
  // a newer one (or after Generate) and overwrite it.
  const saveChain = useRef<Promise<unknown>>(Promise.resolve());
  const finished = useRef(false);
  const weatherRequest = useRef(0);
  const refreshedImages = useRef(false);
  const router = useRouter();
  const settings = useSettings();
  const speciesCatalog = useSpeciesCatalog();
  const researcherName = displayName(settings);
  const sampleId_ = report?.sampleId ?? null;

  useEffect(() => {
    if (!sampleId) return;
    let cancelled = false;
    getReport(sampleId)
      .then((found) => {
        if (cancelled) return;
        if (found && (found.status !== "Pending" || !found.canEdit)) {
          // Already generated, or someone else's: the report page is the place for it.
          router.replace(`/reports/${found.sampleId}`);
          return;
        }
        setReport(found);
        if (!found) return;
        setSelectedId(found.slides[0]?.id ?? null);
        setNotes(Object.fromEntries(found.slides.map((slide) => [slide.id, slide.notes])));
        const [date, time = ""] = found.collectedAt.split("T");
        setLocation(found.location);
        setResearcher(found.researcher);
        setCollectedDate(date);
        setCollectedTime(time);
        setWeather(found.weather);
        if (found.location) {
          loadPlaces().then((places) => {
            if (!cancelled) setPlace(places ? findPlace(places, found.location) : null);
          });
        }
      })
      .catch((error: unknown) => {
        if (cancelled || error instanceof SessionExpiredError) return;
        setLoadError(error instanceof Error ? error.message : "Couldn't load this analysis.");
      });
    return () => {
      cancelled = true;
    };
  }, [sampleId, router]);

  /** Runs `task` after every save already queued. */
  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = saveChain.current.then(task, task);
    saveChain.current = run.catch(() => undefined);
    return run;
  }

  /** Record an edit and (re)start the autosave timer. */
  function edit(patch: ReportPatch) {
    dirty.current = mergePatch(dirty.current, patch);
    setSaveState("saving");
    setSaveError(null);
    setEditVersion((v) => v + 1);
  }

  function flush(): Promise<boolean> {
    return enqueue(async () => {
      if (!report || finished.current) return true;
      const patch = dirty.current;
      if (Object.keys(patch).length === 0) return true;
      dirty.current = {};
      try {
        await updateReport(report.sampleId, patch);
        // Edits typed while that request was out are still waiting.
        if (Object.keys(dirty.current).length > 0) {
          setEditVersion((v) => v + 1);
        } else {
          setSaveState("saved");
        }
        return true;
      } catch (error) {
        // Put the unsaved edits back (newer ones win) for the next attempt.
        dirty.current = mergePatch(patch, dirty.current);
        if (error instanceof SessionExpiredError) return false;
        setSaveState("failed");
        setSaveError(error instanceof Error ? error.message : "Couldn't save your changes.");
        return false;
      }
    });
  }

  // Autosave: a short pause after the last edit sends everything changed since.
  useEffect(() => {
    if (editVersion === 0) return;
    const timer = setTimeout(() => void flush(), AUTOSAVE_MS);
    return () => clearTimeout(timer);
    // flush reads refs; only a new edit should restart the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editVersion]);

  // Leaving with unsaved edits: warn on reload/close, and send them anyway
  // when the page goes away (keepalive lets the request outlive the page).
  useEffect(() => {
    if (!sampleId_) return;
    const unsaved = () => !finished.current && Object.keys(dirty.current).length > 0;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!unsaved()) return;
      void updateReport(sampleId_, dirty.current, { keepalive: true }).catch(() => {});
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      if (unsaved()) {
        const patch = dirty.current;
        dirty.current = {};
        void updateReport(sampleId_, patch, { keepalive: true }).catch(() => {});
      }
    };
  }, [sampleId_]);

  function setCollected(date: string, time: string) {
    setCollectedDate(date);
    setCollectedTime(time);
    if (date) edit({ collectedAt: time ? `${date}T${time}` : date });
  }

  function updateWeather<K extends keyof WeatherConditions>(key: K, value: WeatherConditions[K]) {
    weatherRequest.current++; // a lookup still in flight must not overwrite this
    const next = { ...(weather ?? EMPTY_WEATHER), [key]: value };
    setWeather(next);
    edit({ weather: next });
  }

  /** Conditions at the place on the collection date/time, from Open-Meteo. */
  async function fillWeatherFromOpenMeteo() {
    if (!place) return;
    const request = ++weatherRequest.current;
    setFillingWeather(true);
    const found = await fetchWeather({ lat: place.lat, lon: place.lon, date: collectedDate, time: collectedTime });
    if (request !== weatherRequest.current) return; // superseded by an edit or a newer lookup
    setFillingWeather(false);
    if (!found) {
      toast.error("No weather available for this place and time.");
      return;
    }
    setWeather(found);
    edit({ weather: found });
  }

  /** A slide image failed to load — most likely its signed link expired. */
  function handleImageError() {
    if (!sampleId || refreshedImages.current) return;
    refreshedImages.current = true;
    getReport(sampleId)
      .then((found) => found && setReport(found))
      .catch(() => {});
  }

  async function handleGenerate() {
    if (!report || isGenerating) return;
    setIsGenerating(true);
    // Everything on screen goes with the status change, so nothing typed is
    // lost; queued behind any autosave still in flight.
    const fields: ReportPatch = {
      collectedAt: collectedTime ? `${collectedDate}T${collectedTime}` : collectedDate,
      location,
      researcher: researcher.trim() || researcherName,
      weather,
      notes,
    };
    const ok = await enqueue(async () => {
      dirty.current = {};
      try {
        await updateReport(report.sampleId, { ...fields, status: "Completed" });
        return true;
      } catch (error) {
        // Keep the edits, but never the status: a later autosave must not
        // quietly finish the report the researcher saw fail.
        dirty.current = mergePatch(fields, dirty.current);
        if (!(error instanceof SessionExpiredError)) {
          toast.error(error instanceof Error ? error.message : "Couldn't generate the report.");
        }
        return false;
      }
    });
    if (!ok) {
      setIsGenerating(false);
      return;
    }
    finished.current = true;
    toast.success(`Report ${report.sampleId} generated`);
    router.push(`/reports?saved=${report.sampleId}`);
  }

  async function handleDiscard() {
    if (!report || isDiscarding) return;
    setIsDiscarding(true);
    finished.current = true;
    try {
      await enqueue(() => deleteReport(report.sampleId));
    } catch (error) {
      finished.current = false;
      setIsDiscarding(false);
      if (error instanceof SessionExpiredError) return;
      toast.error(error instanceof Error ? error.message : "Couldn't discard the analysis.");
      return;
    }
    toast.success("Analysis discarded");
    router.push("/upload");
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface px-6 py-16 text-center">
        <CloudOff size={22} strokeWidth={1.5} className="text-text-faint" />
        <p className="text-[13.5px] text-text-muted">{loadError}</p>
        <Button type="button" intent="secondary" size="sm" onClick={() => window.location.reload()}>
          Try Again
        </Button>
      </div>
    );
  }

  if (report === undefined) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-6 py-16 text-[13px] text-text-muted">
        <Loader2 size={16} strokeWidth={1.75} className="animate-spin" />
        Loading analysis…
      </div>
    );
  }

  if (report === null) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface px-6 py-16 text-center">
        <Microscope size={22} strokeWidth={1.5} className="text-text-faint" />
        <p className="text-[13.5px] text-text-muted">
          There is no pending analysis here. Run one from Analyze Specimen, or open a report.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Link
            href="/upload"
            className="focus-ring inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-[13px] font-medium text-accent-fg transition active:scale-[0.97] hover:bg-[var(--accent-hover)]"
          >
            <Microscope size={14} strokeWidth={1.75} />
            Analyze a Specimen
          </Link>
          <Link
            href="/reports"
            className="focus-ring inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-[13px] text-text-muted transition active:scale-[0.97] hover:text-text"
          >
            Reports
          </Link>
        </div>
      </div>
    );
  }

  const selected = report.slides.find((slide) => slide.id === selectedId) ?? report.slides[0] ?? null;
  const detections = selected ? [...selected.detections].sort(sortByAbundance) : [];
  const totalGrains = getTotalGrains(detections);
  const confidence = getWeightedAvgConfidence(detections);
  const batchGrains = report.slides.reduce((sum, slide) => sum + getTotalGrains(slide.detections), 0);
  const slideIndex = selected ? report.slides.findIndex((slide) => slide.id === selected.id) : -1;
  // One palette for the whole batch: a type keeps its colour on every slide.
  const colors = overlayColors(aggregateSlideDetections(report.slides));
  const canGenerate = Boolean(collectedDate) && location.trim() !== "" && !isGenerating;
  const top = aggregateSlideDetections(report.slides)[0];

  const generateButton = (size: "sm" | "md") => (
    <Button
      type="button"
      intent="accent"
      size={size}
      onClick={handleGenerate}
      disabled={!canGenerate}
      className="disabled:cursor-not-allowed"
    >
      {isGenerating ? (
        <>
          <Loader2 size={15} strokeWidth={1.75} className="animate-spin" />
          Generating…
        </>
      ) : (
        <>
          <FileCheck2 size={15} strokeWidth={1.75} />
          Generate Report
        </>
      )}
    </Button>
  );

  return (
    <div className="flex flex-col gap-6">
      {(sampleDetections || report.sampleDetections) && (
        <p className="flex items-start gap-2 rounded-md border border-processing/30 bg-processing-bg px-3 py-2.5 text-[12.5px] text-processing">
          <FlaskConical size={14} strokeWidth={2} className="mt-px shrink-0" />
          Sample detections — the trained model isn&apos;t deployed yet, so the server returned its
          built-in example reading. Don&apos;t treat these counts as results.
        </p>
      )}

      {/* Header: what was analyzed, and the way out of the screen */}
      <div className="rounded-lg border border-border bg-surface p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            <div
              className="text-[12px] tracking-widest text-text-muted uppercase"
              style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}
            >
              Pending · {report.sampleId}
            </div>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-text">
              {report.slides.length === 1 ? "1 Slide Analyzed" : `${report.slides.length} Slides Analyzed`}
            </h2>
            <p className="mt-1 text-[13px] text-text-muted">
              {batchGrains} {batchGrains === 1 ? "grain" : "grains"} counted across the batch
              {top ? ` · mostly ${speciesLabel(findSpecies(speciesCatalog, top.speciesId))}` : ""}
            </p>
            <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-text-faint" aria-live="polite">
              {saveState === "saving" && (
                <>
                  <Loader2 size={11} strokeWidth={2} className="animate-spin" /> Saving changes…
                </>
              )}
              {saveState === "saved" && (
                <>
                  <Check size={11} strokeWidth={2} /> All changes saved
                </>
              )}
              {saveState === "failed" && <span className="text-danger">{saveError}</span>}
              {saveState === "idle" && "Stored on the server — you can resume it later from Analyze."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 md:max-w-[50%] md:shrink-0 md:justify-end">
            {confirmingDiscard ? (
              <>
                <span className="text-[13px] text-text-muted">Discard this analysis?</span>
                <button
                  type="button"
                  onClick={handleDiscard}
                  disabled={isDiscarding}
                  className="focus-ring rounded-md border border-danger/30 bg-surface px-3 py-2 text-[13px] font-medium text-danger transition active:scale-[0.97] hover:bg-danger-bg"
                >
                  Yes, Discard
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDiscard(false)}
                  className="focus-ring rounded-md px-2 py-2 text-[13px] text-text-muted transition active:scale-[0.97] hover:text-text"
                >
                  Keep It
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDiscard(true)}
                className="focus-ring flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text-muted transition active:scale-[0.97] hover:text-text"
              >
                <Trash2 size={14} strokeWidth={1.75} />
                Discard
              </button>
            )}
            {generateButton("sm")}
          </div>
        </div>

        {/* Slide switcher — one report, but each slide has its own reading. */}
        {report.slides.length > 1 && (
          <div className="mt-4 flex flex-wrap gap-1.5 border-t border-border pt-4">
            {report.slides.map((slide, index) => {
              const active = slide.id === selected?.id;
              return (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(slide.id);
                    setHighlighted(null);
                  }}
                  aria-current={active}
                  className={`focus-ring flex max-w-[16rem] items-center gap-2 rounded-md border px-2.5 py-1.5 text-[13px] transition ${
                    active
                      ? "border-border-strong bg-surface text-text"
                      : "border-border bg-surface-sunken text-text-muted hover:border-border-strong hover:text-text"
                  }`}
                >
                  <span className="shrink-0 text-[12px] text-text-muted" style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
                    S{index + 1}
                  </span>
                  <span className="truncate">{slide.fileName}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selected && (
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          {/* The slide itself leads: it is what every number below is read against. */}
          <div className="rounded-lg border border-border bg-surface p-5 xl:sticky xl:top-48">
            <h3 className="mb-4 text-lg font-semibold tracking-tight text-text">Specimen Image</h3>
            <SpecimenImageViewer
              imageUrl={selected.imageUrl}
              fileName={selected.fileName}
              grains={selected.grains}
              detections={detections}
              colors={colors}
              selectedSpeciesId={highlighted}
              onSelectSpecies={setHighlighted}
              onExpand={() => setInspectorOpen(true)}
              onImageError={handleImageError}
            />
            <SpecimenInspector
              open={inspectorOpen}
              onOpenChange={setInspectorOpen}
              colors={colors}
              initialSlideId={selected.id}
              initialSpeciesId={highlighted}
              slides={report.slides.map((slide, index) => ({
                id: slide.id,
                label: `Slide ${index + 1}`,
                fileName: slide.fileName,
                imageUrl: slide.imageUrl,
                grains: slide.grains,
                detections: slide.detections,
              }))}
            />
          </div>

          {/* What the analysis found, then the note about this slide */}
          <div className="flex min-w-0 flex-col gap-6">
            <div className="rounded-lg border border-border bg-surface p-5">
              <div className="mb-4 flex items-baseline justify-between gap-3">
                <h3 className="text-lg font-semibold tracking-tight text-text">Pollen Detected</h3>
                {report.slides.length > 1 && (
                  <span className="text-[13px] text-text-muted">Slide {slideIndex + 1}</span>
                )}
              </div>

              <div className="mb-4 grid grid-cols-3 gap-3 rounded-md bg-surface-sunken px-3 py-3 text-center">
                <SummaryTile value={totalGrains} label="Grains" />
                <SummaryTile value={detections.length} label={detections.length === 1 ? "Pollen Type" : "Pollen Types"} />
                <SummaryTile value={`${Math.round(confidence * 100)}%`} label="Avg. Confidence" />
              </div>

              {detections.length === 0 ? (
                <p className="rounded-md border border-border bg-surface px-3 py-4 text-center text-[13px] text-text-muted">
                  Nothing detected on this slide — no pollen grains were found.
                </p>
              ) : (
                <>
                  <p className="mb-2 text-[12.5px] text-text-muted">Select a type to box its grains on the image.</p>
                  <ul className="flex flex-col gap-2">
                    {detections.map((detection) => (
                      <DetectionRow
                        key={detection.speciesId}
                        detection={detection}
                        colors={colors}
                        selected={highlighted === detection.speciesId}
                        onSelect={() =>
                          setHighlighted((current) => (current === detection.speciesId ? null : detection.speciesId))
                        }
                      />
                    ))}
                  </ul>
                </>
              )}
            </div>

            <div className="rounded-lg border border-border bg-surface p-5">
              <h3 className="mb-1 text-lg font-semibold tracking-tight text-text">Notes</h3>
              <p className="mb-2.5 text-[12.5px] text-text-muted">
                Recorded against this slide
                {report.slides.length > 1 ? " only — each slide keeps its own note." : "."}
              </p>
              <textarea
                rows={6}
                value={notes[selected.id] ?? ""}
                onChange={(e) => {
                  const text = e.target.value;
                  setNotes((current) => ({ ...current, [selected.id]: text }));
                  edit({ notes: { [selected.id]: text } });
                }}
                placeholder="Slide preparation, staining, obscured grains, anything unusual…"
                className={`${fieldClass} resize-y`}
              />
            </div>
          </div>
        </div>
      )}

      {/* The details entered on Analyze, still editable until the report is generated. */}
      <div className="rounded-lg border border-border bg-surface p-5">
        <h3 className="text-lg font-semibold tracking-tight text-text">Collection Details</h3>
        <p className="mt-0.5 mb-4 text-[13px] text-text-muted">
          What you entered before analyzing — correct anything here; changes save as you go.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-[12.5px] text-text-muted">Location</span>
            <LocationSearch
              value={location}
              onChange={(text) => {
                setLocation(text);
                edit({ location: text });
                if (place && text !== place.label) setPlace(null);
              }}
              onSelectPlace={setPlace}
              placeholder="Search town or province"
              className={fieldClass}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[12.5px] text-text-muted">Researcher</span>
            <input
              type="text"
              value={researcher}
              onChange={(e) => {
                setResearcher(e.target.value);
                edit({ researcher: e.target.value });
              }}
              placeholder={researcherName}
              className={fieldClass}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[12.5px] text-text-muted">Date Collected</span>
            <input
              type="date"
              value={collectedDate}
              onChange={(e) => setCollected(e.target.value, collectedTime)}
              className={fieldClass}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[12.5px] text-text-muted">
              Time Collected <span className="text-text-faint">(optional)</span>
            </span>
            <input
              type="time"
              value={collectedTime}
              onChange={(e) => setCollected(collectedDate, e.target.value)}
              className={fieldClass}
            />
          </label>
        </div>

        {!collectedDate ? (
          <p className="mt-2 text-[12.5px] text-danger">Set the collection date before generating the report.</p>
        ) : !location.trim() ? (
          <p className="mt-2 text-[12.5px] text-danger">Set the location before generating the report.</p>
        ) : (
          <p className="mt-2 text-[12.5px] text-text-muted">
            Collected {formatCollectedAt(collectedTime ? `${collectedDate}T${collectedTime}` : collectedDate)}
          </p>
        )}

        <div className="mt-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h4 className={`${sectionHeadingClass} mb-0`} style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
              Conditions at Collection
            </h4>
            {place && collectedDate && (
              <button
                type="button"
                onClick={() => void fillWeatherFromOpenMeteo()}
                disabled={fillingWeather}
                className="focus-ring inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[12.5px] text-accent hover:bg-accent-muted disabled:opacity-50"
              >
                {fillingWeather ? (
                  <Loader2 size={12} strokeWidth={2} className="animate-spin" />
                ) : (
                  <CloudSun size={12} strokeWidth={2} />
                )}
                Fill from Open-Meteo
              </button>
            )}
          </div>
          {weather ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <label className="col-span-2 block sm:col-span-1">
                <span className="mb-1 block text-[12.5px] text-text-muted">Weather</span>
                <select
                  value={weather.condition}
                  onChange={(e) => updateWeather("condition", e.target.value as WeatherCondition)}
                  className={fieldClass}
                >
                  {weatherConditionOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <MeasurementField label="Temp (°C)" value={weather.temperatureC} onChange={(next) => updateWeather("temperatureC", next)} />
              <MeasurementField
                label="Humidity (%)"
                value={weather.humidityPct}
                onChange={(next) => updateWeather("humidityPct", next)}
                min={0}
                max={100}
              />
              <MeasurementField label="Wind (km/h)" value={weather.windKph} onChange={(next) => updateWeather("windKph", next)} min={0} />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => updateWeather("condition", EMPTY_WEATHER.condition)}
              className="focus-ring inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[13px] text-text-muted hover:border-border-strong hover:text-text"
            >
              <Plus size={13} strokeWidth={2} />
              Add Conditions
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/upload" className="focus-ring inline-flex items-center gap-1.5 rounded text-[13px] text-text-muted transition hover:text-text">
          <ArrowLeft size={14} strokeWidth={1.75} />
          Back to Analyze Specimen
        </Link>
        {generateButton("md")}
      </div>
    </div>
  );
}
