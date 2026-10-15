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
  CloudOff,
  Download,
  FileSpreadsheet,
  Flag,
  Trash2,
  FileText,
  FlaskConical,
  Loader2,
  MapPin,
  Microscope,
  Pencil,
  Save,
  User,
  X,
} from "lucide-react";
import {
  aggregateSlideDetections,
  formatCollectedAt,
  getCollectionDate,
  getConfidenceGrainCount,
  getReviewedDetections,
  getTotalGrains,
  getWeightedAvgConfidence,
  type GrainAnnotation,
  type SpeciesId,
  type Specimen,
  type SpecimenDetection,
  type SpecimenSlide,
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
import { BRAND_NAME } from "@/lib/brand";
import { SessionExpiredError } from "@/lib/api";
import RiskBadge from "@/components/RiskBadge";
import SummaryTile from "@/components/SummaryTile";
import SpeciesName from "@/components/SpeciesName";
import { downloadReportPdf } from "@/lib/pdf";
import StatusBadge, { SampleBadge } from "@/components/StatusBadge";
import GrainReviewEditor from "@/components/GrainReviewEditor";
import SpecimenImageViewer from "@/components/SpecimenImageViewer";
import SpecimenInspector from "@/components/SpecimenInspector";
import { overlayColor, overlayColors, type OverlayColors } from "@/lib/slide-colors";
import { Button, buttonVariants } from "@/components/Button";

/**
 * One pollen type in a reading. When `onSelect` is given the row doubles as the
 * control for the slide's overlay: picking a type boxes its grains on the image.
 */
function DetectionRow({
  detection,
  colors,
  selected = false,
  compact = false,
  onSelect,
}: {
  detection: SpecimenDetection;
  /** Overlay colours, so the swatch matches this type's boxes on the images. */
  colors: OverlayColors;
  selected?: boolean;
  compact?: boolean;
  onSelect?: () => void;
}) {
  const speciesCatalog = useSpeciesCatalog();
  const species = findSpecies(speciesCatalog, detection.speciesId);
  const hasModelConfidence = getConfidenceGrainCount(detection) > 0;
  const confidencePct = Math.round(detection.avgConfidence * 100);

  /**
   * One line on a wide row, two on a narrow one. Side by side, the name and the
   * figures collide below about 480px — the name has no fixed width and the
   * confidence bar does — so on small screens the figures move underneath
   * instead of being squeezed into the name.
   */
  const body = (
    <div className={`flex flex-col gap-2 ${compact ? "" : "sm:flex-row sm:items-center sm:justify-between sm:gap-3"}`}>
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
            className={`text-[15.5px] text-text italic ${compact ? "whitespace-normal" : "whitespace-nowrap"}`}
            style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
          >
            {species.scientificName}
          </span>
          <span
            className="text-[12px] tracking-wider text-text-muted"
            style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}
          >
            {species.code}
          </span>
          {species.commonName && <span className="text-[13px] text-text-muted">{species.commonName}</span>}
          <RiskBadge level={species.riskLevel} className="shrink-0" />
        </div>
      </div>

      <div className={`flex shrink-0 items-center gap-4 pl-5 ${compact ? "" : "sm:pl-0"}`}>
        <div className={`text-left ${compact ? "" : "sm:text-right"}`}>
          <span
            className="text-[14px] text-text"
            style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}
          >
            {detection.grainCount.toLocaleString()}
          </span>
          <span className={`ml-1 text-[12px] text-text-muted ${compact ? "" : "sm:ml-0 sm:block"}`}>
            {detection.grainCount === 1 ? "grain" : "grains"}
          </span>
        </div>
        <div className={`w-24 flex-1 ${compact ? "" : "sm:flex-none"}`}>
          <div className="mb-1 flex items-center justify-between text-[12px] text-text-muted">
            <span>Model confidence</span>
            <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>{hasModelConfidence ? `${confidencePct}%` : "—"}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
            {hasModelConfidence && <div className="h-full rounded-full bg-text/75" style={{ width: `${confidencePct}%` }} />}
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

function reviewedGrains(slide: SpecimenSlide) {
  const annotationByGrainId = new Map(
    (slide.annotations ?? [])
      .filter((annotation) => annotation.grainId)
      .map((annotation) => [annotation.grainId!, annotation]),
  );
  const excludedIds = new Set(
    (slide.annotations ?? [])
      .filter((annotation) => annotation.kind === "false_positive" && annotation.grainId)
      .map((annotation) => annotation.grainId),
  );
  const modelGrains = slide.grains?.filter((grain) => !excludedIds.has(grain.id)).map((grain) => {
    const annotation = annotationByGrainId.get(grain.id);
    if (!annotation) return grain;
    return {
      ...grain,
      speciesId: annotation.kind === "corrected" && annotation.speciesId
        ? annotation.speciesId
        : grain.speciesId,
      box: annotation.box,
    };
  }) ?? [];
  const missedGrains = (slide.annotations ?? [])
    .filter((annotation) => annotation.kind === "missed" && annotation.speciesId)
    .map((annotation, index) => ({
      id: `M${index + 1}`,
      speciesId: annotation.speciesId!,
      confidence: 0,
      box: annotation.box,
      source: "manual" as const,
    }));
  return [...modelGrains, ...missedGrains];
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
        <div className="caption-label text-[13px]" >
          {label}
        </div>
        <div className="text-[13px] text-text">{value}</div>
      </div>
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
  const [editingNoteSlideId, setEditingNoteSlideId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [completeReviewOpen, setCompleteReviewOpen] = useState(false);
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
      if (status === "Completed") setCompleteReviewOpen(false);
      toast.success(
        status === "Completed" ? `Report ${report.sampleId} marked Completed` : `Report ${report.sampleId} flagged Needs Review`,
      );
    } catch (error) {
      if (!(error instanceof SessionExpiredError)) {
        toast.error(error instanceof Error ? error.message : "Couldn't change the status.");
      }
    } finally {
      setChanging(false);
    }
  }

  function handleAnnotationSaved(slideId: string, annotation: GrainAnnotation) {
    setReport((current) => current && ({
      ...current,
      slides: current.slides.map((slide) => {
        if (slide.id !== slideId) return slide;
        const annotations = slide.annotations ?? [];
        const existing = annotations.findIndex((entry) =>
          entry.id === annotation.id ||
          (annotation.grainId !== null && entry.grainId === annotation.grainId),
        );
        const next = [...annotations];
        if (existing >= 0) next[existing] = annotation;
        else next.push(annotation);
        return {
          ...slide,
          annotations: next,
          detections: getReviewedDetections(
            slide.modelDetections ?? slide.detections,
            slide.grains,
            next,
          ),
        };
      }),
    }));
  }

  function handleAnnotationRemoved(slideId: string, annotationId: string) {
    setReport((current) => current && ({
      ...current,
      slides: current.slides.map((slide) => slide.id === slideId
        ? (() => {
            const annotations = (slide.annotations ?? []).filter((entry) => entry.id !== annotationId);
            return {
              ...slide,
              annotations,
              detections: getReviewedDetections(
                slide.modelDetections ?? slide.detections,
                slide.grains,
                annotations,
              ),
            };
          })()
        : slide),
    }));
  }

  function editSlideNote(slide: SpecimenSlide) {
    if (savingNote || (editingNoteSlideId && editingNoteSlideId !== slide.id)) return;
    setEditingNoteSlideId(slide.id);
    setNoteDraft(slide.notes);
  }

  function cancelSlideNote() {
    setEditingNoteSlideId(null);
    setNoteDraft("");
  }

  async function saveSlideNote(slide: SpecimenSlide) {
    if (!report || !report.canEdit || report.sampleDetections || savingNote) return;
    const notes = noteDraft.trim();
    setSavingNote(true);
    try {
      setReport(await updateReport(report.sampleId, { notes: { [slide.id]: notes } }));
      cancelSlideNote();
      toast.success(notes ? "Slide note saved" : "Slide note cleared");
    } catch (error) {
      if (!(error instanceof SessionExpiredError)) {
        toast.error(error instanceof Error ? error.message : "Couldn't save the slide note.");
      }
    } finally {
      setSavingNote(false);
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
    if (!report || report.status !== "Completed") return;
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
      toast.error("Couldn't build the PDF. Try again.");
    } finally {
      setDownloading(null);
    }
  }

  async function handleDownloadXlsx() {
    if (!report || report.status !== "Completed") return;
    setDownloading("xlsx");
    try {
      await exportReportsXlsx([report], `${BRAND_NAME}-${report.sampleId}.xlsx`);
    } catch {
      toast.error("Couldn't build the Excel file. Try again.");
    } finally {
      setDownloading(null);
    }
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
        Loading report…
      </div>
    );
  }

  if (report === null) {
    return (
      <div className="card-panel flex flex-col items-center gap-3 px-6 py-16 text-center">
        <FileText size={22} strokeWidth={1.5} className="text-text-faint" />
        <p className="t-prose text-text-muted">
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
  const reportAnnotations = report.slides.flatMap((slide) => slide.annotations ?? []);
  const reviewedModelGrains = new Set(
    reportAnnotations.flatMap((annotation) => annotation.grainId ? [annotation.grainId] : []),
  ).size;
  const modelGrainCount = report.slides.reduce(
    (count, slide) => count + (slide.grains?.length ?? getTotalGrains(slide.detections)),
    0,
  );
  const unreviewedModelGrains = Math.max(0, modelGrainCount - reviewedModelGrains);

  return (
    <div className="flex flex-col gap-4">
      {report.sampleDetections && (
        <p className="flex items-center gap-2 rounded-md border border-processing/30 bg-processing-bg px-3 py-2 text-[12px] leading-snug text-processing">
          <FlaskConical size={14} strokeWidth={2} className="mt-px shrink-0" />
          Sample detections · The trained model wasn&apos;t deployed. Counts are illustrative.
        </p>
      )}
      {/* Header */}
      <div className="card-panel p-4 sm:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-semibold tracking-tight text-text">
              {report.reportName || report.location || "No location recorded"}
            </h2>
            {report.reportName && <p className="mt-1 text-[13px] text-text-muted">{report.location || "No location recorded"}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={report.status} />
              {report.sampleDetections && <SampleBadge />}
              <span className="text-[12.5px] text-text-muted" style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>{report.sampleId}</span>
              <span className="text-[12.5px] text-text-muted">
                Analyzed {new Date(report.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 md:max-w-[55%] md:shrink-0 md:justify-end">
            {report.status === "Pending" && report.canEdit && (
              <Link
                href={`/upload/result?report=${report.sampleId}`}
                className={`${buttonVariants({ intent: "resume", size: "sm" })} focus-ring`}
              >
                Resume Analysis
              </Link>
            )}
            {report.canEdit && report.status === "Completed" && (
              <Button type="button" intent="caution" size="sm" disabled={changing} onClick={() => changeStatus("Needs review")}>
                <Flag size={14} strokeWidth={1.75} />
                Flag for Review
              </Button>
            )}
            {report.canEdit && report.status === "Needs review" && (
              <Button type="button" intent="confirm" size="sm" disabled={changing} onClick={() => setCompleteReviewOpen(true)}>
                <CircleCheck size={14} strokeWidth={1.75} />
                Mark Completed
              </Button>
            )}
            {report.canEdit && (
              <AlertDialog.Root open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialog.Trigger
                  disabled={changing}
                  className={`${buttonVariants({ intent: "caution", size: "sm" })} focus-ring`}
                >
                  <Trash2 size={14} strokeWidth={1.75} />
                  Delete
                </AlertDialog.Trigger>
                <AlertDialog.Portal>
                  <AlertDialog.Backdrop className="fixed inset-0 z-40 bg-black/40 transition-opacity duration-[var(--duration-base)] ease-[var(--ease-out)] data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
                  <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-surface p-5 shadow-lg outline-none transition-all duration-[var(--duration-base)] ease-[var(--ease-out)] data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0">
                    <AlertDialog.Title className="t-plate-title text-text">
                      Delete report {report.sampleId}?
                    </AlertDialog.Title>
                    <AlertDialog.Description className="t-prose mt-2 text-text-muted">
                      This permanently deletes the report and its {report.slides.length}{" "}
                      {report.slides.length === 1 ? "slide image" : "slide images"} for every
                      researcher. It can&apos;t be undone.
                    </AlertDialog.Description>
                    <div className="mt-4 flex justify-end gap-2">
                      <AlertDialog.Close className="focus-ring rounded-md border border-border bg-surface px-3 py-1.5 text-[13px] text-text-muted hover:text-text">
                        Keep Report
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
            {report.canEdit && report.status === "Needs review" && (
              <AlertDialog.Root open={completeReviewOpen} onOpenChange={setCompleteReviewOpen}>
                <AlertDialog.Portal>
                  <AlertDialog.Backdrop className="fixed inset-0 z-40 bg-black/40 transition-opacity duration-[var(--duration-base)] ease-[var(--ease-out)] data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
                  <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-surface p-5 shadow-lg outline-none transition-all duration-[var(--duration-base)] ease-[var(--ease-out)] data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0">
                    <AlertDialog.Title className="t-plate-title text-text">
                      Complete review for {report.sampleId}?
                    </AlertDialog.Title>
                    <AlertDialog.Description className="t-prose mt-2 text-text-muted">
                      Confirm the report status after checking its slides. Verified non-pollen detections are removed from report counts; original model predictions remain available for review records.
                    </AlertDialog.Description>
                    <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-y border-border py-3 text-[13px] sm:grid-cols-3">
                      {([
                        ["Confirmed", "confirmed"],
                        ["Corrected", "corrected"],
                        ["False detections", "false_positive"],
                        ["Missed grains", "missed"],
                        ["Uncertain", "uncertain"],
                      ] as const).map(([label, kind]) => (
                        <div key={kind} className="flex justify-between gap-2">
                          <dt className="text-text-muted">{label}</dt>
                          <dd className="tabular-nums text-text" style={{ fontFamily: "var(--font-mono)" }}>
                            {reportAnnotations.filter((annotation) => annotation.kind === kind).length}
                          </dd>
                        </div>
                      ))}
                      <div className="flex justify-between gap-2">
                        <dt className="text-text-muted">Unannotated model grains</dt>
                        <dd className="tabular-nums text-text" style={{ fontFamily: "var(--font-mono)" }}>
                          {unreviewedModelGrains}
                        </dd>
                      </div>
                    </dl>
                    <p className="mt-3 text-[12.5px] text-text-muted">
                      Unannotated grains keep their model labels. The saved researcher corrections are available for later dataset preparation and retraining.
                    </p>
                    <div className="mt-4 flex justify-end gap-2">
                      <AlertDialog.Close className="focus-ring rounded-md border border-border bg-surface px-3 py-1.5 text-[13px] text-text-muted hover:text-text">
                        Continue Review
                      </AlertDialog.Close>
                      <Button type="button" intent="confirm" size="sm" disabled={changing} onClick={() => changeStatus("Completed")}>
                        <CircleCheck size={13} strokeWidth={1.75} />
                        Confirm and Complete
                      </Button>
                    </div>
                  </AlertDialog.Popup>
                </AlertDialog.Portal>
              </AlertDialog.Root>
            )}
            <Button
              type="button"
              intent="secondary"
              size="sm"
              onClick={handleDownloadXlsx}
              disabled={downloading !== null || report.status !== "Completed"}
              aria-describedby={report.status !== "Completed" ? "report-export-note" : undefined}
            >
              {downloading === "xlsx" ? (
                <Loader2 size={14} strokeWidth={1.75} className="animate-spin" />
              ) : (
                <FileSpreadsheet size={14} strokeWidth={1.75} />
              )}
              Export Excel
            </Button>
            <Button
              type="button"
              size="sm"
              intent="accent"
              onClick={handleDownloadPdf}
              disabled={downloading !== null || report.status !== "Completed"}
              aria-describedby={report.status !== "Completed" ? "report-export-note" : undefined}
            >
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
            {report.status !== "Completed" && (
              <p id="report-export-note" className="basis-full text-right text-[12px] text-text-muted">
                Only Completed reports can be exported. Mark this report Completed first.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Combined results */}
      <div className="card-panel p-4 sm:p-5">
        <h3 className="t-plate-title mb-4 text-text">
          Detections
        </h3>

        <div className="mb-4 grid grid-cols-2 gap-3 rounded-md bg-surface-sunken px-3 py-3 text-center sm:grid-cols-4">
          <SummaryTile value={totalGrains} label="Total Grains" />
          <SummaryTile value={aggregated.length} label="Pollen Types" />
          <SummaryTile value={overallConfidence === null ? "—" : `${Math.round(overallConfidence * 100)}%`} label="Avg. Model Confidence" />
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
      <div className="card-panel p-4 sm:p-5">
        <h3 className="t-plate-title text-text">
          Collection Details
        </h3>
        <p className="mt-0.5 mb-4 text-[13px] text-text-muted">
          Recorded with the batch when it was analyzed and reviewed.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetaItem icon={FileText} label="Report Name" value={report.reportName || report.sampleId} />
          <MetaItem
            icon={CalendarDays}
            label="Date Collected"
            value={new Date(`${getCollectionDate(report.collectedAt)}T00:00:00`).toLocaleDateString(
              "en-US",
              { month: "short", day: "numeric", year: "numeric" },
            )}
          />
          <MetaItem icon={MapPin} label="Location" value={report.location || "No location recorded"} />
          {report.canEdit && report.researcher && (
            <MetaItem icon={User} label="Researcher" value={report.researcher} />
          )}
        </div>

      </div>

      {/* Per slide: the boxed image on the left, its reading on the right */}
      <div className="card-panel p-4 sm:p-5">
        <h3 className="t-plate-title mb-1 text-text">
          Slide Images
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
            const isEditableReview = report.status === "Needs review" && report.canEdit;
            const slideSummary = (
              <div className="min-w-0">
                {slide.detections.length === 0 ? (
                  <p className="text-[14px] text-text-muted">No pollen grains detected on this slide.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {slide.detections.map((detection) => (
                      <DetectionRow
                        key={detection.speciesId}
                        detection={detection}
                        colors={colors}
                        selected={selectedSpecies === detection.speciesId}
                        compact={isEditableReview}
                        onSelect={() =>
                          select(selectedSpecies === detection.speciesId ? null : detection.speciesId)
                        }
                      />
                    ))}
                  </ul>
                )}
              </div>
            );
            const slideNote = (
              <div className="mt-4 border-t border-border pt-3">
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="caption-label text-[13px]">Slide Note</div>
                  {report.canEdit && !report.sampleDetections && editingNoteSlideId !== slide.id && (
                    <Button
                      type="button"
                      intent="ghost"
                      size="sm"
                      onClick={() => editSlideNote(slide)}
                      disabled={savingNote || Boolean(editingNoteSlideId && editingNoteSlideId !== slide.id)}
                    >
                      <Pencil size={13} strokeWidth={1.75} />
                      {slide.notes ? "Edit note" : "Add note"}
                    </Button>
                  )}
                </div>
                {editingNoteSlideId === slide.id ? (
                  <div>
                    <textarea
                      autoFocus
                      aria-label={`Slide note for ${slide.fileName}`}
                      value={noteDraft}
                      onChange={(event) => setNoteDraft(event.target.value)}
                      placeholder="Add a note about this slide…"
                      maxLength={10000}
                      rows={3}
                      disabled={savingNote}
                      className="focus-ring w-full resize-y rounded-sm border border-border bg-surface px-3 py-2 text-[13px] leading-relaxed text-text placeholder:text-text-faint disabled:opacity-60"
                    />
                    <p className="mt-1 text-[11.5px] text-text-muted">
                      This note is saved with this slide in the report.
                    </p>
                    <div className="mt-2 flex flex-wrap justify-end gap-2">
                      <Button type="button" intent="secondary" size="sm" onClick={cancelSlideNote} disabled={savingNote}>
                        <X size={13} strokeWidth={1.75} /> Cancel
                      </Button>
                      <Button
                        type="button"
                        intent="accent"
                        size="sm"
                        onClick={() => saveSlideNote(slide)}
                        disabled={savingNote || noteDraft.trim() === slide.notes.trim()}
                      >
                        {savingNote ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} strokeWidth={1.75} />}
                        Save note
                      </Button>
                    </div>
                  </div>
                ) : slide.notes ? (
                  <p className="t-prose whitespace-pre-wrap text-text">{slide.notes}</p>
                ) : (
                  <p className="text-[14px] text-text-muted">No note recorded.</p>
                )}
              </div>
            );
            const slideDetails = (
              <div className="min-w-0">
                {slideSummary}
                {slideNote}
              </div>
            );
            const slideImage = (
              <SpecimenImageViewer
                imageUrl={imageUrls[slide.id]}
                fileName={slide.fileName}
                grains={reviewedGrains(slide)}
                detections={slide.detections}
                colors={colors}
                selectedSpeciesId={selectedSpecies}
                onSelectSpecies={select}
                onExpand={() => setInspector({ slideId: slide.id, speciesId: selectedSpecies })}
                onImageError={handleImageError}
                caption={
                  <>
                    <span className="plate-label mr-1.5">Slide {index + 1}</span>
                    {slide.fileName} · {slideGrains} {slideGrains === 1 ? "grain" : "grains"}
                    {slide.detections[0] && (
                      <>
                        {" "}· mostly{" "}
                        <SpeciesName
                          species={findSpecies(speciesCatalog, slide.detections[0].speciesId)}
                          commonName={false}
                        />
                      </>
                    )}
                  </>
                }
              />
            );

            return (
              <div key={slide.id} className="border-t border-border pt-5 first:border-t-0 first:pt-0">
                <div className="mb-3 flex flex-wrap items-center gap-3 text-[13px]">
                  <span className="plate-label text-[12px]">Slide {index + 1}</span>
                  <span className="flex items-center gap-1.5 text-text-muted">
                    <Microscope size={13} strokeWidth={1.75} className="text-text-faint" />
                    {slideGrains} {slideGrains === 1 ? "grain" : "grains"} ·{" "}
                    {slide.detections.length}{" "}
                    {slide.detections.length === 1 ? "type" : "types"}
                  </span>
                </div>

                {isEditableReview ? (
                  <GrainReviewEditor
                    sampleId={report.sampleId}
                    slideId={slide.id}
                    imageUrl={imageUrls[slide.id]}
                    fileName={slide.fileName}
                    grains={slide.grains}
                    detections={slide.modelDetections ?? slide.detections}
                    reviewedDetections={slide.detections}
                    selectedSpeciesId={selectedSpecies}
                    annotations={slide.annotations}
                    sampleDetections={report.sampleDetections}
                    summaryContent={slideSummary}
                    trailingContent={slideNote}
                    onSaved={(annotation) => handleAnnotationSaved(slide.id, annotation)}
                    onRemoved={(annotationId) => handleAnnotationRemoved(slide.id, annotationId)}
                  />
                ) : (
                  <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                    <div className="min-w-0">
                      {slideImage}
                    </div>
                    {slideDetails}
                  </div>
                )}
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
          grains: reviewedGrains(slide),
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
