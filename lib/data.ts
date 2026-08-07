// ---------------------------------------------------------------------------
// SINGLE SOURCE OF TRUTH
// Everything below (allergen classes, history reports, recent detections,
// dashboard stats) is derived from `specimens`. Edit specimens/speciesCatalog
// and every screen that reads from this file stays consistent automatically.
// The one exception is `historicalPollenCounts`, which represents a separate
// real-world dataset (continuous monthly air-monitoring measurements) rather
// than individual specimen analyses — it shares the same species catalog for
// naming/color consistency, but its numbers are independent by design.
// ---------------------------------------------------------------------------

export type SpeciesId =
  | "poaceae"
  | "betula"
  | "alnus"
  | "corylus"
  | "quercus"
  | "ambrosia"
  | "pinus"
  | "artemisia";

export type Species = {
  id: SpeciesId;
  genus: string;
  commonName: string;
  code: string; // taxonomic-style short tag, e.g. AMBR
  season: string;
  riskLevel: "High" | "Moderate" | "Low";
  color: string; // CSS color/var, used consistently across charts, badges, thumbnails
};

export const speciesCatalog: Species[] = [
  { id: "poaceae", genus: "Poaceae", commonName: "Grass", code: "POAC", season: "Late spring – summer", riskLevel: "Moderate", color: "var(--grass)" },
  { id: "betula", genus: "Betula", commonName: "Birch", code: "BETU", season: "Early spring", riskLevel: "High", color: "var(--birch)" },
  { id: "alnus", genus: "Alnus", commonName: "Alder", code: "ALNU", season: "Winter – early spring", riskLevel: "Moderate", color: "var(--pollen)" },
  { id: "corylus", genus: "Corylus", commonName: "Hazel", code: "CORY", season: "Winter – early spring", riskLevel: "Moderate", color: "var(--hazel)" },
  { id: "quercus", genus: "Quercus", commonName: "Oak", code: "QUER", season: "Spring", riskLevel: "Moderate", color: "var(--anther)" },
  { id: "ambrosia", genus: "Ambrosia", commonName: "Ragweed", code: "AMBR", season: "Late summer – fall", riskLevel: "High", color: "#c2703d" },
  { id: "pinus", genus: "Pinus", commonName: "Pine", code: "PINU", season: "Spring", riskLevel: "Low", color: "#6f8f6a" },
  { id: "artemisia", genus: "Artemisia", commonName: "Mugwort", code: "ARTE", season: "Summer – fall", riskLevel: "Moderate", color: "#a1785a" },
];

export function getSpecies(id: SpeciesId): Species {
  const found = speciesCatalog.find((s) => s.id === id);
  if (!found) throw new Error(`Unknown species id: ${id}`);
  return found;
}

export type ReportStatus = "Completed" | "Processing" | "Needs review";

export type Specimen = {
  sampleId: string;
  date: string; // ISO date
  location: string;
  speciesId: SpeciesId;
  confidence: number; // 0-1
  researcher: string;
  status: ReportStatus;
};

// "Today" for the mock dataset, so "this week" / "recent" calculations are stable.
export const MOCK_TODAY = "2026-07-29";

export const specimens: Specimen[] = [
  { sampleId: "PLN-2026-0142", date: "2026-07-29", location: "Lucena City, Quezon", speciesId: "ambrosia", confidence: 0.97, researcher: "You", status: "Completed" },
  { sampleId: "PLN-2026-0141", date: "2026-07-28", location: "Lucban, Quezon", speciesId: "betula", confidence: 0.91, researcher: "You", status: "Completed" },
  { sampleId: "PLN-2026-0140", date: "2026-07-28", location: "Lucena City, Quezon", speciesId: "poaceae", confidence: 0.62, researcher: "M. Reyes", status: "Needs review" },
  { sampleId: "PLN-2026-0139", date: "2026-07-27", location: "Tayabas, Quezon", speciesId: "quercus", confidence: 0.94, researcher: "You", status: "Completed" },
  { sampleId: "PLN-2026-0138", date: "2026-07-26", location: "Lucena City, Quezon", speciesId: "ambrosia", confidence: 0.79, researcher: "M. Reyes", status: "Processing" },
  { sampleId: "PLN-2026-0137", date: "2026-07-26", location: "Sariaya, Quezon", speciesId: "artemisia", confidence: 0.86, researcher: "You", status: "Completed" },
  { sampleId: "PLN-2026-0136", date: "2026-07-25", location: "Lucban, Quezon", speciesId: "pinus", confidence: 0.88, researcher: "You", status: "Completed" },
  { sampleId: "PLN-2026-0135", date: "2026-06-14", location: "Lucena City, Quezon", speciesId: "poaceae", confidence: 0.93, researcher: "You", status: "Completed" },
  { sampleId: "PLN-2026-0134", date: "2026-05-30", location: "Candelaria, Quezon", speciesId: "corylus", confidence: 0.81, researcher: "M. Reyes", status: "Completed" },
  { sampleId: "PLN-2026-0133", date: "2026-05-12", location: "Lucban, Quezon", speciesId: "alnus", confidence: 0.90, researcher: "You", status: "Completed" },
  { sampleId: "PLN-2026-0132", date: "2026-04-22", location: "Tayabas, Quezon", speciesId: "betula", confidence: 0.85, researcher: "You", status: "Completed" },
  { sampleId: "PLN-2026-0131", date: "2026-03-18", location: "Lucena City, Quezon", speciesId: "quercus", confidence: 0.77, researcher: "M. Reyes", status: "Needs review" },
  { sampleId: "PLN-2026-0130", date: "2026-02-09", location: "Sariaya, Quezon", speciesId: "alnus", confidence: 0.89, researcher: "You", status: "Completed" },
  { sampleId: "PLN-2026-0129", date: "2026-01-20", location: "Lucban, Quezon", speciesId: "corylus", confidence: 0.92, researcher: "You", status: "Completed" },
];

// ---------------------------------------------------------------------------
// Derived: history reports table (Sample ID, Date, Location, Top pollen, Status)
// ---------------------------------------------------------------------------

export type HistoryReport = {
  sampleId: string;
  date: string;
  location: string;
  topPollen: string;
  status: ReportStatus;
};

export const historyReports: HistoryReport[] = specimens.map((s) => {
  const sp = getSpecies(s.speciesId);
  return {
    sampleId: s.sampleId,
    date: s.date,
    location: s.location,
    topPollen: `${sp.genus} (${sp.commonName})`,
    status: s.status,
  };
});

// ---------------------------------------------------------------------------
// Derived: recent detections feed (most recent specimens, newest first)
// ---------------------------------------------------------------------------

export type Detection = {
  id: string;
  thumbColor: string;
  classId: SpeciesId;
  className: string;
  code: string;
  confidence: number;
  researcher: string;
  createdAt: string;
};

export const recentDetections: Detection[] = [...specimens]
  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  .slice(0, 6)
  .map((s) => {
    const sp = getSpecies(s.speciesId);
    const sampleNumber = parseInt(s.sampleId.split("-").pop() ?? "0", 10);
    return {
      id: s.sampleId,
      thumbColor: sp.color,
      classId: sp.id,
      className: `${sp.genus} (${sp.commonName})`,
      code: `${sp.code}·${sampleNumber}`,
      confidence: s.confidence,
      researcher: s.researcher,
      createdAt: s.date,
    };
  });

// ---------------------------------------------------------------------------
// Derived: allergen class reference set, with counts computed from specimens
// ---------------------------------------------------------------------------

export type AllergenClass = {
  id: SpeciesId;
  genus: string;
  commonName: string;
  code: string;
  season: string;
  riskLevel: "High" | "Moderate" | "Low";
  count: number;
};

export const allergenClasses: AllergenClass[] = speciesCatalog.map((sp) => ({
  id: sp.id,
  genus: sp.genus,
  commonName: sp.commonName,
  code: sp.code,
  season: sp.season,
  riskLevel: sp.riskLevel,
  count: specimens.filter((s) => s.speciesId === sp.id).length,
}));

// ---------------------------------------------------------------------------
// Derived: dashboard stats, computed directly from specimens
// ---------------------------------------------------------------------------

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export const dashboardStats = {
  totalSpecimens: specimens.length,
  classesTracked: speciesCatalog.length,
  detectionsThisWeek: specimens.filter((s) => {
    const days = new Date(MOCK_TODAY).getTime() - new Date(s.date).getTime();
    return days >= 0 && days <= ONE_WEEK_MS;
  }).length,
  avgConfidence:
    specimens.reduce((sum, s) => sum + s.confidence, 0) / specimens.length,
};

// ---------------------------------------------------------------------------
// Historical pollen counts: monthly environmental monitoring data.
// A separate real-world dataset from `specimens` above, but keyed to the
// same species catalog for consistent naming and color.
// ---------------------------------------------------------------------------

export type MonthlyPollenCount = {
  month: string;
  Poaceae: number;
  Betula: number;
  Alnus: number;
  Corylus: number;
  Quercus: number;
};

const CHART_SPECIES_IDS: SpeciesId[] = ["poaceae", "betula", "alnus", "corylus", "quercus"];

export const pollenSeries = CHART_SPECIES_IDS.map((id) => {
  const sp = getSpecies(id);
  return { key: sp.genus, label: `${sp.genus} (${sp.commonName})`, color: sp.color };
});

export const historicalPollenCounts: MonthlyPollenCount[] = [
  { month: "Jan", Poaceae: 45, Betula: 32, Alnus: 28, Corylus: 20, Quercus: 13 },
  { month: "Feb", Poaceae: 52, Betula: 38, Alnus: 35, Corylus: 26, Quercus: 16 },
  { month: "Mar", Poaceae: 67, Betula: 46, Alnus: 33, Corylus: 28, Quercus: 20 },
  { month: "Apr", Poaceae: 89, Betula: 78, Alnus: 44, Corylus: 39, Quercus: 29 },
  { month: "May", Poaceae: 116, Betula: 97, Alnus: 52, Corylus: 46, Quercus: 35 },
  { month: "Jun", Poaceae: 100, Betula: 67, Alnus: 40, Corylus: 32, Quercus: 28 },
  { month: "Jul", Poaceae: 92, Betula: 55, Alnus: 36, Corylus: 29, Quercus: 24 },
  { month: "Aug", Poaceae: 84, Betula: 44, Alnus: 33, Corylus: 27, Quercus: 22 },
  { month: "Sep", Poaceae: 70, Betula: 36, Alnus: 30, Corylus: 24, Quercus: 19 },
  { month: "Oct", Poaceae: 55, Betula: 28, Alnus: 26, Corylus: 20, Quercus: 15 },
  { month: "Nov", Poaceae: 40, Betula: 22, Alnus: 22, Corylus: 16, Quercus: 12 },
  { month: "Dec", Poaceae: 34, Betula: 18, Alnus: 19, Corylus: 14, Quercus: 10 },
];