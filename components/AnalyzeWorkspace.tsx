"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  FileText,
  ImagePlus,
  X,
  Loader2,
  Maximize2,
  Microscope,
} from "lucide-react";
import {
  getTotalGrains,
  weatherConditionOptions,
  type SpecimenDetection,
  type WeatherCondition,
  type WeatherConditions,
} from "@/lib/data";
import { analyzeSpecimen, type AnalysisResult } from "@/lib/analysis";
import { getDraft, saveDraft } from "@/lib/store";
import { accountName } from "@/lib/account";
import { useSettings } from "@/lib/settings";
import { Button } from "@/components/Button";
import ImageLightbox from "@/components/ImageLightbox";

type ItemStatus = "pending" | "analyzing" | "analyzed";

/** One uploaded slide. Detections are per image; the collection details
 *  (location, researcher, weather) are shared by the whole batch. */
type BatchItem = {
  id: string;
  file: File;
  imageUrl: string;
  status: ItemStatus;
  detections: SpecimenDetection[];
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
  const [isDragging, setIsDragging] = useState(false);
  const [hasPendingDraft, setHasPendingDraft] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const settings = useSettings();
  const researcherName = accountName(settings.email);

  // Time is optional — a researcher who only knows the day can leave it blank.
  const collectedAt = collectedTime ? `${collectedDate}T${collectedTime}` : collectedDate;

  const selected = items.find((item) => item.id === selectedId) ?? null;
  const canAnalyze = items.length > 0 && !!collectedDate && !isAnalyzing;

  // An analysis run in an earlier visit may still be sitting unsaved. Say so
  // rather than letting the next run quietly replace it.
  useEffect(() => {
    let cancelled = false;
    getDraft().then((draft) => {
      if (!cancelled) setHasPendingDraft(draft !== null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function patchItem(id: string, patch: Partial<BatchItem>) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  function updateWeather<K extends keyof WeatherConditions>(key: K, value: WeatherConditions[K]) {
    setWeather((current) => ({ ...current, [key]: value }));
  }

  function handleFiles(fileList: FileList | null) {
    const images = Array.from(fileList ?? []).filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) return;

    const added: BatchItem[] = images.map((file) => ({
      id: crypto.randomUUID(),
      file,
      imageUrl: URL.createObjectURL(file),
      status: "pending",
      detections: [],
    }));

    setItems((current) => [...current, ...added]);
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
    if (selectedId === id) setSelectedId(next[0]?.id ?? null);
  }

  function handleClearAll() {
    items.forEach((item) => URL.revokeObjectURL(item.imageUrl));
    setItems([]);
    setSelectedId(null);
    setWeather({ ...EMPTY_WEATHER });
    const { date, time } = nowParts();
    setCollectedDate(date);
    setCollectedTime(time);
    if (inputRef.current) inputRef.current.value = "";
  }

  /**
   * Analyze every slide in the batch, then hand the whole reading over to the
   * report page. The batch is written to a draft rather than passed in the URL
   * because it carries the images themselves — and a draft in IndexedDB also
   * survives a refresh of the page it lands on.
   */
  async function handleAnalyze() {
    if (!canAnalyze) return;
    setIsAnalyzing(true);

    // One slide at a time, so the list shows progress as each result lands.
    const analyzed: { item: BatchItem; analysis: AnalysisResult }[] = [];
    let batchWeather = weather;

    for (const item of items) {
      patchItem(item.id, { status: "analyzing" });
      const analysis = await analyzeSpecimen(item.file);
      patchItem(item.id, { status: "analyzed", detections: analysis.detections });
      analyzed.push({ item, analysis });
      if (analysis.weather) {
        batchWeather = analysis.weather;
        setWeather(analysis.weather);
      }
    }

    await saveDraft({
      collectedAt,
      location,
      researcher: researcher || researcherName,
      weather: batchWeather,
      analyzedAt: new Date().toISOString(),
      slides: analyzed.map(({ item, analysis }) => ({
        id: item.id,
        fileName: item.file.name,
        image: item.file,
        detections: analysis.detections,
        grains: analysis.grains,
        notes: "",
      })),
    });

    // The draft owns the images from here; these object URLs belong to this
    // screen and go with it.
    items.forEach((item) => URL.revokeObjectURL(item.imageUrl));
    router.push("/upload/result");
  }

  return (
    <div className="flex flex-col gap-4">
      {hasPendingDraft && !isAnalyzing && (
        <div className="flex flex-col gap-3 rounded-lg border border-processing/30 bg-processing-bg px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <FileText size={15} strokeWidth={1.75} className="mt-0.5 shrink-0 text-processing" />
            <p className="text-[13px] text-text/80">
              You have an analysis that hasn&apos;t been saved yet. Running a new one replaces it.
            </p>
          </div>
          <Link
            href="/upload/result"
            className="focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border-strong bg-surface px-3 py-1.5 text-[13px] text-text transition active:scale-[0.97] hover:bg-surface-sunken"
          >
            Open It
            <ArrowRight size={13} strokeWidth={1.75} />
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        {/* Left: batch + collection details */}
        <div className="rounded-lg border border-border bg-surface p-5 xl:col-span-3">
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
            accept="image/*"
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
                JPG, PNG — up to 10MB each. Select several to analyze a batch.
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
              still correct any of it on the report page before saving.
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[12.5px] text-text-muted">Location</span>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Lucena City, Quezon"
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
                  Time collected <span className="text-text-faint">(optional)</span>
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

            {/* TODO(backend): fetchWeather(location) will pre-fill these. */}
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
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

          <Button
            type="button"
            intent="accent"
            disabled={!canAnalyze}
            onClick={handleAnalyze}
            className="mt-5 w-full disabled:cursor-not-allowed"
          >
            {isAnalyzing ? (
              <>
                <Loader2 size={16} strokeWidth={1.75} className="animate-spin" />
                Analyzing…
              </>
            ) : (
              <>
                <Microscope size={16} strokeWidth={1.75} />
                {items.length > 1 ? `Analyze ${items.length} Specimens` : "Analyze Specimen"}
              </>
            )}
          </Button>

          <p className="mt-2 text-center text-[12.5px] text-text-muted">
            The results open on their own page, where you add notes and save the report.
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
                Each slide is counted and identified separately, then the whole batch is saved as a
                single report.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
