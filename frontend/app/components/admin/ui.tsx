"use client";

import { useId, type ReactNode } from "react";
import { StudentIcon as Icon, type StudentIconName } from "../student/student-icon";
import type { AccountStatus, CourseStatus, Metric, Page } from "../../lib/admin/types";
import type { Resource } from "./use-admin-resource";
export { Modal, Actions } from "../instructor/ui";
export { Icon };

export function Heading({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return <div className="adm-page-heading"><div><p className="adm-eyebrow">ADMIN WORKSPACE</p><h1>{title}</h1><p className="adm-muted">{description}</p></div>{children && <div className="adm-heading-actions">{children}</div>}</div>;
}
export function Panel({ title, subtitle, children, action, className = "" }: { title: string; subtitle?: string; children: ReactNode; action?: ReactNode; className?: string }) {
  return <section className={`adm-panel ${className}`}><div className="adm-panel-heading"><div><h2>{title}</h2>{subtitle && <p className="adm-muted">{subtitle}</p>}</div>{action}</div>{children}</section>;
}
export function Empty({ title, children, icon = "layers" }: { title: string; children: ReactNode; icon?: StudentIconName }) {
  return <div className="adm-empty"><span className="adm-empty-icon"><Icon name={icon} /></span><h3>{title}</h3><p>{children}</p></div>;
}
export function Loading({ rows = 4 }: { rows?: number }) {
  return <div className="adm-loading" role="status"><span className="sr-only">Loading admin data…</span>{Array.from({ length: rows }, (_, i) => <div key={i} className="adm-skeleton" aria-hidden="true" />)}</div>;
}
export function ResourceView<T>({ resource, children }: { resource: Resource<T> & { retry: () => void }; children: (data: T) => ReactNode }) {
  if (resource.status === "loading") return <Loading />;
  if (resource.status === "error") return <div className="adm-resource-error" role={resource.error.kind === "unavailable" ? "status" : "alert"}><Empty title={resource.error.kind === "unavailable" ? "Awaiting backend integration" : resource.error.kind === "forbidden" ? "Admin permission required" : "Unable to load data"}>{resource.error.message}</Empty><button className="adm-button adm-secondary" onClick={resource.retry}>Try again</button></div>;
  return children(resource.data);
}
export function Value({ value, percent = false }: { value: Metric | undefined; percent?: boolean }) {
  return <>{value == null ? <span title="Metric unavailable" aria-label="Unavailable">—</span> : `${new Intl.NumberFormat("en", { maximumFractionDigits: percent ? 1 : 0 }).format(value)}${percent ? "%" : ""}`}</>;
}
export function Stat({ label, value, description, icon = "progress", percent = false, loading = false }: { label: string; value?: Metric; description: string; icon?: StudentIconName; percent?: boolean; loading?: boolean }) {
  return <article className="adm-stat"><div><span>{label}</span><span className="adm-stat-icon"><Icon name={icon} /></span></div><strong>{loading ? <span className="adm-skeleton" aria-label="Loading" /> : <Value value={value} percent={percent} />}</strong><p>{value == null && !loading ? "Metric unavailable" : description}</p></article>;
}
export function DateText({ value, time = false }: { value?: string | null; time?: boolean }) {
  if (!value || !Number.isFinite(Date.parse(value))) return <span className="adm-muted">Unavailable</span>;
  return <time dateTime={value} title={value}>{new Intl.DateTimeFormat("en", { dateStyle: "medium", ...(time ? { timeStyle: "short" } : {}), timeZone: "UTC" }).format(new Date(value))}{time ? " UTC" : ""}</time>;
}
export function Badge({ value }: { value: AccountStatus | CourseStatus | string }) {
  return <span className={`adm-badge ${value.toLowerCase()}`}><span aria-hidden="true" />{value === "unknown" ? "Unavailable" : value.replaceAll("_", " ")}</span>;
}
export function Avatar({ name, large = false }: { name: string; large?: boolean }) {
  return <span className={`adm-avatar${large ? " large" : ""}`} aria-hidden="true">{name.trim().split(/\s+/).map(part => part[0]).slice(0, 2).join("").toUpperCase()}</span>;
}
export function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return <label className={`adm-field ${className}`}><span>{label}</span>{children}</label>;
}
export function Pagination({ data, onPage }: { data: Pick<Page<unknown>, "page" | "pageSize" | "total">; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  return <nav className="adm-pagination" aria-label="Table pagination"><p>{data.total === 0 ? "0 results" : `${(data.page - 1) * data.pageSize + 1}–${Math.min(data.page * data.pageSize, data.total)} of ${data.total} results`}</p><div><button className="adm-button adm-secondary" disabled={data.page <= 1} onClick={() => onPage(data.page - 1)}>Previous</button><span>Page {data.page} of {pages}</span><button className="adm-button adm-secondary" disabled={data.page >= pages} onClick={() => onPage(data.page + 1)}>Next</button></div></nav>;
}
export function DetailGrid({ items }: { items: { label: string; value: ReactNode }[] }) {
  return <dl className="adm-detail-grid">{items.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>;
}
export function Info({ children }: { children: ReactNode }) {
  return <p className="adm-info"><Icon name="book" /> <span>{children}</span></p>;
}
export function ReasonField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const id = useId();
  return <div className="adm-field"><label htmlFor={id}>Reason for this action</label><textarea id={id} value={value} onChange={e => onChange(e.target.value)} minLength={5} maxLength={500} required placeholder="Add context for the audit log (5–500 characters)." /></div>;
}
