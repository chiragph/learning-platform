// The App Router has no route-blocking API. Guard links before Next handles
// them, use the browser's unload dialog, and intercept history traversal before
// the router's bubbling popstate listener. No router or authentication patching.
export function installInstructorLeaveGuard(browser: Window, dirty: () => boolean, contentName = "lesson") {
  const currentUrl = browser.location.href, currentState: unknown = browser.history.state;
  const question = `You have unsaved ${contentName} changes. Leave this page and discard them?`;
  const unload = (event: BeforeUnloadEvent) => { if (dirty()) { event.preventDefault(); event.returnValue = ""; } };
  const click = (event: MouseEvent) => {
    if (!dirty() || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = event.target as Element | null, anchor = target?.closest<HTMLAnchorElement>("a[href]");
    if (!anchor || anchor.hasAttribute("download") || anchor.target && anchor.target !== "_self") return;
    const url = new URL(anchor.href, browser.location.href);
    if (url.origin === browser.location.origin && url.pathname === browser.location.pathname && url.search === browser.location.search) return;
    if (!browser.confirm(question)) { event.preventDefault(); event.stopImmediatePropagation(); }
  };
  const pop = (event: PopStateEvent) => {
    if (!dirty() || browser.confirm(question)) return;
    event.stopImmediatePropagation();
    // Restore the current editor URL and Next history state after cancellation.
    // This avoids replaying a traversal while the unsaved document is mounted.
    browser.history.pushState(currentState, "", currentUrl);
  };
  browser.addEventListener("beforeunload", unload);
  browser.document.addEventListener("click", click, true);
  browser.addEventListener("popstate", pop, true);
  return () => { browser.removeEventListener("beforeunload", unload); browser.document.removeEventListener("click", click, true); browser.removeEventListener("popstate", pop, true); };
}
export const installTheoryLeaveGuard = installInstructorLeaveGuard;
