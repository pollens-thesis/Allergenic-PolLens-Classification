"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarDays,
  CircleCheck,
  Clock,
  CloudOff,
  CloudSun,
  Download,
  FileSpreadsheet,
  Flag,
  Trash2,
  Droplets,
  FileText,
  FlaskConical,
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
  getTotalGrains,
  getWeightedAvgConfidence,
  type SpeciesId,
  type Specimen,
  type SpecimenDetection,
} from "@/lib/data";
import { findSpecies, useSpeciesCatalog } from "@/lib/species-catalog";
import {
  deleteReport,
  getReport,
  getReportImageBlobs,
  getReportImageUrls,
  updateReport,
} from "@/lib/store";
import { exportReportsXlsx } from "@/lib/export";
import { SessionExpiredError } from "@/lib/api";
import RiskBadge from "@/components/RiskBadge";
import { downloadReportPdf } from "@/lib/pdf";
import StatusBadge from "@/components/StatusBadge";
import SpecimenImageViewer from "@/components/SpecimenImageViewer";
import SpecimenInspector from "@/components/SpecimenInspector";
import { overlayColor, overlayColors, type OverlayColors } from "@/lib/slide-colors";
import { Button } from "@/components/Button";

/**
 * One pollen type in a reading. When `onSelect` is given the row doubles as the
 * control for the slide's overlay: picking a type boxes its grains on the image.
 */
function DetectionRow({
  detection,
  colors,
  selected = false,
  onSelect,
}: {
  detection: SpecimenDetection;
  /** Overlay colours, so the swatch matches this type's boxes on the images. */
  colors: OverlayColors;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const speciesCatalog = useSpeciesCatalog();
  const species = findSpecies(speciesCatalog, detection.speciesId);
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
          className="h-3 w-3 shrink-0 rounded-[2px] ring-1 ring-black/20"
          style={{ backgroundColor: overlayColor(colors, detection.speciesId) }}
        />
        {/* Name, code and risk wrap as whole words inside the row's own width, so a
            half-width slide column never breaks a binomial or runs it into the badge. */}
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 text-left">
          <span
            className="text-[15.5px] whitespace-nowrap text-text italic"
            style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
          >
            {species.scientificName}
          </span>
          <span
            className="text-[11.5px] tracking-wider text-text-muted"
            style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}
          >
            {species.code}
          </span>
          {species.commonName && <span className="text-[13px] text-text-muted">{species.commonName}</span>}
          <RiskBadge level={species.riskLevel} className="shrink-0" />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-4 pl-5 sm:pl-0">
        <div className="text-left sm:text-right">
          <span
            className="text-[14px] text-text"
            style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}
          >
            {detection.grainCount}
          </span>
          <span className="ml-1 text-[11.5px] text-text-faint sm:ml-0 sm:block">
            {detection.grainCount === 1 ? "grain" : "grains"}
          </span>
        </div>
        <div className="w-24 flex-1 sm:flex-none">
          <div className="mb-1 flex items-center justify-between text-[11.5px] text-text-muted">
            <span>conf.</span>
            <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>{confidencePct}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
            <div className="h-full rounded-full bg-text/75" style={{ width: `${confidencePct}%` }} />
          </div>
        </div>
      </div>
    </div>
  );

  if (!onSelect) {
    return <li className="rounded-md border border-border bg-surface px-3 py-2.5">{body}</li>;
  }

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={`focus-ring block w-full rounded-md border px-3 py-2.5 transition-colors duration-[var(--duration-fast)] ${
          selected
            ? "border-accent bg-accent-muted"
            : "border-border bg-surface hover:border-border-strong"
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
      <Icon size={15} strokeWidth={1.75} className="mt-0.5 shrink-0 text-text-faint" />
      <div className="min-w-0">
        <div className="caption-label text-[14.5px]" >
          {label}
        </div>
        <div className="text-[13px] text-text">{value}</div>
      </div>
    </div>
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

export default function ReportDetail({ sampleId }: { sampleId: string }) {
  const [report, setReport] = useState<Specimen | null | undefined>(undefined);
  const speciesCatalog = useSpeciesCatalog();
  // The pollen type each slide's overlay is isolating, keyed by slide id.
  const [highlighted, setHighlighted] = useState<Record<string, SpeciesId | null>>({});
  const [downloading, setDownloading] = useState<"pdf" | "xlsx" | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  // Presigned image links expire (1 h); one refetch per page view renews them.
  const refreshedImages = useRef(false);
  const router = useRouter();
  // Which slide (and type) the full-screen inspector opened on; null = closed.
  const [inspector, setInspector] = useState<{ slideId: string; speciesId: SpeciesId | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getReport(sampleId)
      .then((found) => {
        if (!cancelled) setReport(found);
      })
      .catch((error: unknown) => {
        if (cancelled || error instanceof SessionExpiredError) return;
        setLoadError(error instanceof Error ? error.message : "Couldn't load this report.");
      });
    return () => {
      cancelled = true;
    };
  }, [sampleId]);

  /** A slide image failed to load — most likely its signed link expired. */
  function handleImageError() {
    if (refreshedImages.current) return;
    refreshedImages.current = true;
    getReport(sampleId)
      .then((found) => found && setReport(found))
      .catch(() => {});
  }

  async function changeStatus(status: "Completed" | "Needs review") {
    if (!report) return;
    setChanging(true);
    try {
      setReport(await updateReport(report.sampleId, { status }));
      toast.success(status === "Completed" ? "Marked as completed" : "Flagged for review");
    } catch (error) {
      if (!(error instanceof SessionExpiredError)) {
        toast.error(error instanceof Error ? error.message : "Couldn't change the status.");
      }
    } finally {
      setChanging(false);
    }
  }

  async function handleDelete() {
    if (!report) return;
    setChanging(true);
    try {
      await deleteReport(report.sampleId);
    } catch (error) {
      setChanging(false);
      if (!(error instanceof SessionExpiredError)) {
        toast.error(error instanceof Error ? error.message : "Couldn't delete the report.");
      }
      return;
    }
    toast.success(`Report ${report.sampleId} deleted`);
    router.push("/reports");
  }

  // Server-hosted URLs, straight off the report — no object-URL lifecycle needed.
  const imageUrls = useMemo(() => (report ? getReportImageUrls(report) : {}), [report]);

  async function handleDownloadPdf() {
    if (!report) return;
    setDownloading("pdf");
    try {
      const blobs = await getReportImageBlobs(report);
      await downloadReportPdf(report, blobs);
      const missing = report.slides.filter((slide) => slide.imageUrl && !blobs[slide.id]).length;
      if (missing > 0) {
        toast.warning(
          `${missing} slide ${missing === 1 ? "image" : "images"} couldn't be fetched and ${
            missing === 1 ? "is" : "are"
          } left out of the PDF.`,
        );
      }
    } catch {
      toast.error("Couldn't build the PDF.");
    } finally {
      setDownloading(null);
    }
  }

  async function handleDownloadXlsx() {
    if (!report) return;
    setDownloading("xlsx");
    try {
      await exportReportsXlsx([report], `${report.sampleId}.xlsx`);
    } catch {
      toast.error("Couldn't build the Excel file.");
    } finally {
      setDownloading(null);
    }
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
        Loading report…
      </div>
    );
  }

  if (report === null) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface px-6 py-16 text-center">
        <FileText size={22} strokeWidth={1.5} className="text-text-faint" />
        <p className="text-[13.5px] text-text-muted">
          No report found for{" "}
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>{sampleId}</span>.
        </p>
        <Link
          href="/reports"
          className="focus-ring inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-[13px] text-text-muted transition-colors hover:text-text"
        >
          <ArrowLeft size={14} strokeWidth={1.75} />
          Back to Reports
        </Link>
      </div>
    );
  }

  const aggregated = aggregateSlideDetections(report.slides);
  // One palette for the whole report: a type keeps its colour on every slide.
  const colors = overlayColors(aggregated);
  const totalGrains = getTotalGrains(aggregated);
  const overallConfidence = getWeightedAvgConfidence(aggregated);
  const collectionTime = getCollectionTime(report.collectedAt);
  const weather = report.weather;

  return (
    <div className="flex flex-col gap-6">
      {report.sampleDetections && (
        <p className="flex items-start gap-2 rounded-md border border-processing/30 bg-processing-bg px-3 py-2.5 text-[12.5px] text-processing">
          <FlaskConical size={14} strokeWidth={2} className="mt-px shrink-0" />
          Sample detections — this report was analyzed while the trained model wasn&apos;t
          deployed, so its counts are the server&apos;s built-in example reading, not results.
        </p>
      )}
      {/* Header */}
      <div className="rounded-lg border border-border bg-surface p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-semibold text-text">
              {report.location || "Location not recorded"}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={report.status} />
              <span className="text-[12.5px] text-text-muted">
                Analyzed {new Date(report.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 md:max-w-[55%] md:shrink-0 md:justify-end">
            {report.status === "Pending" && report.canEdit && (
              <Link
                href={`/upload/result?report=${report.sampleId}`}
                className="focus-ring inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-2 text-[13px] font-medium text-accent-fg hover:bg-[var(--accent-hover)]"
              >
                Resume Analysis
              </Link>
            )}
            {report.canEdit && report.status === "Completed" && (
              <Button type="button" intent="secondary" size="sm" disabled={changing} onClick={() => changeStatus("Needs review")}>
                <Flag size={14} strokeWidth={1.75} />
                Flag for Review
              </Button>
            )}
            {report.canEdit && report.status === "Needs review" && (
              <Button type="button" intent="secondary" size="sm" disabled={changing} onClick={() => changeStatus("Completed")}>
                <CircleCheck size={14} strokeWidth={1.75} />
                Mark Completed
              </Button>
            )}
            {report.canEdit && (
              <AlertDialog.Root open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialog.Trigger
                  disabled={changing}
                  className="focus-ring inline-flex items-center gap-1.5 rounded-md border border-danger/30 bg-surface px-3 py-1.5 text-[13px] text-danger hover:bg-danger-bg disabled:opacity-40"
                >
                  <Trash2 size={14} strokeWidth={1.75} />
                  Delete
                </AlertDialog.Trigger>
                <AlertDialog.Portal>
                  <AlertDialog.Backdrop className="fixed inset-0 z-40 bg-black/40 transition-opacity duration-[var(--duration-base)] ease-[var(--ease-out)] data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
                  <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-surface p-5 shadow-lg outline-none transition-all duration-[var(--duration-base)] ease-[var(--ease-out)] data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0">
                    <AlertDialog.Title className="text-[15px] font-medium text-text">
                      Delete report {report.sampleId}?
                    </AlertDialog.Title>
                    <AlertDialog.Description className="mt-2 text-[13px] leading-relaxed text-text-muted">
                      This permanently deletes the report and its {report.slides.length}{" "}
                      {report.slides.length === 1 ? "slide image" : "slide images"} for every
                      researcher. It can&apos;t be undone.
                    </AlertDialog.Description>
                    <div className="mt-4 flex justify-end gap-2">
                      <AlertDialog.Close className="focus-ring rounded-md border border-border bg-surface px-3 py-1.5 text-[13px] text-text-muted hover:text-text">
                        Cancel
                      </AlertDialog.Close>
                      <Button type="button" intent="destructive" size="sm" disabled={changing} onClick={handleDelete}>
                        <Trash2 size={13} strokeWidth={1.75} />
                        Delete Report
                      </Button>
                    </div>
                  </AlertDialog.Popup>
                </AlertDialog.Portal>
              </AlertDialog.Root>
            )}
            <Button type="button" intent="secondary" size="sm" onClick={handleDownloadXlsx} disabled={downloading !== null}>
              {downloading === "xlsx" ? (
                <Loader2 size={14} strokeWidth={1.75} className="animate-spin" />
              ) : (
                <FileSpreadsheet size={14} strokeWidth={1.75} />
              )}
              Excel
            </Button>
            <Button type="button" size="sm" intent="accent" onClick={handleDownloadPdf} disabled={downloading !== null}>
              {downloading === "pdf" ? (
                <>
                  <Loader2 size={14} strokeWidth={1.75} className="animate-spin" />
                  Building PDF…
                </>
              ) : (
                <>
                  <Download size={14} strokeWidth={1.75} />
                  Download PDF
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Combined results */}
      <div className="rounded-lg border border-border bg-surface p-5">
        <h3 className="mb-4 text-lg text-text" style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>
          Results
        </h3>

        <div className="mb-4 grid grid-cols-2 gap-3 rounded-md bg-surface-sunken px-3 py-3 text-center sm:grid-cols-4">
          <SummaryTile value={totalGrains} label="Total Grains" />
          <SummaryTile value={aggregated.length} label="Pollen Types" />
          <SummaryTile value={`${Math.round(overallConfidence * 100)}%`} label="Avg. Confidence" />
          <SummaryTile
            value={report.slides.length}
            label={report.slides.length === 1 ? "Slide" : "Slides"}
          />
        </div>

        {aggregated.length === 0 ? (
          <p className="rounded-md border border-border bg-surface px-3 py-4 text-center text-[13px] text-text-muted">
            No pollen grains detected in this report.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {aggregated.map((detection) => (
              <DetectionRow key={detection.speciesId} detection={detection} colors={colors} />
            ))}
          </ul>
        )}
      </div>

      {/* Everything the researcher entered on the Analyze screen. */}
      <div className="rounded-lg border border-border bg-surface p-5">
        <h3 className="text-lg text-text" style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>
          Collection Details
        </h3>
        <p className="mt-0.5 mb-4 text-[13px] text-text-muted">
          Recorded with the batch when it was analyzed and reviewed.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetaItem
            icon={CalendarDays}
            label="Date Collected"
            value={new Date(`${getCollectionDate(report.collectedAt)}T00:00:00`).toLocaleDateString(
              "en-US",
              { month: "short", day: "numeric", year: "numeric" },
            )}
          />
          <MetaItem
            icon={Clock}
            label="Time Collected"
            value={collectionTime ? formatTime(collectionTime) : "Not recorded"}
          />
          <MetaItem icon={MapPin} label="Location" value={report.location || "Not specified"} />
          <MetaItem icon={User} label="Researcher" value={report.researcher} />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-4">
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

      {/* Per slide: its reading on the left, the boxed image on the right */}
      <div className="rounded-lg border border-border bg-surface p-5">
        <h3 className="mb-1 text-lg text-text" style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>
          Specimen Images
        </h3>
        <p className="mb-4 text-[13px] text-text-muted">
          {report.slides.length === 1
            ? "One slide in this report."
            : `${report.slides.length} slides in this report, each analyzed separately.`}{" "}
          Select a pollen type to box its grains on the slide.
        </p>

        <div className="flex flex-col gap-5">
          {report.slides.map((slide, index) => {
            const slideGrains = getTotalGrains(slide.detections);
            const selectedSpecies = highlighted[slide.id] ?? null;
            const select = (speciesId: SpeciesId | null) =>
              setHighlighted((current) => ({ ...current, [slide.id]: speciesId }));

            return (
              <div key={slide.id} className="border-t border-border pt-5 first:border-t-0 first:pt-0">
                <div className="mb-3 flex flex-wrap items-center gap-3 text-[13px]">
                  <span className="plate-label text-[16px]">Slide {index + 1}</span>
                  <span className="flex items-center gap-1.5 text-text-muted">
                    <Microscope size={13} strokeWidth={1.75} className="text-text-faint" />
                    {slideGrains} {slideGrains === 1 ? "grain" : "grains"} ·{" "}
                    {slide.detections.length}{" "}
                    {slide.detections.length === 1 ? "type" : "types"}
                  </span>
                </div>

                <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                  <div className="min-w-0">
                    {slide.detections.length === 0 ? (
                      <p className="text-[13px] text-text-muted">No pollen grains detected.</p>
                    ) : (
                      <ul className="flex flex-col gap-2">
                        {slide.detections.map((detection) => (
                          <DetectionRow
                            key={detection.speciesId}
                            detection={detection}
                            colors={colors}
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
                        className="caption-label text-[14.5px] mb-1"
                        
                      >
                        Researcher&apos;s Note
                      </div>
                      {slide.notes ? (
                        <p className="text-[13px] whitespace-pre-wrap text-text">{slide.notes}</p>
                      ) : (
                        <p className="text-[13px] text-text-muted">No note recorded.</p>
                      )}
                    </div>
                  </div>

                  <div className="min-w-0">
                    <SpecimenImageViewer
                      imageUrl={imageUrls[slide.id]}
                      fileName={slide.fileName}
                      grains={slide.grains}
                      detections={slide.detections}
                      colors={colors}
                      selectedSpeciesId={selectedSpecies}
                      onSelectSpecies={select}
                      onExpand={() =>
                        setInspector({ slideId: slide.id, speciesId: selectedSpecies })
                      }
                      onImageError={handleImageError}
                      caption={
                        <>
                          <span className="plate-label mr-1.5">Slide {index + 1}</span>
                          {slide.fileName} · {slideGrains} {slideGrains === 1 ? "grain" : "grains"}
                          {slide.detections[0] && (
                            <>
                              {" "}· mostly{" "}
                              <i>{findSpecies(speciesCatalog, slide.detections[0].speciesId).scientificName}</i>
                            </>
                          )}
                        </>
                      }
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <SpecimenInspector
        open={inspector !== null}
        onOpenChange={(open) => {
          if (!open) setInspector(null);
        }}
        colors={colors}
        initialSlideId={inspector?.slideId}
        initialSpeciesId={inspector?.speciesId ?? null}
        slides={report.slides.map((slide, index) => ({
          id: slide.id,
          label: `Slide ${index + 1}`,
          fileName: slide.fileName,
          imageUrl: imageUrls[slide.id],
          grains: slide.grains,
          detections: slide.detections,
        }))}
      />

      <p className="text-[12.5px] text-text-faint">
        Collected {formatCollectedAt(report.collectedAt)} · report{" "}
        <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>{report.sampleId}</span>
      </p>
    </div>
  );
}
