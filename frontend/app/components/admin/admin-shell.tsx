"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Wordmark } from "../landing/wordmark";
import { ThemeToggle } from "../theme-toggle";
import type { StudentIconName } from "../student/student-icon";
import { AdminLogout, useAdmin } from "./admin-provider";
import { Actions, Avatar, Icon, Modal } from "./ui";

const groups: { label: string; items: { label: string; href: string; icon: StudentIconName }[] }[] = [
  { label: "Overview", items: [{ label: "Dashboard", href: "/admin", icon: "dashboard" }] },
  { label: "Management", items: [{ label: "Users", href: "/admin/users", icon: "profile" }, { label: "Instructors", href: "/admin/instructors", icon: "book" }, { label: "Courses", href: "/admin/courses", icon: "courses" }] },
  { label: "Insights", items: [{ label: "Analytics", href: "/admin/analytics", icon: "progress" }, { label: "Activity Logs", href: "/admin/activity", icon: "clock" }] },
  { label: "Workspace", items: [{ label: "Settings", href: "/admin/settings", icon: "layers" }, { label: "Profile", href: "/admin/profile", icon: "profile" }] },
];
export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname(), { user, logoutError } = useAdmin();
  const [collapsed, setCollapsed] = useState(false), [drawer, setDrawer] = useState(false);
  const [tooltip, setTooltip] = useState<{ label: string; top: number } | null>(null);
  const menu = useRef<HTMLButtonElement>(null);
  const title = groups.flatMap(group => group.items).find(item => item.href === pathname)?.label ?? "Admin workspace";
  useEffect(() => {
    const restore = () => {
      try {
        const saved = localStorage.getItem("decode-admin-sidebar-collapsed");
        setCollapsed(saved === "true" || saved === null && window.matchMedia("(min-width: 761px) and (max-width: 1100px)").matches);
      } catch { /* Optional preference. */ }
    };
    restore();
    const resize = () => { if (window.matchMedia("(min-width: 761px)").matches) setDrawer(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setTooltip(null); };
    window.addEventListener("resize", resize); window.addEventListener("keydown", escape);
    return () => { window.removeEventListener("resize", resize); window.removeEventListener("keydown", escape); };
  }, []);
  function toggle() {
    setTooltip(null); setCollapsed(!collapsed);
    try { localStorage.setItem("decode-admin-sidebar-collapsed", String(!collapsed)); } catch { /* Still works this visit. */ }
  }
  function showTooltip(target: HTMLAnchorElement, label: string) {
    if (collapsed && window.matchMedia("(min-width: 761px)").matches) setTooltip({ label, top: target.getBoundingClientRect().top + 22 });
  }
  function navigation(mobile = false) {
    return <nav aria-label={mobile ? "Mobile admin navigation" : "Admin navigation"}>{groups.map(group => <div className="adm-nav-group" key={group.label}><p className="adm-nav-label">{group.label}</p>{group.items.map(item => <Link key={item.href} className="adm-nav-link" href={item.href} aria-label={item.label} aria-current={pathname === item.href ? "page" : undefined} aria-describedby={!mobile && tooltip?.label === item.label ? "adm-tooltip" : undefined} onMouseEnter={e => { if (!mobile) showTooltip(e.currentTarget, item.label); }} onMouseLeave={() => setTooltip(null)} onFocus={e => { if (!mobile) showTooltip(e.currentTarget, item.label); }} onBlur={() => setTooltip(null)} onClick={() => { setDrawer(false); setTooltip(null); }}><Icon name={item.icon} /><span>{item.label}</span><i aria-hidden="true" /></Link>)}</div>)}</nav>;
  }
  return <div className={`adm-app${collapsed ? " is-collapsed" : ""}`}>
    <a className="decode-skip" href="#admin-main">Skip to admin content</a>
    <aside className="adm-sidebar"><Link href="/admin" className="adm-brand" aria-label="DECODE admin dashboard"><Wordmark /></Link><div className="adm-workspace-label"><span>A</span><div><strong>Admin Workspace</strong><small>Platform management</small></div></div>{navigation()}<div className="adm-sidebar-foot"><div className="adm-access"><span />ADMIN ACCESS</div><AdminLogout compact={collapsed} /></div><button className="adm-collapse" onClick={toggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed}><Icon name="chevron" /><span>Collapse sidebar</span></button></aside>
    {tooltip && <span role="tooltip" id="adm-tooltip" className="adm-tooltip" style={{ top: tooltip.top }}>{tooltip.label}</span>}
    <div className="adm-workspace"><header className="adm-header"><button ref={menu} className="adm-icon-button adm-mobile-toggle" aria-label="Open navigation" aria-expanded={drawer} onClick={() => setDrawer(true)}><Icon name="menu" /></button><nav className="adm-breadcrumb" aria-label="Breadcrumb"><Link href="/admin">Workspace</Link><Icon name="chevron" /><span aria-current="page">{title}</span></nav><div className="adm-header-actions"><span className="adm-admin-label">Administrator</span><ThemeToggle /><Actions label={`Account menu for ${user.name}`}><p className="adm-menu-user"><strong>{user.name}</strong><span>{user.email}</span></p><Link href="/admin/profile">View profile</Link><Link href="/admin/settings">Account settings</Link><AdminLogout /></Actions><span className="adm-header-avatar"><Avatar name={user.name} /></span></div></header>
      <main id="admin-main" className="adm-main" tabIndex={-1}>{logoutError && <p className="adm-error" role="alert">{logoutError}</p>}{children}</main><footer className="adm-footer"><span>DECODE <span aria-hidden="true">/</span> Admin Workspace</span><span>Learn. Practice. Build.</span></footer>
    </div>{drawer && <Modal title="Admin navigation" drawer onClose={() => { setDrawer(false); requestAnimationFrame(() => menu.current?.focus()); }}><div className="adm-mobile-nav">{navigation(true)}<AdminLogout /></div></Modal>}
  </div>;
}
