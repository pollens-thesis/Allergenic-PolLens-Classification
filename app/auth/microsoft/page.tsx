import type { Metadata } from "next";
import MicrosoftRedirectBridge from "@/components/MicrosoftRedirectBridge";

export const metadata: Metadata = {
  title: { absolute: "Signing In · PolLens" },
};

/**
 * Where Microsoft's sign-in popup lands (the redirect URI registered in Entra).
 * It only hands the response back to the window that opened it; the popup then
 * closes. Outside the (app) group, so no session is required.
 */
export default function MicrosoftRedirectPage() {
  return <MicrosoftRedirectBridge />;
}
