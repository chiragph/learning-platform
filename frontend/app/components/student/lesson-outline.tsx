"use client";

import Link from "next/link";
import { curricula } from "@/app/lib/student/curriculum";
import { findCourse } from "@/app/lib/student/courses";
import type { Lesson, Progress } from "@/app/lib/student/types";
import { StudentIcon, SubjectMark } from "./student-icon";

export function LessonOutline({ lesson, progress }: { lesson: Lesson; progress: Progress }) {
  const course = findCourse(lesson.language)!;
  const curriculum = curricula[course.id];
  return <nav aria-label="Course theory lessons" className="student-lesson-outline">
    <div className="student-lesson-outline-heading"><SubjectMark subject={course.id} small /><div><span>YOUR COURSE</span><Link href={`/courses/${course.id}`}>{course.title}</Link></div></div>
    {curriculum.modules.map((module, index) => <section key={module.id}><h3><Link href={`/courses/${course.id}#${module.id}`}><span>{String(index + 1).padStart(2, "0")}</span>{module.title}</Link></h3><ol>{module.items.filter((item) => item.kind === "lesson").map((item) => {
      const entry = course.lessons.find((l) => l.id === item.id); if (!entry) return null;
      const done = progress.lessons.includes(item.id);
      return <li key={item.id}><Link href={`/lessons/${item.id}`} aria-current={lesson.id === item.id ? "page" : undefined}><span className={done ? "complete" : ""} aria-label={done ? "Completed" : "Not completed"}>{done ? <StudentIcon name="check" /> : <span />}</span><span>{entry.title}</span></Link></li>;
    })}</ol></section>)}
    <Link className="student-lesson-full-curriculum" href={`/courses/${course.id}`}>Full curriculum <StudentIcon name="arrow" /></Link>
  </nav>;
}
