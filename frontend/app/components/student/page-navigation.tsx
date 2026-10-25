"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";
import { usePathname } from "next/navigation";

type Intent = { sequence: number; kind: "push" | "pop"; path: string };
const Context = createContext<RefObject<Intent | null> | null>(null);

export function StudentNavigationProvider({ children }: { children: ReactNode }) {
  const intent = useRef<Intent | null>(null);
  useEffect(() => {
    const remember = (kind: Intent["kind"], path: string) => { intent.current = { sequence: (intent.current?.sequence ?? 0) + 1, kind, path }; };
    const link = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !(event.target instanceof Element)) return;
      const anchor = event.target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.hasAttribute("download") || anchor.target && anchor.target !== "_self") return;
      const target = new URL(anchor.href, window.location.href);
      if (target.origin === window.location.origin && target.pathname !== window.location.pathname) remember("push", target.pathname);
    };
    const pop = () => remember("pop", window.location.pathname);
    document.addEventListener("click", link, true);
    window.addEventListener("popstate", pop);
    return () => { document.removeEventListener("click", link, true); window.removeEventListener("popstate", pop); };
  }, []);
  return <Context value={intent}>{children}</Context>;
}

// The document owns page scrolling. Never reset Monaco, preview, or sidebar
// scroll offsets. History traversal and explicit hash links stay with Next/the
// browser. Cached Activity pages still start at the top on a new link visit.
export function useStudentPageEntry() {
  const pathname = usePathname();
  const intent = useContext(Context);
  const entered = useRef(false);
  const handled = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (window.location.pathname !== pathname) return;
    const next = intent?.current;
    const requested = next?.path === pathname && next.sequence !== handled.current;
    const navigation = window.performance.getEntriesByType?.("navigation")[0] as PerformanceNavigationTiming | undefined;
    const restore = navigation?.type === "back_forward" || navigation?.type === "reload";
    const reset = requested ? next.kind === "push" : !entered.current && !restore;
    if (reset && !window.location.hash) window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    entered.current = true;
    if (requested) handled.current = next.sequence;
  }, [pathname, intent]);
}
