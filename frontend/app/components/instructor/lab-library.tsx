"use client";

import Link from "next/link";
import { useState } from "react";
import { initialLabContent, labEditorHref, labReadiness } from "../../lib/instructor/lab";
import { theoryCurriculumHref } from "../../lib/instructor/theory";
import { useInstructor } from "./instructor-provider";
import { Empty, Icon, Modified, PageHeading, Status } from "./ui";
import "./theory.css";
import "./lab.css";

export function LabLibrary() {
  const { state } = useInstructor();
  const [query, setQuery] = useState(""), [courseId, setCourse] = useState("all"), [moduleId, setModule] = useState("all"), [status, setStatus] = useState("active");
  const modules = state.courses.filter(c => courseId === "all" || c.id === courseId).flatMap(c => c.modules.map(m => ({ ...m, courseTitle: c.title })));
  const records = state.courses.flatMap(course => course.modules.flatMap(module => module.activities.filter(a => a.type === "lab").map(activity => ({ course, module, activity, draft: state.lab?.drafts[activity.id], archived: course.archived || module.archived || activity.archived }))));
  const filtered = records.filter(r => {
    const matchesStatus = status === "archived" ? r.archived : !r.archived && (status === "active" || status === "working" && !!r.draft || status === r.activity.status);
    return matchesStatus && (courseId === "all" || courseId === r.course.id) && (moduleId === "all" || moduleId === r.module.id) && (r.draft?.title ?? r.activity.title).toLowerCase().includes(query.trim().toLowerCase());
  });
  return <><PageHeading title="Coding Labs" description="Build practical challenges with clear instructions, starter code, and testable requirements."><Link className="ins-button secondary" href="/instructor/curriculum"><Icon name="layers" />Create Lab in Curriculum</Link></PageHeading>
    <p className="ins-theory-note"><Icon name="code" />Working drafts and preview attempts are separate from published originals. Publish the course from My Courses to deliver these changes.</p>
    <div className="ins-toolbar ins-theory-filters"><label className="ins-search"><span className="sr-only">Search lab titles</span><input type="search" placeholder="Search lab titles…" value={query} onChange={e => setQuery(e.target.value)} /></label><select aria-label="Filter labs by course" value={courseId} onChange={e => { setCourse(e.target.value); setModule("all"); }}><option value="all">All courses</option>{state.courses.map(c => <option key={c.id} value={c.id}>{c.title}{c.archived ? " (archived)" : ""}</option>)}</select><select aria-label="Filter labs by module" value={moduleId} onChange={e => setModule(e.target.value)}><option value="all">All modules</option>{modules.map(m => <option key={m.id} value={m.id}>{courseId === "all" ? `${m.courseTitle} / ` : ""}{m.title}</option>)}</select><select aria-label="Filter labs by status" value={status} onChange={e => setStatus(e.target.value)}><option value="active">All active</option><option value="draft">Draft activities</option><option value="published">Published originals</option><option value="working">With working drafts</option><option value="archived">Archived</option></select><span className="ins-muted" role="status">{filtered.length} labs</span></div>
    {filtered.length ? <div className="ins-content-list">{filtered.map(({ course, module, activity, draft, archived }) => {
      const content = draft ?? initialLabContent(activity).content;
      return <article key={activity.id} className="ins-content-row ins-lab-row"><span className="ins-activity-icon lab"><Icon name="code" /></span><div className="ins-content-name"><h2><Link href={labEditorHref(activity.id)}>{draft?.title.trim() || activity.title}</Link></h2><p><Link href={course.archived ? "/instructor/courses" : theoryCurriculumHref(course.id, module.id, activity.id, archived)}>{course.title} / {module.title}</Link></p><small>{content.checks.length} checks · {content.widths.length} test widths · {draft ? labReadiness(draft).ready ? "Ready for Publication" : "Incomplete Draft" : activity.status === "published" ? "Published Original" : "Draft activity"}</small><small>{draft ? "Draft saved" : "Last updated"} · <Modified at={draft?.updatedAt ?? activity.updatedAt} /></small></div><Status status={activity.status} archived={archived} /><div className="ins-theory-row-actions"><Link className="ins-text-link" href={labEditorHref(activity.id, true)}>Preview Lab</Link><Link className="ins-button secondary" href={labEditorHref(activity.id)}>{archived ? "View Lab" : "Edit Lab"}<Icon name="arrow" /></Link></div></article>;
    })}</div> : <Empty title="No matching labs">Try a different title, course, module, or status. Add a Lab activity in the Curriculum Builder to open a new draft.</Empty>}
  </>;
}
