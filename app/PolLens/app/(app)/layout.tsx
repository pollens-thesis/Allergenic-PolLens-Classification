import SessionGuard from "@/components/SessionGuard";
import Sidebar from "@/components/Sidebar";
import SiteFooter from "@/components/SiteFooter";

/**
 * Every page in this group requires a signed-in researcher; `/` is the public
 * welcome page with the sign-in dialog. The shell — navigation rail (or the
 * mobile bar below `lg`) and the main column — is drawn once here; pages supply
 * a PageHeader and PageBody.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionGuard>
      <div className="app-shell grid min-h-screen w-full grid-cols-1 content-start bg-bg lg:grid-cols-[var(--sidebar-width)_minmax(0,1fr)]">
        <div className="min-w-0 lg:contents">
          <Sidebar />
        </div>
        <div className="flex min-w-0 flex-col">
          <main className="min-w-0 flex-1">{children}</main>
          <SiteFooter className="border-t border-border px-4 py-4 sm:px-6 lg:px-10" />
        </div>
      </div>
    </SessionGuard>
  );
}
