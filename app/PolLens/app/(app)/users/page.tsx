import type { Metadata } from "next";
import UsersWorkspace from "@/components/UsersWorkspace";
import { PageBody, PageHeader } from "@/components/PageFrame";

export const metadata: Metadata = {
  title: "Users",
};

export default function UsersPage() {
  return (
    <>
      <PageHeader title="Users" description="Appoint verifiers and block accounts." width="medium" />
      <PageBody width="medium">
        <UsersWorkspace />
      </PageBody>
    </>
  );
}
