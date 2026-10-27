"use client";

import { useEffect, useState } from "react";
import { Icon } from "../landing/landing-icon";

// Uses the existing decode-theme storage key and root data-theme attribute.
// The established theme supports light and dark; no second system preference.
export function Appearance() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const sync = () => setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
    sync();
    const observer = new MutationObserver(sync); observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);
  function change(value: "light" | "dark") {
    document.documentElement.setAttribute("data-theme", value); setTheme(value);
    try { localStorage.setItem("decode-theme", value); } catch { /* Theme still applies for this visit. */ }
  }
  return <fieldset className="adm-appearance"><legend>Theme preference</legend>{(["light", "dark"] as const).map(value => <label className={`adm-theme-option ${value}`} key={value}><input type="radio" name="admin-theme" value={value} checked={theme === value} onChange={() => change(value)} /><span className="adm-theme-preview" aria-hidden="true"><i /><span><i /><i /><i /></span></span><span className="adm-theme-label"><Icon name={value === "light" ? "sun" : "moon"} />{value === "light" ? "Light mode" : "Dark mode"}</span></label>)}</fieldset>;
}
