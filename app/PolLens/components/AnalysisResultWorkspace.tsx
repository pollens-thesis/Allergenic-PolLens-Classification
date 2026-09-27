"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  CloudOff,
  CloudSun,
  FileCheck2,
  FlaskConical,
  Loader2,
  Microscope,
  Trash2,
} from "lucide-react";
import {
  aggregateSlideDetections,
  formatCollectedAt,
  getTotalGrains,
  getWeightedAvgConfidence,
  sortByAbundance,
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
import SummaryTile from "@/components/SummaryTile";
import SpeciesName from "@/components/SpeciesName";
import StatusBadge from "@/components/StatusBadge";
import { overlayColor, overlayColors, type OverlayColors } from "@/lib/slide-colors";
import { Button, buttonVariants } from "@/components/Button";
import { toast } from "sonner";

const fieldClass =
  "focus-ring w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text placeholder:text-text-faint";

const sectionHeadingClass = "caption-label text-[13px] mb-2";

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
        className={`focus-ring block w-full border-l-2 px-2.5 py-2.5 text-left transition-colors ${
          selected
            ? "border-l-accent bg-accent-muted"
            : "border-l-transparent hover:bg-surface-sunken"
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
              {/* The binomial in the atlas serif italic; the code follows it as its key mark. */}
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                <span
                  className="text-[15.5px] text-text italic"
                  style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
                >
                  {species.scientificName}
                </span>
                <span
                  className="shrink-0 text-[12px] tracking-wider text-text-muted"
                  style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}
                >
                  {species.code}
                </span>
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
            <div className="h-full rounded-full bg-text/75" style={{ width: `${confidencePct}%` }} />
          </div>
        </div>
      </button>
    </li>
  );
}

/** A report slide preview; image failures fall back to a plain plate mark. */
function SlideThumbnail({ imageUrl }: { imageUrl?: string }) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <span className="relative flex h-12 w-[4.5rem] shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border bg-surface-sunken">
      {imageUrl && !imageFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          onError={() => setImageFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <Microscope size={15} strokeWidth={1.5} className="text-text-faint" aria-hidden="true" />
      )}
    </span>
  );
}

/** Number input that keeps an empty box as `null` rather than 0. */
function MeasurementField({
  label,
  value,
  onChange,
  disabled = false,
  min,
  max,
}: {
  label: string;
  value: number | null;
  onChange: (next: number | null) => void;
  disabled?: boolean;
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
        disabled={disabled}
        placeholder="—"
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className={`${fieldClass} disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-text-faint`}
      />
    </label>
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
    toast.success(report ? `Analysis ${report.sampleId} discarded` : "Analysis discarded");
    router.push("/upload");
  }

  if (loadError) {
    return (
      <div className="card-panel flex flex-col items-center gap-3 px-6 py-16 text-center">
        <CloudOff size={22} strokeWidth={1.5} className="text-text-faint" />
        <p className="t-prose text-text-muted">{loadError}</p>
        <Button type="button" intent="secondary" size="sm" onClick={() => window.location.reload()}>
          Try Again
        </Button>
      </div>
    );
  }

  if (report === undefined) {
    return (
      <div className="card-panel flex items-center justify-center gap-2 px-6 py-16 text-[13px] text-text-muted">
        <Loader2 size={16} strokeWidth={1.75} className="animate-spin" />
        Loading analysis…
      </div>
    );
  }

  if (report === null) {
    return (
      <div className="card-panel flex flex-col items-center gap-3 px-6 py-16 text-center">
        <Microscope size={22} strokeWidth={1.5} className="text-text-faint" />
        <p className="t-prose text-text-muted">
          {sampleId
            ? `Analysis ${sampleId} wasn't found — it may have been discarded, or its report already generated.`
            : "No analysis selected. Run one from Analyze Specimen, or open a report."}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Link
            href="/upload"
            className={`${buttonVariants({ intent: "accent", size: "sm" })} focus-ring`}
          >
            <Microscope size={14} strokeWidth={1.75} />
            Analyze Slides
          </Link>
          <Link
            href="/reports"
            className={`${buttonVariants({ intent: "secondary", size: "sm" })} focus-ring`}
          >
            Open Reports
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
  // Said beside the disabled button, not only further down in Collection Details.
  const generateBlocker = !collectedDate
    ? "Add the collection date to generate the report."
    : location.trim() === ""
      ? "Add a location to generate the report."
      : null;
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
          Generating Report…
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
    <div className="flex flex-col gap-4">
      {(sampleDetections || report.sampleDetections) && (
        <p className="flex items-center gap-2 rounded-md border border-processing/30 bg-processing-bg px-3 py-2 text-[12px] text-processing">
          <FlaskConical size={14} strokeWidth={2} className="mt-px shrink-0" />
          Sample detections · The trained model isn&apos;t deployed. Counts are illustrative.
        </p>
      )}

      {/* Header: what was analyzed, and the way out of the screen */}
      <div className="card-panel p-4 sm:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-semibold tracking-tight text-text lining-nums">
              {report.slides.length === 1 ? "1 Slide Analyzed" : `${report.slides.length} Slides Analyzed`}
            </h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <StatusBadge status="Pending" />
              <span className="text-[13px] text-text-muted" style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
                {report.sampleId}
              </span>
            </div>
            <p className="mt-1 text-[13px] text-text-muted">
              {batchGrains} {batchGrains === 1 ? "grain" : "grains"} counted across the batch
              {top && (
                <>
                  {" "}· mostly <SpeciesName species={findSpecies(speciesCatalog, top.speciesId)} />
                </>
              )}
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
              {saveState === "failed" && (
                <span className="text-danger">Changes not saved — {saveError} Edit any field to try again.</span>
              )}
              {saveState === "idle" && "Saved as Pending — resume it any time from Analyze Specimen."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 md:max-w-[50%] md:shrink-0 md:justify-end">
            {confirmingDiscard ? (
              <>
                <span className="text-[13px] text-text-muted">
                  Discard analysis {report.sampleId}? Its {report.slides.length}{" "}
                  {report.slides.length === 1 ? "slide image" : "slide images"}, detections and notes are deleted
                  for good.
                </span>
                <button
                  type="button"
                  onClick={handleDiscard}
                  disabled={isDiscarding}
                  className={`${buttonVariants({ intent: "destructive", size: "sm" })} focus-ring`}
                >
                  Discard Analysis
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDiscard(false)}
                  className={`${buttonVariants({ intent: "secondary", size: "sm" })} focus-ring`}
                >
                  Keep Analysis
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDiscard(true)}
                className={`${buttonVariants({ intent: "caution", size: "sm" })} focus-ring`}
              >
                <Trash2 size={14} strokeWidth={1.75} />
                Discard
              </button>
            )}
            {generateButton("sm")}
          </div>
        </div>

      </div>

      {report.slides.length > 1 && (
        <nav aria-label="Slides in this analysis" className="-mx-1 overflow-x-auto px-1 pb-1">
          <ul className="flex w-max min-w-full gap-2">
            {report.slides.map((slide, index) => {
              const active = slide.id === selected?.id;
              return (
                <li key={slide.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(slide.id);
                      setHighlighted(null);
                    }}
                    aria-current={active ? "true" : undefined}
                    aria-label={`Slide ${index + 1}: ${slide.fileName}${active ? ", selected" : ""}`}
                    title={slide.fileName}
                    className={`focus-ring flex w-48 items-center gap-2 rounded-md border p-1.5 text-left transition-colors ${
                      active
                        ? "border-border-strong bg-surface text-text"
                        : "border-border bg-surface-sunken text-text-muted hover:border-border-strong hover:text-text"
                    }`}
                  >
                    <SlideThumbnail imageUrl={slide.imageUrl} />
                    <span className="min-w-0">
                      <span className="block text-[11px] text-text-faint" style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
                        SLIDE {index + 1}
                      </span>
                      <span className="mt-0.5 block truncate text-[12.5px]">{slide.fileName}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      {selected && (
        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.9fr)_minmax(21rem,1fr)]">
          {/* The slide itself leads: it is what every number below is read against. */}
          <div className="card-panel p-4 sm:p-5 xl:sticky xl:top-48">
            <div className="mb-3 flex min-w-0 items-baseline justify-between gap-3">
              {/* The slide's plate number, as an atlas numbers its figures. */}
              <span className="plate-label ml-auto text-[12px]">
                Slide {slideIndex + 1}
                {report.slides.length > 1 ? ` of ${report.slides.length}` : ""}
              </span>
            </div>
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
              caption={selected.fileName}
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

          {/* The detection key and slide note stay together beside the image. */}
          <div className="card-panel min-w-0 p-4 sm:p-5">
            <section aria-labelledby="pollen-detected-heading">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h3 id="pollen-detected-heading" className="t-plate-title text-text">Pollen Detected</h3>
                <span className="plate-label text-[12px]">Slide {slideIndex + 1}</span>
              </div>

              <div className="mb-3 grid grid-cols-3 gap-2 border-y border-border py-2.5 text-center">
                <SummaryTile value={totalGrains} label="Grains" />
                <SummaryTile value={detections.length} label={detections.length === 1 ? "Pollen Type" : "Pollen Types"} />
                <SummaryTile value={`${Math.round(confidence * 100)}%`} label="Avg. Confidence" />
              </div>

              {detections.length === 0 ? (
                <p className="py-3 text-center text-[13px] text-text-muted">
                  No pollen grains detected on this slide.
                </p>
              ) : (
                <>
                  <p className="mb-2 text-[12px] text-text-muted">Select a type to highlight its grains.</p>
                  <ul className="divide-y divide-border border-y border-border">
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
            </section>

            <section aria-labelledby="slide-note-heading" className="mt-5 border-t border-border pt-4">
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <h3 id="slide-note-heading" className="t-plate-title text-text">Slide Note</h3>
                {report.slides.length > 1 && <span className="text-[12px] text-text-muted">Slide {slideIndex + 1}</span>}
              </div>
              <textarea
                rows={4}
                value={notes[selected.id] ?? ""}
                onChange={(e) => {
                  const text = e.target.value;
                  setNotes((current) => ({ ...current, [selected.id]: text }));
                  edit({ notes: { [selected.id]: text } });
                }}
                aria-label={`Note for slide ${slideIndex + 1}`}
                placeholder="Slide preparation, staining, obscured grains, anything unusual…"
                className={`${fieldClass} resize-y`}
              />
            </section>
          </div>
        </div>
      )}

      {/* The details entered on Analyze, still editable until the report is generated. */}
      <div className="card-panel p-4 sm:p-5">
        <h3 className="t-plate-title text-text">Collection Details</h3>
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
          <p className="mt-2 text-[13px] text-danger">Add the collection date to generate the report.</p>
        ) : !location.trim() ? (
          <p className="mt-2 text-[13px] text-danger">Add a location to generate the report.</p>
        ) : (
          <p className="mt-2 text-[12.5px] text-text-muted">
            Collected {formatCollectedAt(collectedTime ? `${collectedDate}T${collectedTime}` : collectedDate)}
          </p>
        )}

        <div className="mt-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h4 className={`${sectionHeadingClass} mb-0`}>
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="col-span-2 block sm:col-span-1">
              <span className="mb-1 block text-[12.5px] text-text-muted">Weather</span>
              <select
                value={weather?.condition ?? ""}
                onChange={(e) => {
                  if (!e.target.value) {
                    weatherRequest.current++;
                    setWeather(null);
                    edit({ weather: null });
                  } else {
                    updateWeather("condition", e.target.value as WeatherCondition);
                  }
                }}
                className={fieldClass}
              >
                <option value="">Not recorded</option>
                {weatherConditionOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <MeasurementField label="Temperature (°C)" value={weather?.temperatureC ?? null} disabled={!weather} onChange={(next) => updateWeather("temperatureC", next)} />
            <MeasurementField
              label="Humidity (%)"
              value={weather?.humidityPct ?? null}
              disabled={!weather}
              onChange={(next) => updateWeather("humidityPct", next)}
              min={0}
              max={100}
            />
            <MeasurementField label="Wind (km/h)" value={weather?.windKph ?? null} disabled={!weather} onChange={(next) => updateWeather("windKph", next)} min={0} />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        {generateBlocker && <p className="text-[13px] text-text-muted">{generateBlocker}</p>}
        {generateButton("md")}
      </div>
    </div>
  );
}
