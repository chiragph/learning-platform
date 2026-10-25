"use client";

import Link from "next/link";
import { activityLocations, completionStats, curriculumCourses, curriculumStats, learningPath } from "@/app/lib/student/curriculum";
import { useStudent } from "./student-provider";
import { useProgress } from "./progress-provider";
import { ActivityList, PageHeading } from "./learning-overview";
import { ContinueLearning } from "./continue-learning";
import { StudentIcon, SubjectMark } from "./student-icon";
import { useStudentPageEntry } from "./page-navigation";

export function DashboardView() {
  useStudentPageEntry();
  const student = useStudent();
  const { progress } = useProgress();
  const stats = completionStats(activityLocations().map((entry) => entry.activity), progress);
  const completedCourses = curriculumCourses.filter((c) => curriculumStats(c.id, progress).isComplete).length;
  return <div className="learning-dashboard">
    <div className="learning-dashboard-heading"><PageHeading eyebrow="YOUR WORKSPACE" title={"Welcome, " + student.label + "."} description="Pick up where you left off and keep your next step in view." /><Link href="/courses" className="student-button secondary">My Learning<StudentIcon name="arrow" /></Link></div>
    <ContinueLearning />
    <section className="learning-summary" aria-label="Curriculum progress"><div><strong>{stats.percent}%</strong><span>Overall completion</span></div><div><strong>{stats.completed}<small> / {stats.total}</small></strong><span>Activities completed</span></div><div><strong>{completedCourses}<small> / {curriculumCourses.length}</small></strong><span>Courses completed</span></div><progress className="student-progress" value={stats.percent} max={100} aria-label="Overall curriculum completion" /></section>
    <div className="learning-dashboard-columns"><section aria-labelledby="dashboard-courses"><div className="student-section-heading"><div><p className="student-kicker">{learningPath.title.toUpperCase()}</p><h2 id="dashboard-courses">Course progress</h2></div><Link className="student-text-action" href="/courses">View curriculum<StudentIcon name="arrow" /></Link></div><ul className="learning-course-overview">{curriculumCourses.map((course) => {
      const current = curriculumStats(course.id, progress);
      return <li key={course.id}><Link href={"/courses/" + course.id}><SubjectMark subject={course.id} small /><div><span><strong>{course.title}</strong><strong>{current.percent}%</strong></span><progress className="student-progress" value={current.percent} max={100} aria-label={course.title + " completion"} /><small>{current.completed} of {current.total} activities completed</small></div><StudentIcon name="chevron" /></Link></li>;
    })}</ul><Link className="learning-playground-link" href="/playground"><StudentIcon name="code" /><span>Try an idea in the Code Playground</span><StudentIcon name="arrow" /></Link></section>
    <section aria-labelledby="dashboard-recent"><div className="student-section-heading"><div><p className="student-kicker">YOUR LEARNING RECORD</p><h2 id="dashboard-recent">Recent activity</h2></div><Link className="student-text-action" href="/progress">My Progress<StudentIcon name="arrow" /></Link></div><ActivityList limit={4} /></section></div>
  </div>;
}
