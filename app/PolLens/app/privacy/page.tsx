import type { Metadata } from "next";
import LegalPage, { CONTACT_EMAIL, type LegalSection } from "@/components/LegalPage";
import { BRAND_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${BRAND_NAME} handles sign-in details, reports and slide images.`,
};

const sections: LegalSection[] = [
  {
    id: "collect",
    title: "What We Collect",
    body: (
      <>
        <p>
          <strong className="font-medium text-text">Account details.</strong> When you sign in with
          Google or Microsoft we receive your email address, your name and, for work or school
          accounts, your organization domain. We use them to identify you, show your name, and
          decide whether your account is approved.
        </p>
        <p>
          <strong className="font-medium text-text">Research records.</strong> The collection
          details you enter (location, researcher name, date and time, weather), the slide images
          you upload, the detections and counts the system produces, and any corrections or notes
          you add.
        </p>
        <p>
          <strong className="font-medium text-text">Browser storage.</strong> Your sign-in session
          and your appearance preference (light or dark, sidebar state) are stored in your browser.
        </p>
      </>
    ),
  },
  {
    id: "use",
    title: "How We Use It",
    body: (
      <p>
        Only to run {BRAND_NAME}: signing you in, analyzing slide images, saving and showing
        reports, and producing exports. We do not sell your data, show advertising, or use it for
        anything unrelated to this research project.
      </p>
    ),
  },
  {
    id: "google",
    title: "Google User Data",
    body: (
      <p>
        {BRAND_NAME} asks Google only for your basic profile: email address, name and profile
        information. We use it for sign-in and display. We do not transfer it to others except as
        described below, and we do not use it for advertising. {BRAND_NAME}&apos;s use of
        information received from Google APIs adheres to the Google API Services User Data Policy,
        including its Limited Use requirements.
      </p>
    ),
  },
  {
    id: "shared",
    title: "Who Can See It",
    body: (
      <>
        <p>
          Reports and slide images are a shared research record. Signed-in, approved research users
          can view them; editing and review are limited to the report owner or staff.
        </p>
        <p>
          Service providers process data on our behalf: Vercel (website), Render (application
          server), Neon (database), Cloudflare (slide image storage), and Modal (slide images are
          sent to the detection service for analysis). They act only to provide those services.
        </p>
      </>
    ),
  },
  {
    id: "keep",
    title: "Retention And Deletion",
    body: (
      <p>
        Records are kept while the research project needs them. To ask for your account details or
        reports to be corrected or deleted, email{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="text-text underline underline-offset-4">
          {CONTACT_EMAIL}
        </a>
        . You can also revoke {BRAND_NAME}&apos;s access at any time from your Google or Microsoft
        account settings.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <p>
        {BRAND_NAME} is a thesis research project of students at the University of the Philippines
        and Manuel S. Enverga University Foundation. Questions about this policy:{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="text-text underline underline-offset-4">
          {CONTACT_EMAIL}
        </a>
        . We will update this page if our practices change.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      effective="October 16, 2026"
      intro={
        <p>
          {BRAND_NAME} is a research workspace for identifying allergenic pollen in microscope
          slide images. This page explains what information it handles and why.
        </p>
      }
      sections={sections}
    />
  );
}
