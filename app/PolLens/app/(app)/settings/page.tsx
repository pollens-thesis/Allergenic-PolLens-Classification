import type { Metadata } from "next";
import SettingsWorkspace from "@/components/SettingsWorkspace";
import { PageBody, PageHeader } from "@/components/PageFrame";

export const metadata: Metadata = {
  title: "Settings",
};

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        width="narrow"
        title="Settings"
      />
      <PageBody width="narrow">
        <SettingsWorkspace />
      </PageBody>
    </>
  );
}
