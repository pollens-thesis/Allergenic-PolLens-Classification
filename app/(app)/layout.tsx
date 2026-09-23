import SessionGuard from "@/components/SessionGuard";

/** Every page in this group requires a signed-in researcher; `/` (sign-in) sits outside it. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <SessionGuard>{children}</SessionGuard>;
}
