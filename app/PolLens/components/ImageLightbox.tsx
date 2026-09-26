"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";

/**
 * A plain full-screen view of one image — for the Analyze preview, where a
 * slide has no detections yet. Analyzed slides open SpecimenInspector instead.
 */
export default function ImageLightbox({
  open,
  onOpenChange,
  imageUrl,
  fileName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string;
  fileName: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/50 transition-opacity duration-[var(--duration-base)] ease-[var(--ease-out)] data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
        <Dialog.Popup className="fixed inset-0 z-50 flex flex-col bg-viewer outline-none transition-opacity duration-[var(--duration-base)] ease-[var(--ease-out)] data-[starting-style]:opacity-0 data-[ending-style]:opacity-0">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2.5 text-white/85">
            <Dialog.Title className="truncate font-sans text-[14px] font-normal tracking-normal" style={{ fontFamily: "var(--font-body)" }}>
              {fileName}
            </Dialog.Title>
            <Dialog.Close
              aria-label="Close Preview"
              className="focus-ring inline-flex items-center gap-1.5 rounded px-2 py-1 text-[12.5px] hover:bg-white/10 hover:text-white"
            >
              <X size={15} />
              Close
            </Dialog.Close>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt={`Slide image ${fileName}`} className="max-h-full max-w-full object-contain" />
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
