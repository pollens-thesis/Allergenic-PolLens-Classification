import type { Species, SpeciesId } from "./data";

/** The 15 classes in the current EfficientNet classifier and research atlas. */
export const CLASSIFIER_SPECIES_IDS = new Set<SpeciesId>([
  "amaranthus_spinosus",
  "brachiaria_mutica",
  "chloris_barbata",
  "chrysopogon_aciculatus",
  "dactyloctenium_aegyptium",
  "digitaria_ciliaris",
  "imperata_cylindrica",
  "leucaena_leucocephala",
  "mangifera_indica",
  "mimosa_pudica",
  "oryza_sativa",
  "panicum_maximum",
  "pennisetum_polystachion",
  "sorghum_halepense",
  "tridax_procumbens",
]);

/**
 * Names researchers use in the training dataset and on the Allergen Reference.
 * Keep these aligned with the classifier's scientific species IDs.
 */
export const DATASET_SPECIES_NAMES: Partial<Record<SpeciesId, string>> = {
  amaranthus_spinosus: "Pigweed",
  brachiaria_mutica: "Paragrass",
  chloris_barbata: "Koroskorosan",
  chrysopogon_aciculatus: "Amorseco",
  dactyloctenium_aegyptium: "Egyptian grass",
  digitaria_ciliaris: "Crabgrass",
  imperata_cylindrica: "Cogon",
  leucaena_leucocephala: "Ipil-ipil",
  mangifera_indica: "Mango",
  mimosa_pudica: "Makahiya",
  oryza_sativa: "Rice pollen",
  panicum_maximum: "Guinea grass",
  pennisetum_polystachion: "Foxtail",
  sorghum_halepense: "Johnson grass",
  tridax_procumbens: "Wild daisy",
};

/**
 * Applies the Allergen Reference label as the species' common name, so every
 * screen and export shows one name per species. The catalog's own English name
 * is kept as `catalogName` (it still appears under "other names" on the
 * reference page). Species outside the 15 classifier classes have no reference
 * label and keep the catalog name. Idempotent. Call it where a catalog enters
 * the app: the bundled `speciesCatalog` and the API response.
 */
export function withReferenceName(species: Species): Species {
  const catalogName = species.catalogName ?? species.commonName;
  return {
    ...species,
    catalogName,
    commonName: referenceLabel(species) ?? catalogName,
  };
}

/**
 * The Allergen Reference label: what an admin saved on the server (an empty
 * string means "use the catalog name"), else the bundled dataset name for the
 * bundled catalog, which has no `referenceName`.
 */
function referenceLabel(species: Pick<Species, "id" | "referenceName">): string | undefined {
  if (species.referenceName !== undefined) return species.referenceName || undefined;
  return DATASET_SPECIES_NAMES[species.id];
}

type SpeciesNames = Pick<Species, "id" | "commonName" | "catalogName" | "filipinoName" | "referenceName">;

/** The dataset's familiar label, falling back to the catalog's plant names. */
export function researchSpeciesName(species: SpeciesNames): string {
  return referenceLabel(species)
    ?? [species.catalogName ?? species.commonName, species.filipinoName].filter(Boolean).join(" · ");
}

/** Catalog names not already represented by the dataset's primary label. */
export function additionalSpeciesNames(species: SpeciesNames): string {
  const primary = researchSpeciesName(species).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  return [species.catalogName ?? species.commonName, species.filipinoName]
    .filter((name): name is string => typeof name === "string" && name !== "")
    .filter((name) => name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase() !== primary)
    .join(" · ");
}
