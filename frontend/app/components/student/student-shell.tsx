"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Wordmark } from "../landing/wordmark";
import { ThemeToggle } from "../theme-toggle";
import { LogoutButton, useStudent } from "./student-provider";
import { ProgressProvider } from "./progress-provider";
import { ActivityVisitTracker } from "./activity-visit-tracker";
import { StudentIcon, type StudentIconName } from "./student-icon";
import { StudentNavigationProvider } from "./page-navigation";
import { useOptionalStudentProfile } from "./profile-provider";
import { StudentAvatar } from "./student-avatar";
import "./student-interactions.css";
import "./sidebar.css";

const groups: { label: string; items: { href: string; label: string; icon: StudentIconName }[] }[] = [
  { label: "Learn", items: [
    { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
    { href: "/courses", label: "My Learning", icon: "courses" },
    { href: "/playground", label: "Code Playground", icon: "code" },
  ] },
  { label: "Account", items: [
    { href: "/progress", label: "My Progress", icon: "progress" },
    { href: "/profile", label: "Profile", icon: "profile" },
  ] },
];

export function StudentShell({ children }: { children: ReactNode }) {
  const student = useStudent();
  const studentProfile = useOptionalStudentProfile();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [tooltip, setTooltip] = useState<{ label: string; top: number } | null>(null);
  function showTooltip(target: HTMLAnchorElement, label: string) {
    if (collapsed && window.matchMedia("(min-width: 761px)").matches) { const bounds = target.getBoundingClientRect(); setTooltip({ label, top: bounds.top + bounds.height / 2 }); }
  }
  useEffect(() => {
    const restore = () => { try { setCollapsed(window.localStorage.getItem("decode-sidebar-collapsed") === "true"); } catch { /* Optional UI preference. */ } };
    restore();
    const storage = (event: StorageEvent) => { if (event.key === "decode-sidebar-collapsed" || event.key === null) restore(); };
    window.addEventListener("storage", storage); return () => window.removeEventListener("storage", storage);
  }, []);
  function toggleSidebar() {
    setTooltip(null);
    const next = !collapsed; setCollapsed(next);
    try { window.localStorage.setItem("decode-sidebar-collapsed", String(next)); } catch { /* Still works for this visit. */ }
  }
  const menu = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const profile = useRef<HTMLDetailsElement>(null);
  const learningRoute = /^\/(lessons|quizzes|challenges|projects|activities)(\/|$)/.test(pathname);
  const active = groups.flatMap((g) => g.items).find((item) => pathname === item.href || pathname.startsWith(item.href + "/") || item.href === "/courses" && learningRoute);

  function closeNavigation() {
    setOpen(false);
    requestAnimationFrame(() => menu.current?.focus({ preventScroll: true }));
  }

  useEffect(() => {
    const closeProfile = (event: PointerEvent) => { if (!profile.current?.contains(event.target as Node)) profile.current?.removeAttribute("open"); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setTooltip(null); if (profile.current?.open) { profile.current.removeAttribute("open"); profile.current.querySelector("summary")?.focus(); } } };
    window.addEventListener("pointerdown", closeProfile); window.addEventListener("keydown", escape);
    return () => { window.removeEventListener("pointerdown", closeProfile); window.removeEventListener("keydown", escape); };
  }, []);

  useEffect(() => {
    if (!open) return;
    sidebar.current?.querySelector<HTMLAnchorElement>("a[aria-current]")?.focus({ preventScroll: true });
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); requestAnimationFrame(() => menu.current?.focus({ preventScroll: true })); }
      if (event.key !== "Tab") return;
      const focusable = sidebar.current?.querySelectorAll<HTMLElement>("a[href], button:not(:disabled)");
      if (!focusable?.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    const width = window.matchMedia("(min-width: 761px)");
    const closeOnDesktop = () => { if (width.matches) setOpen(false); };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", keyboard); width.addEventListener("change", closeOnDesktop);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", keyboard); width.removeEventListener("change", closeOnDesktop); };
  }, [open]);

  return <div className="decode student-app" data-sidebar-collapsed={collapsed}>
    <a href="#student-content" className="decode-skip">Skip to learning content</a>
    <header className="student-header" inert={open}>
      <Link href="/dashboard" className="student-brand" aria-label="DECODE dashboard"><Wordmark /></Link>
      <div className="student-breadcrumb"><span>Workspace</span><StudentIcon name="chevron" /><span>{active?.label ?? "Learning"}</span></div>
      <div className="student-header-actions">
        <ThemeToggle />
        <details ref={profile} className="student-profile-menu">
          <summary aria-label={`Open profile menu for ${student.label}`}>
            <StudentAvatar avatar={studentProfile?.profile.avatar} className="student-header-avatar" />
            <span className="student-profile-label"><strong>{student.label}</strong><span>Student account</span></span>
            <StudentIcon name="chevron" className="student-profile-chevron" />
          </summary>
          <div><p>{student.label}<span className="student-muted">{student.email}</span></p><Link href="/profile" onClick={() => profile.current?.removeAttribute("open")}>View profile <StudentIcon name="arrow" /></Link><LogoutButton /></div>
        </details>
        <button ref={menu} className="student-icon-button student-menu-toggle" aria-label="Open navigation" aria-expanded={open} aria-controls="student-navigation" onClick={() => setOpen(true)}><StudentIcon name="menu" /></button>
      </div>
    </header>
    <div className="student-layout">
      {open && <button className="student-nav-backdrop" aria-label="Close navigation" tabIndex={-1} onClick={closeNavigation} />}
      <aside ref={sidebar} id="student-navigation" className={`student-sidebar${open ? " open" : ""}`} role={open ? "dialog" : undefined} aria-modal={open ? true : undefined} aria-label={open ? "Student navigation" : undefined}>
        <div className="student-mobile-nav-heading"><span>Learning workspace</span><button className="student-icon-button" onClick={closeNavigation} aria-label="Close navigation"><StudentIcon name="close" /></button></div>
        <button className="student-sidebar-toggle" onClick={toggleSidebar} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} aria-controls="student-sidebar-links" title={collapsed ? "Expand sidebar" : "Collapse sidebar"}><StudentIcon name="chevron" /><span>{collapsed ? "Expand" : "Collapse sidebar"}</span></button>
        <nav id="student-sidebar-links" aria-label="Student">
          {groups.map((group) => <div className="student-nav-group" key={group.label}>
            <p className="student-nav-label">{group.label}</p>
            {group.items.map(({ href, label, icon }) => <Link className="student-nav-link" key={href} href={href} aria-label={label} aria-describedby={tooltip?.label === label ? "student-nav-tooltip" : undefined} onFocus={(event) => showTooltip(event.currentTarget, label)} onBlur={() => setTooltip(null)} onMouseEnter={(event) => showTooltip(event.currentTarget, label)} onMouseLeave={() => setTooltip(null)} aria-current={active?.href === href ? "page" : undefined} onClick={() => { setOpen(false); setTooltip(null); }}><StudentIcon name={icon} /><span>{label}</span><span className="student-nav-dot" aria-hidden="true" /></Link>)}
          </div>)}
        </nav>
        <div className="student-sidebar-foot"><span className="student-demo-badge"><span aria-hidden="true" />Browser-local learning</span><p>Progress and code drafts stay in this browser for your account.</p><LogoutButton /><Link className="student-sidebar-home" href="/">Back to DECODE home <StudentIcon name="arrow" /></Link></div>
      </aside>
      {collapsed && tooltip && <span id="student-nav-tooltip" role="tooltip" className="student-nav-tooltip" style={{ top: tooltip.top }}>{tooltip.label}</span>}
      <main id="student-content" tabIndex={-1} inert={open} className="student-main"><StudentNavigationProvider><ProgressProvider key={student.id}><ActivityVisitTracker />{children}</ProgressProvider></StudentNavigationProvider></main>
    </div>
  </div>;
}
