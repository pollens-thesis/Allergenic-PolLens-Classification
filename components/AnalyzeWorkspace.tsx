"use client";

import { useRef, useState } from "react";
import {
  CalendarDays,
  ImagePlus,
  X,
  Loader2,
  MapPin,
  Microscope,
  RotateCcw,
  Save,
  Check,
} from "lucide-react";
import {
  formatCollectedAt,
  getSpecies,
  getTotalGrains,
  getWeightedAvgConfidence,
  sortByAbundance,
  weatherConditionOptions,
  type Species,
  type SpecimenDetection,
  type WeatherCondition,
  type WeatherConditions,
} from "@/lib/data";
import { analyzeSpecimen, saveSpecimen } from "@/lib/analysis";

type ItemStatus = "pending" | "analyzing" | "analyzed";

/** One uploaded slide. Detections and notes are per image; the collection
 *  details (location, researcher, weather) are shared by the whole batch. */
type BatchItem = {
  id: string;
  file: File;
  imageUrl: string;
  status: ItemStatus;
  detections: SpecimenDetection[];
  notes: string;
  saving: boolean;
  savedSampleId: string | null;
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
  "focus-ring w-full rounded-md border border-panel-line bg-white px-3 py-2 text-[13px] text-ink placeholder:text-ink/35";

const sectionHeadingClass = "mb-2 text-[11px] tracking-[0.2em] text-ink/45 uppercase";

function riskBadgeClass(level: Species["riskLevel"]) {
  if (level === "High") return "bg-[#b3492f]/10 text-[#b3492f]";
  if (level === "Moderate") return "bg-anther/10 text-anther";
  return "bg-[#3f7a4f]/10 text-[#3f7a4f]";
}

/** One pollen type found on a slide: how many grains, and how sure the model is. */
function DetectionRow({ detection }: { detection: SpecimenDetection }) {
  const species = getSpecies(detection.speciesId);
  const confidencePct = Math.round(detection.avgConfidence * 100);

  return (
    <li className="rounded-md border border-panel-line bg-white px-3 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span
            aria-hidden
            className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: species.color }}
          />
          <div className="min-w-0">
            <div
              className="text-[10.5px] tracking-widest text-ink/45 uppercase"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {species.code}
            </div>
            <div className="truncate text-[14px] text-ink" style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}>
              {species.genus}
            </div>
            <div className="truncate text-[12px] text-ink/55">{species.commonName}</div>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div className="text-[14px] text-ink" style={{ fontFamily: "var(--font-mono)" }}>
            {detection.grainCount}
          </div>
          <div className="text-[11px] text-ink/45">
            {detection.grainCount === 1 ? "grain" : "grains"}
          </div>
          <span
            className={`mt-1.5 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap ${riskBadgeClass(species.riskLevel)}`}
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {species.riskLevel} risk
          </span>
        </div>
      </div>

      <div className="mt-2.5">
        <div className="mb-1 flex items-center justify-between text-[11.5px] text-ink/55">
          <span>Avg. confidence</span>
          <span style={{ fontFamily: "var(--font-mono)" }}>{confidencePct}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel-line">
          <div className="h-full rounded-full bg-anther" style={{ width: `${confidencePct}%` }} />
        </div>
      </div>
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
      <span className="mb-1 block text-[11.5px] text-ink/50">{label}</span>
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
  isSelected,
  onSelect,
  onRemove,
}: {
  item: BatchItem;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const grains = getTotalGrains(item.detections);

  return (
    <li className="flex items-stretch gap-1">
      <button
        type="button"
        onClick={onSelect}
        aria-current={isSelected}
        className={`focus-ring flex min-w-0 flex-1 items-center gap-3 rounded-md border px-2.5 py-2 text-left transition ${
          isSelected
            ? "border-ink/25 bg-white"
            : "border-panel-line bg-white/50 hover:border-ink/20"
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.imageUrl}
          alt=""
          className="h-10 w-10 shrink-0 rounded object-cover bg-panel"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px] text-ink">{item.file.name}</span>
          <span className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-ink/50">
            {item.status === "pending" && "Not analyzed yet"}
            {item.status === "analyzing" && (
              <>
                <Loader2 size={11} strokeWidth={2} className="animate-spin" />
                Analyzing…
              </>
            )}
            {item.status === "analyzed" && (
              <span style={{ fontFamily: "var(--font-mono)" }}>
                {grains} {grains === 1 ? "grain" : "grains"} · {item.detections.length}{" "}
                {item.detections.length === 1 ? "type" : "types"}
              </span>
            )}
            {item.savedSampleId && (
              <Check size={11} strokeWidth={2.25} className="text-[#3f7a4f]" />
            )}
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${item.file.name}`}
        className="focus-ring flex w-8 shrink-0 items-center justify-center rounded-md border border-panel-line bg-white/50 text-ink/35 transition hover:text-ink"
      >
        <X size={13} strokeWidth={1.75} />
      </button>
    </li>
  );
}

export default function AnalyzeWorkspace() {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [location, setLocation] = useState("");
  const [researcher, setResearcher] = useState("You");
  const [collectedDate, setCollectedDate] = useState("");
  const [collectedTime, setCollectedTime] = useState("");
  const [weather, setWeather] = useState<WeatherConditions>(EMPTY_WEATHER);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Time is optional — a researcher who only knows the day can leave it blank.
  const collectedAt = collectedTime ? `${collectedDate}T${collectedTime}` : collectedDate;

  const selected = items.find((item) => item.id === selectedId) ?? null;
  const pendingCount = items.filter((item) => item.status === "pending").length;
  const unsavedCount = items.filter(
    (item) => item.status === "analyzed" && !item.savedSampleId,
  ).length;

  const detections = selected ? [...selected.detections].sort(sortByAbundance) : [];
  const totalGrains = getTotalGrains(detections);
  const overallConfidence = getWeightedAvgConfidence(detections);

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
      notes: "",
      saving: false,
      savedSampleId: null,
    }));

    setItems((current) => [...current, ...added]);
    setSelectedId((current) => current ?? added[0].id);
    // Stamp the batch with "now" the first time images arrive. Computed here,
    // in an event handler, so the server and client render the same empty
    // fields initially — no hydration mismatch, and the researcher can still
    // change it to when the slides were actually collected.
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
    setWeather(EMPTY_WEATHER);
    const { date, time } = nowParts();
    setCollectedDate(date);
    setCollectedTime(time);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleAnalyze() {
    const queue = items.filter((item) => item.status === "pending");
    if (queue.length === 0) return;

    setIsAnalyzing(true);
    // One slide at a time, so the list shows progress as each result lands.
    for (const item of queue) {
      patchItem(item.id, { status: "analyzing" });
      const analysis = await analyzeSpecimen(item.file);
      patchItem(item.id, { status: "analyzed", detections: analysis.detections });
      if (analysis.weather) setWeather(analysis.weather);
    }
    setIsAnalyzing(false);
  }

  async function saveItem(item: BatchItem) {
    patchItem(item.id, { saving: true });
    const specimen = await saveSpecimen({
      collectedAt,
      location,
      researcher,
      notes: item.notes,
      weather,
      detections: item.detections,
    });
    patchItem(item.id, { saving: false, savedSampleId: specimen.sampleId });
  }

  async function handleSaveAll() {
    setSavingAll(true);
    for (const item of items) {
      if (item.status === "analyzed" && !item.savedSampleId) await saveItem(item);
    }
    setSavingAll(false);
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
      {/* Left: batch + collection details */}
      <div className="rounded-lg border border-panel-line bg-white/60 p-5 xl:col-span-3">
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h2 className="text-lg text-ink" style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}>
            Specimen images
          </h2>
          {items.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="focus-ring rounded text-[12px] text-ink/45 transition hover:text-ink"
            >
              Clear all
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
            className={`focus-ring flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-14 text-center transition ${
              isDragging ? "border-anther bg-anther/5" : "border-panel-line hover:border-ink/30"
            }`}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-panel">
              <ImagePlus size={20} strokeWidth={1.75} className="text-ink/50" />
            </span>
            <span className="text-[13.5px] text-ink/70">
              Drag and drop microscope images, or click to browse
            </span>
            <span className="text-[11.5px] text-ink/40">
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
            className={`rounded-lg border-2 border-dashed p-2 transition ${
              isDragging ? "border-anther bg-anther/5" : "border-transparent"
            }`}
          >
            <ul className="flex flex-col gap-1.5">
              {items.map((item) => (
                <SpecimenListRow
                  key={item.id}
                  item={item}
                  isSelected={item.id === selectedId}
                  onSelect={() => setSelectedId(item.id)}
                  onRemove={() => handleRemove(item.id)}
                />
              ))}
            </ul>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="focus-ring mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-panel-line px-3 py-2 text-[12.5px] text-ink/55 transition hover:border-ink/25 hover:text-ink"
            >
              <ImagePlus size={14} strokeWidth={1.75} />
              Add more images
            </button>
          </div>
        )}

        {/* Collection details — shared by every slide in the batch. */}
        <div className="mt-5">
          <h3 className={sectionHeadingClass} style={{ fontFamily: "var(--font-mono)" }}>
            Collection details
          </h3>
          <p className="mb-2.5 text-[11.5px] text-ink/40">
            When and where the batch was collected — applies to every specimen in it.
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[11.5px] text-ink/50">Location</span>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Lucena City, Quezon"
                className={fieldClass}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11.5px] text-ink/50">Researcher</span>
              <input
                type="text"
                value={researcher}
                onChange={(e) => setResearcher(e.target.value)}
                className={fieldClass}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11.5px] text-ink/50">Date collected</span>
              <input
                type="date"
                value={collectedDate}
                onChange={(e) => setCollectedDate(e.target.value)}
                className={fieldClass}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11.5px] text-ink/50">
                Time collected <span className="text-ink/30">(optional)</span>
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
            <p className="mt-2 text-[11.5px] text-[#b3492f]">
              Set the collection date before saving.
            </p>
          )}

          {/* TODO(backend): fetchWeather(location) will pre-fill these. */}
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="col-span-2 block sm:col-span-1">
              <span className="mb-1 block text-[11.5px] text-ink/50">Weather</span>
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

        <button
          type="button"
          disabled={pendingCount === 0 || isAnalyzing}
          onClick={handleAnalyze}
          className="focus-ring mt-5 flex w-full items-center justify-center gap-2 rounded-md bg-ink px-4 py-2.5 text-sm font-medium text-parchment transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isAnalyzing ? (
            <>
              <Loader2 size={16} strokeWidth={1.75} className="animate-spin" />
              Analyzing…
            </>
          ) : (
            <>
              <Microscope size={16} strokeWidth={1.75} />
              {items.length > 0 && pendingCount === 0
                ? "All specimens analyzed"
                : pendingCount > 1
                  ? `Analyze ${pendingCount} specimens`
                  : "Analyze specimen"}
            </>
          )}
        </button>

        {unsavedCount > 1 && (
          <button
            type="button"
            disabled={savingAll || !collectedDate}
            onClick={handleSaveAll}
            className="focus-ring mt-2 flex w-full items-center justify-center gap-2 rounded-md border border-panel-line bg-white px-4 py-2 text-[13px] text-ink/70 transition hover:text-ink disabled:opacity-50"
          >
            {savingAll ? (
              <>
                <Loader2 size={14} strokeWidth={1.75} className="animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save size={14} strokeWidth={1.75} />
                Save all {unsavedCount} to history
              </>
            )}
          </button>
        )}
      </div>

      {/* Right: result for the selected specimen */}
      <div className="rounded-lg border border-panel-line bg-white/60 p-5 xl:col-span-2">
        <h2 className="mb-4 text-lg text-ink" style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}>
          Result
        </h2>

        {!selected || selected.status !== "analyzed" ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg bg-panel/60 px-6 py-14 text-center">
            <Microscope size={22} strokeWidth={1.5} className="text-ink/25" />
            <p className="text-[13px] text-ink/45">
              {selected?.status === "analyzing"
                ? "Counting and identifying pollen grains…"
                : selected
                  ? "This specimen hasn't been analyzed yet. Run the analysis to see its pollen breakdown."
                  : "Upload one or more images and run analysis to see every pollen type detected, with its grain count and average confidence."}
            </p>
          </div>
        ) : (
          <div>
            <div className="mb-3 overflow-hidden rounded-md border border-panel-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selected.imageUrl}
                alt={`Specimen ${selected.file.name}`}
                className="max-h-44 w-full bg-panel object-contain"
              />
              <div className="truncate border-t border-panel-line bg-white px-3 py-2 text-[12px] text-ink/55">
                {selected.file.name}
              </div>
            </div>

            <div className="mb-3 flex flex-col gap-1 text-[12px] text-ink/55">
              <p className="flex items-center gap-1.5">
                <MapPin size={13} strokeWidth={1.75} className="shrink-0 text-ink/35" />
                <span className="truncate">{location || "Location not specified"}</span>
              </p>
              <p className="flex items-center gap-1.5">
                <CalendarDays size={13} strokeWidth={1.75} className="shrink-0 text-ink/35" />
                <span className="truncate">
                  {collectedDate ? formatCollectedAt(collectedAt) : "Collection date not set"}
                </span>
              </p>
            </div>

            {/* Summary */}
            <div className="mb-4 grid grid-cols-3 gap-3 rounded-md bg-panel/60 px-3 py-3 text-center">
              <div>
                <div className="text-[17px] text-ink" style={{ fontFamily: "var(--font-mono)" }}>
                  {totalGrains}
                </div>
                <div className="text-[11px] text-ink/45">Grains</div>
              </div>
              <div>
                <div className="text-[17px] text-ink" style={{ fontFamily: "var(--font-mono)" }}>
                  {detections.length}
                </div>
                <div className="text-[11px] text-ink/45">
                  {detections.length === 1 ? "Pollen type" : "Pollen types"}
                </div>
              </div>
              <div>
                <div className="text-[17px] text-ink" style={{ fontFamily: "var(--font-mono)" }}>
                  {Math.round(overallConfidence * 100)}%
                </div>
                <div className="text-[11px] text-ink/45">Avg. confidence</div>
              </div>
            </div>

            {/* Detected pollen */}
            <div className="mb-5">
              <h3 className={sectionHeadingClass} style={{ fontFamily: "var(--font-mono)" }}>
                Pollen detected
              </h3>
              {detections.length === 0 ? (
                <p className="rounded-md border border-panel-line bg-white px-3 py-4 text-center text-[12.5px] text-ink/50">
                  No pollen grains found on this slide.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {detections.map((detection) => (
                    <DetectionRow key={detection.speciesId} detection={detection} />
                  ))}
                </ul>
              )}
            </div>

            {/* Notes — per specimen, unlike the batch-level collection details. */}
            <div className="mb-5">
              <h3 className={sectionHeadingClass} style={{ fontFamily: "var(--font-mono)" }}>
                Notes
              </h3>
              <textarea
                rows={3}
                value={selected.notes}
                onChange={(e) => patchItem(selected.id, { notes: e.target.value })}
                placeholder="Slide preparation, staining, obscured grains, anything unusual…"
                className={`${fieldClass} resize-y`}
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => saveItem(selected)}
                disabled={selected.saving || selected.savedSampleId !== null || !collectedDate}
                className="focus-ring flex flex-1 items-center justify-center gap-2 rounded-md bg-ink px-3 py-2 text-[13px] font-medium text-parchment transition hover:opacity-90 disabled:cursor-default disabled:opacity-60"
              >
                {selected.saving ? (
                  <>
                    <Loader2 size={14} strokeWidth={1.75} className="animate-spin" />
                    Saving…
                  </>
                ) : selected.savedSampleId ? (
                  <>
                    <Check size={14} strokeWidth={1.75} />
                    Saved
                  </>
                ) : (
                  <>
                    <Save size={14} strokeWidth={1.75} />
                    Save to history
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="focus-ring flex items-center justify-center gap-2 rounded-md border border-panel-line bg-white px-3 py-2 text-[13px] text-ink/70 transition hover:text-ink"
              >
                <RotateCcw size={14} strokeWidth={1.75} />
                New batch
              </button>
            </div>

            {selected.savedSampleId && (
              <p className="mt-3 text-[11.5px] text-ink/40">
                Saved as{" "}
                <span style={{ fontFamily: "var(--font-mono)" }}>{selected.savedSampleId}</span>{" "}
                locally for this session — this will sync to your real History once the backend is
                connected.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
