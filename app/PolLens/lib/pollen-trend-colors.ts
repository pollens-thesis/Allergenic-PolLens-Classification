import type { SpeciesId } from "@/lib/data";

/** Stable CSS color tokens shared by the trend chart and Allergen Reference. */
const TREND_COLOR_TOKENS: Partial<Record<SpeciesId, string>> = {
  amaranthus_spinosus: "--trend-amaranthus-spinosus",
  brachiaria_mutica: "--trend-brachiaria-mutica",
  chloris_barbata: "--trend-chloris-barbata",
  chrysopogon_aciculatus: "--trend-chrysopogon-aciculatus",
  dactyloctenium_aegyptium: "--trend-dactyloctenium-aegyptium",
  digitaria_ciliaris: "--trend-digitaria-ciliaris",
  imperata_cylindrica: "--trend-imperata-cylindrica",
  leucaena_leucocephala: "--trend-leucaena-leucocephala",
  mangifera_indica: "--trend-mangifera-indica",
  mimosa_pudica: "--trend-mimosa-pudica",
  oryza_sativa: "--trend-oryza-sativa",
  panicum_maximum: "--trend-panicum-maximum",
  pennisetum_polystachion: "--trend-pennisetum-polystachion",
  sorghum_halepense: "--trend-sorghum-halepense",
  tridax_procumbens: "--trend-tridax-procumbens",
};

export function pollenTrendColor(speciesId: SpeciesId, fallbackColor: string): string {
  const token = TREND_COLOR_TOKENS[speciesId];
  return token ? `var(${token})` : fallbackColor;
}
