"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { ChevronLeft, ChevronRight, ImageOff, Search, X } from "lucide-react";
import type { Species } from "@/lib/data";
import { useSpeciesCatalog } from "@/lib/species-catalog";
import { useReportGrainCounts } from "@/lib/report-grain-counts";
import RiskBadge from "@/components/RiskBadge";
import { buttonVariants } from "@/components/Button";

/**
 * The 23-species taxonomic scope as an atlas: a searchable grid of plates,
 * four across with 12 species per page, each opening the species' full record.
 *
 * Reference text and photos come from the API (Django admin → Species); the
 * text is botanical only — the risk stamp reads "Not Assessed" until UPLB
 * supplies allergenicity data. Photos are freely licensed and always credited.
 */
const PAGE_SIZE = 12;

/** Case- and accent-insensitive form, so "kulitis", "Kulitis" and "kulítis" match. */
function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function searchText(sp: Species): string {
  return fold([sp.scientificName, sp.commonName, sp.filipinoName ?? "", sp.code].join(" "));
}

/** "Spiny amaranth · Kulitis" — the plant's everyday names under the binomial. */
function plantNames(sp: Species): string {
  return [sp.commonName, sp.filipinoName].filter(Boolean).join(" · ");
}

function photoFor(sp: Species): string {
  return sp.photoUrl || `/species/${sp.id}.jpg`;
}

export default function AllergenReference() {
  const speciesCatalog = useSpeciesCatalog();
  const counts = useReportGrainCounts();
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const matches = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return speciesCatalog;
    return speciesCatalog.filter((sp) => searchText(sp).includes(q));
  }, [speciesCatalog, query]);

  const pageCount = Math.ceil(matches.length / PAGE_SIZE);
  const [pagination, setPagination] = useState({ page: 1, matches, openId });
  let currentPage = Math.min(pagination.page, Math.max(pageCount, 1));

  // Adjust before rendering when filtering or a shared record changes pages.
  if (pagination.matches !== matches || pagination.openId !== openId) {
    const matchIndex = openId ? matches.findIndex((sp) => sp.id === openId) : -1;
    const index = matchIndex >= 0 ? matchIndex : speciesCatalog.findIndex((sp) => sp.id === openId);
    if (index >= 0) currentPage = Math.min(Math.floor(index / PAGE_SIZE) + 1, Math.max(pageCount, 1));
    setPagination({ page: currentPage, matches, openId });
  }

  function setPage(page: number) {
    setPagination({ page, matches, openId });
  }

  const visibleMatches = matches.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const rangeStart = matches.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, matches.length);

  // Deep links: /dataset#cocos_nucifera opens that species' record, and the
  // hash follows the dialog so a record can be shared or bookmarked.
  useEffect(() => {
    const fromHash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      setOpenId(id || null);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);

  function updateQuery(value: string) {
    setQuery(value);
    setPage(1);
  }

  function open(id: string | null) {
    setOpenId(id);
    const url = id ? `${window.location.pathname}#${id}` : window.location.pathname;
    window.history.replaceState(null, "", url);
  }

  const openSpecies = openId ? (speciesCatalog.find((sp) => sp.id === openId) ?? null) : null;
  const grainsOf = (sp: Species) => (counts ? (counts[sp.id] ?? 0) : null);

  return (
    <div>
      {/* Search, indexed on scientific name, plant names (English and Filipino) and code */}
      <div className="mb-5">
        <label className="relative block w-full sm:max-w-sm">
          <span className="sr-only">Search species by scientific or plant name</span>
          <Search
            size={15}
            strokeWidth={1.75}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-text-faint"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => updateQuery(event.target.value)}
            placeholder="Search species"
            className="focus-ring w-full rounded-md border border-border bg-surface py-2 pr-9 pl-9 text-[14px] text-text placeholder:text-text-faint"
          />
          {query && (
            <button
              type="button"
              onClick={() => updateQuery("")}
              aria-label="Clear Search"
              className="focus-ring absolute top-1/2 right-1.5 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-text-muted hover:bg-surface-sunken hover:text-text"
            >
              <X size={14} strokeWidth={1.75} />
            </button>
          )}
        </label>
      </div>

      {matches.length === 0 ? (
        <div className="card-panel flex flex-col items-center gap-3 px-6 py-14 text-center">
          <p className="text-[14px] text-text-muted">
            No species match &ldquo;{query.trim()}&rdquo;.
          </p>
          <button
            type="button"
            onClick={() => updateQuery("")}
            className={`${buttonVariants({ intent: "secondary", size: "sm" })} focus-ring`}
          >
            Clear Search
          </button>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {visibleMatches.map((sp) => (
            <li key={sp.id} id={sp.id} className="scroll-mt-24 lg:scroll-mt-48">
              <SpeciesCard species={sp} grains={grainsOf(sp)} onOpen={() => open(sp.id)} />
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] text-text-muted lining-nums" aria-live="polite">
          {matches.length === 0
            ? `0 of ${speciesCatalog.length} species`
            : query.trim()
              ? `Showing ${rangeStart}–${rangeEnd} of ${matches.length} matches (${speciesCatalog.length} total)`
              : `Showing ${rangeStart}–${rangeEnd} of ${matches.length} species`}
        </p>
        {pageCount > 1 && (
          <nav aria-label="Species pages" className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous Page"
              onClick={() => setPage(currentPage - 1)}
              disabled={currentPage === 1}
              className={`${buttonVariants({ intent: "secondary", size: "sm" })} focus-ring h-8 min-w-8 px-2`}
            >
              <ChevronLeft size={14} strokeWidth={1.75} />
            </button>
            {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                aria-label={`Page ${pageNumber} of ${pageCount}`}
                aria-current={currentPage === pageNumber ? "page" : undefined}
                onClick={() => setPage(pageNumber)}
                className={`${buttonVariants({ intent: "secondary", size: "sm" })} focus-ring h-8 min-w-8 px-2 ${
                  currentPage === pageNumber ? "border-border-strong bg-surface-sunken text-text" : ""
                }`}
              >
                {pageNumber}
              </button>
            ))}
            <button
              type="button"
              aria-label="Next Page"
              onClick={() => setPage(currentPage + 1)}
              disabled={currentPage === pageCount}
              className={`${buttonVariants({ intent: "secondary", size: "sm" })} focus-ring h-8 min-w-8 px-2`}
            >
              <ChevronRight size={14} strokeWidth={1.75} />
            </button>
          </nav>
        )}
      </div>

      <SpeciesRecord
        species={openSpecies}
        grains={openSpecies ? grainsOf(openSpecies) : null}
        onClose={() => open(null)}
      />
    </div>
  );
}

function SpeciesPhoto({ sp, className }: { sp: Species; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className={`flex flex-col items-center justify-center gap-1.5 bg-surface-sunken text-text-faint ${className ?? ""}`}>
        <ImageOff size={18} strokeWidth={1.5} />
        <span className="text-[12px]">No photo yet</span>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a small, pre-sized static image
    <img
      src={photoFor(sp)}
      alt={`${sp.scientificName}${sp.commonName ? ` (${sp.commonName})` : ""}`}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={`bg-surface-sunken object-cover ${className ?? ""}`}
    />
  );
}

/** The concise plate in the grid: photo, binomial over plant names, and its readings. */
function SpeciesCard({
  species: sp,
  grains,
  onOpen,
}: {
  species: Species;
  grains: number | null;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      className="focus-ring card-panel card-panel-interactive group flex h-full w-full flex-col overflow-hidden text-left transition-transform duration-[var(--duration-fast)] ease-[var(--ease-out)] active:scale-[0.99]"
    >
      <SpeciesPhoto sp={sp} className="aspect-[4/3] w-full border-b border-border" />
      <span className="flex flex-1 flex-col px-3 pt-2.5 pb-3">
        {/* Primary: the binomial. Secondary: the names people use for the plant. */}
        <span className="t-binomial text-[16px] leading-snug font-semibold text-text">{sp.scientificName}</span>
        <span className="mt-0.5 text-[13px] leading-snug text-text-muted">{plantNames(sp) || " "}</span>
        <span className="mt-2 mb-3">
          <RiskBadge level={sp.riskLevel} />
        </span>
        <span className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-2">
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-[2px] ring-1 ring-black/15"
              style={{ backgroundColor: sp.color }}
            />
            <span className="text-[12px] tracking-wider text-text" style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
              {sp.code}
            </span>
          </span>
          <span className="text-right text-[12px] text-text-muted">
            <span className="text-text" style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
              {grains === null ? "…" : grains.toLocaleString()}
            </span>{" "}
            {grains === 1 ? "grain" : "grains"}
          </span>
        </span>
      </span>
    </button>
  );
}

/** The full record, opened from a card or a #species link. */
function SpeciesRecord({
  species: sp,
  grains,
  onClose,
}: {
  species: Species | null;
  grains: number | null;
  onClose: () => void;
}) {
  return (
    <Dialog.Root open={sp !== null} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/40 transition-opacity duration-[var(--duration-base)] ease-[var(--ease-out)] data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100vh-2rem)] w-[min(60rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-border bg-surface shadow-lg outline-none transition-all duration-[var(--duration-base)] ease-[var(--ease-out)] data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0 data-[ending-style]:scale-[0.98] data-[ending-style]:opacity-0">
          {/* First in the markup, so it takes the dialog's initial focus and the
              record opens at its top rather than scrolled to the photo credit. */}
          <Dialog.Close
            aria-label="Close"
            className="focus-ring absolute top-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface/90 text-text-muted transition-colors hover:bg-surface-sunken hover:text-text"
          >
            <X size={17} strokeWidth={1.75} />
          </Dialog.Close>
          {sp && (
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
              {/* The plate */}
              <figure className="flex flex-col border-b border-border md:border-r md:border-b-0">
                <SpeciesPhoto sp={sp} className="aspect-[4/3] w-full shrink-0 border-b border-border" />
                {sp.photoCredit && (
                  <figcaption className="shrink-0 border-t border-border px-4 py-2 text-[12px] text-text-muted">
                    Photo: {sp.photoCredit} ·{" "}
                    {sp.photoSource ? (
                      <a
                        href={sp.photoSource}
                        target="_blank"
                        rel="noreferrer"
                        className="focus-ring rounded underline underline-offset-2 hover:text-text"
                      >
                        {sp.photoLicense || "Wikimedia Commons"}
                      </a>
                    ) : (
                      sp.photoLicense
                    )}
                    , via Wikimedia Commons
                  </figcaption>
                )}
              </figure>

              {/* The record */}
              <div className="relative p-5 sm:p-6">
                <span className="plate-label text-[12px]">{sp.code}</span>
                <Dialog.Title className="mt-0.5 pr-10 text-[1.875rem] leading-tight font-semibold text-text">
                  <i className="t-binomial">{sp.scientificName}</i>
                </Dialog.Title>
                {plantNames(sp) && <p className="mt-1 text-[15px] text-text-muted">{plantNames(sp)}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <RiskBadge level={sp.riskLevel} />
                  {sp.family && <span className="text-[13px] text-text-muted">{sp.family}</span>}
                </div>

                {sp.description && (
                  <Dialog.Description className="t-prose mt-4 text-text">{sp.description}</Dialog.Description>
                )}

                <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-4 text-[14px]">
                  <RecordItem label="Grains in Finalized Reports">
                    <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
                      {grains === null ? "…" : grains.toLocaleString()}
                    </span>
                  </RecordItem>
                  <RecordItem label="Risk Level">
                    {sp.riskLevel === "Not assessed" ? "Not assessed yet" : sp.riskLevel}
                  </RecordItem>
                  {sp.growthForm && <RecordItem label="Growth Form">{sp.growthForm}</RecordItem>}
                  {sp.pollination && <RecordItem label="Pollination">{sp.pollination}</RecordItem>}
                  <RecordItem label="Code">
                    <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>{sp.code}</span>
                  </RecordItem>
                  <RecordItem label="Chart and Map Colour">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        aria-hidden
                        className="h-3 w-3 rounded-[2px] ring-1 ring-black/15"
                        style={{ backgroundColor: sp.color }}
                      />
                      <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>{sp.color}</span>
                    </span>
                  </RecordItem>
                </dl>

                {sp.distribution && (
                  <div className="mt-4 border-t border-border pt-4">
                    <div className="caption-label text-[13px]">Where It Grows in the Philippines</div>
                    <p className="t-prose mt-1 text-text">{sp.distribution}</p>
                  </div>
                )}

                {sp.infoSource && <p className="mt-5 text-[12px] leading-relaxed text-text-muted">{sp.infoSource}</p>}
              </div>
            </div>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function RecordItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="caption-label text-[13px]">{label}</dt>
      <dd className="mt-0.5 text-text">{children}</dd>
    </div>
  );
}
