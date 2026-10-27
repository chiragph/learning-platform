"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { initialWorkshopContent, sameWorkshopContent, workshopContentOnly, workshopLocation, workshopReadiness } from "../../lib/instructor/workshop";
import type { WorkshopContent } from "../../lib/instructor/workshop-types";
import { theoryCurriculumHref } from "../../lib/instructor/theory";
import { installInstructorLeaveGuard } from "../../lib/instructor/theory-navigation";
import { useInstructor } from "./instructor-provider";
import { WorkshopFields } from "./workshop-fields";
import { WorkshopPreview } from "./workshop-preview";
import { Confirm, Empty, Icon, Modified, Status } from "./ui";
import "./theory.css";
import "./lab.css";
import "./workshop.css";

export function WorkshopEditor({ activityId, initialPreview = false }: { activityId: string; initialPreview?: boolean }) {
  const { state, ready } = useInstructor(), location = workshopLocation(state, activityId);
  if (!ready) return <p role="status">Opening workshop…</p>;
  if (!location) return <Empty title="Workshop not found">This activity may have been deleted or belong to another browser profile. <Link className="ins-text-link" href="/instructor/workshops">Back to Workshops</Link></Empty>;
  return <WorkshopEditorSession key={`${activityId}:${initialPreview ? "preview" : "edit"}`} location={location} initialPreview={initialPreview} />;
}
function WorkshopEditorSession({ location, initialPreview }: { location: NonNullable<ReturnType<typeof workshopLocation>>; initialPreview: boolean }) {
  const { state, execute, readSnapshot, writable } = useInstructor(), { course, module, activity, archived } = location;
  const imported = initialWorkshopContent(activity), stored = state.workshop?.drafts[activity.id];
  const [content, setContent] = useState<WorkshopContent>(() => structuredClone(workshopContentOnly(stored ?? imported.content)));
  const [saved, setSaved] = useState(() => ({ content: structuredClone(content), at: stored?.updatedAt ?? null, revision: stored?.revision ?? null }));
  const [preview, setPreview] = useState(initialPreview), [reload, setReload] = useState(false), [notice, setNotice] = useState("");
  const saveButton = useRef<HTMLButtonElement>(null);
  const dirty = !sameWorkshopContent(content, saved.content), readiness = workshopReadiness(content), conflict = (stored?.updatedAt ?? null) !== saved.at || (stored?.revision ?? null) !== saved.revision;
  const readOnly = !writable || archived || imported.source === "unsupported", publishedOriginal = activity.status === "published" || !!activity.hasBeenPublished;
  const curriculumHref = course.archived ? "/instructor/courses" : theoryCurriculumHref(course.id, module.id, activity.id, archived);
  useEffect(() => dirty ? installInstructorLeaveGuard(window, () => true, "workshop") : undefined, [dirty]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); saveButton.current?.click(); } };
    window.addEventListener("keydown", shortcut); return () => window.removeEventListener("keydown", shortcut);
  }, []);
  async function save() {
    if (readOnly || !dirty || conflict) return;
    const result = await execute({ type: "workshop.save", courseId: course.id, moduleId: module.id, activityId: activity.id, content, expectedUpdatedAt: saved.at, expectedRevision: saved.revision });
    if (result) { const draft = readSnapshot().state.workshop?.drafts[activity.id]; setSaved({ content: structuredClone(content), at: draft?.updatedAt ?? null, revision: draft?.revision ?? null }); setNotice("Workshop working draft saved to your account."); }
  }
  return <div className="ins-workshop-editor"><div className="ins-editor-context"><Link className="ins-text-link" href="/instructor/workshops">Workshops</Link><span>/</span><span>{course.title}</span><span>/</span><span>{module.title}</span></div>
    <header className="ins-editor-header"><div><p className="ins-eyebrow">WORKSHOP BUILDER</p><h1>{content.title.trim() || "Untitled workshop"}</h1><div className="ins-editor-metadata"><Status status={activity.status} archived={archived} /><span>{publishedOriginal ? "Published Original / Working Draft" : "Local Working Draft"}</span><span className={dirty ? "ins-unsaved" : "ins-muted"} role="status">{dirty ? "Unsaved changes" : saved.at ? "Working draft saved" : "No local changes"}</span><span>Last saved · <Modified at={saved.at} unavailable="Not saved locally" /></span></div></div><div className="ins-heading-actions"><Link className="ins-button secondary" href={curriculumHref}><Icon name="layers" />Back to Curriculum</Link><button type="button" className="ins-button secondary" onClick={() => setPreview(!preview)}><Icon name="project" />{preview ? "Back to Editor" : "Preview Workshop"}</button><button ref={saveButton} type="button" className="ins-button" disabled={readOnly || !dirty || conflict} onClick={save}>Save Draft</button></div></header>
    <div className="ins-theory-note"><Icon name="project" /><p>{publishedOriginal ? "Edit a separate working draft. Published projects, original step IDs and student progress remain unchanged." : "Save incomplete drafts whenever you need. Preview steps and submission demonstrations are temporary."} Readiness is not publication. Publish from My Courses. Students submit their saved project code on completion.</p></div>
    {imported.source === "student" && <p className="ins-footnote">Original objectives, instructions and starter files are imported. Original workshops use self-review; requirements, deliverables and submission settings need your local configuration before publication readiness.</p>}
    {imported.source === "unsupported" && <p className="ins-notice warning" role="status">This legacy workshop cannot be imported safely. Its original association is preserved; no blank draft will replace it.</p>}
    {archived && <p className="ins-notice warning">This workshop or its parent curriculum is archived. Restore it before editing.</p>}
    {conflict && <div className="ins-notice warning" role="alert"><p>The saved workshop changed in another tab. Your unsaved work is still here. Copy it somewhere safe before reloading.</p><button type="button" onClick={() => setReload(true)}>Reload saved draft</button></div>}
    <p className="ins-save-notice" role="status">{notice}</p>
    {preview ? <><div className="ins-preview-toolbar"><div><strong>Inspect the student experience</strong><p>{dirty ? "Includes unsaved content" : "Current workshop content"} · Demonstration only</p></div><span className="ins-status draft">Isolated preview</span></div><WorkshopPreview content={content} context={`${course.title} / ${module.title}`} /></> : <div className="ins-theory-edit-layout"><div><WorkshopFields content={content} readOnly={readOnly} onChange={content => { setContent(content); setNotice(""); }} /></div><aside className="ins-readiness"><p className="ins-eyebrow">PUBLICATION READINESS</p><h2>{readiness.ready ? "Ready for Publication" : "Incomplete Draft"}</h2><ul>{readiness.checklist.map(item => <li key={item.label} data-ready={item.ready}><Icon name={item.ready ? "check" : "clock"} />{item.label}</li>)}</ul><p>Readiness never publishes content or enables real uploads. Limits: 50 entries per section, 20 resources, 30 objectives, 200 title characters, 10,000 per instruction field and 100,000 per starter file.</p><div><strong>Workshop dates</strong><dl><dt>Working draft created</dt><dd><Modified at={stored?.createdAt} unavailable="Not saved locally" /></dd><dt>Working draft updated</dt><dd><Modified at={saved.at} unavailable="Not saved locally" /></dd><dt>Original publication</dt><dd><Modified at={activity.publishedAt} unavailable={publishedOriginal ? "Historical date unavailable" : "Not published"} /></dd></dl></div></aside></div>}
    {reload && <Confirm title="Reload the saved workshop draft?" label="Reload Draft" onClose={() => setReload(false)} onConfirm={() => { const latest = readSnapshot().state.workshop?.drafts[activity.id], loaded = structuredClone(workshopContentOnly(latest ?? imported.content)); setContent(loaded); setSaved({ content: structuredClone(loaded), at: latest?.updatedAt ?? null, revision: latest?.revision ?? null }); setPreview(false); setReload(false); setNotice("Latest saved workshop loaded."); }}>This discards unsaved changes and loads the latest saved draft. Cancel to keep your work and copy it somewhere safe first.</Confirm>}
  </div>;
}
