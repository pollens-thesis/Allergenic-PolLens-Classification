"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Microscope,
  Save,
  Trash2,
} from "lucide-react";
import {
  formatCollectedAt,
  getSpecies,
  getTotalGrains,
  getWeightedAvgConfidence,
  sortByAbundance,
  weatherConditionOptions,
  type Species,
  type SpeciesId,
  type SpecimenDetection,
  type WeatherCondition,
  type WeatherConditions,
} from "@/lib/data";
import { clearDraft, getDraft, saveDraft, saveReport, type ReportDraft } from "@/lib/store";
import { accountName } from "@/lib/account";
import { useSettings } from "@/lib/settings";
import SpecimenImageViewer from "@/components/SpecimenImageViewer";

const fieldClass =
  "focus-ring w-full rounded-md border border-panel-line bg-white px-3 py-2 text-[13px] text-ink placeholder:text-ink/70";

const sectionHeadingClass = "mb-2 text-[12px] tracking-[0.2em] text-ink/65 uppercase";

function riskBadgeClass(level: Species["riskLevel"]) {
  if (level === "High") return "bg-ember-ink/10 text-ember-ink";
  if (level === "Moderate") return "bg-anther/10 text-anther-ink";
  return "bg-leaf-ink/10 text-leaf-ink";
}

/**
 * One pollen type found on a slide: how many grains, and how sure the model is.
 * The row is the control for the overlay — selecting it boxes that type's
 * grains on the image beside it.
 */
function DetectionRow({
  detection,
  selected,
  onSelect,
}: {
  detection: SpecimenDetection;
  selected: boolean;
  onSelect: () => void;
}) {
  const species = getSpecies(detection.speciesId);
  const confidencePct = Math.round(detection.avgConfidence * 100);

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={`focus-ring block w-full rounded-md border px-3 py-2.5 text-left transition ${
          selected
            ? "border-ink/25 bg-white shadow-[inset_3px_0_0_0_var(--anther)]"
            : "border-panel-line bg-white hover:border-ink/20"
        }`}
      >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span
            aria-hidden
            className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: species.color }}
          />
          <div className="min-w-0">
            <div
              className="text-[11.5px] tracking-widest text-ink/65 uppercase"
              style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}
            >
              {species.code}
            </div>
            <div className="truncate text-[14px] text-ink" style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>
              {species.genus}
            </div>
            <div className="truncate text-[13px] text-ink/70">{species.commonName}</div>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div className="text-[14px] text-ink" style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
            {detection.grainCount}
          </div>
          <div className="text-[12px] text-ink/65">
            {detection.grainCount === 1 ? "grain" : "grains"}
          </div>
          <span
            className={`mt-1.5 inline-flex items-center rounded-full px-2 py-0.5 text-[11.5px] font-medium whitespace-nowrap ${riskBadgeClass(species.riskLevel)}`}
            style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}
          >
            {species.riskLevel} risk
          </span>
        </div>
      </div>

      <div className="mt-2.5">
        <div className="mb-1 flex items-center justify-between text-[12.5px] text-ink/70">
          <span>Avg. confidence</span>
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>{confidencePct}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel-line">
          <div className="h-full rounded-full bg-anther" style={{ width: `${confidencePct}%` }} />
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
      <span className="mb-1 block text-[12.5px] text-ink/70">{label}</span>
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
      <div className="text-[17px] text-ink" style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
        {value}
      </div>
      <div className="text-[12px] text-ink/65">{label}</div>
    </div>
  );
}

/**
 * The page the Analyze screen hands off to: what the model found on the left,
 * the slide itself on the right, the collection details underneath — all still
 * editable — and the note the researcher writes before saving the report.
 *
 * Nothing here is a saved report yet. It reads the draft written by Analyze,
 * and only `Save report` turns it into a record with a sample id.
 */
export default function AnalysisResultWorkspace() {
  const [draft, setDraft] = useState<ReportDraft | null | undefined>(undefined);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Which pollen type the image overlay is isolating; null shows every box.
  const [highlighted, setHighlighted] = useState<SpeciesId | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [location, setLocation] = useState("");
  const [researcher, setResearcher] = useState("");
  const [collectedDate, setCollectedDate] = useState("");
  const [collectedTime, setCollectedTime] = useState("");
  const [weather, setWeather] = useState<WeatherConditions | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  // Only true once the draft's values are in state, so the write-back effect
  // below can't flush empty fields over the draft it is still loading.
  const [hydrated, setHydrated] = useState(false);
  // Set the moment the draft is on its way out, so a debounced write can't
  // resurrect it after it has been saved or discarded.
  const finished = useRef(false);
  const router = useRouter();
  const settings = useSettings();
  const researcherName = accountName(settings.email);

  useEffect(() => {
    let cancelled = false;
    let created: string[] = [];

    getDraft().then((found) => {
      if (cancelled) return;
      setDraft(found);
      if (!found) return;

      const urls = Object.fromEntries(
        found.slides.map((slide) => [slide.id, URL.createObjectURL(slide.image)]),
      );
      created = Object.values(urls);
      setImageUrls(urls);
      setSelectedId(found.slides[0]?.id ?? null);
      setNotes(Object.fromEntries(found.slides.map((slide) => [slide.id, slide.notes])));
      const [date, time = ""] = found.collectedAt.split("T");
      setLocation(found.location);
      setResearcher(found.researcher);
      setCollectedDate(date);
      setCollectedTime(time);
      setWeather(found.weather);
      setHydrated(true);
    });

    return () => {
      cancelled = true;
      created.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  // Every edit goes back into the draft, so a refresh — or a detour to another
  // screen and back — returns to the notes and corrections already made rather
  // than to the raw reading.
  useEffect(() => {
    if (!draft || !hydrated || finished.current) return;
    const timer = setTimeout(() => {
      if (finished.current) return;
      void saveDraft({
        ...draft,
        collectedAt: collectedTime ? `${collectedDate}T${collectedTime}` : collectedDate,
        location,
        researcher,
        weather: weather ?? draft.weather,
        slides: draft.slides.map((slide) => ({ ...slide, notes: notes[slide.id] ?? "" })),
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [draft, hydrated, notes, location, researcher, collectedDate, collectedTime, weather]);

  function updateWeather<K extends keyof WeatherConditions>(key: K, value: WeatherConditions[K]) {
    setWeather((current) => (current ? { ...current, [key]: value } : current));
  }

  async function handleSave() {
    if (!draft || !collectedDate || isSaving) return;
    finished.current = true;
    setIsSaving(true);

    const report = await saveReport(
      {
        collectedAt: collectedTime ? `${collectedDate}T${collectedTime}` : collectedDate,
        location,
        researcher: researcher || researcherName,
        weather,
        slides: draft.slides.map((slide) => ({
          fileName: slide.fileName,
          detections: slide.detections,
          grains: slide.grains,
          notes: notes[slide.id] ?? "",
        })),
      },
      Object.fromEntries(draft.slides.map((slide, index) => [String(index), slide.image])),
    );

    await clearDraft();
    router.push(`/reports?saved=${report.sampleId}`);
  }

  async function handleDiscard() {
    finished.current = true;
    await clearDraft();
    router.push("/upload");
  }

  if (draft === undefined) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border border-panel-line bg-white/60 px-6 py-16 text-[13px] text-ink/65">
        <Loader2 size={16} strokeWidth={1.75} className="animate-spin" />
        Loading analysis…
      </div>
    );
  }

  if (draft === null) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-panel-line bg-white/60 px-6 py-16 text-center">
        <Microscope size={22} strokeWidth={1.5} className="text-ink/55" />
        <p className="text-[13.5px] text-ink/70">
          There is no analysis waiting here. Run one from Analyze specimen, or open a saved report.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Link
            href="/upload"
            className="focus-ring inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-[13px] font-medium text-parchment transition hover:opacity-90"
          >
            <Microscope size={14} strokeWidth={1.75} />
            Analyze a specimen
          </Link>
          <Link
            href="/reports"
            className="focus-ring inline-flex items-center gap-1.5 rounded-md border border-panel-line bg-white px-3 py-1.5 text-[13px] text-ink/70 transition hover:text-ink"
          >
            Saved reports
          </Link>
        </div>
      </div>
    );
  }

  const selected = draft.slides.find((slide) => slide.id === selectedId) ?? draft.slides[0] ?? null;
  const detections = selected ? [...selected.detections].sort(sortByAbundance) : [];
  const totalGrains = getTotalGrains(detections);
  const confidence = getWeightedAvgConfidence(detections);
  const batchGrains = draft.slides.reduce(
    (sum, slide) => sum + getTotalGrains(slide.detections),
    0,
  );
  const slideIndex = selected ? draft.slides.findIndex((slide) => slide.id === selected.id) : -1;

  return (
    <div className="flex flex-col gap-6">
      {/* Header: what was analyzed, and the way out of the screen */}
      <div className="rounded-lg border border-panel-line bg-white/60 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div
              className="text-[12px] tracking-widest text-ink/65 uppercase"
              style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}
            >
              Not saved yet
            </div>
            <h2 className="mt-1 text-2xl text-ink" style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>
              {draft.slides.length === 1
                ? "1 slide analyzed"
                : `${draft.slides.length} slides analyzed`}
            </h2>
            <p className="mt-1 text-[13px] text-ink/70">
              {batchGrains} {batchGrains === 1 ? "grain" : "grains"} counted across the batch ·
              saved as one report
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {confirmingDiscard ? (
              <>
                <span className="text-[13px] text-ink/70">Discard this analysis?</span>
                <button
                  type="button"
                  onClick={handleDiscard}
                  className="focus-ring rounded-md border border-[#b3492f]/30 bg-white px-3 py-2 text-[13px] font-medium text-[#b3492f] transition hover:bg-[#b3492f]/5"
                >
                  Yes, discard
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDiscard(false)}
                  className="focus-ring rounded-md px-2 py-2 text-[13px] text-ink/65 transition hover:text-ink"
                >
                  Keep it
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDiscard(true)}
                className="focus-ring flex items-center gap-1.5 rounded-md border border-panel-line bg-white px-3 py-2 text-[13px] text-ink/70 transition hover:text-ink"
              >
                <Trash2 size={14} strokeWidth={1.75} />
                Discard
              </button>
            )}

            <button
              type="button"
              onClick={handleSave}
              disabled={!collectedDate || isSaving}
              className="focus-ring flex items-center justify-center gap-2 rounded-md bg-ink px-4 py-2.5 text-[13px] font-medium text-parchment transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSaving ? (
                <>
                  <Loader2 size={15} strokeWidth={1.75} className="animate-spin" />
                  Saving report…
                </>
              ) : (
                <>
                  <Save size={15} strokeWidth={1.75} />
                  Save report
                </>
              )}
            </button>
          </div>
        </div>

        {/* Slide switcher — one report, but each slide has its own reading. */}
        {draft.slides.length > 1 && (
          <div className="mt-4 flex flex-wrap gap-1.5 border-t border-panel-line pt-4">
            {draft.slides.map((slide, index) => {
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
                      ? "border-ink/25 bg-white text-ink"
                      : "border-panel-line bg-white/50 text-ink/70 hover:border-ink/20 hover:text-ink"
                  }`}
                >
                  <span
                    className="shrink-0 text-[12px] text-ink/65"
                    style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}
                  >
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
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-5">
          {/* Left: what the analysis found */}
          <div className="rounded-lg border border-panel-line bg-white/60 p-5 xl:col-span-3">
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <h3 className="text-lg text-ink" style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>
                Pollen detected
              </h3>
              {draft.slides.length > 1 && (
                <span className="text-[13px] text-ink/65">Slide {slideIndex + 1}</span>
              )}
            </div>

            <div className="mb-4 grid grid-cols-3 gap-3 rounded-md bg-panel/60 px-3 py-3 text-center">
              <SummaryTile value={totalGrains} label="Grains" />
              <SummaryTile
                value={detections.length}
                label={detections.length === 1 ? "Pollen type" : "Pollen types"}
              />
              <SummaryTile value={`${Math.round(confidence * 100)}%`} label="Avg. confidence" />
            </div>

            {detections.length === 0 ? (
              <p className="rounded-md border border-panel-line bg-white px-3 py-4 text-center text-[13px] text-ink/70">
                No pollen grains found on this slide.
              </p>
            ) : (
              <>
                <p className="mb-2 text-[12.5px] text-ink/65">
                  Select a type to box its grains on the image.
                </p>
                <ul className="flex flex-col gap-2">
                  {detections.map((detection) => (
                    <DetectionRow
                      key={detection.speciesId}
                      detection={detection}
                      selected={highlighted === detection.speciesId}
                      onSelect={() =>
                        setHighlighted((current) =>
                          current === detection.speciesId ? null : detection.speciesId,
                        )
                      }
                    />
                  ))}
                </ul>
              </>
            )}
          </div>

          {/* Right: the slide itself, and the note about it */}
          <div className="flex flex-col gap-6 xl:col-span-2">
            <div className="rounded-lg border border-panel-line bg-white/60 p-5">
              <h3 className="mb-4 text-lg text-ink" style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>
                Specimen image
              </h3>
              <SpecimenImageViewer
                imageUrl={imageUrls[selected.id]}
                fileName={selected.fileName}
                grains={selected.grains}
                detections={detections}
                selectedSpeciesId={highlighted}
                onSelectSpecies={setHighlighted}
              />
            </div>

            <div className="rounded-lg border border-panel-line bg-white/60 p-5">
              <h3 className="mb-1 text-lg text-ink" style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>
                Notes
              </h3>
              <p className="mb-2.5 text-[12.5px] text-ink/70">
                Recorded against this slide
                {draft.slides.length > 1 ? " only — each slide keeps its own note." : "."}
              </p>
              <textarea
                rows={6}
                value={notes[selected.id] ?? ""}
                onChange={(e) =>
                  setNotes((current) => ({ ...current, [selected.id]: e.target.value }))
                }
                placeholder="Slide preparation, staining, obscured grains, anything unusual…"
                className={`${fieldClass} resize-y`}
              />
            </div>
          </div>
        </div>
      )}

      {/* The details entered on Analyze, still editable until the report is saved. */}
      <div className="rounded-lg border border-panel-line bg-white/60 p-5">
        <h3 className="text-lg text-ink" style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>
          Collection details
        </h3>
        <p className="mt-0.5 mb-4 text-[13px] text-ink/70">
          What you entered before analyzing — correct anything here and it is saved with the
          report.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-[12.5px] text-ink/70">Location</span>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Lucena City, Quezon"
              className={fieldClass}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[12.5px] text-ink/70">Researcher</span>
            <input
              type="text"
              value={researcher}
              onChange={(e) => setResearcher(e.target.value)}
              placeholder={researcherName}
              className={fieldClass}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[12.5px] text-ink/70">Date collected</span>
            <input
              type="date"
              value={collectedDate}
              onChange={(e) => setCollectedDate(e.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[12.5px] text-ink/70">
              Time collected <span className="text-ink/65">(optional)</span>
            </span>
            <input
              type="time"
              value={collectedTime}
              onChange={(e) => setCollectedTime(e.target.value)}
              className={fieldClass}
            />
          </label>
        </div>

        {collectedDate ? (
          <p className="mt-2 text-[12.5px] text-ink/65">
            Collected{" "}
            {formatCollectedAt(
              collectedTime ? `${collectedDate}T${collectedTime}` : collectedDate,
            )}
          </p>
        ) : (
          <p className="mt-2 text-[12.5px] text-[#b3492f]">
            Set the collection date before saving the report.
          </p>
        )}

        {weather && (
          <div className="mt-4">
            <h4 className={sectionHeadingClass} style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
              Conditions at collection
            </h4>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <label className="col-span-2 block sm:col-span-1">
                <span className="mb-1 block text-[12.5px] text-ink/70">Weather</span>
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
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/upload"
          className="focus-ring inline-flex items-center gap-1.5 rounded text-[13px] text-ink/70 transition hover:text-ink"
        >
          <ArrowLeft size={14} strokeWidth={1.75} />
          Back to Analyze specimen
        </Link>

        <button
          type="button"
          onClick={handleSave}
          disabled={!collectedDate || isSaving}
          className="focus-ring flex items-center justify-center gap-2 rounded-md bg-ink px-4 py-2.5 text-sm font-medium text-parchment transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSaving ? (
            <>
              <Loader2 size={16} strokeWidth={1.75} className="animate-spin" />
              Saving report…
            </>
          ) : (
            <>
              <Save size={16} strokeWidth={1.75} />
              Save report
            </>
          )}
        </button>
      </div>
    </div>
  );
}
