"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { allLessons, courses } from "@/app/lib/student/courses";
import { curricula, curriculumStats, estimatedTime, itemComplete, itemDetails, itemKey, nextCourseItem, type LearningItem } from "@/app/lib/student/curriculum";
import type { Course } from "@/app/lib/student/types";
import { PageHeading, ProgressRing } from "./learning-overview";
import { useProgress } from "./progress-provider";
import { StudentIcon, SubjectMark, type StudentIconName } from "./student-icon";

const icons: Record<LearningItem["kind"], StudentIconName> = { lesson: "lesson", quiz: "quiz", exercise: "code", project: "project" };

function CourseCatalogEntry({ course, index }: { course: Course; index: number }) {
  const { progress } = useProgress();
  const curriculum = curricula[course.id];
  const stats = curriculumStats(course.id, progress);
  const next = nextCourseItem(course.id, progress);
  const target = next && itemDetails(next);
  return <article className={`student-catalog-course ${course.id}`}>
    <div className="student-catalog-overview">
      <div className="student-row"><SubjectMark subject={course.id} /><span className="student-course-number">0{index + 1}</span></div>
      <p className="student-course-category">BEGINNER · CORE COURSE</p>
      <h2><Link href={`/courses/${course.id}`}>{course.title}</Link></h2>
      <p className="student-muted">{curriculum.headline} {course.description}</p>
      <div className="student-course-meta"><span><StudentIcon name="lesson" />{stats.lessons} lessons</span><span><StudentIcon name="code" />{stats.exercises} exercises</span><span><StudentIcon name="clock" />~{estimatedTime(stats.minutes)} core study</span></div>
      <Link className="student-text-action" href={`/courses/${course.id}`}>Overview & objectives <StudentIcon name="arrow" /></Link>
    </div>
    <div className="student-catalog-modules"><p className="student-kicker">YOUR CURRICULUM · {curriculum.modules.length} MODULES</p>
      <ol>{curriculum.modules.map((module, moduleIndex) => {
        const core = module.items.filter((i) => i.kind !== "project");
        const done = core.filter((i) => itemComplete(i, progress)).length;
        return <li key={module.id}><Link href={`/courses/${course.id}#${module.id}`}><span className={`student-module-number${done === core.length ? " complete" : ""}`}>{done === core.length ? <StudentIcon name="check" /> : String(moduleIndex + 1).padStart(2, "0")}</span><div><h3>{module.title}</h3><span>{module.items.length} activities · {done}/{core.length} core complete</span></div><StudentIcon name="chevron" /></Link></li>;
      })}</ol>
    </div>
    <div className="student-catalog-footer"><div><div className="student-row"><span>{stats.completed}/{stats.total} core activities complete</span><strong>{stats.percent}%</strong></div><progress className="student-progress" value={stats.percent} max={100} aria-label={`${course.title} completion`} /></div><Link href={target?.href ?? `/courses/${course.id}`} className="student-button">{stats.percent === 100 ? "Review course" : stats.completed || progress.currentLesson?.startsWith(course.id + "-") ? "Continue course" : "Start course"}<StudentIcon name="arrow" /></Link></div>
  </article>;
}

export function CoursesView() {
  return <div className="student-curriculum-page">
    <PageHeading eyebrow="YOUR CURRICULUM" title="Build a strong foundation." description="A practical path from your first element to your first interactive page. Choose any course or module and learn at your own pace." />
    <div className="student-catalog-intro"><div className="student-path-label"><span>HTML</span><StudentIcon name="chevron" /><span>CSS</span><StudentIcon name="chevron" /><span>JavaScript</span></div><p>{courses.length} courses <span aria-hidden="true">·</span> {allLessons.length} theory lessons <span aria-hidden="true">·</span> No locked modules</p></div>
    <div className="student-catalog-list">{courses.map((course, index) => <CourseCatalogEntry key={course.id} course={course} index={index} />)}</div>
    <p className="student-curriculum-footnote"><StudentIcon name="clock" />Durations are study estimates, not tracked time. Optional guided projects are separate from core course percentages.</p>
  </div>;
}

export function CourseView({ course }: { course: Course }) {
  const { progress } = useProgress();
  const curriculum = curricula[course.id];
  const stats = curriculumStats(course.id, progress);
  const next = nextCourseItem(course.id, progress);
  const target = next && itemDetails(next);
  const firstUnfinished = curriculum.modules.find((m) => m.items.some((i) => i.kind !== "project" && !itemComplete(i, progress))) ?? curriculum.modules[0];
  const lastViewedModule = curriculum.modules.find((m) => m.items.some((i) => i.kind === "lesson" && i.id === progress.currentLesson && !itemComplete(i, progress)));
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([(lastViewedModule ?? firstUnfinished).id]));
  useEffect(() => {
    const revealHash = () => {
      let hash = "";
      try { hash = decodeURIComponent(window.location.hash.slice(1)); } catch { return; }
      if (curriculum.modules.some((m) => m.id === hash)) setExpanded((current) => new Set([...current, hash]));
    };
    revealHash(); window.addEventListener("hashchange", revealHash);
    return () => window.removeEventListener("hashchange", revealHash);
  }, [curriculum]);

  function toggle(id: string) { setExpanded((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }

  return <div className="student-curriculum-page">
    <Link className="student-back-link" href="/courses"><StudentIcon name="arrow" />All courses</Link>
    <section className={`student-course-hero ${course.id}`} aria-labelledby="course-title">
      <div className="student-course-hero-copy">
        <div className="student-course-hero-label"><SubjectMark subject={course.id} small /><span>BEGINNER · {course.id === "javascript" ? "JAVASCRIPT" : course.id.toUpperCase()}</span></div>
        <h1 id="course-title">{course.title}</h1><p>{curriculum.headline} {course.description}</p>
        <div className="student-course-meta"><span><StudentIcon name="layers" />{stats.modules} modules</span><span><StudentIcon name="lesson" />{stats.lessons} lessons</span><span><StudentIcon name="clock" />~{estimatedTime(stats.minutes)} core study</span></div>
        <div className="student-objectives"><h2>What you will learn</h2><ul>{curriculum.objectives.map((objective) => <li key={objective}><StudentIcon name="check" /><span>{objective}</span></li>)}</ul></div>
      </div>
      <div className="student-course-resume"><ProgressRing value={stats.percent} label={`${course.title} complete`} /><h2>{stats.percent === 100 ? "Core course completed" : stats.completed ? "Keep your momentum." : "Your next chapter starts here."}</h2><p>{stats.completed} of {stats.total} core activities completed</p><Link className="student-button" href={target?.href ?? `/quizzes/${course.id}`}>{target ? stats.completed || progress.currentLesson?.startsWith(course.id + "-") ? "Continue learning" : "Start learning" : "Revisit course quiz"}<StudentIcon name="arrow" /></Link><span>Every module is open. Choose your own pace.</span></div>
    </section>

    <section className="student-syllabus" aria-labelledby="syllabus-title">
      <div className="student-section-heading"><div><p className="student-kicker">YOUR LEARNING PLAN</p><h2 id="syllabus-title">Course curriculum</h2><p>Theory, knowledge checks, and hands-on practice in one place.</p></div><div className="student-syllabus-controls"><button className="student-button secondary" onClick={() => setExpanded(new Set(curriculum.modules.map((m) => m.id)))}>Expand all</button><button className="student-button secondary" onClick={() => setExpanded(new Set())}>Collapse all</button></div></div>
      <div className="student-item-legend" aria-label="Curriculum activity types"><span><StudentIcon name="lesson" />Theory</span><span><StudentIcon name="quiz" />Quiz</span><span><StudentIcon name="code" />Exercise</span><span><StudentIcon name="project" />Optional project</span></div>
      <div className="student-module-list">{curriculum.modules.map((module, index) => {
        const open = expanded.has(module.id);
        const core = module.items.filter((i) => i.kind !== "project");
        const done = core.filter((i) => itemComplete(i, progress)).length;
        const minutes = core.reduce((sum, i) => sum + i.minutes, 0);
        return <section key={module.id} id={module.id} className={`student-module${open ? " expanded" : ""}`} aria-labelledby={`${module.id}-title`}>
          <h3><button id={`${module.id}-title`} aria-expanded={open} aria-controls={`${module.id}-items`} onClick={() => toggle(module.id)}><span className={`student-module-number${done === core.length ? " complete" : ""}`}>{done === core.length ? <StudentIcon name="check" /> : String(index + 1).padStart(2, "0")}</span><span className="student-module-copy"><strong>{module.title}</strong><span>{module.description}</span></span><span className="student-module-summary"><span>{done}/{core.length} core complete</span><span>~{estimatedTime(minutes)}</span></span><StudentIcon name="chevron" className="student-module-chevron" /></button></h3>
          <div id={`${module.id}-items`} hidden={!open} className="student-module-panel"><ol>{module.items.map((item) => {
            const entry = itemDetails(item);
            if (!entry) return null;
            const complete = itemComplete(item, progress);
            const current = item.kind === "lesson" && item.id === progress.currentLesson && !complete;
            return <li key={itemKey(item)}><Link className="student-learning-item" href={entry.href} data-current={current || undefined}>
              <span className={`student-learning-item-icon${complete ? " complete" : ""}`}><StudentIcon name={complete ? "check" : icons[item.kind]} /></span>
              <span className="student-learning-item-copy"><strong>{entry.title}</strong><span>{entry.label}{item.kind === "quiz" ? " · Pass with 70%" : ""}</span></span>
              <span className="student-learning-item-meta"><span className={complete ? "student-item-done" : current ? "student-item-current" : "student-item-time"}>{complete ? "Completed" : current ? "Last viewed" : `~${estimatedTime(item.minutes)}`}</span><StudentIcon name="chevron" /></span>
            </Link></li>;
          })}</ol></div>
        </section>;
      })}</div>
      <p className="student-curriculum-footnote"><StudentIcon name="layers" />Core progress counts lessons, a passed quiz, and exercises equally. Optional projects are tracked separately. No prerequisites are enforced.</p>
    </section>
  </div>;
}
