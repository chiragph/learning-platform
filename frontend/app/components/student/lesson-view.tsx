"use client";

import Link from "next/link";
import { theoryBlocks } from "@/app/lib/learning/catalog";
import { useLayoutEffect, useRef, useState } from "react";
import { allLessons, courses } from "@/app/lib/student/courses";
import { curricula, courseItems } from "@/app/lib/student/curriculum";
import { completeLesson } from "@/app/lib/student/progress";
import { fileNames } from "@/app/lib/student/editor-settings";
import { lessonStarter } from "@/app/lib/student/lesson-practice";
import type { Lesson } from "@/app/lib/student/types";
import { PageHeading } from "./learning-overview";
import { useProgress } from "./progress-provider";
import { CodeWorkspace, type WorkspaceControls } from "./code-workspace";
import { LessonOutline } from "./lesson-outline";
import { StudentIcon, SubjectMark } from "./student-icon";
import "./lesson.css";
import { useStudentPageEntry } from "./page-navigation";

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
          const currentModule = curricula[course.id].modules.find((m) => m.activities.some((i) => i.reference?.kind === "lesson" && i.reference.id === lesson.id));
          const complete = progress.lessons.includes(lesson.id);
          return <li key={lesson.id}><Link href={`/lessons/${lesson.id}`}><span className={`student-theory-lesson-icon${complete ? " complete" : ""}`}><StudentIcon name={complete ? "check" : "lesson"} /></span><div><h3>{lesson.title}</h3><p>{currentModule?.title}{" · Integrated coding practice"}</p></div><span className="student-theory-lesson-state">{complete ? "Completed" : "Read lesson"}</span><StudentIcon name="chevron" /></Link></li>;
        })}</ol>
      </section>;
    })}</div>
    {!visible.length && <div className="student-theory-empty"><StudentIcon name="lesson" /><h2>No lessons match your search.</h2><p>Try a different topic or explore the full theory library.</p><button className="student-button secondary" onClick={() => setQuery("")}>Clear search</button></div>}
  </div>;
}

export function LessonView({ lesson }: { lesson: Lesson }) {
  useStudentPageEntry();
  const { progress, update } = useProgress();
  const [copyStatus, setCopyStatus] = useState("");
  const [practice, setPractice] = useState(true);
  const [completionNotice, setCompletionNotice] = useState("");
  const readButton = useRef<HTMLButtonElement>(null);
  const workspace = useRef<WorkspaceControls>(null);
  const [practiceRequest, setPracticeRequest] = useState(0);
  const handledPracticeRequest = useRef(0);
  useLayoutEffect(() => {
    if (!practice || practiceRequest === handledPracticeRequest.current) return;
    handledPracticeRequest.current = practiceRequest;
    workspace.current?.focusEditor();
  }, [practice, practiceRequest]);
  const done = progress.lessons.includes(lesson.id);
  const course = courses.find(c => c.lessons.some(l => l.id === lesson.id))!;
  const currentModule = curricula[course.id].modules.find((m) => m.activities.some((i) => i.reference?.kind === "lesson" && i.reference.id === lesson.id));
  const lessonIndex = course.lessons.findIndex((l) => l.id === lesson.id);
  const completed = course.lessons.filter((l) => progress.lessons.includes(l.id)).length;
  const activities = courseItems(course.id);
  const index = activities.findIndex((a) => a.reference?.kind === "lesson" && a.reference.id === lesson.id);
  const previous = activities[index - 1], next = activities[index + 1];
  const estimate = activities[index]?.minutes;
  const starter = lessonStarter(lesson);
  const workspaceId = "lesson-" + lesson.id + "-workspace";
  async function copy() { try { await navigator.clipboard.writeText(lesson.code); setCopyStatus("Example copied to clipboard."); } catch { setCopyStatus("Clipboard unavailable. Select the example and copy it manually."); } }
  function openPractice(focus = false) {
    setPractice(true);
    if (focus) setPracticeRequest((request) => request + 1);
  }
  function closePractice() { setPractice(false); requestAnimationFrame(() => readButton.current?.focus({ preventScroll: true })); }
  function complete() {
    if (update((p) => completeLesson(p, lesson.id, new Date().toISOString()))) setCompletionNotice("Lesson completed. Your learning progress is updated.");
  }

  return <div className="student-theory-workspace">
    <div className="student-lesson-breadcrumb"><Link href={"/courses/" + course.id}>{course.title}</Link><StudentIcon name="chevron" /><span>{currentModule?.title ?? "Theory lessons"}</span></div>
    <header className="student-reading-header"><div><p className="student-kicker">LESSON {lessonIndex + 1} OF {course.lessons.length} {estimate ? "· ~" + estimate + " MIN READ" : ""}</p><h1>{lesson.title}</h1><p>Understand the idea, change the code, and see what happens.</p></div><span className={"student-lesson-completion-badge" + (done ? " complete" : "")}><StudentIcon name={done ? "check" : "lesson"} />{done ? "Completed" : "In progress"}</span></header>
    <div className="student-lesson-progress-row"><span>{completed}/{course.lessons.length} theory lessons complete</span><progress className="student-progress" max={course.lessons.length} value={completed} aria-label={course.title + " theory completion"} /><div role="group" aria-label="Lesson workspace view"><button ref={readButton} aria-pressed={!practice} onClick={closePractice}>Read</button><button aria-pressed={practice} aria-controls={workspaceId} onClick={() => openPractice()}><StudentIcon name="code" />Read & practice</button></div></div>
    <details className="student-lesson-mobile-contents"><summary><StudentIcon name="courses" />Course contents <StudentIcon name="chevron" /></summary><LessonOutline lesson={lesson} progress={progress} /></details>
    <div className="student-reading-layout">
      <aside className="student-lesson-course-sidebar"><LessonOutline lesson={lesson} progress={progress} /></aside>
      <div className="student-reading-main">
        <article className="student-reading-article">
          <section><div className="student-reading-section-label"><span>01</span><h2>The concept</h2></div>{theoryBlocks.get(lesson.id)?.blocks.map((block,i)=>block.type==='heading'?<h3 key={block.id}>{block.text}</h3>:block.type==='paragraph'?<p key={block.id} className={i===0?'student-reading-lead':''}>{block.text}</p>:block.type==='list'?<ul key={block.id}>{block.items.map((item,j)=><li key={j}>{item}</li>)}</ul>:block.type==='code'?<div key={block.id}><h3>{block.title}</h3><pre><code>{block.code}</code></pre><p>{block.explanation}</p></div>:block.type==='resource'?<p key={block.id}><a href={block.url} target="_blank" rel="noopener noreferrer">{block.title}</a> {block.description}</p>:<aside key={block.id}><strong>{block.title}</strong><p>{block.text}</p></aside>) ?? lesson.explanation.map((paragraph,i)=><p key={i}>{paragraph}</p>)}</section>
          <section className="student-reading-example"><div className="student-reading-section-label"><span>02</span><h2>Syntax & example</h2></div><p>Read through the example and connect each part to the explanation above.</p><div className="student-example-file"><span><StudentIcon name="code" />{fileNames[lesson.language]}</span><button onClick={copy}>Copy code</button></div><div className="student-example-code"><div aria-hidden="true">{lesson.code.split("\n").map((_, i) => <span key={i}>{i + 1}</span>)}</div><pre tabIndex={0} aria-label={lesson.language.toUpperCase() + " code example"}><code>{lesson.code}</code></pre></div><p role="status" className="student-example-copy-status">{copyStatus}</p></section>
          <section className="student-reading-practice"><div className="student-reading-section-label"><span>03</span><h2>Try it yourself</h2></div><p>{lesson.practice}</p><p className="student-reading-practice-note">Use the practice workspace on this page. Each lesson has its own draft. Run Code updates the preview; practice does not automatically complete the lesson.</p><button className="student-button secondary" aria-controls={workspaceId} onClick={() => openPractice(true)}>Practice this lesson<StudentIcon name="code" /></button></section>

        </article>
      <aside id={workspaceId} hidden={!practice} className="student-lesson-practice-panel" aria-label={"Practice " + lesson.title}>
        <div className="student-lesson-practice-heading"><h2><StudentIcon name="code" />Practice workspace</h2><button onClick={closePractice}>Reading view</button></div>
        <p className="student-lesson-practice-instructions">{lesson.practice}</p><p>Start with a blank workspace and use the example above as a reference. Save Draft keeps your work in your account.</p>
        <CodeWorkspace ref={workspace} key={lesson.id} workspaceId={"lesson-" + lesson.id} starter={starter} initialLanguage={lesson.language} embedded />
      </aside>
          <section className="student-reading-complete student-reading-completion-card"><h2>Ready for your next step?</h2><p>Mark this lesson complete when you feel comfortable with the concept. You can revisit it anytime.</p><button className="student-button" disabled={done} onClick={complete}>{done ? <><StudentIcon name="check" />Lesson completed</> : "Mark as complete"}</button><Link href={activities.find(a=>a.type==="quiz")?.href ?? "/courses/" + course.id} className="student-text-action">Check your understanding<StudentIcon name="arrow" /></Link><p role="status" className="student-completion-feedback">{completionNotice}</p></section>
        <nav aria-label="Lesson navigation" className="student-reading-navigation">{previous ? <Link href={previous.href}><span>← PREVIOUS ACTIVITY</span><strong>{previous.title}</strong></Link> : <Link href={"/courses/" + course.id}><span>← YOUR COURSE</span><strong>Back to curriculum</strong></Link>}{next ? <Link href={next.href}><span>NEXT ACTIVITY →</span><strong>{next.title}</strong></Link> : <Link href="/courses"><span>YOUR LEARNING →</span><strong>Back to My Learning</strong></Link>}</nav>
      </div>

    </div>
  </div>;
}
