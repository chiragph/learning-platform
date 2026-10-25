"use client";

import Link from "next/link";
import { activityComplete, learningSuggestion } from "@/app/lib/student/curriculum";
import { useProgress } from "./progress-provider";
import { StudentIcon, SubjectMark } from "./student-icon";
import "./curriculum.css";

export function ContinueLearning() {
  const { progress } = useProgress();
  const suggestion = learningSuggestion(progress);
  return <section className="curriculum-continue" aria-labelledby="continue-learning-title">
    <div className="curriculum-continue-label"><StudentIcon name="clock" /><h2 id="continue-learning-title">Continue Learning</h2><span>{suggestion?.reason === "resume" ? "Last opened" : suggestion ? "Suggested first activity" : "Curriculum complete"}</span></div>
    {suggestion ? <div className="curriculum-continue-body"><SubjectMark subject={suggestion.course.id} small /><div><p>{suggestion.course.title} <span aria-hidden="true">/</span> {suggestion.module.title}</p><h3>{suggestion.activity.title}</h3>{suggestion.activity.availability === "upcoming" && <span className="student-muted">Upcoming · preview only</span>}</div><Link className="student-button" href={suggestion.activity.href}>{suggestion.activity.availability === "upcoming" ? "Preview activity" : activityComplete(suggestion.activity, progress) ? "Revisit activity" : suggestion.reason === "resume" ? "Continue activity" : "Start learning"}<StudentIcon name="arrow" /></Link></div> : <div className="curriculum-continue-body"><p>Every published activity is complete. You can revisit your curriculum anytime.</p><Link href="/courses" className="student-text-action">My Learning<StudentIcon name="arrow" /></Link></div>}
  </section>;
}
