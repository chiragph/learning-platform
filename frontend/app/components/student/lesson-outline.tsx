"use client";

import Link from "next/link";
import { activityComplete, curricula, displayOrder } from "@/app/lib/student/curriculum";
import { findCourse } from "@/app/lib/student/courses";
import type { Lesson, Progress } from "@/app/lib/student/types";
import { StudentIcon, SubjectMark } from "./student-icon";

export function LessonOutline({ lesson, progress }: { lesson: Lesson; progress: Progress }) {
  const course = findCourse(lesson.language)!;
  const curriculum = curricula[course.id];
  return <nav aria-label="Course activities" className="student-lesson-outline">
    <div className="student-lesson-outline-heading"><SubjectMark subject={course.id} small /><div><span>YOUR COURSE</span><Link href={`/courses/${course.id}`}>{course.title}</Link></div></div>
    {displayOrder(curriculum.modules).map((module, index) => <section key={module.id}><h3><Link href={`/courses/${course.id}#${module.id}`}><span>{String(index + 1).padStart(2, "0")}</span>{module.title}</Link></h3><ol>{displayOrder(module.activities).map((item) => {
      const done = activityComplete(item, progress);
      const current = item.reference?.kind === "lesson" && item.reference.id === lesson.id;
      const icon = ({ theory: "lesson", quiz: "quiz", lab: "code", workshop: "project" } as const)[item.type];
      const label = item.type[0].toUpperCase() + item.type.slice(1);
      return <li key={item.id}><Link href={item.href} aria-current={current ? "page" : undefined}><span className={done ? "complete" : ""} aria-label={done ? "Completed" : label}><StudentIcon name={done ? "check" : icon} /></span><span>{item.title}<small className="student-outline-activity-type">{label}{item.availability === "upcoming" ? " · Upcoming" : ""}</small></span></Link></li>;
    })}</ol></section>)}
    <Link className="student-lesson-full-curriculum" href={`/courses/${course.id}`}>Full curriculum <StudentIcon name="arrow" /></Link>
  </nav>;
}
