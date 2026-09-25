import clsx from "clsx";
import type { Species } from "@/lib/data";

/**
 * A species as the atlas sets it: the binomial in the serif italic, with the
 * common name (when there is one) in plain text after it. The markup sibling
 * of `speciesLabel()`, which stays for plain-text outputs (PDF, CSV, titles).
 */
export default function SpeciesName({
  species,
  className,
  commonName = true,
}: {
  species: Pick<Species, "scientificName" | "commonName">;
  className?: string;
  /** Show the common name in parentheses after the binomial. */
  commonName?: boolean;
}) {
  return (
    <span className={className}>
      <i className={clsx("t-binomial")}>{species.scientificName}</i>
      {commonName && species.commonName && <span className="text-text-muted"> ({species.commonName})</span>}
    </span>
  );
}
