"use client";

import Link from "next/link";
import { courses } from "@/app/lib/student/courses";
import { curriculumStats, estimatedTime, itemDetails, nextCourseItem } from "@/app/lib/student/curriculum";
import type { Course } from "@/app/lib/student/types";
import { useProgress } from "./progress-provider";
import { StudentIcon, SubjectMark, type StudentIconName } from "./student-icon";
import "./learning.css";

export function PageHeading({ eyebrow = "YOUR LEARNING SPACE", title, description }: { eyebrow?: string; title: string; description: string }) {
  return <div className="student-heading"><p className="student-kicker" style={{ padding: 0 }}>{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>;
}

export function ProgressRing({ value, label }: { value: number; label: string }) {
  return <div className="student-progress-ring" role="img" aria-label={`${label}: ${value}%`}>
    <svg viewBox="0 0 80 80" aria-hidden="true"><circle className="student-ring-track" cx="40" cy="40" r="33" /><circle className="student-ring-value" cx="40" cy="40" r="33" pathLength="100" strokeDasharray="100" strokeDashoffset={100 - value} /></svg>
    <strong aria-hidden="true">{value}<span>%</span></strong>
  </div>;
}

export function CourseCard({ course }: { course: Course }) {
  const { progress } = useProgress();
  const stats = curriculumStats(course.id, progress);
  const next = nextCourseItem(course.id, progress);
  const target = next && itemDetails(next);
  const index = courses.findIndex((c) => c.id === course.id);
  return <article className={`student-course-card ${course.id}`}>
    <div className="student-row"><SubjectMark subject={course.id} /><span className="student-course-number">0{index + 1}</span></div>
    <p className="student-course-category">{["STRUCTURE", "STYLE", "INTERACTION"][index]}</p>
    <h3>{course.title}</h3><p className="student-muted">{course.description}</p>
    <div className="student-course-meta"><span><StudentIcon name="layers" />{stats.modules} modules</span><span><StudentIcon name="clock" />~{estimatedTime(stats.minutes)}</span></div>
    <div className="student-course-completion"><div className="student-row"><span>{stats.completed}/{stats.total} core activities</span><strong>{stats.percent}%</strong></div><progress className="student-progress" value={stats.percent} max={100} aria-label={`${course.title} completion`} /></div>
    <Link className="student-button" href={target?.href ?? `/courses/${course.id}`}>{stats.percent === 100 ? "Review course" : stats.completed || progress.currentLesson?.startsWith(course.id + "-") ? "Continue learning" : "Start learning"}<StudentIcon name="arrow" /></Link>
    <Link className="student-course-syllabus-link" href={`/courses/${course.id}`}>View curriculum <StudentIcon name="chevron" /></Link>
  </article>;
}

function activityIcon(href: string): StudentIconName {
  if (href.startsWith("/quizzes/")) return "quiz";
  if (href.startsWith("/challenges/")) return "challenge";
  if (href.startsWith("/projects/")) return "project";
  return "lesson";
}
export function ActivityList({ limit = 20 }: { limit?: number }) {
  const { progress } = useProgress();
  return <div className="student-activity-panel">
    {progress.activity.length ? <ul>{progress.activity.slice(0, limit).map((activity) => <li key={activity.id}>
      <span className="student-activity-icon"><StudentIcon name={activityIcon(activity.href)} /></span>
      <div><Link href={activity.href}>{activity.title}</Link><time dateTime={activity.at}>{Number.isNaN(Date.parse(activity.at)) ? "Saved locally" : new Date(activity.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</time></div>
      <StudentIcon name="check" className="student-activity-check" />
    </li>)}</ul> : <div className="student-activity-empty"><span className="student-empty-mark"><StudentIcon name="book" /></span><h3>Your journey starts with one step.</h3><p>Complete a lesson or try an activity. Your learning history will appear here.</p><Link className="student-link" href="/courses">Find your first lesson <StudentIcon name="arrow" /></Link></div>}
  </div>;
}
