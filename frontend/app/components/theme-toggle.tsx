"use client";

import { useLayoutEffect } from "react";
import { Icon } from "./landing/landing-icon";
import "./theme-toggle.css";

const storageKey = "decode-theme";

export function ThemeToggle() {
  useLayoutEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(storageKey); } catch { /* Keep the preference for this visit. */ }
    document.documentElement.dataset.theme = saved === "dark" || saved === "light"
      ? saved : document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    const storage = (event: StorageEvent) => {
      if (event.key !== storageKey && event.key !== null) return;
      document.documentElement.dataset.theme = event.newValue === "dark" ? "dark" : "light";
    };
    window.addEventListener("storage", storage);
    return () => {
      window.removeEventListener("storage", storage);
    };
  }, []);

  function toggle() {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(storageKey, next); } catch { /* Still works for this visit. */ }
  }

  // CSS selects the correct icon and accessible name before hydration as well.
  return (
    <button type="button" className="decode-icon-button decode-theme-toggle" onClick={toggle}>
      <span className="decode-theme-to-dark"><Icon name="moon" className="size-[22px]" strokeWidth={2} /><span className="sr-only">Switch to dark mode</span></span>
      <span className="decode-theme-to-light"><Icon name="sun" className="size-[22px]" strokeWidth={2} /><span className="sr-only">Switch to light mode</span></span>
    </button>
  );
}
