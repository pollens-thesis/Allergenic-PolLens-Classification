"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { MapPin, TriangleAlert } from "lucide-react";

/** One entry of public/geo/places.json — see scripts/build-places.mjs. */
export type Place = {
  label: string;
  town: string;
  province: string;
  kind: "town" | "province";
  lat: number;
  lon: number;
  /** PSGC of the province boundary (public/geo/provinces.json) it sits in. */
  provincePsgc: number;
  /** PSGC of the town boundary, for towns. */
  townPsgc?: number;
};

const MAX_SUGGESTIONS = 8;

// Loaded once per session, on first use — 1,700 places, ~200 KB.
let placesRequest: Promise<Place[]> | null = null;
export function loadPlaces(): Promise<Place[]> {
  placesRequest ??= fetch("/geo/places.json")
    .then((res) => (res.ok ? (res.json() as Promise<Place[]>) : []))
    .catch(() => {
      placesRequest = null;
      return [];
    });
  return placesRequest;
}

/**
 * Case- and accent-insensitive form, character for character (so an index in
 * the folded string is the same index in the original): "Dasmariñas" and
 * "dasmarinas" fold to the same text.
 */
function fold(text: string): string {
  return Array.from(text, (ch) => ch.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().charAt(0) || ch).join("");
}

/** Lower rank = better: name starts with the query, then any word does, then anywhere. */
function rank(place: Place, q: string): number {
  const label = fold(place.label);
  const name = fold(place.kind === "town" ? place.town : place.province);
  if (name.startsWith(q)) return 0;
  if (label.split(/[\s,]+/).some((word) => word.startsWith(q))) return 1;
  if (label.includes(q)) return 2;
  return -1;
}

export function findPlace(places: Place[], label: string): Place | null {
  const key = fold(label.trim());
  return places.find((place) => fold(place.label) === key) ?? null;
}

/**
 * Location field with search-as-you-type suggestions from the Philippine
 * Standard Geographic Code (PSGC) list the map is drawn from — so every picked
 * place is spelled the way the map matches it. Free text is still accepted
 * (a note warns it won't be plotted), since a site may not be a town.
 *
 * WAI-ARIA combobox pattern: ↑/↓ move, Enter picks, Esc closes.
 */
export default function LocationSearch({
  value,
  onChange,
  onSelectPlace,
  placeholder,
  className,
  warnUnrecognised = true,
}: {
  value: string;
  onChange: (text: string) => void;
  /** Fired when a suggestion is chosen (with coordinates for the weather lookup). */
  onSelectPlace?: (place: Place) => void;
  placeholder?: string;
  className?: string;
  /** Warn when the text isn't a known place (off where partial text is a search). */
  warnUnrecognised?: boolean;
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [focused, setFocused] = useState(false);

  // An existing value (a restored draft, the result page) needs the list to
  // say whether it is a recognised place.
  useEffect(() => {
    if (!value || places) return;
    let cancelled = false;
    loadPlaces().then((loaded) => {
      if (!cancelled) setPlaces(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [value, places]);

  const q = fold(value.trim());
  const suggestions = useMemo(() => {
    if (!places || !q) return [];
    return places
      .map((place) => ({ place, score: rank(place, q) }))
      .filter((entry) => entry.score >= 0)
      .sort(
        (a, b) =>
          a.score - b.score ||
          (a.place.kind === b.place.kind ? 0 : a.place.kind === "town" ? -1 : 1) ||
          a.place.label.localeCompare(b.place.label),
      )
      .slice(0, MAX_SUGGESTIONS)
      .map((entry) => entry.place);
  }, [places, q]);

  const showList = open && suggestions.length > 0;
  const recognised = !value.trim() || !places || findPlace(places, value) !== null;

  function choose(place: Place) {
    onChange(place.label);
    onSelectPlace?.(place);
    setOpen(false);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((i) => (suggestions.length ? (i + 1) % suggestions.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (suggestions.length ? (i - 1 + suggestions.length) % suggestions.length : 0));
    } else if (event.key === "Enter" && showList) {
      event.preventDefault();
      choose(suggestions[Math.min(active, suggestions.length - 1)]);
    } else if (event.key === "Escape" && showList) {
      event.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList ? `${listId}-${active}` : undefined}
        autoComplete="off"
        spellCheck={false}
        value={value}
        placeholder={placeholder}
        onChange={(event) => {
          onChange(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => {
          setFocused(true);
          setOpen(true);
          if (!places) loadPlaces().then(setPlaces);
        }}
        onBlur={() => {
          setFocused(false);
          setOpen(false);
        }}
        onKeyDown={handleKeyDown}
        className={className}
      />

      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute top-full right-0 left-0 z-30 mt-1 max-h-72 overflow-y-auto rounded-md border border-border-strong bg-surface py-1 shadow-lg"
        >
          {suggestions.map((place, index) => (
            <li
              key={place.label}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              // mousedown, not click: it fires before the input's blur closes the list.
              onMouseDown={(event) => {
                event.preventDefault();
                choose(place);
              }}
              onMouseEnter={() => setActive(index)}
              className={clsx(
                "flex cursor-pointer items-center gap-2 px-3 py-1.5 text-[13px]",
                index === active ? "bg-accent-muted text-text" : "text-text",
              )}
            >
              <MapPin size={13} strokeWidth={1.75} className="shrink-0 text-text-faint" />
              <span className="min-w-0 flex-1 truncate">
                <Highlight text={place.label} query={q} />
              </span>
              {place.kind === "province" && (
                <span className="shrink-0 text-[11.5px] text-text-faint">Province</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {warnUnrecognised && !focused && !recognised && (
        <p className="mt-1 flex items-start gap-1 text-[12px] text-processing">
          <TriangleAlert size={12} strokeWidth={2} className="mt-0.5 shrink-0" />
          Not a recognised town or province — it won&apos;t appear on the map or fill the weather.
        </p>
      )}
    </div>
  );
}

function Highlight({ text, query }: { text: string; query: string }) {
  const at = query ? fold(text).indexOf(query) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="bg-transparent font-semibold text-text">{text.slice(at, at + query.length)}</mark>
      {text.slice(at + query.length)}
    </>
  );
}
