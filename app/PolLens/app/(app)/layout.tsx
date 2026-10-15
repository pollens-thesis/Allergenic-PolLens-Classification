import SessionGuard from "@/components/SessionGuard";
import Sidebar from "@/components/Sidebar";

/**
 * Every page in this group requires a signed-in researcher; `/` (sign-in) sits
 * outside it. The shell — navigation rail (or the mobile bar below `lg`) and the
 * main column — is drawn once here; pages supply a PageHeader and PageBody.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionGuard>
      <div className="app-shell grid min-h-screen w-full grid-cols-1 content-start bg-bg lg:grid-cols-[var(--sidebar-width)_minmax(0,1fr)]">
        <div className="min-w-0 lg:contents">
          <Sidebar />
        </div>
        <main className="min-w-0">{children}</main>
      </div>
    </SessionGuard>
  );
}
