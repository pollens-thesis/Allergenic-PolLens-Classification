"use client";

import { useRef, useState } from "react";
import {
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
import { analyzeSpecimen, saveSpecimen, type AnalysisResult } from "@/lib/analysis";

type Stage = "empty" | "ready" | "analyzing" | "result";

const EMPTY_WEATHER: WeatherConditions = {
  condition: "Sunny",
  temperatureC: null,
  humidityPct: null,
  windKph: null,
};

const fieldClass =
  "focus-ring w-full rounded-md border border-panel-line bg-white px-3 py-2 text-[13px] text-ink placeholder:text-ink/35";

function riskBadgeClass(level: Species["riskLevel"]) {
  if (level === "High") return "bg-[#b3492f]/10 text-[#b3492f]";
  if (level === "Moderate") return "bg-anther/10 text-anther";
  return "bg-[#3f7a4f]/10 text-[#3f7a4f]";
}

/** One pollen type found on the slide: how many grains, and how sure the model is. */
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
  placeholder,
  min,
  max,
}: {
  label: string;
  value: number | null;
  onChange: (next: number | null) => void;
  placeholder: string;
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
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className={fieldClass}
      />
    </label>
  );
}

export default function AnalyzeWorkspace() {
  const [stage, setStage] = useState<Stage>("empty");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [location, setLocation] = useState("");
  const [researcher, setResearcher] = useState("You");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [notes, setNotes] = useState("");
  const [weather, setWeather] = useState<WeatherConditions>(EMPTY_WEATHER);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedSampleId, setSavedSampleId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const detections = result ? [...result.detections].sort(sortByAbundance) : [];
  const totalGrains = getTotalGrains(detections);
  const overallConfidence = getWeightedAvgConfidence(detections);

  function updateWeather<K extends keyof WeatherConditions>(key: K, value: WeatherConditions[K]) {
    setWeather((current) => ({ ...current, [key]: value }));
  }

  function handleFile(nextFile: File | undefined) {
    if (!nextFile || !nextFile.type.startsWith("image/")) return;
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl(URL.createObjectURL(nextFile));
    setFile(nextFile);
    setResult(null);
    setSaved(false);
    setSavedSampleId(null);
    setStage("ready");
  }

  function handleRemoveImage() {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl(null);
    setFile(null);
    setResult(null);
    setNotes("");
    setWeather(EMPTY_WEATHER);
    setSaved(false);
    setSavedSampleId(null);
    setStage("empty");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleAnalyze() {
    if (!file) return;
    setStage("analyzing");
    const analysis = await analyzeSpecimen(file);
    setResult(analysis);
    // A weather lookup (once wired up) pre-fills the fields; until then the
    // researcher's own entries are kept.
    if (analysis.weather) setWeather(analysis.weather);
    setStage("result");
  }

  async function handleSave() {
    if (!result) return;
    setSaving(true);
    const specimen = await saveSpecimen({
      location,
      researcher,
      notes,
      weather,
      detections,
    });
    setSavedSampleId(specimen.sampleId);
    setSaving(false);
    setSaved(true);
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
      {/* Left: image + metadata */}
      <div className="rounded-lg border border-panel-line bg-white/60 p-5 xl:col-span-3">
        <h2 className="mb-4 text-lg text-ink" style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}>
          Specimen image
        </h2>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />

        {!imageUrl ? (
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
              handleFile(e.dataTransfer.files?.[0]);
            }}
            className={`focus-ring flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-14 text-center transition ${
              isDragging ? "border-anther bg-anther/5" : "border-panel-line hover:border-ink/30"
            }`}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-panel">
              <ImagePlus size={20} strokeWidth={1.75} className="text-ink/50" />
            </span>
            <span className="text-[13.5px] text-ink/70">
              Drag and drop a microscope image, or click to browse
            </span>
            <span className="text-[11.5px] text-ink/40">JPG, PNG — up to 10MB</span>
          </button>
        ) : (
          <div className="relative overflow-hidden rounded-lg border border-panel-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="Uploaded specimen preview" className="max-h-80 w-full object-contain bg-panel" />
            <button
              type="button"
              onClick={handleRemoveImage}
              aria-label="Remove image"
              className="focus-ring absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-ink/80 text-parchment hover:bg-ink"
            >
              <X size={14} strokeWidth={1.75} />
            </button>
            <div className="border-t border-panel-line bg-white px-3 py-2 text-[12px] text-ink/50">
              {file?.name}
            </div>
          </div>
        )}

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
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
        </div>

        <button
          type="button"
          disabled={!imageUrl || stage === "analyzing"}
          onClick={handleAnalyze}
          className="focus-ring mt-5 flex w-full items-center justify-center gap-2 rounded-md bg-ink px-4 py-2.5 text-sm font-medium text-parchment transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {stage === "analyzing" ? (
            <>
              <Loader2 size={16} strokeWidth={1.75} className="animate-spin" />
              Analyzing…
            </>
          ) : (
            <>
              <Microscope size={16} strokeWidth={1.75} />
              Analyze specimen
            </>
          )}
        </button>
      </div>

      {/* Right: result */}
      <div className="rounded-lg border border-panel-line bg-white/60 p-5 xl:col-span-2">
        <h2 className="mb-4 text-lg text-ink" style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}>
          Result
        </h2>

        {stage !== "result" || !result ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg bg-panel/60 px-6 py-14 text-center">
            <Microscope size={22} strokeWidth={1.5} className="text-ink/25" />
            <p className="text-[13px] text-ink/45">
              {stage === "analyzing"
                ? "Counting and identifying pollen grains…"
                : "Upload an image and run analysis to see every pollen type detected, with its grain count and average confidence."}
            </p>
          </div>
        ) : (
          <div>
            <p className="mb-3 flex items-center gap-1.5 text-[12px] text-ink/55">
              <MapPin size={13} strokeWidth={1.75} className="shrink-0 text-ink/35" />
              <span className="truncate">{location || "Location not specified"}</span>
            </p>

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
              <h3 className="mb-2 text-[11px] tracking-[0.2em] text-ink/45 uppercase" style={{ fontFamily: "var(--font-mono)" }}>
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

            {/* Collection conditions.
                TODO(backend): fetchWeather(location) will pre-fill these. */}
            <div className="mb-5">
              <h3 className="mb-2 text-[11px] tracking-[0.2em] text-ink/45 uppercase" style={{ fontFamily: "var(--font-mono)" }}>
                Weather conditions
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <label className="col-span-2 block">
                  <span className="mb-1 block text-[11.5px] text-ink/50">Conditions</span>
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
                  label="Temperature (°C)"
                  value={weather.temperatureC}
                  onChange={(next) => updateWeather("temperatureC", next)}
                  placeholder="—"
                />
                <MeasurementField
                  label="Humidity (%)"
                  value={weather.humidityPct}
                  onChange={(next) => updateWeather("humidityPct", next)}
                  placeholder="—"
                  min={0}
                  max={100}
                />
                <MeasurementField
                  label="Wind (km/h)"
                  value={weather.windKph}
                  onChange={(next) => updateWeather("windKph", next)}
                  placeholder="—"
                  min={0}
                />
              </div>
            </div>

            {/* Notes */}
            <div className="mb-5">
              <h3 className="mb-2 text-[11px] tracking-[0.2em] text-ink/45 uppercase" style={{ fontFamily: "var(--font-mono)" }}>
                Notes
              </h3>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Slide preparation, staining, obscured grains, anything unusual…"
                className={`${fieldClass} resize-y`}
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={saved || saving}
                className="focus-ring flex flex-1 items-center justify-center gap-2 rounded-md bg-ink px-3 py-2 text-[13px] font-medium text-parchment transition hover:opacity-90 disabled:cursor-default disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <Loader2 size={14} strokeWidth={1.75} className="animate-spin" />
                    Saving…
                  </>
                ) : saved ? (
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
                onClick={handleRemoveImage}
                className="focus-ring flex items-center justify-center gap-2 rounded-md border border-panel-line bg-white px-3 py-2 text-[13px] text-ink/70 transition hover:text-ink"
              >
                <RotateCcw size={14} strokeWidth={1.75} />
                New
              </button>
            </div>

            {saved && (
              <p className="mt-3 text-[11.5px] text-ink/40">
                Saved as{" "}
                <span style={{ fontFamily: "var(--font-mono)" }}>{savedSampleId}</span> locally for
                this session — this will sync to your real History once the backend is connected.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
