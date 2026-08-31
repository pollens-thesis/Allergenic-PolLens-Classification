# Allergen reference page — plan

`/dataset` is a dead link in the sidebar today. This is the plan for what goes on it,
written so the page can be built now and filled in as the Roboflow dataset and model
come together.

## The idea

The page looks like a glossary but it isn't. It is the one place where three separate
sources of truth meet, and each answers a different question:

| Source | Question it answers | Exists today? |
|---|---|---|
| **The model** (Roboflow) | What can this system detect at all? | No — not trained yet |
| **Botanical reference** | What is this pollen, and why does it matter? | Partly — 4 fields in `speciesCatalog` |
| **The researcher's own reports** | What have I actually been finding? | Yes — `allergenClasses` already computes it |

Keeping them visually separated matters. A reader must never mistake "the model was
trained on 240 images of this" for "I have found 240 grains of this."

The third source is already built and **completely unused**: `allergenClasses` in
`lib/data.ts` derives `count` and `grainCount` per taxon from saved reports, and nothing
imports it. That is the cheapest part of the page to light up.

---

## 1. The class list is the contract

`speciesCatalog` (23 taxa, as of 2026-08-31 — the real UPLB scope, replacing an
earlier 8-species placeholder) is what the app believes the model can detect.
Once Roboflow training starts, that list and the project's class names must
agree exactly, or detections will silently fail to map to a species.

**Decide the final taxa list before labelling starts.** Changing it afterwards means
re-labelling, not just re-training.

Two things to fix while doing that:

- `app/page.tsx` claims **"12 taxa"** while the catalog holds **8**. Derive it from
  `speciesCatalog.length` so the copy cannot drift again.
- Add an explicit `roboflowClass` field rather than assuming the Roboflow class name
  matches `genus` or `id`. Use lowercase snake_case in Roboflow (`ambrosia`, not
  `Ambrosia (Ragweed)`) — spaces and parentheses in class names cause mismatches that
  are tedious to debug through an inference response.

---

## 2. Fields to add to `Species`

Everything below is **authored from literature**, not derived from the model, so it can
be written now while the dataset is still being collected. This is the thesis-writing
half of the work.

```ts
export type Species = {
  // --- existing ---
  id: SpeciesId;
  genus: string;
  commonName: string;
  code: string;
  season: string;
  riskLevel: "High" | "Moderate" | "Low";
  color: string;

  // --- new: model binding ---
  roboflowClass: string;      // exact class name in the Roboflow project

  // --- new: reference content ---
  peakMonths: number[];       // 1-12, drives the seasonality strip
  description: string;        // 2-3 sentences on the plant and its distribution
  morphology: string;         // what to look for on the slide: size, pores, surface
  allergenicity: string;      // clinical relevance, why the risk level is what it is
  referenceImage?: string;    // /public path to an exemplar grain
  sources: string[];          // citations — this is a thesis
};
```

`peakMonths` is worth the data entry. The catalog currently stores season as prose
(`"Late summer – fall"`), and parsing that into a month strip would be guesswork
dressed up as data. Twelve booleans per taxon, authored once, is honest.

`morphology` earns its place: it is what makes the page useful *while looking down a
microscope*, which is the moment the researcher actually needs it.

---

## 3. Model metadata — `lib/model.ts` (new)

Same seam pattern as `lib/analysis.ts` and `lib/store.ts`: an async function returning
mock/absent data now, a `fetch` later. Nothing else in the app needs to know.

```ts
export type ClassMetrics = {
  roboflowClass: string;
  trainImages: number;
  validImages: number;
  testImages: number;
  annotations: number;
  precision: number | null;   // null until trained
  recall: number | null;
  mAP50: number | null;
};

export type ModelInfo = {
  project: string;            // Roboflow project slug
  version: number;
  trainedAt: string;          // ISO date
  mAP50: number;
  precision: number;
  recall: number;
  classes: ClassMetrics[];
};

// TODO(model): read from the Roboflow project/version API, or a checked-in
// snapshot exported after each training run.
export async function getModelInfo(): Promise<ModelInfo | null> {
  return null;               // no model yet — the page shows its empty state
}
```

Returning `null` is deliberate: the page must render honestly before a model exists
rather than showing zeros that look like a broken model.

**Where the numbers come from in Roboflow:** the dataset page gives per-class image and
annotation counts and the class balance; after a training run, the model page gives
overall mAP@50, precision and recall, plus per-class mAP. A snapshot committed as JSON
after each training run is simpler than calling the API at runtime, and it means the
thesis can cite a fixed version.

---

## 4. Page layout

```
RESEARCH CONSOLE
Allergen reference
The 23 pollen taxa this system is trained to identify.

┌─ MODEL ─────────────────────────────────────────────────────┐
│  pollens-detection · v3      trained Aug 14, 2026           │
│  mAP@50  0.87     precision  0.91     recall  0.84          │
└─────────────────────────────────────────────────────────────┘
        ↑ before training: "No model trained yet — showing the
          reference catalog only."

[ Sort: risk ▾ ]  [ ] Only taxa found in my reports

┌───────────────────────────────────────┐
│ ● AMBR                  [ High risk ] │
│ Ambrosia   Ragweed                    │
│                                       │
│ Late summer – fall                    │
│ J F M A M J J A S O N D               │
│ ░ ░ ░ ░ ░ ░ ▒ █ █ ▓ ░ ░               │
│                                       │
│ Grains are tricolporate, ~18-22 µm,   │
│ with a distinctly spiny surface.      │
│                                       │
│ IN YOUR REPORTS                       │
│ 4 reports · 51 grains · 88% avg conf. │
│ Last seen Jul 29 · Lucena City        │
│ View 4 reports →                      │
│                                       │
│ IN THE MODEL                          │
│ 240 training images · mAP 0.89        │
└───────────────────────────────────────┘
```

Four blocks per card, in this order — identity, seasonality, *your* data, *the model's*
data. Your own findings come first because that is what the researcher returns to the
page for; the model metrics are supporting evidence.

**Sorting and filtering**: by risk level, by abundance in your reports, alphabetical;
plus a toggle for "only taxa I've actually found", which quickly separates the reference
set from the working set.

**Cross-link**: "View 4 reports" goes to `/reports` filtered to that taxon. The report
list already has a text search — the link can prefill it via a query param
(`/reports?q=Ambrosia`), which `ReportsWorkspace` already accepts.

**Colour**: reuse `species.color` for the swatch. It is already the same colour used in
the dashboard chart and in every detection row, so a taxon looks the same everywhere.

---

## 5. Phasing

Each phase is shippable on its own.

| Phase | Needs | Delivers |
|---|---|---|
| **1 — Reference + your data** | Nothing new. Author the botanical fields. | The page, cards, seasonality strips, live stats from saved reports, sort/filter, Report cross-link. Model block shows its empty state. |
| **2 — Dataset labelled** | Roboflow project with images labelled | Per-class training-image counts and a class-balance bar. Makes imbalance visible *before* wasting a training run on it. |
| **3 — Model trained** | A completed Roboflow training run | Model card strip fills in; per-class mAP appears on each card. |

Phase 1 is the bulk of the UI work and does not depend on the dataset at all. Doing it
first means phases 2 and 3 are data drops, not rebuilds.

---

## 6. Dataset checklist for Roboflow

Decisions here are expensive to reverse, so they are worth making deliberately.

- **Class names** match `roboflowClass` exactly. Lowercase, no spaces or parentheses.
- **One class per taxon.** Resist a catch-all "other pollen" class — it teaches the model
  that ambiguity is a valid answer, and it cannot be reported meaningfully.
- **Split by slide, not by image.** If several crops from one slide land in both train
  and validation, the validation score measures memorisation, not generalisation. This is
  the single easiest way to get a misleadingly good mAP, and the hardest to spot later.
- **Track class balance.** Rare taxa with a tenth of the images will score badly, and the
  page will show it. Better to know before training.
- **Augmentations suited to microscopy**: rotation, horizontal/vertical flip, small scale
  and brightness changes. **Avoid hue/saturation shifts** — stain colour is diagnostic
  information, and shifting it teaches the model to ignore a real signal.
- **Record the version.** Every figure quoted in the thesis should name the model version
  it came from, which is why `ModelInfo.version` and `trainedAt` are on the page.

---

## 7. Files this touches

| File | Change |
|---|---|
| `app/dataset/page.tsx` | **New** — route shell, matching the other pages |
| `components/AllergenReference.tsx` | **New** — client component: cards, sort, filter |
| `lib/model.ts` | **New** — Roboflow metadata seam, returns `null` today |
| `lib/data.ts` | Extend `Species` with the fields in §2; author the 8 entries |
| `components/ReportsWorkspace.tsx` | Accepts `?q=` to prefill the search — already done |
| `app/page.tsx` | Derive the taxa count from `speciesCatalog.length` |

`allergenClasses` already exists and needs no change — it just needs a consumer.
