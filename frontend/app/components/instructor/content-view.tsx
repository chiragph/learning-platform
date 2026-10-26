"use client";

import Link from "next/link";
import { useState } from "react";
import type { ActivityType } from "../../lib/student/curriculum-types";
import { activityIcons } from "./curriculum-view";
import { useInstructor } from "./instructor-provider";
import { Empty, Icon, Modified, PageHeading, Status } from "./ui";

const labels: Record<ActivityType, { title: string; description: string }> = {
  theory: { title: "Theory Lessons", description: "The concepts and explanations at the heart of your curriculum." },
  quiz: { title: "Quizzes", description: "Knowledge checks that connect concepts to understanding." },
  lab: { title: "Coding Labs", description: "Hands-on practice, one focused challenge at a time." },
  workshop: { title: "Workshops", description: "Guided projects that bring the learning together." },
};
export function ContentView({ type }: { type: ActivityType }) {
  const { state } = useInstructor(), [query, setQuery] = useState(""), [courseId, setCourseId] = useState("all"), [status, setStatus] = useState("active");
  const records = state.courses.flatMap(course => course.modules.flatMap(module => module.activities.filter(a => a.type === type).map(activity => ({ course, module, activity, archived: course.archived || module.archived || activity.archived }))));
  const filtered = records.filter(r => (courseId === "all" || r.course.id === courseId) && (status === "archived" ? r.archived : !r.archived && (status === "active" || r.activity.status === status)) && `${r.activity.title} ${r.activity.description} ${r.module.title} ${r.course.title}`.toLowerCase().includes(query.toLowerCase()));
  return <><PageHeading title={labels[type].title} description={labels[type].description}><Link className="ins-button" href="/instructor/curriculum"><Icon name="layers" />Manage in Curriculum</Link></PageHeading>
    <div className="ins-stage-note"><Icon name={activityIcons[type]} /><div><strong>Content organization is ready.</strong><p>View and manage activity records in the Curriculum Builder. A dedicated {type === "theory" ? "lesson" : type} editor arrives in a later stage.</p></div><span>RECORDS</span></div>
    <div className="ins-toolbar"><label className="ins-search"><span className="sr-only">Search content</span><input type="search" placeholder={`Search ${labels[type].title.toLowerCase()}…`} value={query} onChange={e => setQuery(e.target.value)} /></label><select aria-label="Filter content by course" value={courseId} onChange={e => setCourseId(e.target.value)}><option value="all">All courses</option>{state.courses.map(c => <option key={c.id} value={c.id}>{c.title}{c.archived ? " (archived)" : ""}</option>)}</select><select aria-label="Filter content by status" value={status} onChange={e => setStatus(e.target.value)}><option value="active">All active</option><option value="published">Published</option><option value="draft">Draft</option><option value="archived">Archived</option></select><span className="ins-muted" role="status">{filtered.length} records</span></div>
    {filtered.length ? <div className="ins-content-list">{filtered.map(({ course, module, activity, archived }) => <article key={activity.id} className="ins-content-row"><span className={`ins-activity-icon ${type}`}><Icon name={activityIcons[type]} /></span><div className="ins-content-name"><h2>{activity.title}</h2><p>{course.title} <span> / </span> {module.title}</p><small>Last updated · <Modified at={activity.updatedAt} /></small></div><Status status={activity.status} archived={archived} />{course.archived ? <Link className="ins-text-link" href="/instructor/courses">Restore course <Icon name="arrow" /></Link> : <Link className="ins-text-link" href={`/instructor/curriculum?course=${encodeURIComponent(course.id)}&activity=${encodeURIComponent(activity.id)}${archived ? "&archived=1" : ""}`}>View in curriculum <Icon name="arrow" /></Link>}</article>)}</div> : <Empty title="No matching content">Try different filters, or add a draft activity in the Curriculum Builder.</Empty>}
  </>;
}
