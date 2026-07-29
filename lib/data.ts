export type AllergenClass = {
  id: string;
  genus: string;
  commonName: string;
  code: string; // taxonomic-style short tag, e.g. AMBR
  season: string;
  riskLevel: "High" | "Moderate" | "Low";
  count: number; // specimens identified as this class
};

export type Detection = {
  id: string;
  thumbColor: string; // placeholder swatch until real thumbnails exist
  classId: string;
  className: string;
  code: string;
  confidence: number; // 0-1
  researcher: string;
  createdAt: string; // ISO date
};

export const allergenClasses: AllergenClass[] = [
  { id: "ambr", genus: "Ambrosia", commonName: "Ragweed", code: "AMBR", season: "Late summer – fall", riskLevel: "High", count: 142 },
  { id: "betu", genus: "Betula", commonName: "Birch", code: "BETU", season: "Early spring", riskLevel: "High", count: 98 },
  { id: "poac", genus: "Poaceae", commonName: "Grass", code: "POAC", season: "Late spring – summer", riskLevel: "Moderate", count: 176 },
  { id: "quer", genus: "Quercus", commonName: "Oak", code: "QUER", season: "Spring", riskLevel: "Moderate", count: 64 },
  { id: "pinu", genus: "Pinus", commonName: "Pine", code: "PINU", season: "Spring", riskLevel: "Low", count: 51 },
  { id: "arte", genus: "Artemisia", commonName: "Mugwort", code: "ARTE", season: "Summer – fall", riskLevel: "Moderate", count: 39 },
];

export const recentDetections: Detection[] = [
  { id: "d1", thumbColor: "#e8b93f", classId: "ambr", className: "Ambrosia (Ragweed)", code: "AMBR·114", confidence: 0.97, researcher: "You", createdAt: "2026-07-29T08:14:00Z" },
  { id: "d2", thumbColor: "#d9704a", classId: "betu", className: "Betula (Birch)", code: "BETU·087", confidence: 0.91, researcher: "You", createdAt: "2026-07-28T15:42:00Z" },
  { id: "d3", thumbColor: "#f3d27a", classId: "poac", className: "Poaceae (Grass)", code: "POAC·162", confidence: 0.88, researcher: "M. Reyes", createdAt: "2026-07-28T11:05:00Z" },
  { id: "d4", thumbColor: "#8fa396", classId: "quer", className: "Quercus (Oak)", code: "QUER·058", confidence: 0.94, researcher: "You", createdAt: "2026-07-27T09:30:00Z" },
  { id: "d5", thumbColor: "#e8b93f", classId: "ambr", className: "Ambrosia (Ragweed)", code: "AMBR·113", confidence: 0.79, researcher: "M. Reyes", createdAt: "2026-07-26T17:20:00Z" },
  { id: "d6", thumbColor: "#d9704a", classId: "arte", className: "Artemisia (Mugwort)", code: "ARTE·034", confidence: 0.86, researcher: "You", createdAt: "2026-07-26T10:02:00Z" },
];

export const dashboardStats = {
  totalSpecimens: recentDetections.length + 564, // mock running total
  classesTracked: allergenClasses.length,
  detectionsThisWeek: 23,
  avgConfidence: 0.9,
};

export type MonthlyPollenCount = {
  month: string;
  Poaceae: number;
  Betula: number;
  Alnus: number;
  Corylus: number;
  Quercus: number;
};

export const pollenSeries = [
  { key: "Poaceae", label: "Poaceae (Grass)", color: "var(--grass)" },
  { key: "Betula", label: "Betula (Birch)", color: "var(--birch)" },
  { key: "Alnus", label: "Alnus (Alder)", color: "var(--pollen)" },
  { key: "Corylus", label: "Corylus (Hazel)", color: "var(--hazel)" },
  { key: "Quercus", label: "Quercus (Oak)", color: "var(--anther)" },
] as const;

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

export type ReportStatus = "Completed" | "Processing" | "Needs review";

export type HistoryReport = {
  sampleId: string;
  date: string; // ISO
  location: string;
  topPollen: string;
  status: ReportStatus;
};

export const historyReports: HistoryReport[] = [
  { sampleId: "PLN-2026-0142", date: "2026-07-29", location: "Lucena City, Quezon", topPollen: "Ambrosia (Ragweed)", status: "Completed" },
  { sampleId: "PLN-2026-0141", date: "2026-07-28", location: "Lucban, Quezon", topPollen: "Betula (Birch)", status: "Completed" },
  { sampleId: "PLN-2026-0140", date: "2026-07-28", location: "Lucena City, Quezon", topPollen: "Poaceae (Grass)", status: "Needs review" },
  { sampleId: "PLN-2026-0139", date: "2026-07-27", location: "Tayabas, Quezon", topPollen: "Quercus (Oak)", status: "Completed" },
  { sampleId: "PLN-2026-0138", date: "2026-07-26", location: "Lucena City, Quezon", topPollen: "Ambrosia (Ragweed)", status: "Processing" },
  { sampleId: "PLN-2026-0137", date: "2026-07-26", location: "Sariaya, Quezon", topPollen: "Artemisia (Mugwort)", status: "Completed" },
  { sampleId: "PLN-2026-0136", date: "2026-07-25", location: "Lucban, Quezon", topPollen: "Pinus (Pine)", status: "Completed" },
];
