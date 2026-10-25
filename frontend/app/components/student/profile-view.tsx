"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { activityLocations, completionStats, curriculumCourses, curriculumStats } from "@/app/lib/student/curriculum";
import { displayNameError, profileAvatars, type AvatarId } from "@/app/lib/student/student-profile";
import { emptyProgress } from "@/app/lib/student/progress";
import { useProgress } from "./progress-provider";
import { useStudentProfile } from "./profile-provider";
import { LogoutButton, useStudent } from "./student-provider";
import { ActivityList, ProgressRing } from "./learning-overview";
import { StudentAvatar } from "./student-avatar";
import { StudentIcon, SubjectMark } from "./student-icon";
import { ThemeToggle } from "../theme-toggle";
import { useStudentPageEntry } from "./page-navigation";
import "./profile.css";

function ProfileEditor() {
  const { profile, updateProfile } = useStudentProfile();
  const [name, setName] = useState(profile.displayName);
  const [avatar, setAvatar] = useState<AvatarId>(profile.avatar);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const input = useRef<HTMLInputElement>(null);
  function submit(event: FormEvent) {
    event.preventDefault();
    const validation = displayNameError(name);
    if (validation) { setError(validation); setNotice(""); input.current?.focus({ preventScroll: true }); return; }
    const result = updateProfile({ version: 1, displayName: name, avatar });
    if (result.ok) { setName(name.trim().replace(/\s+/g, " ")); setError(""); setNotice("Profile saved in this browser."); }
    else { setError(result.error ?? "Your profile could not be saved."); setNotice(""); }
  }
  return <section className="student-profile-card" aria-labelledby="profile-personalize"><div className="student-section-heading"><div><p className="student-kicker">MAKE IT YOURS</p><h2 id="profile-personalize">Your learning identity</h2></div><StudentIcon name="profile" /></div>
    <form noValidate onSubmit={submit}>
      <fieldset className="student-avatar-picker"><legend>Choose an avatar</legend><div>{profileAvatars.map((option) => <label key={option.id} data-selected={avatar === option.id}><input type="radio" name="profile-avatar" value={option.id} checked={avatar === option.id} onChange={() => { setAvatar(option.id); setNotice(""); }} /><StudentAvatar avatar={option.id} /><span>{option.label}</span></label>)}</div></fieldset>
      <label className="student-profile-name-label" htmlFor="profile-name">Display name</label><input ref={input} id="profile-name" value={name} required minLength={2} maxLength={40} autoComplete="off" aria-invalid={Boolean(error)} aria-describedby={error ? "profile-name-help profile-edit-error" : "profile-name-help"} onChange={(event) => { setName(event.target.value); setError(""); setNotice(""); }} /><p id="profile-name-help" className="student-profile-help">Use 2–40 characters. This browser-local display name does not change your account details.</p>
      {error && <p id="profile-edit-error" className="student-error" role="alert">{error}</p>}
      <div className="student-profile-form-actions"><button className="student-button" type="submit">Save profile<StudentIcon name="check" /></button><button className="student-button secondary" type="button" onClick={() => { setName(profile.displayName); setAvatar(profile.avatar); setError(""); setNotice(""); }}>Cancel edits</button></div><p role="status" className="student-profile-save-notice">{notice}</p>
    </form>
  </section>;
}

function LearningDataControls() {
  const { update } = useProgress();
  const [confirm, setConfirm] = useState(false);
  const [notice, setNotice] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  function close() { setConfirm(false); requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true })); }
  return <section className="student-profile-data" aria-labelledby="profile-data-title"><div><p className="student-kicker">LEARNING DATA</p><h2 id="profile-data-title">A fresh start, when you need it</h2><p>Reset this account’s learning progress, attempts, visit history, and all saved code drafts. Your profile, site theme, and other accounts are kept.</p></div>
    {confirm ? <div className="student-profile-reset-confirm" role="group" aria-label="Confirm learning data reset"><h3>Reset progress and drafts?</h3><p>This cannot be undone. Copy any code you want to keep before confirming.</p><div><button ref={cancel} className="student-button secondary" onClick={close}>Keep my data</button><button className="student-button student-danger-button" onClick={() => { if (update(emptyProgress)) { close(); setNotice("Progress and drafts reset for this account."); } else setNotice("Reset could not be saved. Your previous records are unchanged."); }}>Yes, reset my learning data</button></div></div> : <button ref={trigger} className="student-button secondary student-reset-trigger" onClick={() => { setConfirm(true); setNotice(""); requestAnimationFrame(() => cancel.current?.focus({ preventScroll: true })); }}>Reset progress and drafts</button>}
    <p role="status">{notice}</p>
  </section>;
}

export function ProfileView() {
  useStudentPageEntry();
  const student = useStudent();
  const { profile } = useStudentProfile();
  const { progress } = useProgress();
  const stats = completionStats(activityLocations().map(({ activity }) => activity), progress);
  const completedCourses = curriculumCourses.filter((course) => curriculumStats(course.id, progress).isComplete).length;
  const attempts = curriculumCourses.reduce((sum, course) => sum + (progress.quizzes[course.id]?.attempts ?? 0), 0);
  return <div className="student-learning-profile">
    <header className="student-profile-hero"><StudentAvatar avatar={profile.avatar} className="student-profile-hero-avatar" /><div><p className="student-kicker">STUDENT PROFILE · WEB DEVELOPMENT</p><h1>{student.label}</h1><p>A place to make your learning journey your own.</p><span className="student-profile-demo-label">Browser-local learning profile</span></div><Link className="student-button secondary" href="/courses">My Learning<StudentIcon name="arrow" /></Link></header>
    <section className="student-profile-stats" aria-label="Your learning statistics"><div><strong>{stats.completed}<small> / {stats.total}</small></strong><span>Activities completed</span></div><div><strong>{completedCourses}<small> / {curriculumCourses.length}</small></strong><span>Courses completed</span></div><div><strong>{attempts}</strong><span>Quiz attempts</span></div><div><strong>{Object.keys(progress.drafts).length}</strong><span>Saved workspaces</span></div></section>
    <div className="student-profile-grid"><ProfileEditor /><section className="student-profile-card" aria-labelledby="profile-course-progress"><div className="student-section-heading"><div><p className="student-kicker">YOUR FOUNDATIONS</p><h2 id="profile-course-progress">Course progress</h2></div><Link className="student-text-action" href="/progress">My Progress<StudentIcon name="arrow" /></Link></div><div className="student-profile-overall"><ProgressRing value={stats.percent} label="Overall curriculum completion" /><div><strong>{stats.percent}% of your curriculum complete</strong><p>{stats.completed} of {stats.total} activities, at your own pace.</p></div></div><ul className="student-profile-courses">{curriculumCourses.map((course) => {
      const current = curriculumStats(course.id, progress);
      return <li key={course.id}><SubjectMark subject={course.id} small /><div><span><Link href={"/courses/" + course.id}>{course.title}</Link><strong>{current.percent}%</strong></span><progress className="student-progress" max={100} value={current.percent} aria-label={course.title + " completion"} /><small>{current.completed}/{current.total} activities complete</small></div></li>;
    })}</ul></section>
    <section className="student-profile-card" aria-labelledby="profile-recent"><div className="student-section-heading"><div><p className="student-kicker">KEEP THE MOMENTUM</p><h2 id="profile-recent">Recent learning activity</h2></div></div><ActivityList limit={4} /></section>
    <section className="student-profile-card" aria-labelledby="profile-preferences"><div className="student-section-heading"><div><p className="student-kicker">YOUR WORKSPACE</p><h2 id="profile-preferences">Account & preferences</h2></div></div><dl className="student-profile-account"><div><dt>Sign-in address</dt><dd>{student.email}</dd></div><div><dt>Site appearance</dt><dd><span>Light or dark</span><ThemeToggle /></dd></div><div><dt>Practice editor</dt><dd>VS Code dark · independent of site theme</dd></div><div><dt>Storage</dt><dd>This browser, for this account</dd></div></dl><p className="student-profile-help">Your session is verified by DECODE. Profile edits and learning records stay in this browser. Password recovery, Google sign-in, and backend profile editing remain unavailable.</p><LogoutButton /></section></div>
    <LearningDataControls />
  </div>;
}
