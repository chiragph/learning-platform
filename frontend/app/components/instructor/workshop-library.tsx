"use client";

import Link from "next/link";
import { useState } from "react";
import { initialWorkshopContent, workshopEditorHref, workshopReadiness } from "../../lib/instructor/workshop";
import { theoryCurriculumHref } from "../../lib/instructor/theory";
import { useInstructor } from "./instructor-provider";
import { Empty, Icon, Modified, PageHeading, Status } from "./ui";
import "./theory.css";
import "./workshop.css";

export function WorkshopLibrary() {
  const { state } = useInstructor();
  const [query, setQuery] = useState(""), [courseId, setCourse] = useState("all"), [moduleId, setModule] = useState("all"), [status, setStatus] = useState("active");
  const modules = state.courses.filter(c => courseId === "all" || c.id === courseId).flatMap(c => c.modules.map(m => ({ ...m, courseTitle: c.title })));
  const records = state.courses.flatMap(course => course.modules.flatMap(module => module.activities.filter(a => a.type === "workshop").map(activity => ({ course, module, activity, draft: state.workshop?.drafts[activity.id], archived: course.archived || module.archived || activity.archived }))));
  const filtered = records.filter(r => {
    const matchesStatus = status === "archived" ? r.archived : !r.archived && (status === "active" || status === "working" && !!r.draft || status === r.activity.status);
    return matchesStatus && (courseId === "all" || courseId === r.course.id) && (moduleId === "all" || moduleId === r.module.id) && (r.draft?.title ?? r.activity.title).toLowerCase().includes(query.trim().toLowerCase());
  });
  return <><PageHeading title="Workshops" description="Guide learners through a project with clear steps, deliverables and submission guidance."><Link className="ins-button secondary" href="/instructor/curriculum"><Icon name="layers" />Create Workshop in Curriculum</Link></PageHeading>
    <p className="ins-theory-note"><Icon name="project" />Working drafts and preview attempts are separate from published originals. Student publication is deferred to Stage 5E.</p>
    <div className="ins-toolbar ins-theory-filters"><label className="ins-search"><span className="sr-only">Search workshop titles</span><input type="search" placeholder="Search workshop titles…" value={query} onChange={e => setQuery(e.target.value)} /></label><select aria-label="Filter workshops by course" value={courseId} onChange={e => { setCourse(e.target.value); setModule("all"); }}><option value="all">All courses</option>{state.courses.map(c => <option key={c.id} value={c.id}>{c.title}{c.archived ? " (archived)" : ""}</option>)}</select><select aria-label="Filter workshops by module" value={moduleId} onChange={e => setModule(e.target.value)}><option value="all">All modules</option>{modules.map(m => <option key={m.id} value={m.id}>{courseId === "all" ? `${m.courseTitle} / ` : ""}{m.title}</option>)}</select><select aria-label="Filter workshops by status" value={status} onChange={e => setStatus(e.target.value)}><option value="active">All active</option><option value="draft">Draft activities</option><option value="published">Published originals</option><option value="working">With working drafts</option><option value="archived">Archived</option></select><span className="ins-muted" role="status">{filtered.length} workshops</span></div>
    {filtered.length ? <div className="ins-content-list">{filtered.map(({ course, module, activity, draft, archived }) => {
      const content = draft ?? initialWorkshopContent(activity).content;
      return <article key={activity.id} className="ins-content-row ins-workshop-row"><span className="ins-activity-icon workshop"><Icon name="project" /></span><div className="ins-content-name"><h2><Link href={workshopEditorHref(activity.id)}>{draft?.title.trim() || activity.title}</Link></h2><p><Link href={course.archived ? "/instructor/courses" : theoryCurriculumHref(course.id, module.id, activity.id, archived)}>{course.title} / {module.title}</Link></p><small>{content.steps.length} steps · {content.requirements.length} requirements · {draft ? workshopReadiness(draft).ready ? "Ready for Publication" : "Incomplete Draft" : activity.status === "published" ? "Published Original" : "Draft activity"}</small><small>{draft ? "Draft saved" : "Last updated"} · <Modified at={draft?.updatedAt ?? activity.updatedAt} /></small></div><Status status={activity.status} archived={archived} /><div className="ins-theory-row-actions"><Link className="ins-text-link" href={workshopEditorHref(activity.id, true)}>Preview Workshop</Link><Link className="ins-button secondary" href={workshopEditorHref(activity.id)}>{archived ? "View Workshop" : "Edit Workshop"}<Icon name="arrow" /></Link></div></article>;
    })}</div> : <Empty title="No matching workshops">Try a different title, course, module, or status. Add a Workshop activity in the Curriculum Builder to open a new draft.</Empty>}
  </>;
}
