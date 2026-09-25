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

// Loaded once per session, on first use — 1,700 places, ~200 KB. A failed
// load resolves to null (not an empty list, which would call every place
// unrecognised) and is retried on the next use.
let placesRequest: Promise<Place[] | null> | null = null;
export function loadPlaces(): Promise<Place[] | null> {
  placesRequest ??= fetch("/geo/places.json")
    .then((res) => {
      if (!res.ok) throw new Error(`places ${res.status}`);
      return res.json() as Promise<Place[]>;
    })
    .catch(() => {
      placesRequest = null;
      return null;
    });
  return placesRequest;
}

/**
 * Case- and accent-insensitive form of `text`, with `map[i]` = the index in
 * `text` that folded character i came from (plus a final entry for the end),
 * so a match found in the folded text can be highlighted in the original.
 */
function foldWithMap(text: string): { folded: string; map: number[] } {
  let folded = "";
  const map: number[] = [];
  for (let i = 0; i < text.length; ) {
    const ch = String.fromCodePoint(text.codePointAt(i)!);
    for (const out of ch.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()) {
      folded += out;
      map.push(i);
    }
    i += ch.length;
  }
  map.push(text.length);
  return { folded, map };
}

/** "Dasmariñas", "DASMARIÑAS" and "dasmarinas" all fold to the same text. */
function fold(text: string): string {
  return foldWithMap(text.normalize("NFC")).folded;
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
  // The list shrinks as you type; the highlighted row must stay inside it.
  const activeIndex = Math.min(active, Math.max(suggestions.length - 1, 0));
  const recognised = !value.trim() || !places || findPlace(places, value) !== null;

  function choose(place: Place) {
    onChange(place.label);
    onSelectPlace?.(place);
    setOpen(false);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!suggestions.length) return;
      event.preventDefault();
      if (!showList) {
        // The first press only opens the list, on its first row.
        setOpen(true);
        setActive(0);
        return;
      }
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((activeIndex + step + suggestions.length) % suggestions.length);
    } else if (event.key === "Enter" && showList) {
      event.preventDefault();
      choose(suggestions[activeIndex]);
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
        aria-activedescendant={showList ? `${listId}-${activeIndex}` : undefined}
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
              aria-selected={index === activeIndex}
              // mousedown, not click: it fires before the input's blur closes the list.
              onMouseDown={(event) => {
                event.preventDefault();
                choose(place);
              }}
              onMouseEnter={() => setActive(index)}
              className={clsx(
                "flex cursor-pointer items-center gap-2 px-3 py-1.5 text-[13px]",
                index === activeIndex ? "bg-accent-muted text-text" : "text-text",
              )}
            >
              <MapPin size={13} strokeWidth={1.75} className="shrink-0 text-text-faint" />
              <span className="min-w-0 flex-1 truncate">
                <Highlight text={place.label} query={q} />
              </span>
              {place.kind === "province" && (
                <span className="shrink-0 text-[12px] text-text-muted">Province</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {warnUnrecognised && !focused && !recognised && (
        <p className="mt-1 flex items-start gap-1 text-[12px] text-processing">
          <TriangleAlert size={12} strokeWidth={2} className="mt-0.5 shrink-0" />
          Not a recognized town or province — it won&apos;t appear on the map or fill the weather.
        </p>
      )}
    </div>
  );
}

function Highlight({ text, query }: { text: string; query: string }) {
  const { folded, map } = foldWithMap(text);
  const at = query ? folded.indexOf(query) : -1;
  if (at < 0) return <>{text}</>;
  const start = map[at];
  const end = map[at + query.length];
  return (
    <>
      {text.slice(0, start)}
      <mark className="bg-transparent font-semibold text-text">{text.slice(start, end)}</mark>
      {text.slice(end)}
    </>
  );
}
