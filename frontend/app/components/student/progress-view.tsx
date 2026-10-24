"use client";

import Link from "next/link";
import { useState } from "react";
import { allLessons, courses } from "@/app/lib/student/courses";
import { challenges, challengeIds } from "@/app/lib/student/challenges";
import { projects } from "@/app/lib/student/projects";
import { courseProgress, emptyProgress } from "@/app/lib/student/progress";
import { PageHeading, CourseCard, ActivityList } from "./learning-overview";
import { useProgress } from "./progress-provider";
import { useStudent, LogoutButton } from "./student-provider";

export function ProgressView() {
  const { progress } = useProgress();
  const units = courses.map((c) => courseProgress(progress, c.id, challengeIds(c.id)));
  const completed = units.reduce((sum, p) => sum + p.completed, 0);
  const total = units.reduce((sum, p) => sum + p.total, 0);
  const percent = Math.round(completed / total * 100);
  return <><PageHeading title="See how far you have come." description="Every completed lesson, quiz, and practice exercise is a small step forward. Your records stay in this browser." /><section className="student-card"><div className="student-row"><h2>Overall course progress</h2><strong className="student-stat">{percent}%</strong></div><progress className="student-progress" value={percent} max={100} aria-label="Overall course completion" /><p className="student-muted">{completed} of {total} learning units completed.</p><details className="student-hint"><summary>How completion is calculated</summary><p>Each course gives one equally weighted unit for each completed lesson, one for a best quiz score of at least 70%, and one for each completed course challenge. Course percentage = completed units ÷ total units × 100, rounded to the nearest whole number. Overall progress uses the sum of all course units. Self-reviewed exercises count when you explicitly mark them complete. Projects are tracked separately.</p></details></section><section className="student-section"><h2 className="student-section-title">Course progress</h2><div className="student-grid">{courses.map((c) => <CourseCard key={c.id} course={c} />)}</div></section><section className="student-section student-grid"><div className="student-card"><span className="student-stat">{progress.lessons.length}/{allLessons.length}</span><h2>Lessons</h2><Link href="/lessons" className="student-link">Continue theory →</Link></div><div className="student-card"><span className="student-stat">{progress.challenges.length}/{challenges.length}</span><h2>Challenges</h2><Link href="/challenges" className="student-link">Keep practicing →</Link></div><div className="student-card"><span className="student-stat">{progress.projects.length}/{projects.length}</span><h2>Projects</h2><Link href="/projects" className="student-link">Build something →</Link></div></section><section className="student-section"><h2 className="student-section-title">Quiz performance</h2><div className="student-card"><ul>{courses.map((c) => { const q = progress.quizzes[c.id]; return <li key={c.id} className="student-list-item"><Link className="student-link" href={`/quizzes/${c.id}`}>{c.title}</Link><span>{q ? `Latest ${q.latest}% · Best ${q.best}% · ${q.attempts} attempt${q.attempts === 1 ? "" : "s"}` : "Not attempted"}</span></li>; })}</ul></div></section><section className="student-section"><h2 className="student-section-title">Learning activity</h2><ActivityList /></section></>;
}
export function ProfileView() {
  const student = useStudent();
  const { progress, update } = useProgress();
  const [confirm, setConfirm] = useState(false);
  const [notice, setNotice] = useState("");
  return <>
    <PageHeading title="Your demo profile." description="A fictional student identity for trying DECODE's learning experience. No real names or passwords are stored." />
    <div className="student-grid two">
      <section className="student-card">
        <span className="student-tag">STUDENT DEMO</span><h2>{student.label}</h2>
        <dl className="student-profile-fields">
          <div><dt>Fictional email</dt><dd>{student.email}</dd></div>
          <div><dt>Storage</dt><dd>This browser only</dd></div>
          <div><dt>Saved workspaces</dt><dd>{Object.keys(progress.drafts).length}</dd></div>
        </dl>
        <p className="student-muted">Profile editing, password recovery, Google sign-in, and real authentication are not connected. This demo grants no instructor or administrator permissions.</p>
        <LogoutButton />
      </section>
      <section className="student-card">
        <h2>Manage local progress</h2>
        <p className="student-muted">Reset completed lessons, quiz attempts, challenges, projects, activity, and all saved code drafts for this demo account. Other demo accounts and the theme preference are kept.</p>
        <p className="student-muted mt-3">Copy any code you want to keep first. Clearing browser site data also removes local learning records.</p>
        {confirm ? <div className="student-notice mt-4">
          <p>Reset progress and drafts for this account? This cannot be undone.</p>
          <div className="student-row">
            <button className="student-button" onClick={() => { if (update(emptyProgress)) { setConfirm(false); setNotice("Progress and drafts reset for this demo account."); } }}>Yes, reset my demo progress</button>
            <button className="student-button secondary" onClick={() => setConfirm(false)}>Cancel</button>
          </div>
        </div> : <button className="student-button secondary" onClick={() => setConfirm(true)}>Reset progress and drafts</button>}
        <p role="status">{notice}</p>
      </section>
    </div>
  </>;
}
