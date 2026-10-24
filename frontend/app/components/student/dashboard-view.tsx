"use client";

import Link from "next/link";
import { allLessons, courses } from "@/app/lib/student/courses";
import { challenges } from "@/app/lib/student/challenges";
import { projects } from "@/app/lib/student/projects";
import { curriculumStats, estimatedTime, itemDetails, learningSuggestion } from "@/app/lib/student/curriculum";
import { useStudent } from "./student-provider";
import { useProgress } from "./progress-provider";
import { ActivityList, CourseCard } from "./learning-overview";
import { StudentIcon, SubjectMark } from "./student-icon";

export function DashboardView() {
  const student = useStudent();
  const { progress } = useProgress();
  const suggestion = learningSuggestion(progress);
  const details = suggestion && itemDetails(suggestion.item);
  const subject = suggestion?.subject ?? "html";
  const course = courses.find((c) => c.id === subject)!;
  const stats = curriculumStats(subject, progress);
  const results = courses.flatMap((c) => progress.quizzes[c.id] ? [progress.quizzes[c.id]] : []);
  const average = results.length ? Math.round(results.reduce((sum, q) => sum + q.latest, 0) / results.length) : null;
  const started = Boolean(progress.currentLesson || progress.activity.length);
  const nextTheory = course.lessons.find((l) => !progress.lessons.includes(l.id) && !(suggestion?.item.kind === "lesson" && suggestion.item.id === l.id)) ?? allLessons.find((l) => !progress.lessons.includes(l.id) && l.id !== suggestion?.item.id);

  return <div className="student-dashboard">
    <section className="student-welcome" aria-labelledby="welcome-title">
      <div className="student-welcome-copy">
        <p className="student-kicker">LEARN. PRACTICE. BUILD.</p>
        <h1 id="welcome-title">{started ? "Welcome back," : "Welcome to your workspace,"}<br /><span>{student.label}.</span></h1>
        <p>{started ? "Pick up a new idea. Make it work. Keep building the things you want to see on the web." : "Your first line of code is a great place to start. Learn the foundations, try things out, and build at your own pace."}</p>
        <Link className="student-welcome-link" href="/courses">Explore your curriculum <StudentIcon name="arrow" /></Link>
      </div>
      <div className="student-continue">
        <div className="student-row"><span className="student-kicker">{suggestion?.reason === "resume" ? "CONTINUE LEARNING" : started ? "YOUR NEXT ACTIVITY" : "SUGGESTED STARTING POINT"}</span><SubjectMark subject={subject} small /></div>
        <p className="student-continue-course">{suggestion ? course.title : "Foundations complete"}</p>
        <h2>{details?.title ?? "Put your skills to work."}</h2>
        <p className="student-muted">{suggestion ? <>{details?.label} <span aria-hidden="true">·</span> ~{estimatedTime(suggestion.item.minutes)} estimated</> : "All core course activities are complete. Explore a guided project or revisit any topic."}</p>
        <div className="student-course-completion"><div className="student-row"><span>{course.id === "javascript" ? "JavaScript" : course.id.toUpperCase()} course progress</span><strong>{stats.percent}%</strong></div><progress className="student-progress" value={stats.percent} max={100} aria-label="Suggested course completion" /></div>
        <Link href={details?.href ?? "/projects"} className="student-button">{suggestion?.reason === "resume" ? "Resume activity" : suggestion ? started ? "Open activity" : "Start your first lesson" : "Explore projects"}<StudentIcon name="arrow" /></Link>
        <span className="student-continue-note">{suggestion?.reason === "resume" ? "The lesson you last opened. Your place is saved." : suggestion?.reason === "course" ? "Next unfinished activity in your last-viewed course." : suggestion ? "A suggested path, with every course open to explore." : "Project completion is self-reviewed."}</span>
      </div>
    </section>

    <section className="student-stat-strip" aria-label="Your learning statistics">
      <div><span className="student-stat-icon"><StudentIcon name="lesson" /></span><div><strong>{progress.lessons.length}<small>/{allLessons.length}</small></strong><span>Lessons completed</span></div></div>
      <div><span className="student-stat-icon"><StudentIcon name="quiz" /></span><div><strong>{average === null ? "—" : `${average}%`}</strong><span>{results.length ? `Latest quiz average · ${results.length}/3 taken` : "Quiz average · no attempts yet"}</span></div></div>
      <div><span className="student-stat-icon"><StudentIcon name="challenge" /></span><div><strong>{progress.challenges.length}<small>/{challenges.length}</small></strong><span>Exercises completed</span></div></div>
      <div><span className="student-stat-icon"><StudentIcon name="project" /></span><div><strong>{progress.projects.length}<small>/{projects.length}</small></strong><span>Projects completed</span></div></div>
    </section>

    <section className="student-learning-section" aria-labelledby="learning-path-title">
      <div className="student-section-heading"><div><p className="student-kicker">THE FOUNDATIONS</p><h2 id="learning-path-title">Your learning path</h2><p className="student-path-label"><span>HTML</span><StudentIcon name="chevron" /><span>CSS</span><StudentIcon name="chevron" /><span>JavaScript</span><small>Explore in any order.</small></p></div><Link className="student-text-action" href="/courses">All courses <StudentIcon name="arrow" /></Link></div>
      <ol className="student-roadmap">{courses.map((entry) => <li key={entry.id}><CourseCard course={entry} /></li>)}</ol>
    </section>

    <div className="student-dashboard-bottom">
      <section aria-labelledby="recent-activity-title"><div className="student-section-heading"><div><p className="student-kicker">ONE STEP AT A TIME</p><h2 id="recent-activity-title">Recent activity</h2></div><Link className="student-text-action" href="/progress">My progress <StudentIcon name="arrow" /></Link></div><ActivityList limit={4} /></section>
      <div className="student-dashboard-aside">
        <section className="student-practice-launcher"><div className="student-row"><span className="student-kicker">LEARN BY DOING</span><StudentIcon name="code" /></div><h2>Make the idea your own.</h2><p>Try a small experiment or take on a focused challenge.</p><div><Link href="/playground"><StudentIcon name="code" /><span>Open playground</span><StudentIcon name="arrow" /></Link><Link href="/challenges"><StudentIcon name="challenge" /><span>Explore challenges</span><StudentIcon name="arrow" /></Link></div></section>
        {nextTheory && <section className="student-next-lesson"><span className="student-next-icon"><StudentIcon name="lesson" /></span><div><p className="student-kicker">NEXT THEORY LESSON</p><h3><Link href={`/lessons/${nextTheory.id}`}>{nextTheory.title}</Link></h3><p>{nextTheory.language.toUpperCase()} · Suggested from your unfinished lessons</p></div><StudentIcon name="chevron" /></section>}
      </div>
    </div>
  </div>;
}
