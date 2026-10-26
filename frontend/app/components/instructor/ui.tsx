"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { StudentIcon as Icon } from "../student/student-icon";
import { formatInstructorTimestamp } from "../../lib/instructor/dates";
import type { ContentTimestamps, CourseFields, PublicationStatus } from "../../lib/instructor/types";
export { StudentIcon as Icon } from "../student/student-icon";

export function Modal({ title, children, onClose, drawer = false, descriptionId }: { title: string; children: ReactNode; onClose: () => void; drawer?: boolean; descriptionId?: string }) {
  const ref = useRef<HTMLDialogElement>(null), titleId = useId();
  useEffect(() => {
    const dialog = ref.current!, previous = document.activeElement as HTMLElement | null;
    dialog.showModal(); (dialog.querySelector<HTMLElement>("[data-autofocus]") ?? dialog.querySelector<HTMLElement>("button"))?.focus();
    return () => { dialog.close(); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  return <dialog ref={ref} className={`ins-dialog${drawer ? " ins-drawer" : ""}`} aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="ins-dialog-head"><h2 id={titleId}>{title}</h2><button type="button" className="ins-icon-button" aria-label="Close dialog" onClick={onClose}><Icon name="close" /></button></div>{children}
  </dialog>;
}
export function Confirm({ title, children, label, onConfirm, onClose, destructive = false, error }: { title: string; children: ReactNode; label: string; onConfirm: () => void; onClose: () => void; destructive?: boolean; error?: string }) {
  const descriptionId = useId();
  return <Modal title={title} descriptionId={descriptionId} onClose={onClose}><p id={descriptionId} className="ins-dialog-copy">{children}</p>{error && <p className="ins-error" role="alert">{error}</p>}<div className="ins-dialog-actions"><button type="button" className="ins-button secondary" data-autofocus onClick={onClose}>Cancel</button><button type="button" className={`ins-button${destructive ? " destructive" : ""}`} onClick={onConfirm}>{destructive && <TrashIcon />}{label}</button></div></Modal>;
}
export function TrashIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></svg>;
}
export function DeleteAction({ label, issue, disabled, onClick }: { label: string; issue: string | null; disabled: boolean; onClick: () => void }) {
  const descriptionId = useId();
  return <><button type="button" className="ins-delete-action" disabled={disabled || !!issue} title={issue ?? undefined} aria-describedby={issue ? descriptionId : undefined} onClick={onClick}><TrashIcon />{label}</button>{issue && <p className="ins-delete-reason" id={descriptionId}>{issue}</p>}</>;
}
// Native disclosure + ordinary buttons/links: Tab navigates actions, Escape and
// outside clicks dismiss. Avoids claiming ARIA menu semantics without arrow keys.
export function Actions({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) ref.current?.removeAttribute("open"); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && ref.current?.open) { event.preventDefault(); ref.current.removeAttribute("open"); ref.current.querySelector("summary")?.focus(); } };
    document.addEventListener("pointerdown", close); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, []);
  return <details ref={ref} className="ins-actions" onClick={e => { if ((e.target as Element).closest("button,a")) { ref.current?.removeAttribute("open"); ref.current?.querySelector("summary")?.focus(); } }}><summary aria-label={label} title={label}><span aria-hidden="true">•••</span></summary><div className="ins-action-list">{children}</div></details>;
}
export function Status({ status, archived = false }: { status: PublicationStatus; archived?: boolean }) {
  return <span className={`ins-status ${archived ? "archived" : status}`}><span aria-hidden="true" />{archived ? "Archived" : status === "published" ? "Published" : "Draft"}</span>;
}
export function CourseMark({ course }: { course: Pick<CourseFields, "color" | "icon"> }) {
  return <span className={`ins-course-mark ${course.color}`} aria-hidden="true">{course.icon === "code" ? "</>" : course.icon === "braces" ? "{ }" : <Icon name="book" />}</span>;
}
export function Modified({ at, unavailable = "Unavailable" }: { at?: string | null; unavailable?: string }) {
  const formatted = formatInstructorTimestamp(at);
  return formatted ? <time dateTime={at!} title={`${formatted} (${Intl.DateTimeFormat().resolvedOptions().timeZone})`}>{formatted}</time> : <span>{unavailable}</span>;
}
export function TimestampMetadata({ record, publication = false }: { record: ContentTimestamps & { publishedAt?: string | null; status?: PublicationStatus; hasBeenPublished?: boolean }; publication?: boolean }) {
  return <dl className="ins-timestamps" aria-label="Content dates"><div><dt>Created</dt><dd><Modified at={record.createdAt} /></dd></div><div><dt>Last updated</dt><dd><Modified at={record.updatedAt} /></dd></div>{publication && <div><dt>Last published</dt><dd><Modified at={record.publishedAt} unavailable={record.status === "draft" && !record.hasBeenPublished ? "Not published" : "Unavailable"} /></dd></div>}</dl>;
}
export function PageHeading({ eyebrow = "INSTRUCTOR WORKSPACE", title, description, children }: { eyebrow?: string; title: string; description: string; children?: ReactNode }) {
  return <div className="ins-page-heading"><div><p className="ins-eyebrow">{eyebrow}</p><h1>{title}</h1><p className="ins-muted">{description}</p></div>{children && <div className="ins-heading-actions">{children}</div>}</div>;
}
export function Empty({ title, children }: { title: string; children: ReactNode }) {
  return <div className="ins-empty"><Icon name="layers" /><h2>{title}</h2><p className="ins-muted">{children}</p></div>;
}
