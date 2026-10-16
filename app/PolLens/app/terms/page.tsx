import type { Metadata } from "next";
import LegalPage, { type LegalSection } from "@/components/LegalPage";
import { BRAND_NAME, CONTACT_EMAIL } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Terms Of Service",
  description: `The terms for using ${BRAND_NAME}.`,
};

const sections: LegalSection[] = [
  {
    id: "access",
    title: "Who May Use It",
    body: (
      <p>
        {BRAND_NAME} is for UP, MSEUF and approved research accounts. Access may be limited or
        removed at any time. You are responsible for activity under your account.
      </p>
    ),
  },
  {
    id: "results",
    title: "What The Results Mean",
    body: (
      <>
        <p>
          Detections and counts are produced by a machine-learning model and must be reviewed by a
          researcher. The system currently covers a limited set of allergenic pollen species and
          Philippine collection locations, and it can be wrong.
        </p>
        <p>
          Counts describe grains identified in submitted slide images. They are not ambient
          air-concentration measurements or a diagnosis of an individual&apos;s allergies, and they
          are not medical advice.
        </p>
      </>
    ),
  },
  {
    id: "content",
    title: "Your Content",
    body: (
      <p>
        You keep ownership of the slide images and records you submit. By submitting them you
        confirm you may do so and allow {BRAND_NAME} to store, process and show them to other
        approved users as part of the shared research record.
      </p>
    ),
  },
  {
    id: "conduct",
    title: "Acceptable Use",
    body: (
      <p>
        Do not upload content you have no right to share, try to access other people&apos;s
        accounts, disrupt the service, or misuse the shared records.
      </p>
    ),
  },
  {
    id: "warranty",
    title: "No Warranty",
    body: (
      <p>
        {BRAND_NAME} is a student research project provided as is, without warranties of any kind,
        and may change or be unavailable. To the extent allowed by law, its authors are not liable
        for losses arising from its use.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <p>
        Questions about these terms:{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="text-text underline underline-offset-4">
          {CONTACT_EMAIL}
        </a>
        . See also the Privacy Policy.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms Of Service"
      effective="October 16, 2026"
      intro={<p>By signing in to {BRAND_NAME} you agree to these terms.</p>}
      sections={sections}
    />
  );
}
