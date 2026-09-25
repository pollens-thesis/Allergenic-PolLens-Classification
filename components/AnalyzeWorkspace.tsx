"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  FileText,
  ImagePlus,
  X,
  CloudSun,
  Loader2,
  Maximize2,
  TriangleAlert,
  RefreshCw,
  Microscope,
} from "lucide-react";
import {
  getTotalGrains,
  weatherConditionOptions,
  formatCollectedAt,
  type Specimen,
  type SpecimenDetection,
  type WeatherCondition,
  type WeatherConditions,
} from "@/lib/data";
import { analyzeSpecimen, DetectionError, fetchWeather, type AnalysisResult } from "@/lib/analysis";
import { SessionExpiredError } from "@/lib/api";
import { createReport, deleteReport, listReports } from "@/lib/store";
import { displayName } from "@/lib/account";
import { useSettings } from "@/lib/settings";
import { Button } from "@/components/Button";
import ImageLightbox from "@/components/ImageLightbox";
import LocationSearch, { type Place } from "@/components/LocationSearch";

type ItemStatus = "pending" | "analyzing" | "analyzed" | "failed";

let nextItemId = 0;
function newItemId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `item-${Date.now()}-${nextItemId++}`;
}

/** What the server accepts (api/reports/images.py): JPEG/PNG, 25 MB each. */
const ACCEPTED_TYPES = ["image/jpeg", "image/png"];
const MAX_IMAGE_MB = 25;

/** One uploaded slide. Detections are per image; the collection details
 *  (location, researcher, weather) are shared by the whole batch. */
type BatchItem = {
  id: string;
  file: File;
  imageUrl: string;
  status: ItemStatus;
  detections: SpecimenDetection[];
  /** Kept once analyzed, so retrying a batch only re-runs the slides that failed. */
  analysis?: AnalysisResult;
  /** Why detection failed, for "failed" items. */
  error?: string;
};

/** Local "now", split into the shapes <input type="date"|"time"> expect. */
function nowParts() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
  };
}

const EMPTY_WEATHER: WeatherConditions = {
  condition: "Sunny",
  temperatureC: null,
  humidityPct: null,
  windKph: null,
};

const fieldClass =
  "focus-ring w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text placeholder:text-text-faint";

const sectionHeadingClass = "mb-2 text-[12px] tracking-[0.2em] text-text-muted uppercase";

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

/**
 * Where the weather values came from, so an auto-filled reading is never
 * mistaken for an observation: Open-Meteo's conditions for the
 * picked place, or the researcher's own entry/override.
 */
function WeatherStatusLine({
  source,
  status,
  place,
  collectedDate,
  collectedTime,
  onRefresh,
}: {
  source: "manual" | "auto" | "edited";
  status: "idle" | "loading" | "failed";
  place: Place | null;
  collectedDate: string;
  collectedTime: string;
  onRefresh?: () => void;
}) {
  const when = collectedDate
    ? formatCollectedAt(collectedTime ? `${collectedDate}T${collectedTime}` : collectedDate)
    : "now";
  let message: React.ReactNode;
  if (status === "loading") {
    message = (
      <>
        <Loader2 size={12} strokeWidth={2} className="animate-spin" />
        Fetching the weather at {place?.label} for {when}…
      </>
    );
  } else if (status === "failed") {
    message = (
      <span className="text-processing">
        No weather available for this place and time — enter it manually.
      </span>
    );
  } else if (source === "auto") {
    message = (
      <>
        <CloudSun size={12} strokeWidth={2} className="text-accent" />
        Filled from Open-Meteo for {when}
        {collectedTime ? "" : " (midday — no time set)"}. Edit any field to override.
      </>
    );
  } else if (source === "edited") {
    message = <>Edited by researcher — overrides the Open-Meteo values.</>;
  } else {
    message = <>Pick a place above to auto-fill the weather, or enter it manually.</>;
  }

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-text-muted">
      <span className="flex items-center gap-1.5">{message}</span>
      {onRefresh && status !== "loading" && (
        <button
          type="button"
          onClick={onRefresh}
          className="focus-ring inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-accent hover:bg-accent-muted"
        >
          <RefreshCw size={12} strokeWidth={2} />
          {source === "edited" ? "Replace with Open-Meteo" : "Refresh"}
        </button>
      )}
    </div>
  );
}

/** One row in the batch list: thumbnail, file name, and a live one-line summary. */
function SpecimenListRow({
  item,
  index,
  isSelected,
  onSelect,
  onRemove,
}: {
  item: BatchItem;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const grains = getTotalGrains(item.detections);
  // Entrance is CSS-transition-driven (not @keyframes) so a rapid string of
  // adds/removes stays interruptible: each row flips from its hidden starting
  // style to visible on the next frame after mount, staggered by index.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <li
      className="flex items-stretch gap-1 transition-[opacity,transform] duration-[var(--duration-base)] ease-[var(--ease-out)]"
      style={{
        opacity: mounted ? 1 : 0,
        transform: mounted ? "translateY(0)" : "translateY(4px)",
        transitionDelay: mounted ? `${Math.min(index, 10) * 30}ms` : "0ms",
      }}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-current={isSelected}
        className={`focus-ring flex min-w-0 flex-1 items-center gap-3 rounded-md border px-2.5 py-2 text-left transition ${
          isSelected
            ? "border-border-strong bg-surface"
            : "border-border bg-surface-sunken hover:border-border-strong"
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.imageUrl}
          alt=""
          className="h-10 w-10 shrink-0 rounded object-cover bg-surface-sunken"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] text-text">{item.file.name}</span>
          <span className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-text-muted">
            {item.status === "pending" && "Ready to analyze"}
            {item.status === "analyzing" && (
              <>
                <Loader2 size={11} strokeWidth={2} className="animate-spin" />
                Analyzing…
              </>
            )}
            {item.status === "failed" && (
              <span className="flex min-w-0 items-center gap-1 text-danger">
                <TriangleAlert size={11} strokeWidth={2} className="shrink-0" />
                <span className="truncate" title={item.error}>
                  {item.error ?? "Couldn't be analyzed"}
                </span>
              </span>
            )}
            {item.status === "analyzed" && (
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
                {grains} {grains === 1 ? "grain" : "grains"} · {item.detections.length}{" "}
                {item.detections.length === 1 ? "type" : "types"}
              </span>
            )}
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${item.file.name}`}
        className="focus-ring flex w-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface-sunken text-text-faint transition active:scale-[0.9] hover:text-text"
      >
        <X size={13} strokeWidth={1.75} />
      </button>
    </li>
  );
}

/**
 * Upload and describe a batch, then run the analysis. The readings themselves
 * are not shown here: analysis hands the batch to /upload/result, where the
 * researcher reviews it, writes the notes and saves the report.
 */
export default function AnalyzeWorkspace() {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [location, setLocation] = useState("");
  const [researcher, setResearcher] = useState("");
  const [collectedDate, setCollectedDate] = useState("");
  const [collectedTime, setCollectedTime] = useState("");
  const [weather, setWeather] = useState<WeatherConditions>(EMPTY_WEATHER);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  // Your analyses stored as Pending on the server, to resume or discard.
  const [pendingReports, setPendingReports] = useState<Specimen[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  // Which pending analysis is waiting for "Discard?" to be confirmed.
  const [confirmingDiscard, setConfirmingDiscard] = useState<string | null>(null);
  const [pendingError, setPendingError] = useState<string | null>(null);
  // Where the weather fields' values came from. "auto" = Open-Meteo for
  // `weatherPlace`; any manual change flips it to "edited" (the researcher's
  // override), and nothing re-fetches over it unless they ask.
  const [weatherSource, setWeatherSource] = useState<"manual" | "auto" | "edited">("manual");
  const [weatherPlace, setWeatherPlace] = useState<Place | null>(null);
  const [weatherStatus, setWeatherStatus] = useState<"idle" | "loading" | "failed">("idle");
  const weatherRequest = useRef(0);
  // The source as of now, for async callbacks that outlive the render they started in.
  const weatherSourceRef = useRef(weatherSource);
  useEffect(() => {
    weatherSourceRef.current = weatherSource;
  }, [weatherSource]);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const settings = useSettings();
  const researcherName = displayName(settings);

  // Time is optional — a researcher who only knows the day can leave it blank.
  const collectedAt = collectedTime ? `${collectedDate}T${collectedTime}` : collectedDate;

  const selected = items.find((item) => item.id === selectedId) ?? null;
  const canAnalyze = items.length > 0 && !!collectedDate && !isAnalyzing;
  const failedCount = items.filter((item) => item.status === "failed").length;
  // Every slide has a reading but the batch wasn't stored (the store step failed).
  const allAnalyzed = items.length > 0 && items.every((item) => item.analysis);

  // Analyses you ran earlier but haven't generated yet, from any device.
  useEffect(() => {
    let cancelled = false;
    listReports({ mine: true, status: "Pending" })
      .then((reports) => {
        if (!cancelled) setPendingReports(reports);
      })
      .catch(() => {
        // Not being able to list them doesn't stop a new analysis.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function discardPending(sampleId: string) {
    setConfirmingDiscard(null);
    setPendingError(null);
    try {
      await deleteReport(sampleId);
      setPendingReports((current) => current.filter((r) => r.sampleId !== sampleId));
    } catch (error) {
      if (error instanceof SessionExpiredError) return;
      setPendingError(error instanceof Error ? error.message : "Couldn't discard that analysis.");
    }
  }

  function patchItem(id: string, patch: Partial<BatchItem>) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  function updateWeather<K extends keyof WeatherConditions>(key: K, value: WeatherConditions[K]) {
    // The researcher's own reading: cancel any lookup still in flight so it
    // can't overwrite this, and never auto-fill over it again unless asked.
    weatherRequest.current++;
    setWeather((current) => ({ ...current, [key]: value }));
    setWeatherSource("edited");
    setWeatherStatus("idle");
  }

  /**
   * Pre-fill the weather fields with the conditions at the picked place on the
   * collection date and time; they stay editable.
   */
  async function fillWeather(place: Place, date = collectedDate, time = collectedTime) {
    const request = ++weatherRequest.current;
    setWeatherPlace(place);
    setWeatherStatus("loading");
    const found = await fetchWeather({ lat: place.lat, lon: place.lon, date, time });
    if (request !== weatherRequest.current) return; // a newer pick won
    if (found) {
      setWeather(found);
      setWeatherSource("auto");
      setWeatherStatus("idle");
    } else {
      // Don't keep another date's (or place's) readings under this one.
      setWeatherStatus("failed");
      if (weatherSourceRef.current === "auto") {
        setWeather({ ...EMPTY_WEATHER });
        setWeatherSource("manual");
      }
    }
  }

  // A new collection date or time re-fetches the weather for it — unless the
  // researcher has typed their own readings, which are never overwritten.
  useEffect(() => {
    if (!weatherPlace || weatherSource === "edited" || !collectedDate) return;
    const timer = setTimeout(() => void fillWeather(weatherPlace, collectedDate, collectedTime), 500);
    return () => clearTimeout(timer);
    // Only the date/time trigger this; picking a place fetches on its own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectedDate, collectedTime]);

  function handleLocationChange(text: string) {
    setLocation(text);
    // Typing away from the picked place detaches the weather from it: its
    // auto-filled readings belong to that place, not this one.
    if (weatherPlace && text !== weatherPlace.label) {
      setWeatherPlace(null);
      weatherRequest.current++;
      setWeatherStatus("idle");
      if (weatherSource === "auto") {
        setWeather({ ...EMPTY_WEATHER });
        setWeatherSource("manual");
      }
    }
  }

  function handleFiles(fileList: FileList | null) {
    if (isAnalyzing) return;
    const files = Array.from(fileList ?? []);
    const wrongType = files.filter((f) => !ACCEPTED_TYPES.includes(f.type));
    const tooLarge = files.filter(
      (f) => ACCEPTED_TYPES.includes(f.type) && f.size > MAX_IMAGE_MB * 1024 * 1024,
    );
    const images = files.filter((f) => !wrongType.includes(f) && !tooLarge.includes(f));
    const problems = [
      wrongType.length > 0 &&
        `${wrongType.map((f) => f.name).join(", ")} ${wrongType.length === 1 ? "isn't" : "aren't"} JPG or PNG`,
      tooLarge.length > 0 &&
        `${tooLarge.map((f) => f.name).join(", ")} ${tooLarge.length === 1 ? "is" : "are"} over ${MAX_IMAGE_MB} MB`,
    ].filter(Boolean);
    setUploadError(problems.length > 0 ? `Not added: ${problems.join("; ")}.` : null);
    if (inputRef.current) inputRef.current.value = "";
    if (images.length === 0) return;

    const added: BatchItem[] = images.map((file) => ({
      id: newItemId(),
      file,
      imageUrl: URL.createObjectURL(file),
      status: "pending",
      detections: [],
    }));

    setItems((current) => [...current, ...added]);
    setAnalyzeError(null);
    setSelectedId((current) => current ?? added[0].id);

    // Defaults are applied here, in an event handler, rather than as initial
    // state: the server and client then render the same empty fields, so there
    // is no hydration mismatch, and nothing the researcher has already typed
    // gets overwritten.
    const startingBatch = items.length === 0;
    if (startingBatch && !researcher) setResearcher(researcherName);
    // Stamp the batch with "now" the first time images arrive. Both fields stay
    // editable, so a slide read long after collection can be corrected.
    if (!collectedDate) {
      const { date, time } = nowParts();
      setCollectedDate(date);
      setCollectedTime(time);
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleRemove(id: string) {
    const target = items.find((item) => item.id === id);
    if (target) URL.revokeObjectURL(target.imageUrl);
    const next = items.filter((item) => item.id !== id);
    setItems(next);
    setAnalyzeError(null);
    if (selectedId === id) setSelectedId(next[0]?.id ?? null);
  }

  function handleClearAll() {
    items.forEach((item) => URL.revokeObjectURL(item.imageUrl));
    setItems([]);
    setSelectedId(null);
    setAnalyzeError(null);
    setWeather({ ...EMPTY_WEATHER });
    setWeatherSource("manual");
    setWeatherPlace(null);
    setWeatherStatus("idle");
    weatherRequest.current++; // a lookup still in flight must not refill the form
    const { date, time } = nowParts();
    setCollectedDate(date);
    setCollectedTime(time);
    if (inputRef.current) inputRef.current.value = "";
  }

  // Release every image preview when the screen goes away.
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  useEffect(() => () => itemsRef.current.forEach((item) => URL.revokeObjectURL(item.imageUrl)), []);

  /**
   * Analyze every slide in the batch, then store it on the server as one
   * Pending report and open it for review (notes, details, Generate Report).
   */
  async function handleAnalyze() {
    if (!canAnalyze) return;
    setIsAnalyzing(true);

    setAnalyzeError(null);

    // One slide at a time, so the list shows progress as each result lands.
    // Slides already analyzed (on an earlier, partly failed run) keep their
    // reading; only the rest go to the model.
    const analyzed: { item: BatchItem; analysis: AnalysisResult }[] = [];
    const failures: string[] = [];
    let batchWeather = weather;

    for (const item of items) {
      if (item.analysis) {
        analyzed.push({ item, analysis: item.analysis });
        continue;
      }
      patchItem(item.id, { status: "analyzing", error: undefined });
      let analysis: AnalysisResult;
      try {
        analysis = await analyzeSpecimen(item.file);
      } catch (error) {
        if (error instanceof SessionExpiredError) return; // on its way to sign-in
        const message =
          error instanceof DetectionError ? error.message : "Something went wrong analyzing this slide.";
        patchItem(item.id, { status: "failed", error: message });
        failures.push(message);
        continue;
      }
      patchItem(item.id, { status: "analyzed", detections: analysis.detections, analysis });
      analyzed.push({ item, analysis });
      if (analysis.weather) {
        batchWeather = analysis.weather;
        setWeather(analysis.weather);
      }
    }

    // Never hand a partial batch to the report page as if it were complete.
    if (failures.length > 0) {
      setIsAnalyzing(false);
      const count = failures.length === 1 ? "1 slide" : `${failures.length} slides`;
      setAnalyzeError(
        `${count} couldn't be analyzed — ${failures[0]} Retry, or remove ${
          failures.length === 1 ? "it" : "them"
        } to continue with the rest.`,
      );
      return;
    }

    // Weather goes with the batch only if the researcher (or Open-Meteo) set it —
    // an untouched form would otherwise store its "Sunny, blank" defaults.
    const weatherSet =
      weatherSource !== "manual" || JSON.stringify(batchWeather) !== JSON.stringify(EMPTY_WEATHER);

    let report: Specimen;
    try {
      report = await createReport(
        {
          collectedAt,
          location,
          researcher: researcher || researcherName,
          weather: weatherSet ? batchWeather : null,
          slides: analyzed.map(({ item, analysis }) => ({
            fileName: item.file.name,
            detections: analysis.detections,
            grains: analysis.grains,
            notes: "",
          })),
        },
        Object.fromEntries(analyzed.map(({ item }, index) => [String(index), item.file])),
        "Pending",
        analyzed.some(({ analysis }) => analysis.sampleDetections),
      );
    } catch (error) {
      setIsAnalyzing(false);
      if (error instanceof SessionExpiredError) return;
      // The readings are kept on each slide, so trying again won't re-run detection.
      setAnalyzeError(
        `The analysis ran but couldn't be stored — ${
          error instanceof Error ? error.message : "try again."
        }`,
      );
      return;
    }

    // (Object URLs are revoked when this screen unmounts, so thumbnails stay
    // intact while the next page loads.)
    router.push(`/upload/result?report=${report.sampleId}`);
  }

  return (
    <div className="flex flex-col gap-4">
      {pendingReports.length > 0 && !isAnalyzing && (
        <div className="rounded-lg border border-processing/30 bg-processing-bg px-4 py-3">
          <div className="mb-2 flex items-center gap-2">
            <FileText size={15} strokeWidth={1.75} className="shrink-0 text-processing" />
            <h2 className="text-[13.5px] font-semibold text-text">
              Pending Analyses{" "}
              <span className="font-normal text-text-muted">
                — analyzed but not generated yet ({pendingReports.length})
              </span>
            </h2>
          </div>
          <ul className="flex flex-col divide-y divide-processing/15">
            {pendingReports.map((report) => (
              <li key={report.sampleId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="min-w-0 text-[13px] text-text">
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>{report.sampleId}</span>
                  <span className="text-text-muted">
                    {" "}· {report.slides.length} {report.slides.length === 1 ? "slide" : "slides"} ·{" "}
                    {report.location || "No location yet"} · collected {formatCollectedAt(report.collectedAt)}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {confirmingDiscard === report.sampleId ? (
                    <>
                      <span className="text-[12.5px] text-text-muted">Discard it?</span>
                      <button
                        type="button"
                        onClick={() => void discardPending(report.sampleId)}
                        className="focus-ring rounded-md border border-danger/30 px-2 py-1 text-[12.5px] text-danger hover:bg-danger-bg"
                      >
                        Yes, Discard
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingDiscard(null)}
                        className="focus-ring rounded-md px-2 py-1 text-[12.5px] text-text-muted hover:text-text"
                      >
                        Keep
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingDiscard(report.sampleId)}
                      className="focus-ring rounded-md px-2 py-1 text-[12.5px] text-text-muted hover:text-danger"
                    >
                      Discard
                    </button>
                  )}
                  <Link
                    href={`/upload/result?report=${report.sampleId}`}
                    className="focus-ring inline-flex items-center gap-1.5 rounded-md border border-border-strong bg-surface px-3 py-1 text-[12.5px] text-text transition active:scale-[0.97] hover:bg-surface-sunken"
                  >
                    Resume
                    <ArrowRight size={13} strokeWidth={1.75} />
                  </Link>
                </span>
              </li>
            ))}
          </ul>
          {pendingError && <p role="alert" className="mt-1 text-[12.5px] text-danger">{pendingError}</p>}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        {/* Left: batch + collection details */}
        <div className="rounded-lg border border-border bg-surface p-5 xl:col-span-3">
          {/* Frozen while a batch is analyzed: what's sent must be what's on screen. */}
          <fieldset disabled={isAnalyzing} className="m-0 min-w-0 border-0 p-0">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-text" style={{ fontFamily: "var(--font-display)" }}>
              Specimen Images
            </h2>
            {items.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="focus-ring rounded text-[13px] text-text-muted transition hover:text-text"
              >
                Clear All
              </button>
            )}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />

          {items.length === 0 ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                handleFiles(e.dataTransfer.files);
              }}
              className={`focus-ring flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-14 text-center transition-[transform,border-color,background-color] duration-[var(--duration-fast)] ease-[var(--ease-out)] ${
                isDragging ? "scale-[1.01] border-accent bg-accent/5" : "border-border hover:border-border-strong"
              }`}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-sunken">
                <ImagePlus size={20} strokeWidth={1.75} className="text-text-muted" />
              </span>
              <span className="text-[13.5px] text-text-muted">
                Drag and drop microscope images, or click to browse
              </span>
              <span className="text-[12.5px] text-text-muted">
                JPG or PNG, up to {MAX_IMAGE_MB} MB each. Select several to analyze a batch.
              </span>
            </button>
          ) : (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                handleFiles(e.dataTransfer.files);
              }}
              className={`rounded-lg border-2 border-dashed p-2 transition-[transform,border-color,background-color] duration-[var(--duration-fast)] ease-[var(--ease-out)] ${
                isDragging ? "scale-[1.01] border-accent bg-accent/5" : "border-transparent"
              }`}
            >
              <ul className="flex flex-col gap-1.5">
                {items.map((item, index) => (
                  <SpecimenListRow
                    key={item.id}
                    item={item}
                    index={index}
                    isSelected={item.id === selectedId}
                    onSelect={() => setSelectedId(item.id)}
                    onRemove={() => handleRemove(item.id)}
                  />
                ))}
              </ul>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="focus-ring mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border px-3 py-2 text-[13px] text-text-muted transition active:scale-[0.98] hover:border-border-strong hover:text-text"
              >
                <ImagePlus size={14} strokeWidth={1.75} />
                Add More Images
              </button>
            </div>
          )}

          {/* Collection details — shared by every slide in the batch. */}
          <div className="mt-5">
            <h3 className={sectionHeadingClass} style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
              Collection Details
            </h3>
            <p className="mb-2.5 text-[12.5px] text-text-muted">
              When and where the batch was collected — applies to every specimen in it. You can
              still correct any of it on the next page before generating the report.
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[12.5px] text-text-muted">Location</span>
                <LocationSearch
                  value={location}
                  onChange={handleLocationChange}
                  onSelectPlace={fillWeather}
                  placeholder="Search town or province, e.g. Candelaria"
                  className={fieldClass}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[12.5px] text-text-muted">Researcher</span>
                <input
                  type="text"
                  value={researcher}
                  onChange={(e) => setResearcher(e.target.value)}
                  placeholder={researcherName}
                  className={fieldClass}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[12.5px] text-text-muted">Date Collected</span>
                <input
                  type="date"
                  value={collectedDate}
                  onChange={(e) => setCollectedDate(e.target.value)}
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
                  onChange={(e) => setCollectedTime(e.target.value)}
                  className={fieldClass}
                />
              </label>
            </div>

            {items.length > 0 && !collectedDate && (
              <p className="mt-2 text-[12.5px] text-danger">
                Set the collection date before running the analysis.
              </p>
            )}

            <WeatherStatusLine
              source={weatherSource}
              status={weatherStatus}
              place={weatherPlace}
              collectedDate={collectedDate}
              collectedTime={collectedTime}
              onRefresh={weatherPlace ? () => fillWeather(weatherPlace) : undefined}
            />
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
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
              <MeasurementField
                label="Temp (°C)"
                value={weather.temperatureC}
                onChange={(next) => updateWeather("temperatureC", next)}
              />
              <MeasurementField
                label="Humidity (%)"
                value={weather.humidityPct}
                onChange={(next) => updateWeather("humidityPct", next)}
                min={0}
                max={100}
              />
              <MeasurementField
                label="Wind (km/h)"
                value={weather.windKph}
                onChange={(next) => updateWeather("windKph", next)}
                min={0}
              />
            </div>
          </div>
          </fieldset>

          {uploadError && (
            <p role="alert" className="mt-3 flex items-start gap-2 text-[12.5px] text-danger">
              <TriangleAlert size={13} strokeWidth={2} className="mt-px shrink-0" />
              {uploadError}
            </p>
          )}

          {analyzeError && (
            <p
              role="alert"
              className="mt-5 flex items-start gap-2 rounded-md border border-danger/30 bg-danger-bg px-3 py-2.5 text-[12.5px] text-danger"
            >
              <TriangleAlert size={14} strokeWidth={2} className="mt-px shrink-0" />
              {analyzeError}
            </p>
          )}

          <Button
            type="button"
            intent="accent"
            disabled={!canAnalyze}
            onClick={handleAnalyze}
            className={`${analyzeError ? "mt-3" : "mt-5"} w-full disabled:cursor-not-allowed`}
          >
            {isAnalyzing ? (
              <>
                <Loader2 size={16} strokeWidth={1.75} className="animate-spin" />
                Analyzing…
              </>
            ) : (
              <>
                <Microscope size={16} strokeWidth={1.75} />
                {allAnalyzed
                  ? "Try Storing Again"
                  : failedCount > 0
                  ? failedCount === 1
                    ? "Retry Failed Slide"
                    : `Retry ${failedCount} Failed Slides`
                  : items.length > 1
                    ? `Analyze ${items.length} Specimens`
                    : "Analyze Specimen"}
              </>
            )}
          </Button>

          <p className="mt-2 text-center text-[12.5px] text-text-muted">
            The results open on their own page, where you add notes and generate the report.
          </p>
        </div>

        {/* Right: what is about to be analyzed */}
        <div className="rounded-lg border border-border bg-surface p-5 xl:col-span-2">
          <h2 className="mb-4 text-lg font-semibold tracking-tight text-text" style={{ fontFamily: "var(--font-display)" }}>
            Preview
          </h2>

          {!selected ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg bg-surface-sunken px-6 py-14 text-center">
              <Microscope size={22} strokeWidth={1.5} className="text-text-faint" />
              <p className="text-[13px] text-text-muted">
                Upload one or more microscope images. Pick a slide from the list to see it here
                before the analysis runs.
              </p>
            </div>
          ) : (
            <div>
              <div className="overflow-hidden rounded-md border border-border">
                <button
                  type="button"
                  onClick={() => setPreviewOpen(true)}
                  className="focus-ring group relative block w-full cursor-zoom-in bg-viewer"
                  aria-label={`Enlarge ${selected.file.name}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selected.imageUrl}
                    alt={`Specimen ${selected.file.name}`}
                    className="max-h-64 w-full object-contain"
                  />
                  <span className="absolute top-2 right-2 inline-flex items-center gap-1.5 rounded border border-white/20 bg-black/60 px-2 py-1 text-[12px] text-white opacity-90 group-hover:opacity-100">
                    <Maximize2 size={12} strokeWidth={2} />
                    Enlarge
                  </span>
                </button>
                <ImageLightbox
                  open={previewOpen}
                  onOpenChange={setPreviewOpen}
                  imageUrl={selected.imageUrl}
                  fileName={selected.file.name}
                />
                <div className="truncate border-t border-border bg-surface px-3 py-2 text-[13px] text-text-muted">
                  {selected.file.name}
                </div>
              </div>

              <dl className="mt-4 flex flex-col gap-2 text-[13px]">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-text-muted">Slides in Batch</dt>
                  <dd className="text-text" style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
                    {items.length}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-text-muted">Report</dt>
                  <dd className="text-text">One, covering the batch</dd>
                </div>
              </dl>

              <p className="mt-4 rounded-md bg-surface-sunken px-3 py-2.5 text-[12.5px] text-text-muted">
                Each slide is counted and identified separately, then the whole batch is stored as a
                single report.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
