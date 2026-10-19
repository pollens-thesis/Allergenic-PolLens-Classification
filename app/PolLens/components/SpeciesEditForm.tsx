"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { toast } from "sonner";
import { ImagePlus, Loader2, RotateCcw } from "lucide-react";
import { SessionExpiredError } from "@/lib/api";
import type { Species } from "@/lib/data";
import { reloadSpeciesCatalog } from "@/lib/species-catalog";
import { removeSpeciesPhoto, updateSpecies, uploadSpeciesPhoto, type SpeciesEdit } from "@/lib/store";
import { Button } from "@/components/Button";

const MAX_PHOTO_BYTES = 25 * 1024 * 1024;
const RISK_LEVELS: Species["riskLevel"][] = ["Not assessed", "Low", "Moderate", "High"];

const fieldClass =
  "focus-ring w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text placeholder:text-text-placeholder";

type TextField = Exclude<keyof SpeciesEdit, "riskLevel">;

const TEXT_FIELDS: { key: TextField; label: string; hint?: string; max: number; long?: boolean }[] = [
  { key: "referenceName", label: "Display Name", hint: "Shown on cards, reports and the map.", max: 100 },
  { key: "commonName", label: "English Name", max: 100 },
  { key: "filipinoName", label: "Filipino Name", max: 100 },
  { key: "family", label: "Family", max: 60 },
  { key: "growthForm", label: "Growth Form", max: 100 },
  { key: "pollination", label: "Pollination", max: 60 },
  { key: "season", label: "Season", max: 100 },
  { key: "description", label: "Description", max: 5000, long: true },
  { key: "distribution", label: "Where It Grows in the Philippines", max: 255 },
  { key: "infoSource", label: "Source of This Text", max: 255 },
  { key: "photoCredit", label: "Photo Credit", max: 120 },
  { key: "photoLicense", label: "Photo License", max: 40 },
  { key: "photoSource", label: "Photo Source Link", hint: "A full web address (https://…).", max: 300 },
];

function initialValues(sp: Species): Record<TextField, string> & { riskLevel: Species["riskLevel"] } {
  return {
    // Edit the name the server stores, not the catalog name shown when it is blank.
    referenceName: sp.referenceName ?? "",
    commonName: sp.catalogName ?? sp.commonName,
    filipinoName: sp.filipinoName ?? "",
    family: sp.family ?? "",
    growthForm: sp.growthForm ?? "",
    pollination: sp.pollination ?? "",
    season: sp.season ?? "",
    description: sp.description ?? "",
    distribution: sp.distribution ?? "",
    infoSource: sp.infoSource ?? "",
    photoCredit: sp.photoCredit ?? "",
    photoLicense: sp.photoLicense ?? "",
    photoSource: sp.photoSource ?? "",
    riskLevel: sp.riskLevel,
  };
}

/**
 * Admin-only editor for one Allergen Reference record, shown in place of the
 * record inside its dialog. The id, scientific name, code and colour are
 * locked: detection, reports and the charts depend on them.
 */
export default function SpeciesEditForm({
  species: sp,
  onDone,
}: {
  species: Species;
  onDone: () => void;
}) {
  const original = useMemo(() => initialValues(sp), [sp]);
  const [values, setValues] = useState(original);
  const [file, setFile] = useState<File | null>(null);
  const [resetPhoto, setResetPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const changed = (Object.keys(values) as (keyof typeof values)[]).filter((key) => values[key] !== original[key]);
  const dirty = changed.length > 0 || file !== null || resetPhoto;

  function setField<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function chooseFile(next: File | null) {
    if (!next) return;
    if (!/^image\/(jpeg|png)$/.test(next.type)) {
      setError("Choose a JPEG or PNG photo.");
      return;
    }
    if (next.size > MAX_PHOTO_BYTES) {
      setError("That photo is larger than 25 MB.");
      return;
    }
    setError(null);
    setFile(next);
    setResetPhoto(false);
  }

  async function save() {
    setSaving(true);
    setError(null);
    let failed: string | null = null;
    try {
      if (changed.length > 0) {
        const patch: SpeciesEdit = {};
        for (const key of changed) Object.assign(patch, { [key]: values[key] });
        await updateSpecies(sp.id, patch);
      }
      if (file) await uploadSpeciesPhoto(sp.id, file);
      else if (resetPhoto) await removeSpeciesPhoto(sp.id);
    } catch (err) {
      if (err instanceof SessionExpiredError) return;
      failed = err instanceof Error ? err.message : "Couldn't save the species.";
    }
    // Reload either way: a text save may have worked before the photo failed.
    try {
      await reloadSpeciesCatalog();
    } catch {
      // The saved change shows on the next load.
    }
    setSaving(false);
    if (failed) {
      setError(failed);
      return;
    }
    toast.success(`${sp.scientificName} saved`);
    onDone();
  }

  const shownPhoto = preview ?? (resetPhoto ? `/species/${sp.id}.jpg` : sp.photoUrl || `/species/${sp.id}.jpg`);

  return (
    <form
      className="relative p-5 sm:p-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (dirty && !saving) void save();
      }}
    >
      <span className="plate-label text-[12px]">{sp.code}</span>
      <Dialog.Title className="mt-0.5 pr-10 text-[1.5rem] leading-tight font-semibold text-text">
        Edit <i className="t-binomial">{sp.scientificName}</i>
      </Dialog.Title>
      <Dialog.Description className="mt-1 text-[13px] text-text-muted">
        The scientific name, code and colour are locked because detection, reports and charts depend on them.
      </Dialog.Description>

      <div className="mt-4 flex items-start gap-3 border-t border-border pt-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- a small preview of the chosen file */}
        <img
          src={shownPhoto}
          alt=""
          className="h-20 w-28 shrink-0 rounded-md border border-border bg-surface-sunken object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="caption-label text-[13px]">Photo</div>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={(event) => {
                chooseFile(event.target.files?.[0] ?? null);
                event.target.value = "";
              }}
            />
            <Button type="button" intent="secondary" size="sm" disabled={saving} onClick={() => inputRef.current?.click()}>
              <ImagePlus size={13} strokeWidth={1.75} />
              {file ? "Choose Another Photo" : "Upload a Photo"}
            </Button>
            {(sp.photoUploaded || file) && !resetPhoto && (
              <Button
                type="button"
                intent="caution"
                size="sm"
                disabled={saving}
                onClick={() => {
                  setFile(null);
                  setResetPhoto(Boolean(sp.photoUploaded));
                }}
              >
                <RotateCcw size={13} strokeWidth={1.75} />
                {file ? "Discard New Photo" : "Reset to Original Photo"}
              </Button>
            )}
          </div>
          <p className="mt-1.5 text-[12px] text-text-muted">
            {file
              ? `${file.name} will replace the photo when you save.`
              : resetPhoto
                ? "The original photo will return when you save."
                : "JPEG or PNG, up to 25 MB. Update the credit below to match."}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="caption-label text-[13px]">Risk Level</span>
          <select
            value={values.riskLevel}
            onChange={(event) => setField("riskLevel", event.target.value as Species["riskLevel"])}
            disabled={saving}
            className={`${fieldClass} mt-1`}
          >
            {RISK_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level === "Not assessed" ? "Not Assessed" : level}
              </option>
            ))}
          </select>
        </label>
        {TEXT_FIELDS.filter((field) => !field.long).map((field) => (
          <label key={field.key} className="block">
            <span className="caption-label text-[13px]">{field.label}</span>
            <input
              type="text"
              value={values[field.key]}
              onChange={(event) => setField(field.key, event.target.value)}
              maxLength={field.max}
              disabled={saving}
              className={`${fieldClass} mt-1`}
            />
            {field.hint && <span className="mt-0.5 block text-[12px] text-text-muted">{field.hint}</span>}
          </label>
        ))}
        {TEXT_FIELDS.filter((field) => field.long).map((field) => (
          <label key={field.key} className="block sm:col-span-2">
            <span className="caption-label text-[13px]">{field.label}</span>
            <textarea
              value={values[field.key]}
              onChange={(event) => setField(field.key, event.target.value)}
              maxLength={field.max}
              rows={5}
              disabled={saving}
              className={`${fieldClass} mt-1 resize-y`}
            />
          </label>
        ))}
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-md border border-danger/40 bg-danger-bg px-3 py-2 text-[13px] text-danger">
          {error}
        </p>
      )}

      <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
        <Button type="button" intent="secondary" size="sm" disabled={saving} onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" intent="accent" size="sm" disabled={!dirty || saving}>
          {saving && <Loader2 size={13} strokeWidth={1.75} className="animate-spin" />}
          {saving ? "Saving…" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
