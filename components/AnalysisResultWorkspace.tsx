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
  aggregateSlideDetections,
  formatCollectedAt,
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
import { findSpecies, useSpeciesCatalog } from "@/lib/species-catalog";
import { clearDraft, getDraft, saveDraft, saveReport, type ReportDraft } from "@/lib/store";
import { accountName } from "@/lib/account";
import { useSettings } from "@/lib/settings";
import SpecimenImageViewer from "@/components/SpecimenImageViewer";
import SpecimenInspector from "@/components/SpecimenInspector";
import LocationSearch from "@/components/LocationSearch";
import { overlayColor, overlayColors, type OverlayColors } from "@/lib/slide-colors";
import { Button } from "@/components/Button";
import { toast } from "sonner";

const fieldClass =
  "focus-ring w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text placeholder:text-text-faint";

const sectionHeadingClass = "mb-2 text-[12px] tracking-[0.2em] text-text-muted uppercase";

function riskBadgeClass(level: Species["riskLevel"]) {
  if (level === "High") return "bg-danger-bg text-danger";
  if (level === "Moderate") return "bg-processing-bg text-processing";
  return "bg-success-bg text-success";
}

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
            <div className="truncate text-[14px] font-semibold tracking-tight text-text" style={{ fontFamily: "var(--font-display)" }}>
              {species.scientificName}
            </div>
            <div className="truncate text-[13px] text-text-muted">{species.commonName}</div>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div className="text-[14px] text-text" style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
            {detection.grainCount}
          </div>
          <div className="text-[12px] text-text-muted">
            {detection.grainCount === 1 ? "grain" : "grains"}
          </div>
          <span
            className={`mt-1.5 inline-flex items-center rounded-full px-2 py-0.5 text-[11.5px] font-medium whitespace-nowrap ${riskBadgeClass(species.riskLevel)}`}
            style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}
          >
            {species.riskLevel} Risk
          </span>
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
  const [inspectorOpen, setInspectorOpen] = useState(false);
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

    const savePromise = saveReport(
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
    toast.promise(savePromise, {
      loading: "Saving report…",
      success: "Report saved",
      error: "Couldn't save report",
    });
    const report = await savePromise;

    await clearDraft();
    router.push(`/reports?saved=${report.sampleId}`);
  }

  async function handleDiscard() {
    finished.current = true;
    await clearDraft();
    toast.success("Draft discarded");
    router.push("/upload");
  }

  if (draft === undefined) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-6 py-16 text-[13px] text-text-muted">
        <Loader2 size={16} strokeWidth={1.75} className="animate-spin" />
        Loading analysis…
      </div>
    );
  }

  if (draft === null) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface px-6 py-16 text-center">
        <Microscope size={22} strokeWidth={1.5} className="text-text-faint" />
        <p className="text-[13.5px] text-text-muted">
          There is no analysis waiting here. Run one from Analyze specimen, or open a saved report.
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
            Saved Reports
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
  // One palette for the whole batch: a type keeps its colour on every slide.
  const colors = overlayColors(aggregateSlideDetections(draft.slides));

  return (
    <div className="flex flex-col gap-6">
      {/* Header: what was analyzed, and the way out of the screen */}
      <div className="rounded-lg border border-border bg-surface p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div
              className="text-[12px] tracking-widest text-text-muted uppercase"
              style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}
            >
              Not Saved Yet
            </div>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-text" style={{ fontFamily: "var(--font-display)" }}>
              {draft.slides.length === 1
                ? "1 Slide Analyzed"
                : `${draft.slides.length} Slides Analyzed`}
            </h2>
            <p className="mt-1 text-[13px] text-text-muted">
              {batchGrains} {batchGrains === 1 ? "grain" : "grains"} counted across the batch ·
              saved as one report
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {confirmingDiscard ? (
              <>
                <span className="text-[13px] text-text-muted">Discard this analysis?</span>
                <button
                  type="button"
                  onClick={handleDiscard}
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

            <Button
              type="button"
              intent="accent"
              size="sm"
              onClick={handleSave}
              disabled={!collectedDate || isSaving}
              className="disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <Loader2 size={15} strokeWidth={1.75} className="animate-spin" />
                  Saving report…
                </>
              ) : (
                <>
                  <Save size={15} strokeWidth={1.75} />
                  Save Report
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Slide switcher — one report, but each slide has its own reading. */}
        {draft.slides.length > 1 && (
          <div className="mt-4 flex flex-wrap gap-1.5 border-t border-border pt-4">
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
                      ? "border-border-strong bg-surface text-text"
                      : "border-border bg-surface-sunken text-text-muted hover:border-border-strong hover:text-text"
                  }`}
                >
                  <span
                    className="shrink-0 text-[12px] text-text-muted"
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
          <div className="rounded-lg border border-border bg-surface p-5 xl:col-span-3">
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <h3 className="text-lg font-semibold tracking-tight text-text" style={{ fontFamily: "var(--font-display)" }}>
                Pollen Detected
              </h3>
              {draft.slides.length > 1 && (
                <span className="text-[13px] text-text-muted">Slide {slideIndex + 1}</span>
              )}
            </div>

            <div className="mb-4 grid grid-cols-3 gap-3 rounded-md bg-surface-sunken px-3 py-3 text-center">
              <SummaryTile value={totalGrains} label="Grains" />
              <SummaryTile
                value={detections.length}
                label={detections.length === 1 ? "Pollen Type" : "Pollen Types"}
              />
              <SummaryTile value={`${Math.round(confidence * 100)}%`} label="Avg. Confidence" />
            </div>

            {detections.length === 0 ? (
              <p className="rounded-md border border-border bg-surface px-3 py-4 text-center text-[13px] text-text-muted">
                No pollen grains found on this slide.
              </p>
            ) : (
              <>
                <p className="mb-2 text-[12.5px] text-text-muted">
                  Select a type to box its grains on the image.
                </p>
                <ul className="flex flex-col gap-2">
                  {detections.map((detection) => (
                    <DetectionRow
                      key={detection.speciesId}
                      detection={detection}
                      colors={colors}
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
            <div className="rounded-lg border border-border bg-surface p-5">
              <h3 className="mb-4 text-lg font-semibold tracking-tight text-text" style={{ fontFamily: "var(--font-display)" }}>
                Specimen Image
              </h3>
              <SpecimenImageViewer
                imageUrl={imageUrls[selected.id]}
                fileName={selected.fileName}
                grains={selected.grains}
                detections={detections}
                colors={colors}
                selectedSpeciesId={highlighted}
                onSelectSpecies={setHighlighted}
                onExpand={() => setInspectorOpen(true)}
              />
              <SpecimenInspector
                open={inspectorOpen}
                onOpenChange={setInspectorOpen}
                colors={colors}
                initialSlideId={selected.id}
                initialSpeciesId={highlighted}
                slides={draft.slides.map((slide, index) => ({
                  id: slide.id,
                  label: `Slide ${index + 1}`,
                  fileName: slide.fileName,
                  imageUrl: imageUrls[slide.id],
                  grains: slide.grains,
                  detections: slide.detections,
                }))}
              />
            </div>

            <div className="rounded-lg border border-border bg-surface p-5">
              <h3 className="mb-1 text-lg font-semibold tracking-tight text-text" style={{ fontFamily: "var(--font-display)" }}>
                Notes
              </h3>
              <p className="mb-2.5 text-[12.5px] text-text-muted">
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
      <div className="rounded-lg border border-border bg-surface p-5">
        <h3 className="text-lg font-semibold tracking-tight text-text" style={{ fontFamily: "var(--font-display)" }}>
          Collection Details
        </h3>
        <p className="mt-0.5 mb-4 text-[13px] text-text-muted">
          What you entered before analyzing — correct anything here and it is saved with the
          report.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-[12.5px] text-text-muted">Location</span>
            <LocationSearch
              value={location}
              onChange={setLocation}
              placeholder="Search town or province"
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

        {collectedDate ? (
          <p className="mt-2 text-[12.5px] text-text-muted">
            Collected{" "}
            {formatCollectedAt(
              collectedTime ? `${collectedDate}T${collectedTime}` : collectedDate,
            )}
          </p>
        ) : (
          <p className="mt-2 text-[12.5px] text-danger">
            Set the collection date before saving the report.
          </p>
        )}

        {weather && (
          <div className="mt-4">
            <h4 className={sectionHeadingClass} style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
              Conditions at Collection
            </h4>
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
          className="focus-ring inline-flex items-center gap-1.5 rounded text-[13px] text-text-muted transition hover:text-text"
        >
          <ArrowLeft size={14} strokeWidth={1.75} />
          Back to Analyze Specimen
        </Link>

        <Button
          type="button"
          intent="accent"
          onClick={handleSave}
          disabled={!collectedDate || isSaving}
          className="disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <>
              <Loader2 size={16} strokeWidth={1.75} className="animate-spin" />
              Saving report…
            </>
          ) : (
            <>
              <Save size={16} strokeWidth={1.75} />
              Save Report
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
