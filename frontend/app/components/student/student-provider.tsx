"use client";

import { createContext, useCallback, useContext, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { authRequest, type AuthUser } from "../auth/auth-client";
import { announceAuthChange, authChangeKey, loadStudentSession, type StudentSession } from "../auth/student-session";
import { StudentProfileProvider, useOptionalStudentProfile } from "./profile-provider";

type SessionStatus = StudentSession["status"] | "checking";
const Context = createContext<{ user: AuthUser; signOut: () => Promise<void> } | null>(null);
export function useStudent() {
  const session = useContext(Context);
  const profile = useOptionalStudentProfile();
  if (!session) throw new Error("Student context missing");
  const student = session.user;
  return { ...student, label: profile?.studentId === student.id ? profile.profile.displayName : student.name };
}
export function StudentSessionNotice({ status, retry }: { status: Exclude<SessionStatus, "authenticated">; retry?: () => void }) {
  const router = useRouter();
  if (status === "checking" || status === "anonymous") return <p className="student-empty" role="status">{status === "checking" ? "Checking your session…" : "Returning to sign in…"}</p>;
  return <div className="student-empty" role="alert"><h1>{status === "forbidden" ? "Student account required" : "Unable to verify your session"}</h1><p>{status === "forbidden" ? "This learning workspace is for student accounts." : "Your workspace is hidden until the server confirms your session. Please try again."}</p>{status === "unavailable" && <button className="student-button secondary" onClick={retry ?? (() => router.refresh())}>Try again</button>}<Link className="student-link" href={status === "forbidden" ? "/login/success" : "/login"}>{status === "forbidden" ? "Return to your account" : "Sign in"}</Link></div>;
}
export function StudentProvider({ user: initialUser, children }: { user: AuthUser; children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(initialUser);
  const [status, setStatus] = useState<SessionStatus>("checking");
  const router = useRouter(), pathname = usePathname();
  const request = useRef<AbortController | null>(null), generation = useRef(0), retry = useRef(() => {});
  const logout = useRef<Promise<void> | null>(null);
  // Layout reactivation covers Next's cached Activity routes before paint. Keep
  // the current workspace hidden and inert, not remounted or suspended, while
  // rechecking the same account. Monaco, unsaved edits and in-flight lab checks
  // retain their lifecycle; an expired/different account discards the old scope.
  useLayoutEffect(() => {
    let active = true;
    let timer: number | undefined;
    async function verify() {
      if (logout.current) return;
      const current = ++generation.current;
      request.current?.abort();
      window.clearTimeout(timer);
      const controller = new AbortController(); request.current = controller;
      setStatus("checking");
      const timeout = window.setTimeout(() => controller.abort(), 15_000);
      timer = timeout;
      const session = await loadStudentSession(controller.signal);
      window.clearTimeout(timeout);
      if (!active || current !== generation.current) return;
      if (session.status === "authenticated") setUser(session.user);
      else if (session.status !== "unavailable") setUser(null);
      setStatus(session.status);
      if (session.status === "anonymous") { router.replace("/login"); router.refresh(); }
    }
    const recheck = () => { void verify(); };
    const visible = () => { if (document.visibilityState === "visible") recheck(); };
    const storage = (event: StorageEvent) => { if (event.key === authChangeKey || event.key === null) recheck(); };
    retry.current = recheck;
    recheck();
    window.addEventListener("focus", recheck); window.addEventListener("pageshow", recheck);
    window.addEventListener("storage", storage); document.addEventListener("visibilitychange", visible);
    return () => {
      active = false; generation.current += 1; request.current?.abort(); window.clearTimeout(timer); retry.current = () => {};
      window.removeEventListener("focus", recheck); window.removeEventListener("pageshow", recheck);
      window.removeEventListener("storage", storage); document.removeEventListener("visibilitychange", visible);
    };
  }, [router, pathname, initialUser.id]);
  const signOut = useCallback(() => {
    if (logout.current) return logout.current;
    generation.current++; request.current?.abort();
    const pending = (async () => {
      await authRequest("logout", {}, "student");
      setUser(null); setStatus("anonymous"); announceAuthChange();
      router.replace("/login"); router.refresh();
    })();
    logout.current = pending;
    void pending.finally(() => { logout.current = null; }).catch(() => {});
    return pending;
  }, [router]);
  return <>{status !== "authenticated" && <StudentSessionNotice status={status} retry={() => retry.current()} />}{user && <Context value={{ user, signOut }}><div data-student-session-workspace hidden={status !== "authenticated"} inert={status !== "authenticated"} style={{ display: status === "authenticated" ? "contents" : "none" }}><StudentProfileProvider key={user.id} studentId={user.id} displayName={user.name}>{children}</StudentProfileProvider></div></Context>}</>;
}
export function LogoutButton() {
  const session = useContext(Context);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  return <><button className="student-button secondary" disabled={pending} onClick={async () => { if (!session) return; setPending(true); setError(""); try { await session.signOut(); } catch (error) { setError(error instanceof Error ? error.message : "Unable to log out. Please try again."); } finally { setPending(false); } }}>{pending ? "Logging out…" : "Log out"}</button>{error && <p role="alert">{error}</p>}</>;
}
