"use client";
import { courses, allLessons } from "../../lib/student/courses";
import { challenges } from "../../lib/student/challenges";
import { projects } from "../../lib/student/projects";
import { quizzes } from "../../lib/student/quizzes";
import type { Subject } from "../../lib/student/types";
import { CourseView } from "./curriculum-view";
import { LessonView } from "./lesson-view";
import { QuizView } from "./quiz-view";
import { ChallengeView } from "./challenge-view";
import { ProjectView } from "./project-view";
export function RemoteActivity({ kind, id }: { kind: string; id: string }) {
  const course = courses.find((c) => c.id === id),
    lesson = allLessons.find((l) => l.id === id),
    challenge = challenges.find((c) => c.id === id),
    project = projects.find((p) => p.id === id);
  if (kind === "courses" && course) return <CourseView course={course} />;
  if (kind === "lessons" && lesson) return <LessonView lesson={lesson} />;
  if (kind === "quizzes" && Object.hasOwn(quizzes, id))
    return <QuizView subject={id as Subject} />;
  if (kind === "challenges" && challenge)
    return <ChallengeView challenge={challenge} />;
  if (kind === "projects" && project) return <ProjectView project={project} />;
  return (
    <p className="student-empty">This content is not currently published.</p>
  );
}
