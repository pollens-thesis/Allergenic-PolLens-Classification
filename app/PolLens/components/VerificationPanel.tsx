"use client";

import { useState } from "react";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { toast } from "sonner";
import { Ban, CircleCheck, Clock, RotateCcw } from "lucide-react";
import type { Specimen } from "@/lib/data";
import { resubmitReport, verifyReport } from "@/lib/store";
import { SessionExpiredError } from "@/lib/api";
import { Button, buttonVariants } from "@/components/Button";

const REASON_LIMIT = 1000;

/**
 * Where a report stands with the verifiers. Only Verified reports are shared,
 * so this tells the owner why theirs isn't (and what to do about a decline),
 * and gives a verifier the Approve and Decline actions. Verified reports show
 * nothing.
 */
export default function VerificationPanel({
  report,
  onChange,
}: {
  report: Specimen;
  onChange: (report: Specimen) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [reason, setReason] = useState("");

  // A draft hasn't been submitted, and a verified report needs no explanation.
  if (report.status === "Pending" || report.verification === "Verified") return null;

  async function run(action: () => Promise<Specimen>, done: string) {
    setBusy(true);
    try {
      onChange(await action());
      toast.success(done);
      return true;
    } catch (error) {
      if (!(error instanceof SessionExpiredError)) {
        toast.error(error instanceof Error ? error.message : "Couldn't save the change.");
      }
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function decline() {
    const ok = await run(
      () => verifyReport(report.sampleId, { decision: "decline", reason: reason.trim() }),
      `Report ${report.sampleId} declined`,
    );
    if (ok) {
      setDeclineOpen(false);
      setReason("");
    }
  }

  const declined = report.verification === "Declined";

  return (
    <section
      aria-label="Verification"
      className="card-panel flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5"
    >
      <div className="flex min-w-0 gap-3">
        {declined ? (
          <Ban size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-danger" aria-hidden />
        ) : (
          <Clock size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-text-muted" aria-hidden />
        )}
        <div className="min-w-0">
          <h3 className="text-[14px] font-semibold text-text">
            {declined ? "Declined by a Verifier" : "Awaiting Verification"}
          </h3>
          {declined ? (
            <>
              <p className="mt-1 text-[13px] leading-snug text-text-muted">
                This report is not shared. Fix what the verifier found, then resubmit it.
              </p>
              {report.declineReason && (
                <blockquote className="mt-2 border-l-2 border-danger pl-3 text-[13px] leading-snug break-words whitespace-pre-wrap text-text">
                  {report.declineReason}
                </blockquote>
              )}
            </>
          ) : (
            <p className="mt-1 text-[13px] leading-snug text-text-muted">
              {report.canVerify
                ? "Check the slides and counts. Approving shares this report on the map and dashboard."
                : "A verifier checks every report before it is shared on the map and dashboard. Until then only you and the verifiers can see it."}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
        {report.canVerify && (
          <>
            <Button
              type="button"
              intent="confirm"
              size="sm"
              disabled={busy}
              onClick={() =>
                run(() => verifyReport(report.sampleId, { decision: "approve" }), `Report ${report.sampleId} approved`)
              }
            >
              <CircleCheck size={14} strokeWidth={1.75} />
              Approve Report
            </Button>
            <AlertDialog.Root open={declineOpen} onOpenChange={setDeclineOpen}>
              <AlertDialog.Trigger
                disabled={busy}
                className={`${buttonVariants({ intent: "caution", size: "sm" })} focus-ring`}
              >
                <Ban size={14} strokeWidth={1.75} />
                Decline Report
              </AlertDialog.Trigger>
              <AlertDialog.Portal>
                <AlertDialog.Backdrop className="fixed inset-0 z-40 bg-black/40 transition-opacity duration-[var(--duration-base)] ease-[var(--ease-out)] data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
                <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-surface p-5 shadow-lg outline-none transition-all duration-[var(--duration-base)] ease-[var(--ease-out)] data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0">
                  <AlertDialog.Title className="t-plate-title text-text">
                    Decline {report.sampleId}?
                  </AlertDialog.Title>
                  <AlertDialog.Description className="t-prose mt-2 text-text-muted">
                    The report stays private. The researcher sees your reason and can fix the report and resubmit it.
                  </AlertDialog.Description>
                  <label className="mt-4 flex flex-col gap-1">
                    <span className="text-[12.5px] text-text-muted">Reason</span>
                    <textarea
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      maxLength={REASON_LIMIT}
                      rows={4}
                      className="focus-ring w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text placeholder:text-text-faint"
                      placeholder="What should the researcher fix?"
                    />
                    <span className="self-end text-[11.5px] text-text-faint">
                      {reason.length}/{REASON_LIMIT}
                    </span>
                  </label>
                  <div className="mt-4 flex justify-end gap-2">
                    <AlertDialog.Close className="focus-ring rounded-md border border-border bg-surface px-3 py-1.5 text-[13px] text-text-muted hover:text-text">
                      Cancel
                    </AlertDialog.Close>
                    <Button
                      type="button"
                      intent="destructive"
                      size="sm"
                      disabled={busy || !reason.trim()}
                      onClick={decline}
                    >
                      <Ban size={13} strokeWidth={1.75} />
                      Decline Report
                    </Button>
                  </div>
                </AlertDialog.Popup>
              </AlertDialog.Portal>
            </AlertDialog.Root>
          </>
        )}
        {declined && report.canEdit && (
          <Button
            type="button"
            intent="resume"
            size="sm"
            disabled={busy}
            onClick={() => run(() => resubmitReport(report.sampleId), `Report ${report.sampleId} resubmitted`)}
          >
            <RotateCcw size={14} strokeWidth={1.75} />
            Resubmit for Verification
          </Button>
        )}
      </div>
    </section>
  );
}
