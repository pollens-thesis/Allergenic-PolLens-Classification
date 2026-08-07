"use client";

import { useRef, useState } from "react";
import {
  ImagePlus,
  X,
  Loader2,
  Microscope,
  RotateCcw,
  Save,
  Check,
} from "lucide-react";
import { speciesCatalog, type Species } from "@/lib/data";

type Stage = "empty" | "ready" | "analyzing" | "result";

type MockResult = {
  species: Species;
  confidence: number;
};

function runMockAnalysis(): MockResult {
  const species = speciesCatalog[Math.floor(Math.random() * speciesCatalog.length)];
  const confidence = Math.round((0.65 + Math.random() * 0.33) * 100) / 100;
  return { species, confidence };
}

function riskBadgeClass(level: Species["riskLevel"]) {
  if (level === "High") return "bg-[#b3492f]/10 text-[#b3492f]";
  if (level === "Moderate") return "bg-anther/10 text-anther";
  return "bg-[#3f7a4f]/10 text-[#3f7a4f]";
}

export default function AnalyzeWorkspace() {
  const [stage, setStage] = useState<Stage>("empty");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [location, setLocation] = useState("");
  const [researcher, setResearcher] = useState("You");
  const [result, setResult] = useState<MockResult | null>(null);
  const [saved, setSaved] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return;
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl(URL.createObjectURL(file));
    setFileName(file.name);
    setResult(null);
    setSaved(false);
    setStage("ready");
  }

  function handleRemoveImage() {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl(null);
    setFileName("");
    setResult(null);
    setSaved(false);
    setStage("empty");
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleAnalyze() {
    setStage("analyzing");
    window.setTimeout(() => {
      setResult(runMockAnalysis());
      setStage("result");
    }, 1400);
  }

  function handleAnalyzeAnother() {
    handleRemoveImage();
  }

  function handleSave() {
    setSaved(true);
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
      {/* Left: image + metadata */}
      <div className="rounded-lg border border-panel-line bg-white/60 p-5 xl:col-span-3">
        <h2 className="mb-4 text-lg text-ink" style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}>
          Specimen image
        </h2>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />

        {!imageUrl ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              handleFile(e.dataTransfer.files?.[0]);
            }}
            className={`focus-ring flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-14 text-center transition ${
              isDragging ? "border-anther bg-anther/5" : "border-panel-line hover:border-ink/30"
            }`}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-panel">
              <ImagePlus size={20} strokeWidth={1.75} className="text-ink/50" />
            </span>
            <span className="text-[13.5px] text-ink/70">
              Drag and drop a microscope image, or click to browse
            </span>
            <span className="text-[11.5px] text-ink/40">JPG, PNG — up to 10MB</span>
          </button>
        ) : (
          <div className="relative overflow-hidden rounded-lg border border-panel-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="Uploaded specimen preview" className="max-h-80 w-full object-contain bg-panel" />
            <button
              type="button"
              onClick={handleRemoveImage}
              aria-label="Remove image"
              className="focus-ring absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-ink/80 text-parchment hover:bg-ink"
            >
              <X size={14} strokeWidth={1.75} />
            </button>
            <div className="border-t border-panel-line bg-white px-3 py-2 text-[12px] text-ink/50">
              {fileName}
            </div>
          </div>
        )}

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[11.5px] text-ink/50">Location</span>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Lucena City, Quezon"
              className="focus-ring w-full rounded-md border border-panel-line bg-white px-3 py-2 text-[13px] text-ink placeholder:text-ink/35"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11.5px] text-ink/50">Researcher</span>
            <input
              type="text"
              value={researcher}
              onChange={(e) => setResearcher(e.target.value)}
              className="focus-ring w-full rounded-md border border-panel-line bg-white px-3 py-2 text-[13px] text-ink placeholder:text-ink/35"
            />
          </label>
        </div>

        <button
          type="button"
          disabled={!imageUrl || stage === "analyzing"}
          onClick={handleAnalyze}
          className="focus-ring mt-5 flex w-full items-center justify-center gap-2 rounded-md bg-ink px-4 py-2.5 text-sm font-medium text-parchment transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {stage === "analyzing" ? (
            <>
              <Loader2 size={16} strokeWidth={1.75} className="animate-spin" />
              Analyzing…
            </>
          ) : (
            <>
              <Microscope size={16} strokeWidth={1.75} />
              Analyze specimen
            </>
          )}
        </button>
      </div>

      {/* Right: result */}
      <div className="rounded-lg border border-panel-line bg-white/60 p-5 xl:col-span-2">
        <h2 className="mb-4 text-lg text-ink" style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}>
          Result
        </h2>

        {stage !== "result" || !result ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg bg-panel/60 px-6 py-14 text-center">
            <Microscope size={22} strokeWidth={1.5} className="text-ink/25" />
            <p className="text-[13px] text-ink/45">
              {stage === "analyzing"
                ? "Identifying pollen class…"
                : "Upload an image and run analysis to see the identified allergen class here."}
            </p>
          </div>
        ) : (
          <div>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] tracking-widest text-ink/45 uppercase" style={{ fontFamily: "var(--font-mono)" }}>
                  {result.species.code}
                </div>
                <div className="text-xl text-ink" style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}>
                  {result.species.genus}
                </div>
                <div className="text-[13px] text-ink/55">{result.species.commonName}</div>
              </div>
              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${riskBadgeClass(result.species.riskLevel)}`} style={{ fontFamily: "var(--font-mono)" }}>
                {result.species.riskLevel} risk
              </span>
            </div>

            <div className="mb-4">
              <div className="mb-1 flex items-center justify-between text-[12px] text-ink/55">
                <span>Confidence</span>
                <span style={{ fontFamily: "var(--font-mono)" }}>{Math.round(result.confidence * 100)}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel-line">
                <div
                  className="h-full rounded-full bg-anther"
                  style={{ width: `${result.confidence * 100}%` }}
                />
              </div>
            </div>

            <div className="mb-5 grid grid-cols-2 gap-3 text-[12.5px]">
              <div>
                <div className="text-ink/45">Season</div>
                <div className="text-ink/80">{result.species.season}</div>
              </div>
              <div>
                <div className="text-ink/45">Location</div>
                <div className="text-ink/80">{location || "Not specified"}</div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={saved}
                className="focus-ring flex flex-1 items-center justify-center gap-2 rounded-md bg-ink px-3 py-2 text-[13px] font-medium text-parchment transition hover:opacity-90 disabled:cursor-default disabled:opacity-60"
              >
                {saved ? (
                  <>
                    <Check size={14} strokeWidth={1.75} />
                    Saved
                  </>
                ) : (
                  <>
                    <Save size={14} strokeWidth={1.75} />
                    Save to history
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleAnalyzeAnother}
                className="focus-ring flex items-center justify-center gap-2 rounded-md border border-panel-line bg-white px-3 py-2 text-[13px] text-ink/70 transition hover:text-ink"
              >
                <RotateCcw size={14} strokeWidth={1.75} />
                New
              </button>
            </div>

            {saved && (
              <p className="mt-3 text-[11.5px] text-ink/40">
                Saved locally for this session — this will sync to your real History once the backend is connected.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}