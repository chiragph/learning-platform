"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Wordmark } from "../landing/wordmark";
import { ThemeToggle } from "../theme-toggle";
import { LogoutButton, useStudent } from "./student-provider";
import { ProgressProvider } from "./progress-provider";
import { StudentIcon, type StudentIconName } from "./student-icon";

const groups: { label: string; items: { href: string; label: string; icon: StudentIconName }[] }[] = [
  { label: "Learn", items: [
    { href: "/dashboard", label: "Overview", icon: "dashboard" },
    { href: "/courses", label: "My courses", icon: "courses" },
    { href: "/lessons", label: "Theory lessons", icon: "lesson" },
    { href: "/quizzes", label: "Quizzes", icon: "quiz" },
  ] },
  { label: "Build", items: [
    { href: "/playground", label: "Code playground", icon: "code" },
    { href: "/challenges", label: "Coding challenges", icon: "challenge" },
    { href: "/projects", label: "Projects", icon: "project" },
  ] },
  { label: "Your journey", items: [
    { href: "/progress", label: "My progress", icon: "progress" },
    { href: "/profile", label: "Profile", icon: "profile" },
  ] },
];

export function StudentShell({ children }: { children: ReactNode }) {
  const student = useStudent();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const profile = useRef<HTMLDetailsElement>(null);
  const active = groups.flatMap((g) => g.items).find((item) => pathname === item.href || pathname.startsWith(item.href + "/"));

  function closeNavigation() {
    setOpen(false);
    requestAnimationFrame(() => menu.current?.focus());
  }

  useEffect(() => {
    const closeProfile = (event: PointerEvent) => { if (!profile.current?.contains(event.target as Node)) profile.current?.removeAttribute("open"); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && profile.current?.open) { profile.current.removeAttribute("open"); profile.current.querySelector("summary")?.focus(); } };
    window.addEventListener("pointerdown", closeProfile); window.addEventListener("keydown", escape);
    return () => { window.removeEventListener("pointerdown", closeProfile); window.removeEventListener("keydown", escape); };
  }, []);

  useEffect(() => {
    if (!open) return;
    sidebar.current?.querySelector<HTMLAnchorElement>("a[aria-current]")?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); requestAnimationFrame(() => menu.current?.focus()); }
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

  return <div className="decode student-app">
    <a href="#student-content" className="decode-skip">Skip to learning content</a>
    <header className="student-header" inert={open}>
      <Link href="/dashboard" className="student-brand" aria-label="DECODE dashboard"><Wordmark /></Link>
      <div className="student-breadcrumb"><span>Workspace</span><StudentIcon name="chevron" /><span>{active?.label ?? "Learning"}</span></div>
      <div className="student-header-actions">
        <ThemeToggle />
        <details ref={profile} className="student-profile-menu">
          <summary aria-label={`Open profile menu for ${student.label}`}>
            <span className="student-avatar">{student.id.slice(0, 1).toUpperCase()}</span>
            <span className="student-profile-label"><strong>{student.label}</strong><span>Student · local demo</span></span>
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
        <nav aria-label="Student">
          {groups.map((group) => <div className="student-nav-group" key={group.label}>
            <p className="student-nav-label">{group.label}</p>
            {group.items.map(({ href, label, icon }) => <Link className="student-nav-link" key={href} href={href} aria-current={pathname === href || pathname.startsWith(href + "/") ? "page" : undefined} onClick={() => setOpen(false)}><StudentIcon name={icon} /><span>{label}</span><span className="student-nav-dot" aria-hidden="true" /></Link>)}
          </div>)}
        </nav>
        <div className="student-sidebar-foot"><span className="student-demo-badge"><span aria-hidden="true" />Local demo workspace</span><p>Progress stays in this browser. Demo sign-in is not secure authentication.</p><LogoutButton /><Link className="student-sidebar-home" href="/">Back to DECODE home <StudentIcon name="arrow" /></Link></div>
      </aside>
      <main id="student-content" tabIndex={-1} inert={open} className="student-main"><ProgressProvider key={student.id}>{children}</ProgressProvider></main>
    </div>
  </div>;
}
