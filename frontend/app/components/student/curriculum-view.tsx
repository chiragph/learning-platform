"use client";

import Link from "next/link";
import { useEffect, useState, type KeyboardEvent } from "react";
import { activityStatus, completionStats, courseItems, curricula, curriculumCourses, curriculumStats, displayOrder, learningPath, mostRecentActivity, nextCourseItem, type CurriculumActivity, type CurriculumCourse } from "@/app/lib/student/curriculum";
import type { Course } from "@/app/lib/student/types";
import { ContinueLearning } from "./continue-learning";
import { PageHeading } from "./learning-overview";
import { useProgress } from "./progress-provider";
import { StudentIcon, SubjectMark, type StudentIconName } from "./student-icon";
import "./curriculum.css";
import { AnimatedDisclosure } from "./animated-disclosure";
import { useStudentPageEntry } from "./page-navigation";

const activityIcons: Record<CurriculumActivity["type"], StudentIconName> = { theory: "lesson", quiz: "quiz", lab: "code", workshop: "project" };
const activityLabels = { theory: "Theory", quiz: "Quiz", lab: "Lab", workshop: "Workshop" };
const statusLabels = { "not-started": "Not Started", "in-progress": "In Progress", completed: "Completed" };

export function ActivityRow({ activity, recentId }: { activity: CurriculumActivity; recentId?: string }) {
  const { progress } = useProgress();
  const status = activityStatus(activity, progress);
  const referenceId = activity.reference?.id;
  const quiz = referenceId ? progress.quizzes[referenceId] : undefined;
  const workshop = referenceId ? progress.workshops?.[referenceId] : undefined;
  const practiceLabel = activity.type === "lab" ? "Task-specific checks" : activity.type === "workshop" ? workshop ? workshop.completedSteps.length + " steps reviewed · Self-review" : "Guided workshop · Self-review" : activity.type === "quiz" ? quiz ? (quiz.best >= 70 ? "Passed" : "Attempted") + " · Best " + quiz.best + "%" : "Pass with 70%" : "Read & explore";
  return <li><Link className="curriculum-activity" href={activity.href} data-recent={recentId === activity.id || undefined}>
    <span className="curriculum-type-icon"><StudentIcon name={activityIcons[activity.type]} /></span>
    <span className="curriculum-activity-copy"><strong>{activity.title}</strong><span>{activityLabels[activity.type]} <span aria-hidden="true">·</span> {activity.availability === "upcoming" ? "Upcoming" : practiceLabel}{recentId === activity.id && <span className="curriculum-last-opened">Last opened</span>}</span></span>
    <span className="curriculum-status" data-status={status}>{status === "completed" && <StudentIcon name="check" />}{statusLabels[status]}</span>
    <span className="curriculum-activity-action">{activity.availability === "upcoming" ? "Preview" : status === "completed" ? "Review" : status === "in-progress" ? "Continue" : "Start"}<StudentIcon name="chevron" /></span>
  </Link></li>;
}

function CourseCurriculum({ course, initiallyOpen = false }: { course: CurriculumCourse; initiallyOpen?: boolean }) {
  const { progress } = useProgress();
  const recent = mostRecentActivity(progress);
  const modules = displayOrder(course.modules);
  const stats = curriculumStats(course.id, progress);
  const target = nextCourseItem(course.id, progress) ?? courseItems(course.id)[0];
  const started = courseItems(course.id).some((a) => activityStatus(a, progress) !== "not-started");
  const [open, setOpen] = useState(initiallyOpen);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([recent?.course.id === course.id ? recent.module.id : modules.find((m) => !completionStats(m.activities, progress).isComplete)?.id ?? modules[0]?.id].filter((id): id is string => Boolean(id))));
  useEffect(() => {
    const reveal = () => {
      const id = window.location.hash.slice(1);
      if (!course.modules.some((module) => module.id === id)) return;
      setOpen(true);
      setExpanded((previous) => new Set([...previous, id]));
    };
    reveal();
    window.addEventListener("hashchange", reveal);
    return () => window.removeEventListener("hashchange", reveal);
  }, [course]);
  function toggleModule(id: string) { setExpanded((previous) => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }
  return <section className="curriculum-course" aria-labelledby={course.id + "-title"}>
    <div className="curriculum-course-header">
      <h2><button id={course.id + "-title"} aria-expanded={open} aria-controls={course.id + "-modules"} onClick={() => setOpen(!open)}><SubjectMark subject={course.id} small /><span><strong>{course.title}</strong><span>{modules.length} modules · {stats.total} activities</span></span><StudentIcon name="chevron" className="curriculum-chevron" /></button></h2>
      <div className="curriculum-course-progress"><span><strong>{stats.percent}%</strong><span>{stats.completed}/{stats.total} completed</span></span><progress className="student-progress" value={stats.percent} max={100} aria-label={course.title + " completion"} /></div>
      {target && <Link className="student-button secondary" href={target.href}>{stats.isComplete ? "Review" : started ? "Continue" : "Start"}<StudentIcon name="arrow" /><span className="curriculum-sr-only"> {course.title}</span></Link>}
    </div>
    <AnimatedDisclosure id={course.id + "-modules"} open={open} className="curriculum-course-content">
      <div className="curriculum-course-tools"><Link href={"/courses/" + course.id}>Course overview</Link><div><button onClick={() => setExpanded(new Set(modules.map((m) => m.id)))}>Expand all<span className="curriculum-sr-only"> {course.title} modules</span></button><button onClick={() => setExpanded(new Set())}>Collapse all<span className="curriculum-sr-only"> {course.title} modules</span></button></div></div>
      {modules.length ? modules.map((module, index) => {
        const moduleStats = completionStats(module.activities, progress);
        const moduleOpen = expanded.has(module.id);
        return <section className="curriculum-module" id={module.id} key={module.id}>
          <h3><button id={module.id + "-title"} aria-expanded={moduleOpen} aria-controls={module.id + "-activities"} onClick={() => toggleModule(module.id)}><span className="student-module-number">{moduleStats.isComplete ? <StudentIcon name="check" /> : String(index + 1).padStart(2, "0")}</span><span className="curriculum-module-copy"><strong>{module.title}</strong><span>{module.description}</span></span><span className="curriculum-module-progress">{moduleStats.percent}%<span>{moduleStats.completed}/{moduleStats.total} completed</span></span><StudentIcon name="chevron" className="curriculum-chevron" /></button></h3>
          <AnimatedDisclosure id={module.id + "-activities"} open={moduleOpen}>{module.activities.length ? <ol className="curriculum-activities">{displayOrder(module.activities).map((activity) => <ActivityRow key={activity.id} activity={activity} recentId={recent?.activity.id} />)}</ol> : <p className="curriculum-empty-module">No activities have been published in this module yet.</p>}</AnimatedDisclosure>
        </section>;
      }) : <p className="curriculum-empty-module">No modules have been published yet.</p>}
    </AnimatedDisclosure>
  </section>;
}

export function CoursesView() {
  useStudentPageEntry();
  const { progress } = useProgress();
  const recent = mostRecentActivity(progress);
  const [tab, setTab] = useState<"active" | "completed">("active");
  const completed = curriculumCourses.filter((c) => curriculumStats(c.id, progress).isComplete);
  const active = curriculumCourses.filter((c) => !curriculumStats(c.id, progress).isComplete);
  function tabKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? "active" : event.key === "End" ? "completed" : tab === "active" ? "completed" : "active";
    setTab(next);
    document.getElementById("learning-tab-" + next)?.focus();
  }
  return <div className="curriculum-page">
    <PageHeading eyebrow={learningPath.title.toUpperCase()} title="My Learning" description="Your curriculum, one activity at a time. Explore any course or module at your own pace." />
    <ContinueLearning />
    <div className="curriculum-toolbar"><div role="tablist" aria-label="Course completion">{([ ["active", "In Progress", active.length], ["completed", "Completed", completed.length] ] as const).map(([id, label, count]) => <button key={id} role="tab" id={"learning-tab-" + id} aria-selected={tab === id} aria-controls={"learning-panel-" + id} tabIndex={tab === id ? 0 : -1} onClick={() => setTab(id)} onKeyDown={tabKey}>{label}<span>{count}</span></button>)}</div><span>Theory · Quiz · Lab · Workshop</span></div>
    {([ ["active", active], ["completed", completed] ] as const).map(([panel, entries]) => <div key={panel} role="tabpanel" id={"learning-panel-" + panel} aria-labelledby={"learning-tab-" + panel} hidden={tab !== panel} tabIndex={0} className="curriculum-course-list">
      {entries.length ? entries.map((course, index) => <CourseCurriculum key={course.id} course={course} initiallyOpen={recent && entries.some((entry) => entry.id === recent.course.id) ? course.id === recent.course.id : index === 0} />) : <div className="curriculum-empty"><StudentIcon name={panel === "completed" ? "book" : "check"} /><h2>{panel === "completed" ? "No completed courses yet" : "All courses completed"}</h2><p>{panel === "completed" ? "Your completed courses will appear here. Every activity remains open while you learn." : "You have completed every curriculum activity. Revisit any topic in the Completed tab."}</p><button className="student-button secondary" onClick={() => { const next = panel === "active" ? "completed" : "active"; setTab(next); document.getElementById("learning-tab-" + next)?.focus(); }}>{panel === "completed" ? "Browse your curriculum" : "Review completed courses"}</button></div>}
    </div>)}
    <p className="curriculum-footnote">Every activity is accessible. Opening an activity saves your place; completion requires its existing lesson, quiz, or practice action.</p>
  </div>;
}

export function CourseView({ course }: { course: Course }) {
  useStudentPageEntry();
  const curriculum = curricula[course.id];
  return <div className="curriculum-page"><Link className="student-back-link" href="/courses"><StudentIcon name="arrow" />My Learning</Link><PageHeading eyebrow="WEB DEVELOPMENT" title={curriculum.title + " curriculum"} description={curriculum.description} /><details className="curriculum-objectives"><summary>What you will learn</summary><ul>{curriculum.objectives.map((objective) => <li key={objective}>{objective}</li>)}</ul></details><CourseCurriculum course={curriculum} initiallyOpen /><p className="curriculum-footnote">Labs provide task-specific solution checks. Workshops guide you through saved steps and a final self-review. Every activity stays accessible.</p></div>;
}
