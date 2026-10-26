"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Wordmark } from "../landing/wordmark";
import { ThemeToggle } from "../theme-toggle";
import { InstructorProvider } from "./instructor-provider";
import { Actions, Icon, Modal } from "./ui";
import type { StudentIconName } from "../student/student-icon";

const groups: { title: string; items: { title: string; href: string; icon: StudentIconName }[] }[] = [
  { title: "WORKSPACE", items: [{ title: "Overview", href: "/instructor", icon: "dashboard" }, { title: "My Courses", href: "/instructor/courses", icon: "courses" }, { title: "Curriculum Builder", href: "/instructor/curriculum", icon: "layers" }] },
  { title: "CONTENT", items: [{ title: "Theory Lessons", href: "/instructor/theory", icon: "lesson" }, { title: "Quizzes", href: "/instructor/quizzes", icon: "quiz" }, { title: "Coding Labs", href: "/instructor/labs", icon: "code" }, { title: "Workshops", href: "/instructor/workshops", icon: "project" }] },
  { title: "MANAGEMENT", items: [{ title: "Student Insights", href: "/instructor/insights", icon: "progress" }, { title: "Profile & Settings", href: "/instructor/settings", icon: "profile" }] },
];
export function InstructorShell({ children }: { children: ReactNode }) {
  const pathname = usePathname(), [collapsed, setCollapsed] = useState(false), [drawer, setDrawer] = useState(false);
  const title = groups.flatMap(g => g.items).find(item => item.href === pathname)?.title ?? "Workspace";
  useEffect(() => {
    const resize = () => { if (window.matchMedia("(min-width: 861px)").matches) setDrawer(false); };
    window.addEventListener("resize", resize); return () => window.removeEventListener("resize", resize);
  }, []);
  function navigation() {
    return <><nav aria-label="Instructor navigation">{groups.map(group => <div className="ins-nav-group" key={group.title}><p className="ins-nav-label">{group.title}</p>{group.items.map(item => <Link key={item.href} href={item.href} className="ins-nav-link" title={collapsed ? item.title : undefined} aria-current={pathname === item.href ? "page" : undefined} onClick={() => setDrawer(false)}><Icon name={item.icon} /><span>{item.title}</span><i aria-hidden="true" /></Link>)}</div>)}</nav><div className="ins-sidebar-foot"><span className="ins-preview-dot" /> <strong>Development preview</strong><p>Local content workspace.<br />Student publishing awaits integration.</p><Link href="/">Back to DECODE <Icon name="arrow" /></Link></div></>;
  }
  return <div className={`ins-app${collapsed ? " is-collapsed" : ""}`}>
    <a className="ins-skip" href="#instructor-main">Skip to content</a>
    <aside className="ins-sidebar"><Link href="/instructor" className="ins-brand decode-logo-link" aria-label="DECODE instructor overview"><Wordmark /></Link><div className="ins-workspace-label"><span>I</span><div><strong>Instructor workspace</strong><small>Content & curriculum</small></div></div>{navigation()}<button type="button" className="ins-collapse" onClick={() => setCollapsed(!collapsed)} aria-expanded={!collapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}><Icon name="menu" /><span>Collapse sidebar</span></button></aside>
    <div className="ins-workspace"><header className="ins-header"><button type="button" className="ins-icon-button ins-mobile-toggle" aria-label="Open navigation" aria-expanded={drawer} onClick={() => setDrawer(true)}><Icon name="menu" /></button><nav aria-label="Breadcrumb" className="ins-breadcrumb"><Link href="/instructor">Workspace</Link><Icon name="chevron" /><span aria-current="page">{title}</span></nav><div className="ins-header-actions"><span className="ins-preview-label">DEV PREVIEW</span><ThemeToggle /><Actions label="Instructor preview profile"><p><strong>Instructor preview</strong><span>No signed-in instructor identity</span></p><Link href="/instructor/settings">Profile & settings</Link><Link href="/">Back to DECODE</Link></Actions></div></header>
      <div className="ins-preview-bar"><span className="ins-preview-dot" /><span><strong>Development preview</strong> · Changes stay in this browser. Student data and access are separate.</span></div>
      <main id="instructor-main" className="ins-main" tabIndex={-1}><InstructorProvider>{children}</InstructorProvider></main><footer className="ins-footer">DECODE / Instructor workspace <span>Stage 5A · Local preview</span></footer>
    </div>{drawer && <Modal title="Instructor workspace" drawer onClose={() => setDrawer(false)}>{navigation()}</Modal>}
  </div>;
}
