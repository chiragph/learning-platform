"use client";

import { createContext, useContext, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { authRequest, type AuthUser } from "../auth/auth-client";
import { loadAdminSession, type AdminSession } from "../auth/admin-session";
import { announceAuthChange, authChangeKey } from "../auth/student-session";

const Context = createContext<{ user: AuthUser; ready: boolean; logout: () => Promise<void>; signingOut: boolean; logoutError: string } | null>(null);
export function AdminProvider({ user, children }: { user: AuthUser; children: ReactNode }) {
  const [status, setStatus] = useState<AdminSession["status"] | "checking">("checking");
  const [signingOut, setSigningOut] = useState(false), [logoutError, setLogoutError] = useState("");
  const busy = useRef(false), retry = useRef(() => {});
  const router = useRouter(), pathname = usePathname();
  useLayoutEffect(() => {
    let active = true, generation = 0;
    let controller: AbortController | undefined, timeout: number | undefined;
    async function verify() {
      const current = ++generation;
      controller?.abort(); window.clearTimeout(timeout);
      const request = new AbortController(); controller = request;
      setStatus("checking");
      timeout = window.setTimeout(() => request.abort(), 15_000);
      const session = await loadAdminSession(request.signal);
      if (!active || current !== generation) return;
      window.clearTimeout(timeout);
      if (session.status === "authenticated" && (session.user.id !== user.id || session.user.name !== user.name || session.user.email !== user.email)) {
        // A hard navigation discards account-specific cached data on identity changes.
        window.location.replace("/admin"); return;
      }
      setStatus(session.status);
      if (session.status === "anonymous" || session.status === "forbidden") {
        router.replace(session.status === "anonymous" ? "/login" : session.destination); router.refresh();
      }
    }
    const recheck = () => { void verify(); };
    const visible = () => { if (document.visibilityState === "visible") recheck(); };
    const storage = (e: StorageEvent) => { if (e.key === authChangeKey || e.key === null) recheck(); };
    retry.current = recheck; recheck();
    window.addEventListener("focus", recheck); window.addEventListener("pageshow", recheck); window.addEventListener("storage", storage);
    window.addEventListener("decode-admin-session-expired", recheck); document.addEventListener("visibilitychange", visible);
    const interval = window.setInterval(visible, 60_000);
    return () => {
      active = false; generation++; controller?.abort(); window.clearTimeout(timeout); window.clearInterval(interval); retry.current = () => {};
      window.removeEventListener("focus", recheck); window.removeEventListener("pageshow", recheck); window.removeEventListener("storage", storage);
      window.removeEventListener("decode-admin-session-expired", recheck); document.removeEventListener("visibilitychange", visible);
    };
  }, [router, pathname, user.id, user.name, user.email]);
  async function logout() {
    if (busy.current) return;
    busy.current = true; setSigningOut(true); setLogoutError("");
    try {
      await authRequest("logout", {}, "admin");
      setStatus("anonymous"); announceAuthChange(); router.replace("/login"); router.refresh();
    } catch (e) { setLogoutError(e instanceof Error ? e.message : "Unable to sign out. Try again."); }
    finally { busy.current = false; setSigningOut(false); }
  }
  const ready = status === "authenticated";
  return <Context.Provider value={{ user, ready, logout, signingOut, logoutError }}>
    {!ready && <div className="adm-session" role={status === "unavailable" ? "alert" : "status"}><strong>{status === "unavailable" ? "Unable to verify admin access" : "Checking your admin session…"}</strong>{status === "unavailable" && <><p>The backend must support ADMIN sessions and the admin session scope. Access stays protected until verification succeeds.</p><button className="adm-button" onClick={() => retry.current()}>Try again</button><a className="adm-link" href="/login">Return to sign in</a></>}</div>}
    <div data-admin-session-workspace hidden={!ready} inert={!ready} style={{ display: ready ? "contents" : "none" }}>{children}</div>
  </Context.Provider>;
}
export function useAdmin() {
  const value = useContext(Context); if (!value) throw new Error("AdminProvider is required."); return value;
}
export function AdminLogout({ compact = false }: { compact?: boolean }) {
  const { logout, signingOut } = useAdmin();
  return <button className="adm-button adm-secondary adm-logout" onClick={() => void logout()} disabled={signingOut} aria-label={signingOut ? "Signing out" : "Sign out"} title={compact ? "Sign out" : undefined}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M9 4H4v16h5m6-13 5 5-5 5M9 12h11" /></svg><span>{signingOut ? "Signing out…" : "Sign out"}</span></button>;
}
