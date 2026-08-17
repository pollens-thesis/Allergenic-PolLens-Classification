"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  CloudSun,
  Download,
  Droplets,
  FileText,
  Loader2,
  MapPin,
  Microscope,
  Thermometer,
  User,
  Wind,
} from "lucide-react";
import {
  aggregateSlideDetections,
  formatCollectedAt,
  formatTime,
  getCollectionDate,
  getCollectionTime,
  getSpecies,
  getTotalGrains,
  getWeightedAvgConfidence,
  type SpeciesId,
  type Specimen,
  type SpecimenDetection,
} from "@/lib/data";
import { getReport, getReportImageBlobs, getReportImageUrls } from "@/lib/store";
import { downloadReportPdf } from "@/lib/pdf";
import StatusBadge from "@/components/StatusBadge";
import SpecimenImageViewer from "@/components/SpecimenImageViewer";

function riskBadgeClass(level: "High" | "Moderate" | "Low") {
  if (level === "High") return "bg-ember-ink/10 text-ember-ink";
  if (level === "Moderate") return "bg-anther/10 text-anther-ink";
  return "bg-leaf-ink/10 text-leaf-ink";
}

/**
 * One pollen type in a reading. When `onSelect` is given the row doubles as the
 * control for the slide's overlay: picking a type boxes its grains on the image.
 */
function DetectionRow({
  detection,
  selected = false,
  onSelect,
}: {
  detection: SpecimenDetection;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const species = getSpecies(detection.speciesId);
  const confidencePct = Math.round(detection.avgConfidence * 100);

  /**
   * One line on a wide row, two on a narrow one. Side by side, the name and the
   * figures collide below about 480px — the name has no fixed width and the
   * confidence bar does — so on small screens the figures move underneath
   * instead of being squeezed into the name.
   */
  const body = (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          aria-hidden
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: species.color }}
        />
        <div className="min-w-0 text-left">
          <span
            className="mr-2 text-[11.5px] tracking-widest text-ink/65 uppercase"
            style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}
          >
            {species.code}
          </span>
          <span className="text-[14px] text-ink" style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>
            {species.genus}
          </span>
          <span className="ml-1.5 text-[13px] text-ink/70">{species.commonName}</span>
        </div>
        <span
          className={`hidden shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-medium whitespace-nowrap lg:inline-flex ${riskBadgeClass(species.riskLevel)}`}
          style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}
        >
          {species.riskLevel} risk
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-4 pl-5 sm:pl-0">
        <div className="text-left sm:text-right">
          <span
            className="text-[14px] text-ink"
            style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}
          >
            {detection.grainCount}
          </span>
          <span className="ml-1 text-[11.5px] text-ink/65 sm:ml-0 sm:block">
            {detection.grainCount === 1 ? "grain" : "grains"}
          </span>
        </div>
        <div className="w-24 flex-1 sm:flex-none">
          <div className="mb-1 flex items-center justify-between text-[11.5px] text-ink/70">
            <span>conf.</span>
            <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>{confidencePct}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel-line">
            <div className="h-full rounded-full bg-anther" style={{ width: `${confidencePct}%` }} />
          </div>
        </div>
      </div>
    </div>
  );

  if (!onSelect) {
    return <li className="rounded-md border border-panel-line bg-white px-3 py-2.5">{body}</li>;
  }

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={`focus-ring block w-full rounded-md border px-3 py-2.5 transition ${
          selected
            ? "border-ink/25 bg-white shadow-[inset_3px_0_0_0_var(--anther)]"
            : "border-panel-line bg-white hover:border-ink/20"
        }`}
      >
        {body}
      </button>
    </li>
  );
}

/** One recorded field: what it is, and what the researcher entered. */
function MetaItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={15} strokeWidth={1.75} className="mt-0.5 shrink-0 text-ink/55" />
      <div className="min-w-0">
        <div className="text-[12px] tracking-widest text-ink/65 uppercase" style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
          {label}
        </div>
        <div className="text-[13px] text-ink/85">{value}</div>
      </div>
    </div>
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

export default function ReportDetail({ sampleId }: { sampleId: string }) {
  const [report, setReport] = useState<Specimen | null | undefined>(undefined);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  // The pollen type each slide's overlay is isolating, keyed by slide id.
  const [highlighted, setHighlighted] = useState<Record<string, SpeciesId | null>>({});
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let created: string[] = [];

    getReport(sampleId).then(async (found) => {
      if (cancelled) return;
      setReport(found);
      if (!found) return;
      const urls = await getReportImageUrls(sampleId);
      if (cancelled) {
        Object.values(urls).forEach((url) => URL.revokeObjectURL(url));
        return;
      }
      created = Object.values(urls);
      setImageUrls(urls);
    });

    return () => {
      cancelled = true;
      created.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [sampleId]);

  async function handleDownloadPdf() {
    if (!report) return;
    setDownloading(true);
    try {
      const blobs = await getReportImageBlobs(report.sampleId);
      await downloadReportPdf(report, blobs);
    } finally {
      setDownloading(false);
    }
  }

  if (report === undefined) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border border-panel-line bg-white/60 px-6 py-16 text-[13px] text-ink/65">
        <Loader2 size={16} strokeWidth={1.75} className="animate-spin" />
        Loading report…
      </div>
    );
  }

  if (report === null) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-panel-line bg-white/60 px-6 py-16 text-center">
        <FileText size={22} strokeWidth={1.5} className="text-ink/55" />
        <p className="text-[13.5px] text-ink/70">
          No report found for{" "}
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>{sampleId}</span>.
        </p>
        <Link
          href="/reports"
          className="focus-ring inline-flex items-center gap-1.5 rounded-md border border-panel-line bg-white px-3 py-1.5 text-[13px] text-ink/70 transition hover:text-ink"
        >
          <ArrowLeft size={14} strokeWidth={1.75} />
          Back to Reports
        </Link>
      </div>
    );
  }

  const aggregated = aggregateSlideDetections(report.slides);
  const totalGrains = getTotalGrains(aggregated);
  const overallConfidence = getWeightedAvgConfidence(aggregated);
  const collectionTime = getCollectionTime(report.collectedAt);
  const weather = report.weather;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="rounded-lg border border-panel-line bg-white/60 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div
              className="text-[12px] tracking-widest text-ink/65 uppercase"
              style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}
            >
              {report.sampleId}
            </div>
            <h2
              className="mt-1 text-2xl text-ink"
              style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
            >
              Full report
            </h2>
            <div className="mt-2">
              <StatusBadge status={report.status} />
            </div>
          </div>

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="focus-ring flex shrink-0 items-center justify-center gap-2 rounded-md bg-ink px-4 py-2.5 text-[13px] font-medium text-parchment transition hover:opacity-90 disabled:opacity-60"
          >
            {downloading ? (
              <>
                <Loader2 size={15} strokeWidth={1.75} className="animate-spin" />
                Building PDF…
              </>
            ) : (
              <>
                <Download size={15} strokeWidth={1.75} />
                Download PDF
              </>
            )}
          </button>
        </div>
      </div>

      {/* Everything the researcher entered on the Analyze screen. */}
      <div className="rounded-lg border border-panel-line bg-white/60 p-5">
        <h3 className="text-lg text-ink" style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>
          Collection details
        </h3>
        <p className="mt-0.5 mb-4 text-[13px] text-ink/70">
          Recorded with the batch when it was analyzed.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetaItem
            icon={CalendarDays}
            label="Date collected"
            value={new Date(`${getCollectionDate(report.collectedAt)}T00:00:00`).toLocaleDateString(
              "en-US",
              { month: "short", day: "numeric", year: "numeric" },
            )}
          />
          <MetaItem
            icon={Clock}
            label="Time collected"
            value={collectionTime ? formatTime(collectionTime) : "Not recorded"}
          />
          <MetaItem icon={MapPin} label="Location" value={report.location || "Not specified"} />
          <MetaItem icon={User} label="Researcher" value={report.researcher} />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 border-t border-panel-line pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetaItem
            icon={CloudSun}
            label="Weather"
            value={weather ? weather.condition : "Not recorded"}
          />
          <MetaItem
            icon={Thermometer}
            label="Temperature"
            value={weather?.temperatureC !== null && weather ? `${weather.temperatureC}°C` : "—"}
          />
          <MetaItem
            icon={Droplets}
            label="Humidity"
            value={weather?.humidityPct !== null && weather ? `${weather.humidityPct}% RH` : "—"}
          />
          <MetaItem
            icon={Wind}
            label="Wind"
            value={weather?.windKph !== null && weather ? `${weather.windKph} km/h` : "—"}
          />
        </div>
      </div>

      {/* Combined results */}
      <div className="rounded-lg border border-panel-line bg-white/60 p-5">
        <h3 className="mb-4 text-lg text-ink" style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>
          Results
        </h3>

        <div className="mb-4 grid grid-cols-2 gap-3 rounded-md bg-panel/60 px-3 py-3 text-center sm:grid-cols-4">
          <SummaryTile value={totalGrains} label="Total grains" />
          <SummaryTile value={aggregated.length} label="Pollen types" />
          <SummaryTile value={`${Math.round(overallConfidence * 100)}%`} label="Avg. confidence" />
          <SummaryTile
            value={report.slides.length}
            label={report.slides.length === 1 ? "Slide" : "Slides"}
          />
        </div>

        {aggregated.length === 0 ? (
          <p className="rounded-md border border-panel-line bg-white px-3 py-4 text-center text-[13px] text-ink/70">
            No pollen grains detected in this report.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {aggregated.map((detection) => (
              <DetectionRow key={detection.speciesId} detection={detection} />
            ))}
          </ul>
        )}
      </div>

      {/* Per slide: its reading on the left, the boxed image on the right */}
      <div className="rounded-lg border border-panel-line bg-white/60 p-5">
        <h3 className="mb-1 text-lg text-ink" style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>
          Specimen images
        </h3>
        <p className="mb-4 text-[13px] text-ink/70">
          {report.slides.length === 1
            ? "One slide in this report."
            : `${report.slides.length} slides in this report, each analyzed separately.`}{" "}
          Select a pollen type to box its grains on the slide.
        </p>

        <div className="flex flex-col gap-4">
          {report.slides.map((slide, index) => {
            const slideGrains = getTotalGrains(slide.detections);
            const selectedSpecies = highlighted[slide.id] ?? null;
            const select = (speciesId: SpeciesId | null) =>
              setHighlighted((current) => ({ ...current, [slide.id]: speciesId }));

            return (
              <div key={slide.id} className="rounded-lg border border-panel-line bg-white p-4">
                <div className="mb-3 flex flex-wrap items-center gap-3 text-[13px]">
                  <span
                    className="rounded-full bg-panel px-2.5 py-1 text-[12px] text-ink/70"
                    style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}
                  >
                    Slide {index + 1}
                  </span>
                  <span className="flex items-center gap-1.5 text-ink/70">
                    <Microscope size={13} strokeWidth={1.75} className="text-ink/55" />
                    {slideGrains} {slideGrains === 1 ? "grain" : "grains"} ·{" "}
                    {slide.detections.length}{" "}
                    {slide.detections.length === 1 ? "type" : "types"}
                  </span>
                </div>

                <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-5">
                  <div className="min-w-0 xl:col-span-3">
                    {slide.detections.length === 0 ? (
                      <p className="text-[13px] text-ink/70">No pollen grains detected.</p>
                    ) : (
                      <ul className="flex flex-col gap-2">
                        {slide.detections.map((detection) => (
                          <DetectionRow
                            key={detection.speciesId}
                            detection={detection}
                            selected={selectedSpecies === detection.speciesId}
                            onSelect={() =>
                              select(
                                selectedSpecies === detection.speciesId
                                  ? null
                                  : detection.speciesId,
                              )
                            }
                          />
                        ))}
                      </ul>
                    )}

                    <div className="mt-4">
                      <div
                        className="mb-1 text-[12px] tracking-widest text-ink/65 uppercase"
                        style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}
                      >
                        Researcher&apos;s note
                      </div>
                      {slide.notes ? (
                        <p className="text-[13px] whitespace-pre-wrap text-ink/80">{slide.notes}</p>
                      ) : (
                        <p className="text-[13px] text-ink/70">No note recorded.</p>
                      )}
                    </div>
                  </div>

                  <div className="min-w-0 xl:col-span-2">
                    <SpecimenImageViewer
                      imageUrl={imageUrls[slide.id]}
                      fileName={slide.fileName}
                      grains={slide.grains}
                      detections={slide.detections}
                      selectedSpeciesId={selectedSpecies}
                      onSelectSpecies={select}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[12.5px] text-ink/65">
        Collected {formatCollectedAt(report.collectedAt)} · saved as{" "}
        <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>{report.sampleId}</span>
      </p>
    </div>
  );
}
