"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { allLessons, courses, findCourse } from "@/app/lib/student/courses";
import { curricula, courseItems } from "@/app/lib/student/curriculum";
import { completeLesson } from "@/app/lib/student/progress";
import { fileNames } from "@/app/lib/student/editor-settings";
import { lessonStarter } from "@/app/lib/student/lesson-practice";
import type { Lesson } from "@/app/lib/student/types";
import { PageHeading } from "./learning-overview";
import { useProgress } from "./progress-provider";
import { CodeWorkspace } from "./code-workspace";
import { LessonOutline } from "./lesson-outline";
import { StudentIcon, SubjectMark } from "./student-icon";
import "./lesson.css";

export function LessonsIndex() {
  const { progress } = useProgress();
  const [query, setQuery] = useState("");
  const term = query.trim().toLowerCase();
  const visible = allLessons.filter((l) => `${l.title} ${l.language}`.toLowerCase().includes(term));
  return <div className="student-theory-library">
    <PageHeading eyebrow="THEORY LIBRARY" title="Understand the idea behind the code." description="Short explanations, useful examples, and room to experiment. Find a topic or continue the course you are exploring." />
    <div className="student-lesson-search"><label htmlFor="lesson-search">Find a lesson</label><input type="search" id="lesson-search" placeholder="Search HTML, CSS, JavaScript…" value={query} onChange={(event) => setQuery(event.target.value)} aria-describedby="lesson-count" /><p id="lesson-count" role="status">{visible.length} lesson{visible.length === 1 ? "" : "s"}{term ? " found" : " to explore"}</p></div>
    <div className="student-theory-courses">{courses.map((course) => {
      const lessons = course.lessons.filter((l) => visible.some((v) => v.id === l.id));
      if (!lessons.length) return null;
      const done = course.lessons.filter((l) => progress.lessons.includes(l.id)).length;
      return <section className="student-theory-course" key={course.id}>
        <div className="student-theory-course-header"><SubjectMark subject={course.id} /><div><h2>{course.title}</h2><p>{done}/{course.lessons.length} lessons completed</p></div><Link href={`/courses/${course.id}`}>View curriculum <StudentIcon name="arrow" /></Link></div>
        <ol>{lessons.map((lesson) => {
          const currentModule = curricula[course.id].modules.find((m) => m.items.some((i) => i.kind === "lesson" && i.id === lesson.id));
          const complete = progress.lessons.includes(lesson.id);
          return <li key={lesson.id}><Link href={`/lessons/${lesson.id}`}><span className={`student-theory-lesson-icon${complete ? " complete" : ""}`}><StudentIcon name={complete ? "check" : "lesson"} /></span><div><h3>{lesson.title}</h3><p>{currentModule?.title}{lessonStarter(lesson) ? " · Optional coding practice" : " · Theory & example"}</p></div><span className="student-theory-lesson-state">{complete ? "Completed" : "Read lesson"}</span><StudentIcon name="chevron" /></Link></li>;
        })}</ol>
      </section>;
    })}</div>
    {!visible.length && <div className="student-theory-empty"><StudentIcon name="lesson" /><h2>No lessons match your search.</h2><p>Try a different topic or explore the full theory library.</p><button className="student-button secondary" onClick={() => setQuery("")}>Clear search</button></div>}
  </div>;
}

export function LessonView({ lesson }: { lesson: Lesson }) {
  const { progress, update } = useProgress();
  const [copyStatus, setCopyStatus] = useState("");
  const [practice, setPractice] = useState(false);
  const [practiceOpened, setPracticeOpened] = useState(false);
  const done = progress.lessons.includes(lesson.id);
  const course = findCourse(lesson.language)!;
  const currentModule = curricula[course.id].modules.find((m) => m.items.some((i) => i.kind === "lesson" && i.id === lesson.id));
  const lessonIndex = course.lessons.findIndex((l) => l.id === lesson.id);
  const completed = course.lessons.filter((l) => progress.lessons.includes(l.id)).length;
  const index = allLessons.findIndex((l) => l.id === lesson.id);
  const previous = allLessons[index - 1], next = allLessons[index + 1];
  const estimate = courseItems(course.id).find((i) => i.kind === "lesson" && i.id === lesson.id)?.minutes;
  const starter = lessonStarter(lesson);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { update((p) => p.currentLesson === lesson.id ? p : { ...p, currentLesson: lesson.id }); }, [lesson.id, update]);
  async function copy() { try { await navigator.clipboard.writeText(lesson.code); setCopyStatus("Example copied to clipboard."); } catch { setCopyStatus("Clipboard unavailable. Select the example and copy it manually."); } }
  function openPractice() { setPracticeOpened(true); setPractice(true); }

  return <div className="student-theory-workspace">
    <div className="student-lesson-breadcrumb"><Link href={`/courses/${course.id}`}>{course.title}</Link><StudentIcon name="chevron" /><span>{currentModule?.title ?? "Theory lessons"}</span></div>
    <header className="student-reading-header"><div><p className="student-kicker">LESSON {lessonIndex + 1} OF {course.lessons.length} {estimate ? `· ~${estimate} MIN READ` : ""}</p><h1 ref={heading} tabIndex={-1}>{lesson.title}</h1><p>Understand the concept. Explore the example. Make it your own.</p></div><span className={`student-lesson-completion-badge${done ? " complete" : ""}`}><StudentIcon name={done ? "check" : "lesson"} />{done ? "Completed" : "In progress"}</span></header>
    <div className="student-lesson-progress-row"><span>{completed}/{course.lessons.length} theory lessons complete</span><progress className="student-progress" max={course.lessons.length} value={completed} aria-label={`${course.title} theory completion`} />{starter && <div role="group" aria-label="Lesson workspace view"><button aria-pressed={!practice} onClick={() => setPractice(false)}>Read</button><button aria-pressed={practice} onClick={openPractice}><StudentIcon name="code" />Read & practice</button></div>}</div>
    <details className={`student-lesson-mobile-contents${practice ? " practice-visible" : ""}`}><summary><StudentIcon name="courses" />Course contents <StudentIcon name="chevron" /></summary><LessonOutline lesson={lesson} progress={progress} /></details>
    <div className={`student-reading-layout${practice && starter ? " with-practice" : ""}`}>
      <aside className="student-lesson-course-sidebar"><LessonOutline lesson={lesson} progress={progress} /></aside>
      <div className="student-reading-main">
        <article className="student-reading-article">
          <section><div className="student-reading-section-label"><span>01</span><h2>The concept</h2></div>{lesson.explanation.map((paragraph, i) => <p key={paragraph} className={i === 0 ? "student-reading-lead" : ""}>{paragraph}</p>)}</section>
          <section className="student-reading-example"><div className="student-reading-section-label"><span>02</span><h2>Syntax & example</h2></div><p>Read through the example and connect each part to the explanation above.</p><div className="student-example-file"><span><StudentIcon name="code" />{fileNames[lesson.language]}</span><button onClick={copy}>Copy code</button></div><div className="student-example-code"><div aria-hidden="true">{lesson.code.split("\n").map((_, i) => <span key={i}>{i + 1}</span>)}</div><pre tabIndex={0} aria-label={`${lesson.language.toUpperCase()} code example`}><code>{lesson.code}</code></pre></div><p role="status" className="student-example-copy-status">{copyStatus}</p></section>
          <section className="student-reading-practice"><div className="student-reading-section-label"><span>03</span><h2>Try it yourself</h2></div><p>{lesson.practice}</p>{starter ? <><p className="student-reading-practice-note">Optional practice uses a separate draft. You can read and complete this lesson without opening the editor.</p><button className="student-button secondary" aria-expanded={practice} onClick={() => practice ? setPractice(false) : openPractice()}>{practice ? "Return to reading" : "Open practice workspace"}<StudentIcon name="code" /></button></> : <Link className="student-button secondary" href="/playground">Experiment in the playground <StudentIcon name="arrow" /></Link>}</section>
          <section className="student-reading-complete"><h2>Ready for your next step?</h2><p>Mark this lesson complete when you feel comfortable with the concept. You can revisit it anytime.</p><button className="student-button" disabled={done} onClick={() => update((p) => completeLesson(p, lesson.id, new Date().toISOString()))}>{done ? <><StudentIcon name="check" />Lesson completed</> : "Mark as complete"}</button><Link href={`/quizzes/${course.id}`} className="student-text-action">Check your understanding <StudentIcon name="arrow" /></Link></section>
        </article>
        <nav aria-label="Lesson navigation" className="student-reading-navigation">{previous ? <Link href={`/lessons/${previous.id}`}><span>← PREVIOUS LESSON</span><strong>{previous.title}</strong></Link> : <Link href={`/courses/${course.id}`}><span>← YOUR COURSE</span><strong>Back to curriculum</strong></Link>}{next ? <Link href={`/lessons/${next.id}`}><span>NEXT LESSON →</span><strong>{next.title}</strong></Link> : <Link href="/projects"><span>KEEP BUILDING →</span><strong>Explore guided projects</strong></Link>}</nav>
      </div>
      {practiceOpened && starter && <aside hidden={!practice} className="student-lesson-practice-panel" aria-label="Optional lesson coding practice"><div className="student-lesson-practice-heading"><span><StudentIcon name="code" />Practice this concept</span><button onClick={() => { setPractice(false); requestAnimationFrame(() => heading.current?.focus()); }}>Close practice</button></div><p>Start with the lesson example. Run to preview changes and save your draft before leaving.</p><CodeWorkspace workspaceId={`lesson-${lesson.id}`} starter={starter} initialLanguage={lesson.language} embedded /></aside>}
    </div>
  </div>;
}
