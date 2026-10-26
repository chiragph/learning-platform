"use client";

import Link from "next/link";
import { useState } from "react";
import { initialQuizContent, quizEditorHref, quizReadiness, quizTotalPoints } from "../../lib/instructor/quiz";
import { theoryCurriculumHref } from "../../lib/instructor/theory";
import { useInstructor } from "./instructor-provider";
import { Empty, Icon, Modified, PageHeading, Status } from "./ui";
import "./theory.css";
import "./quiz.css";

export function QuizLibrary() {
  const { state } = useInstructor();
  const [query, setQuery] = useState(""), [courseId, setCourse] = useState("all"), [moduleId, setModule] = useState("all"), [status, setStatus] = useState("active");
  const modules = state.courses.filter(c => courseId === "all" || c.id === courseId).flatMap(c => c.modules.map(m => ({ ...m, courseTitle: c.title })));
  const records = state.courses.flatMap(course => course.modules.flatMap(module => module.activities.filter(a => a.type === "quiz").map(activity => ({ course, module, activity, draft: state.quiz?.drafts[activity.id], archived: course.archived || module.archived || activity.archived }))));
  const filtered = records.filter(r => {
    const matchesStatus = status === "archived" ? r.archived : !r.archived && (status === "active" || status === "working" && !!r.draft || status === r.activity.status);
    return matchesStatus && (courseId === "all" || courseId === r.course.id) && (moduleId === "all" || moduleId === r.module.id) && (r.draft?.title ?? r.activity.title).toLowerCase().includes(query.trim().toLowerCase());
  });
  return <><PageHeading title="Quiz Builder" description="Turn understanding into questions that help learners make their next connection."><Link className="ins-button secondary" href="/instructor/curriculum"><Icon name="layers" />Create Quiz in Curriculum</Link></PageHeading>
    <p className="ins-theory-note"><Icon name="quiz" />Working drafts and preview attempts are separate from published originals. Student publication is deferred to Stage 5E.</p>
    <div className="ins-toolbar ins-theory-filters"><label className="ins-search"><span className="sr-only">Search quiz titles</span><input type="search" placeholder="Search quiz titles…" value={query} onChange={e => setQuery(e.target.value)} /></label><select aria-label="Filter quizzes by course" value={courseId} onChange={e => { setCourse(e.target.value); setModule("all"); }}><option value="all">All courses</option>{state.courses.map(c => <option key={c.id} value={c.id}>{c.title}{c.archived ? " (archived)" : ""}</option>)}</select><select aria-label="Filter quizzes by module" value={moduleId} onChange={e => setModule(e.target.value)}><option value="all">All modules</option>{modules.map(m => <option key={m.id} value={m.id}>{courseId === "all" ? `${m.courseTitle} / ` : ""}{m.title}</option>)}</select><select aria-label="Filter quizzes by status" value={status} onChange={e => setStatus(e.target.value)}><option value="active">All active</option><option value="draft">Draft activities</option><option value="published">Published originals</option><option value="working">With working drafts</option><option value="archived">Archived</option></select><span className="ins-muted" role="status">{filtered.length} quizzes</span></div>
    {filtered.length ? <div className="ins-content-list">{filtered.map(({ course, module, activity, draft, archived }) => {
      const content = draft ?? initialQuizContent(activity).content;
      return <article key={activity.id} className="ins-content-row ins-quiz-row"><span className="ins-activity-icon quiz"><Icon name="quiz" /></span><div className="ins-content-name"><h2><Link href={quizEditorHref(activity.id)}>{draft?.title.trim() || activity.title}</Link></h2><p><Link href={course.archived ? "/instructor/courses" : theoryCurriculumHref(course.id, module.id, activity.id, archived)}>{course.title} / {module.title}</Link></p><small>{content.questions.length} questions · {quizTotalPoints(content)} points · {draft ? quizReadiness(draft).ready ? "Ready for Publication" : "Incomplete Draft" : activity.status === "published" ? "Published Original" : "Draft activity"}</small><small>{draft ? "Draft saved" : "Last updated"} · <Modified at={draft?.updatedAt ?? activity.updatedAt} /></small></div><Status status={activity.status} archived={archived} /><div className="ins-theory-row-actions"><Link className="ins-text-link" href={quizEditorHref(activity.id, true)}>Preview Quiz</Link><Link className="ins-button secondary" href={quizEditorHref(activity.id)}>{archived ? "View Quiz" : "Edit Quiz"}<Icon name="arrow" /></Link></div></article>;
    })}</div> : <Empty title="No matching quizzes">Try a different title, course, module, or status. Add a Quiz activity in the Curriculum Builder to open a new draft.</Empty>}
  </>;
}
