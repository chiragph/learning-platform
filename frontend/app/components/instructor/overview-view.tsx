"use client";

import Link from "next/link";
import { useState } from "react";
import { courseCounts, publicationIssue } from "../../lib/instructor/repository";
import { CourseForm } from "./course-form";
import { useInstructor } from "./instructor-provider";
import { CourseMark, Icon, Modified, PageHeading, Status } from "./ui";

export function OverviewView() {
  const { state, writable } = useInstructor(), [create, setCreate] = useState(false);
  const courses = state.courses.filter(c => !c.archived), totalActivities = courses.reduce((sum,c) => sum + courseCounts(c).activities, 0);
  const attention = courses.filter(c => c.status === "draft" || publicationIssue(c));
  const stats = [{ label: "Total courses", value: courses.length, icon: "courses" as const, detail: "Active catalog" }, { label: "Published courses", value: courses.filter(c => c.status === "published").length, icon: "check" as const, detail: "Local publication state" }, { label: "Draft courses", value: courses.filter(c => c.status === "draft").length, icon: "lesson" as const, detail: "Work in progress" }, { label: "Curriculum activities", value: totalActivities, icon: "layers" as const, detail: "Across active modules" }];
  return <><PageHeading title="Welcome to your workspace." description="Good learning starts with thoughtful content. Make your next move."><Link className="ins-button secondary" href="/instructor/curriculum"><Icon name="layers" />Manage Curriculum</Link><button type="button" className="ins-button" disabled={!writable} onClick={() => setCreate(true)}><span aria-hidden="true">＋</span>Create Course</button></PageHeading>
    <div className="ins-stats">{stats.map(stat => <div key={stat.label}><span className="ins-stat-label">{stat.label}<Icon name={stat.icon} /></span><strong>{stat.value}</strong><small>{stat.detail}</small></div>)}</div>
    <div className="ins-overview-grid"><section className="ins-panel"><div className="ins-section-heading"><div><p className="ins-eyebrow">YOUR CATALOG</p><h2>Course management</h2></div><Link className="ins-text-link" href="/instructor/courses">View all <Icon name="arrow" /></Link></div><div className="ins-summary-head"><span>Course</span><span>Curriculum</span><span>Status</span></div>{courses.length ? courses.map(course => { const count = courseCounts(course); return <Link className="ins-summary-row" key={course.id} href={`/instructor/curriculum?course=${encodeURIComponent(course.id)}`}><div><CourseMark course={course} /><span><strong>{course.title}</strong><small>Updated · <Modified at={course.updatedAt} /></small></span></div><span className="ins-muted">{count.modules} modules · {count.activities} activities</span><Status status={course.status} /></Link>; }) : <p className="ins-inline-empty">Your active catalog is empty. Create a course or restore an archived course.</p>}<div className="ins-panel-foot"><Icon name="book" />Course → Module → Activity</div></section>
    <section className="ins-panel ins-attention"><div className="ins-section-heading"><div><p className="ins-eyebrow">NEXT STEPS</p><h2>Requires attention <span>{attention.length}</span></h2></div></div>{attention.length ? attention.map(course => <Link className="ins-attention-row" key={course.id} href={`/instructor/curriculum?course=${encodeURIComponent(course.id)}`}><strong>{course.title}<Icon name="arrow" /></strong><p>{publicationIssue(course) ?? "Draft changes are ready for your review."}</p></Link>) : <div className="ins-attention-clear"><Icon name="check" /><h3>Your catalog is in good shape.</h3><p>No draft or incomplete courses to review.</p></div>}<div className="ins-panel-foot">Based on your local course records</div></section>
    <section className="ins-panel"><div className="ins-section-heading"><div><p className="ins-eyebrow">CONTENT HISTORY</p><h2>Recent changes</h2></div></div>{state.changes.length ? <ol className="ins-history">{[...state.changes].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 6).map(change => {
      const owner = state.courses.find(c => c.id === change.courseId);
      const activityQuery = change.content?.kind === "activity" ? `&activity=${encodeURIComponent(change.content.id)}` : "";
      return <li key={change.id}><span className="ins-history-dot" /><div>{owner ? <Link href={`/instructor/curriculum?course=${encodeURIComponent(change.courseId)}${activityQuery}`}>{change.title}</Link> : <span>{change.title}</span>}<small>{owner && change.content?.kind !== "course" && <>{owner.title} · </>}<Modified at={change.at} /></small></div></li>;
    })}</ol> : <div className="ins-inline-empty"><Icon name="clock" /><p>No local changes yet.</p><small>Edits, new content, and publication changes will appear here.</small></div>}<div className="ins-panel-foot">Dates and times use your local timezone.</div></section>
    <section className="ins-integration"><span className="ins-integration-icon"><Icon name="progress" /></span><p className="ins-eyebrow">STUDENT INSIGHTS</p><h2>The other side of learning.</h2><p>Enrollment, completion, and student activity are unavailable until instructor analytics are integrated.</p><span className="ins-integration-badge">Awaiting backend integration</span><Link href="/instructor/insights">About student insights <Icon name="arrow" /></Link></section></div>
    {create && <CourseForm onClose={() => setCreate(false)} />}
  </>;
}
