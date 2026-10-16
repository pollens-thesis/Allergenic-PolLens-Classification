"use client";

import { useEffect, useState } from "react";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { toast } from "sonner";
import { Ban, CloudOff, Loader2, ShieldAlert, ShieldCheck, ShieldOff, UserCheck } from "lucide-react";
import { SessionExpiredError } from "@/lib/api";
import { useSettings, type Role } from "@/lib/settings";
import { listUsers, updateUser, type ManagedUser } from "@/lib/store";
import { Button, buttonVariants } from "@/components/Button";

const ROLE_LABEL: Record<Role, string> = { admin: "Admin", verifier: "Verifier", user: "User" };

/**
 * Admins appoint the verifiers and can block an account. Admins themselves are
 * made on the server, so their rows have no actions.
 */
export default function UsersWorkspace() {
  const { role, email } = useSettings();
  const [users, setUsers] = useState<ManagedUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [blocking, setBlocking] = useState<ManagedUser | null>(null);
  const isAdmin = role === "admin";

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    listUsers()
      .then((loaded) => !cancelled && setUsers(loaded))
      .catch((err: unknown) => {
        if (cancelled || err instanceof SessionExpiredError) return;
        setError(err instanceof Error ? err.message : "Couldn't load the accounts.");
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, attempt]);

  async function change(user: ManagedUser, patch: { isVerifier?: boolean; isActive?: boolean }, done: string) {
    setBusyId(user.id);
    try {
      const updated = await updateUser(user.id, patch);
      setUsers((current) => current && current.map((entry) => (entry.id === updated.id ? { ...entry, ...updated } : entry)));
      toast.success(done);
      return true;
    } catch (err) {
      if (!(err instanceof SessionExpiredError)) {
        toast.error(err instanceof Error ? err.message : "Couldn't update the account.");
      }
      return false;
    } finally {
      setBusyId(null);
    }
  }

  if (role === undefined) return <Loading label="Checking your access…" />;

  if (!isAdmin) {
    return (
      <div className="card-panel flex flex-col items-center gap-3 px-6 py-16 text-center">
        <ShieldAlert size={22} strokeWidth={1.5} className="text-text-faint" />
        <p className="max-w-md text-[13.5px] text-text-muted">Only admins can manage accounts.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card-panel flex flex-col items-center gap-3 px-6 py-16 text-center">
        <CloudOff size={22} strokeWidth={1.5} className="text-text-faint" />
        <p className="text-[13.5px] text-text-muted">{error}</p>
        <Button
          type="button"
          intent="secondary"
          size="sm"
          onClick={() => {
            setError(null);
            setAttempt((n) => n + 1);
          }}
        >
          Try Again
        </Button>
      </div>
    );
  }

  if (users === null) return <Loading label="Loading accounts…" />;

  return (
    <>
      <div className="card-panel overflow-x-auto">
        <table className="w-full min-w-[44rem] text-left text-[13px]">
          <caption className="border-b border-border px-4 py-3 text-left text-[13px] text-text-muted">
            {users.length} {users.length === 1 ? "account" : "accounts"}. Verifiers can approve or decline other
            people&apos;s reports. Blocked accounts are signed out.
          </caption>
          <thead>
            <tr className="border-b border-border text-[12px] text-text-muted">
              <th scope="col" className="px-4 py-2 font-medium">Account</th>
              <th scope="col" className="px-2 py-2 font-medium">Role</th>
              <th scope="col" className="px-2 py-2 text-right font-medium">Reports</th>
              <th scope="col" className="px-4 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((user) => {
              const self = user.email.toLowerCase() === email.toLowerCase();
              const busy = busyId === user.id;
              return (
                <tr key={user.id}>
                  <td className="px-4 py-2.5">
                    <span className="block break-words font-medium text-text">{user.fullName || user.email}</span>
                    <span className="block break-all text-[12px] text-text-muted">
                      {user.fullName ? `${user.email} · ` : ""}
                      {user.institution || "No institution"}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 whitespace-nowrap">
                    <span className="text-text">{ROLE_LABEL[user.role]}</span>
                    {self && <span className="text-text-muted"> (you)</span>}
                    {!user.isActive && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-sm border border-danger px-1.5 py-0.5 text-[11.5px] font-medium text-danger">
                        <Ban size={10} strokeWidth={1.75} aria-hidden />
                        Blocked
                      </span>
                    )}
                  </td>
                  <td
                    className="px-2 py-2.5 text-right text-text"
                    style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}
                  >
                    {user.reportCount}
                  </td>
                  <td className="px-4 py-2.5">
                    {user.role === "admin" ? (
                      <span className="block text-right text-[12px] text-text-faint">Set on the server</span>
                    ) : (
                      <span className="flex flex-wrap items-center justify-end gap-2">
                        {user.isActive && (
                          <Button
                            type="button"
                            intent={user.isVerifier ? "secondary" : "confirm"}
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              change(
                                user,
                                { isVerifier: !user.isVerifier },
                                user.isVerifier
                                  ? `${user.email} is no longer a verifier`
                                  : `${user.email} is now a verifier`,
                              )
                            }
                          >
                            {user.isVerifier ? (
                              <ShieldOff size={13} strokeWidth={1.75} />
                            ) : (
                              <ShieldCheck size={13} strokeWidth={1.75} />
                            )}
                            {user.isVerifier ? "Remove Verifier" : "Make Verifier"}
                          </Button>
                        )}
                        {user.isActive ? (
                          <Button
                            type="button"
                            intent="caution"
                            size="sm"
                            disabled={busy}
                            onClick={() => setBlocking(user)}
                          >
                            <Ban size={13} strokeWidth={1.75} />
                            Block
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            intent="secondary"
                            size="sm"
                            disabled={busy}
                            onClick={() => change(user, { isActive: true }, `${user.email} can sign in again`)}
                          >
                            <UserCheck size={13} strokeWidth={1.75} />
                            Unblock
                          </Button>
                        )}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <AlertDialog.Root open={blocking !== null} onOpenChange={(open) => !open && setBlocking(null)}>
        <AlertDialog.Portal>
          <AlertDialog.Backdrop className="fixed inset-0 z-40 bg-black/40 transition-opacity duration-[var(--duration-base)] ease-[var(--ease-out)] data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
          <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-surface p-5 shadow-lg outline-none transition-all duration-[var(--duration-base)] ease-[var(--ease-out)] data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0">
            <AlertDialog.Title className="t-plate-title text-text">Block {blocking?.email}?</AlertDialog.Title>
            <AlertDialog.Description className="t-prose mt-2 text-text-muted">
              They are signed out on their next action and can&apos;t sign in until you unblock them. Their reports stay
              as they are.
            </AlertDialog.Description>
            <div className="mt-4 flex justify-end gap-2">
              <AlertDialog.Close className={`${buttonVariants({ intent: "secondary", size: "sm" })} focus-ring`}>
                Cancel
              </AlertDialog.Close>
              <Button
                type="button"
                intent="destructive"
                size="sm"
                onClick={async () => {
                  if (!blocking) return;
                  const ok = await change(blocking, { isActive: false }, `${blocking.email} is blocked`);
                  if (ok) setBlocking(null);
                }}
              >
                <Ban size={13} strokeWidth={1.75} />
                Block Account
              </Button>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <div className="card-panel flex items-center justify-center gap-2 px-6 py-16 text-[13px] text-text-muted">
      <Loader2 size={16} strokeWidth={1.75} className="animate-spin" />
      {label}
    </div>
  );
}
