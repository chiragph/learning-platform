"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { AuthUser } from "../auth/auth-client";
import { authChangeKey } from "../auth/student-session";
import { loadInstructorSession, type InstructorSession } from "../auth/instructor-session";

// Recheck cached layouts on navigation and after another tab changes accounts.
// The wrapper has no visual layout; the existing instructor UI stays intact.
export function InstructorSessionProvider({ user, children }: { user: AuthUser; children: ReactNode }) {
  const [status, setStatus] = useState<InstructorSession["status"] | "checking">("checking");
  const retry = useRef(() => {});
  const router = useRouter(), pathname = usePathname();
  useLayoutEffect(() => {
    let active = true, generation = 0;
    let request: AbortController | undefined;
    let timeout: number | undefined;
    async function verify() {
      const current = ++generation;
      request?.abort(); window.clearTimeout(timeout);
      request = new AbortController();
      const controller = request;
      setStatus("checking");
      timeout = window.setTimeout(() => controller.abort(), 15_000);
      const session = await loadInstructorSession(controller.signal);
      if (!active || current !== generation) return;
      window.clearTimeout(timeout);
      if (session.status === "authenticated" && session.user.id !== user.id) {
        setStatus("checking"); router.refresh(); return;
      }
      setStatus(session.status);
      if (session.status === "anonymous" || session.status === "forbidden") {
        router.replace(session.status === "anonymous" ? "/login" : "/dashboard");
        router.refresh();
      }
    }
    const recheck = () => { void verify(); };
    const visible = () => { if (document.visibilityState === "visible") recheck(); };
    const storage = (event: StorageEvent) => { if (event.key === authChangeKey || event.key === null) recheck(); };
    retry.current = recheck;
    recheck();
    window.addEventListener("focus", recheck); window.addEventListener("pageshow", recheck);
    window.addEventListener("storage", storage); document.addEventListener("visibilitychange", visible);
    const interval = window.setInterval(() => { if (document.visibilityState === "visible") recheck(); }, 60_000);
    return () => {
      active = false; generation++; request?.abort(); window.clearTimeout(timeout); window.clearInterval(interval);
      retry.current = () => {};
      window.removeEventListener("focus", recheck); window.removeEventListener("pageshow", recheck);
      window.removeEventListener("storage", storage); document.removeEventListener("visibilitychange", visible);
    };
  }, [router, pathname, user.id]);
  return <>{status === "unavailable" && <p role="alert">Unable to verify your session. <button type="button" onClick={() => retry.current()}>Try again</button></p>}<div data-instructor-session-workspace hidden={status !== "authenticated"} inert={status !== "authenticated"} style={{ display: status === "authenticated" ? "contents" : "none" }}>{children}</div></>;
}
