"use client";

import { useEffect, useRef, useState } from "react";
import { AccessButton } from "./interactions";
import { Icon } from "./landing-icon";
import { Wordmark } from "./wordmark";
import { ThemeToggle } from "../theme-toggle";
import { getActiveSection } from "./section-tracking";

const links = [{ label: "Home", href: "#home" }, { label: "Skills", href: "#skills" }, { label: "Our Goal", href: "#our-goal" }];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [activeHref, setActiveHref] = useState("#home");
  const active = useRef("#home");
  const header = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let frame = 0;
    const sections = links.map((link) => ({ ...link, element: document.getElementById(link.href.slice(1)) }));
    const update = () => {
      frame = 0;
      // Measure only the navbar row, excluding an expanded mobile menu.
      const height = header.current?.firstElementChild?.getBoundingClientRect().height ?? 72;
      const line = height + Math.min(160, Math.max(24, (window.innerHeight - height) * .25));
      const positions = sections.filter((section) => section.element).map((section) => ({
        href: section.href, top: section.element!.getBoundingClientRect().top,
      }));
      const next = getActiveSection(positions, active.current, line);
      if (next !== active.current) { active.current = next; setActiveHref(next); }
    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(update); };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("hashchange", schedule);
    const resize = new ResizeObserver(schedule);
    sections.forEach(({ element }) => { if (element) resize.observe(element); });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("hashchange", schedule);
      resize.disconnect();
    };
  }, []);

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
        <div className="flex items-center gap-3 md:gap-5">
        <div className="hidden items-center gap-5 md:flex"><AccessButton intent="signin" className="decode-nav-link min-h-11 text-sm font-medium">Sign In</AccessButton><AccessButton className="decode-button decode-button-primary text-sm">Get Started</AccessButton></div>
        <ThemeToggle />
        <button id="navigation-toggle" ref={toggle} className="decode-icon-button md:hidden" type="button" aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen((value) => !value)}><Icon name={open ? "close" : "menu"} className="size-5" /></button>
        </div>
      </div>
      <nav id="mobile-navigation" aria-label="Mobile navigation" className="decode-mobile-nav md:hidden" hidden={!open}>
        <div className="decode-container flex flex-col gap-2 pb-6 pt-2">{links.map((link) => <a key={link.href} className="decode-nav-link flex min-h-11 items-center text-base" href={link.href} aria-current={activeHref === link.href ? "location" : undefined} onClick={() => setOpen(false)}>{link.label}</a>)}<div className="mt-3 flex flex-wrap items-center gap-3"><AccessButton intent="signin" className="decode-button decode-button-secondary">Sign In</AccessButton><AccessButton className="decode-button decode-button-primary">Get Started</AccessButton></div></div>
      </nav>
    </header>
  );
}
