"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Icon } from "./landing-icon";

type Intent = "start" | "signin" | "HTML" | "CSS" | "JavaScript";
const AccessContext = createContext<(intent: Intent) => void>(() => {});
const MotionContext = createContext({ paused: false, toggle: () => {} });

export function LandingInteractions({ children }: { children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const [intent, setIntent] = useState<Intent>("start");
  const [paused, setPaused] = useState(false);

  function openAccess(nextIntent: Intent) {
    trigger.current = document.activeElement as HTMLElement;
    setIntent(nextIntent);
    dialog.current?.showModal();
  }

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const restore = () => {
      const previous = trigger.current;
      if (previous?.getClientRects().length) previous.focus();
      else document.getElementById("navigation-toggle")?.focus();
    };
    element.addEventListener("close", restore);
    return () => element.removeEventListener("close", restore);
  }, []);

  const isPath = intent !== "start" && intent !== "signin";
  const title = isPath ? `${intent} learning path` : intent === "signin" ? "Sign in to DECODE" : "Get started with DECODE";

  return (
    <AccessContext.Provider value={openAccess}>
      <MotionContext.Provider value={{ paused, toggle: () => setPaused((value) => !value) }}>
        <div className="decode" data-motion={paused ? "paused" : "playing"}>
          {children}
          <dialog ref={dialog} className="decode-dialog" aria-labelledby="access-title" aria-describedby="access-description" onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
            <div className="decode-dialog-content">
              <div className="mb-6 flex items-center justify-between gap-4"><span className="decode-eyebrow">LEARN. PRACTICE. BUILD.</span><button type="button" className="decode-icon-button" aria-label="Close dialog" onClick={() => dialog.current?.close()} autoFocus><Icon name="close" className="size-5" /></button></div>
              <h2 id="access-title" className="text-2xl font-semibold tracking-tight">{title}</h2>
              <p id="access-description" className="mt-4 text-base leading-7 text-secondary">{isPath ? `${intent} lessons are not available in this landing-page preview yet.` : intent === "signin" ? "Sign-in is not available in this landing-page preview yet." : "Student registration is not available in this landing-page preview yet."} You can explore the skills and learning journey here in the meantime.</p>
              <a className="decode-button decode-button-primary mt-6" href="#skills" onClick={() => dialog.current?.close()}>Explore Skills <Icon name="arrow" /></a>
            </div>
          </dialog>
        </div>
      </MotionContext.Provider>
    </AccessContext.Provider>
  );
}

export function AccessButton({ intent = "start", children, className }: { intent?: Intent; children: ReactNode; className?: string }) {
  const open = useContext(AccessContext);
  if (intent === "start" || intent === "signin") {
    return <Link href={intent === "signin" ? "/login" : "/register"} className={className}>{children}</Link>;
  }
  return <button type="button" className={className} onClick={() => open(intent)} aria-haspopup="dialog">{children}</button>;
}

export function MotionControl({ compact = false }: { compact?: boolean }) {
  const { paused, toggle } = useContext(MotionContext);
  return <button type="button" onClick={toggle} className={compact ? "decode-icon-button decode-motion-control" : "decode-motion-control inline-flex min-h-11 items-center gap-2 self-start"} aria-label={paused ? "Play animations" : "Pause animations"} aria-pressed={paused}><Icon name={paused ? "play" : "pause"} />{!compact && (paused ? "Play animations" : "Pause animations")}</button>;
}
