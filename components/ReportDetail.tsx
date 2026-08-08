"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  CloudSun,
  Download,
  FileText,
  ImageOff,
  Loader2,
  MapPin,
  Microscope,
  User,
} from "lucide-react";
import {
  aggregateSlideDetections,
  formatCollectedAt,
  formatWeather,
  getSpecies,
  getTotalGrains,
  getWeightedAvgConfidence,
  type Specimen,
  type SpecimenDetection,
} from "@/lib/data";
import { getReport, getReportImageBlobs, getReportImageUrls } from "@/lib/store";
import { downloadReportPdf } from "@/lib/pdf";
import StatusBadge from "@/components/StatusBadge";

function riskBadgeClass(level: "High" | "Moderate" | "Low") {
  if (level === "High") return "bg-[#b3492f]/10 text-[#b3492f]";
  if (level === "Moderate") return "bg-anther/10 text-anther";
  return "bg-[#3f7a4f]/10 text-[#3f7a4f]";
}

function DetectionRow({ detection }: { detection: SpecimenDetection }) {
  const species = getSpecies(detection.speciesId);
  const confidencePct = Math.round(detection.avgConfidence * 100);

  return (
    <li className="rounded-md border border-panel-line bg-white px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: species.color }}
          />
          <div className="min-w-0">
            <span
              className="mr-2 text-[10.5px] tracking-widest text-ink/45 uppercase"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {species.code}
            </span>
            <span className="text-[14px] text-ink" style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}>
              {species.genus}
            </span>
            <span className="ml-1.5 text-[12.5px] text-ink/55">{species.commonName}</span>
          </div>
          <span
            className={`hidden shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap sm:inline-flex ${riskBadgeClass(species.riskLevel)}`}
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {species.riskLevel} risk
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-4">
          <div className="text-right">
            <div className="text-[14px] text-ink" style={{ fontFamily: "var(--font-mono)" }}>
              {detection.grainCount}
            </div>
            <div className="text-[10.5px] text-ink/45">
              {detection.grainCount === 1 ? "grain" : "grains"}
            </div>
          </div>
          <div className="w-24">
            <div className="mb-1 flex items-center justify-between text-[10.5px] text-ink/50">
              <span>conf.</span>
              <span style={{ fontFamily: "var(--font-mono)" }}>{confidencePct}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel-line">
              <div className="h-full rounded-full bg-anther" style={{ width: `${confidencePct}%` }} />
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}

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
      <Icon size={15} strokeWidth={1.75} className="mt-0.5 shrink-0 text-ink/35" />
      <div className="min-w-0">
        <div className="text-[11px] tracking-widest text-ink/45 uppercase" style={{ fontFamily: "var(--font-mono)" }}>
          {label}
        </div>
        <div className="text-[13px] text-ink/85">{value}</div>
      </div>
    </div>
  );
}

export default function ReportDetail({ sampleId }: { sampleId: string }) {
  const [report, setReport] = useState<Specimen | null | undefined>(undefined);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
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
      <div className="flex items-center justify-center gap-2 rounded-lg border border-panel-line bg-white/60 px-6 py-16 text-[13px] text-ink/45">
        <Loader2 size={16} strokeWidth={1.75} className="animate-spin" />
        Loading report…
      </div>
    );
  }

  if (report === null) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-panel-line bg-white/60 px-6 py-16 text-center">
        <FileText size={22} strokeWidth={1.5} className="text-ink/25" />
        <p className="text-[13.5px] text-ink/60">
          No report found for{" "}
          <span style={{ fontFamily: "var(--font-mono)" }}>{sampleId}</span>.
        </p>
        <Link
          href="/history"
          className="focus-ring inline-flex items-center gap-1.5 rounded-md border border-panel-line bg-white px-3 py-1.5 text-[13px] text-ink/70 transition hover:text-ink"
        >
          <ArrowLeft size={14} strokeWidth={1.75} />
          Back to History
        </Link>
      </div>
    );
  }

  const aggregated = aggregateSlideDetections(report.slides);
  const totalGrains = getTotalGrains(aggregated);
  const overallConfidence = getWeightedAvgConfidence(aggregated);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="rounded-lg border border-panel-line bg-white/60 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div
              className="text-[11px] tracking-widest text-ink/45 uppercase"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {report.sampleId}
            </div>
            <h2
              className="mt-1 text-2xl text-ink"
              style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}
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

        <div className="mt-5 grid grid-cols-1 gap-4 border-t border-panel-line pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetaItem icon={CalendarDays} label="Collected" value={formatCollectedAt(report.collectedAt)} />
          <MetaItem icon={MapPin} label="Location" value={report.location || "Not specified"} />
          <MetaItem icon={User} label="Researcher" value={report.researcher} />
          <MetaItem icon={CloudSun} label="Weather conditions" value={formatWeather(report.weather)} />
        </div>
      </div>

      {/* Combined results */}
      <div className="rounded-lg border border-panel-line bg-white/60 p-5">
        <h3 className="mb-4 text-lg text-ink" style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}>
          Results
        </h3>

        <div className="mb-4 grid grid-cols-2 gap-3 rounded-md bg-panel/60 px-3 py-3 text-center sm:grid-cols-4">
          <div>
            <div className="text-[17px] text-ink" style={{ fontFamily: "var(--font-mono)" }}>
              {totalGrains}
            </div>
            <div className="text-[11px] text-ink/45">Total grains</div>
          </div>
          <div>
            <div className="text-[17px] text-ink" style={{ fontFamily: "var(--font-mono)" }}>
              {aggregated.length}
            </div>
            <div className="text-[11px] text-ink/45">Pollen types</div>
          </div>
          <div>
            <div className="text-[17px] text-ink" style={{ fontFamily: "var(--font-mono)" }}>
              {Math.round(overallConfidence * 100)}%
            </div>
            <div className="text-[11px] text-ink/45">Avg. confidence</div>
          </div>
          <div>
            <div className="text-[17px] text-ink" style={{ fontFamily: "var(--font-mono)" }}>
              {report.slides.length}
            </div>
            <div className="text-[11px] text-ink/45">
              {report.slides.length === 1 ? "Slide" : "Slides"}
            </div>
          </div>
        </div>

        {aggregated.length === 0 ? (
          <p className="rounded-md border border-panel-line bg-white px-3 py-4 text-center text-[12.5px] text-ink/50">
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

      {/* Per slide: image, its own reading, its own note */}
      <div className="rounded-lg border border-panel-line bg-white/60 p-5">
        <h3 className="mb-1 text-lg text-ink" style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}>
          Specimen images
        </h3>
        <p className="mb-4 text-[12.5px] text-ink/50">
          {report.slides.length === 1
            ? "One slide in this report."
            : `${report.slides.length} slides in this report, each analyzed separately.`}
        </p>

        <div className="flex flex-col gap-4">
          {report.slides.map((slide, index) => {
            const url = imageUrls[slide.id];
            const slideGrains = getTotalGrains(slide.detections);

            return (
              <div key={slide.id} className="rounded-lg border border-panel-line bg-white p-4">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[16rem_1fr]">
                  <div>
                    {url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={url}
                        alt={`Slide ${index + 1} — ${slide.fileName}`}
                        className="max-h-56 w-full rounded-md border border-panel-line bg-panel object-contain"
                      />
                    ) : (
                      <div className="flex h-40 w-full flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-panel-line bg-panel/50 text-center">
                        <ImageOff size={18} strokeWidth={1.5} className="text-ink/25" />
                        <span className="px-3 text-[11.5px] text-ink/40">
                          Image not stored for this record
                        </span>
                      </div>
                    )}
                    <div className="mt-2 truncate text-[12px] text-ink/50">{slide.fileName}</div>
                  </div>

                  <div className="min-w-0">
                    <div className="mb-3 flex flex-wrap items-center gap-3 text-[12.5px]">
                      <span
                        className="rounded-full bg-panel px-2.5 py-1 text-[11px] text-ink/70"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        Slide {index + 1}
                      </span>
                      <span className="flex items-center gap-1.5 text-ink/60">
                        <Microscope size={13} strokeWidth={1.75} className="text-ink/35" />
                        {slideGrains} {slideGrains === 1 ? "grain" : "grains"} ·{" "}
                        {slide.detections.length}{" "}
                        {slide.detections.length === 1 ? "type" : "types"}
                      </span>
                    </div>

                    {slide.detections.length === 0 ? (
                      <p className="text-[12.5px] text-ink/50">No pollen grains detected.</p>
                    ) : (
                      <ul className="flex flex-col gap-2">
                        {slide.detections.map((detection) => (
                          <DetectionRow key={detection.speciesId} detection={detection} />
                        ))}
                      </ul>
                    )}

                    <div className="mt-3">
                      <div
                        className="mb-1 text-[11px] tracking-widest text-ink/45 uppercase"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        Researcher&apos;s note
                      </div>
                      {slide.notes ? (
                        <p className="text-[13px] whitespace-pre-wrap text-ink/80">{slide.notes}</p>
                      ) : (
                        <p className="text-[12.5px] text-ink/40">No note recorded.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
