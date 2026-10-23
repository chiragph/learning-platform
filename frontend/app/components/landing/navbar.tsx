"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AccessButton } from "./interactions";
import { Icon } from "./landing-icon";
import { Wordmark } from "./wordmark";

const links = [{ label: "Home", href: "#home" }, { label: "Skills", href: "#skills" }, { label: "Our Goal", href: "#our-goal" }];

function subscribeToHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function getActiveHref() {
  const hash = window.location.hash;
  return links.some((link) => link.href === hash) ? hash : "#home";
}

function getServerHref() {
  return "#home";
}

export function Navbar() {
  const [open, setOpen] = useState(false);
  const activeHref = useSyncExternalStore(subscribeToHash, getActiveHref, getServerHref);
  const header = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); toggle.current?.focus(); } };
    const outside = (event: PointerEvent) => { if (!header.current?.contains(event.target as Node)) setOpen(false); };
    const desktop = window.matchMedia("(min-width: 768px)");
    const resize = () => { if (desktop.matches) setOpen(false); };
    document.addEventListener("keydown", escape);
    document.addEventListener("pointerdown", outside);
    desktop.addEventListener("change", resize);
    return () => { document.removeEventListener("keydown", escape); document.removeEventListener("pointerdown", outside); desktop.removeEventListener("change", resize); };
  }, [open]);

  return (
    <header ref={header} className="decode-header sticky top-0 z-30 border-b border-border" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
      <div className="decode-container flex h-[72px] items-center justify-between gap-4">
        <a className="decode-logo-link inline-flex shrink-0" href="#home" aria-label="DECODE home" onClick={() => setOpen(false)}><Wordmark /></a>
        <nav className="hidden items-center gap-8 text-sm md:flex" aria-label="Main navigation">{links.map((link) => <a className="decode-nav-link" key={link.href} href={link.href} aria-current={activeHref === link.href ? "location" : undefined}>{link.label}</a>)}</nav>
        <div className="hidden items-center gap-5 md:flex"><AccessButton intent="signin" className="decode-nav-link min-h-11 text-sm font-medium">Sign In</AccessButton><AccessButton className="decode-button decode-button-primary text-sm">Get Started</AccessButton></div>
        <button id="navigation-toggle" ref={toggle} className="decode-icon-button md:hidden" type="button" aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen((value) => !value)}><Icon name={open ? "close" : "menu"} className="size-5" /></button>
      </div>
      <nav id="mobile-navigation" aria-label="Mobile navigation" className="decode-mobile-nav md:hidden" hidden={!open}>
        <div className="decode-container flex flex-col gap-2 pb-6 pt-2">{links.map((link) => <a key={link.href} className="decode-nav-link flex min-h-11 items-center text-base" href={link.href} aria-current={activeHref === link.href ? "location" : undefined} onClick={() => setOpen(false)}>{link.label}</a>)}<div className="mt-3 flex flex-wrap items-center gap-3"><AccessButton intent="signin" className="decode-button decode-button-secondary">Sign In</AccessButton><AccessButton className="decode-button decode-button-primary">Get Started</AccessButton></div></div>
      </nav>
    </header>
  );
}
