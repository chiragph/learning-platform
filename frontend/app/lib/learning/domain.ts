// Shared publication rules run on the server and in the existing editor.
import {
  seedInstructorState,
  applyInstructorCommand,
  publicationIssue,
} from "../instructor/repository";
import { initialTheoryContent } from "../instructor/theory";
import { initialQuizContent } from "../instructor/quiz";
import { initialLabContent } from "../instructor/lab";
import { initialWorkshopContent } from "../instructor/workshop";
import type {
  InstructorState,
  InstructorCourse,
  InstructorActivity,
} from "../instructor/types";
import type { TheoryContent } from "../instructor/theory-types";
import type { QuizContent } from "../instructor/quiz-types";
import type { LabContent } from "../instructor/lab-types";
import type { WorkshopContent } from "../instructor/workshop-types";
export { seedInstructorState, applyInstructorCommand, publicationIssue };
export { decodeInstructorStorage } from "../instructor/repository";
export { emptyProgress } from "../student/progress";
export type PublishedActivity = InstructorActivity & {
  content: TheoryContent | QuizContent | LabContent | WorkshopContent;
};
export type PublishedCourse = Omit<InstructorCourse, "modules"> & {
  modules: (Omit<InstructorCourse["modules"][number], "activities"> & {
    activities: PublishedActivity[];
  })[];
};
export function publishCourse(
  state: InstructorState,
  course: InstructorCourse,
  baseline = false,
): PublishedCourse {
  const issue = publicationIssue(course, state);
  if (issue && !baseline) throw new Error(issue);
  return {
    ...structuredClone(course),
    modules: course.modules
      .filter((m) => !m.archived)
      .map((m) => ({
        ...m,
        activities: m.activities
          .filter((a) => !a.archived)
          .map((a) => ({
            ...a,
            reference: a.reference ?? {
              kind: (
                {
                  theory: "lesson",
                  quiz: "quiz",
                  lab: "exercise",
                  workshop: "project",
                } as const
              )[a.type],
              id: a.id,
            },
            content: structuredClone(
              a.type === "theory"
                ? (state.theory?.drafts[a.id] ??
                    initialTheoryContent(a).content)
                : a.type === "quiz"
                  ? (state.quiz?.drafts[a.id] ?? initialQuizContent(a).content)
                  : a.type === "lab"
                    ? (state.lab?.drafts[a.id] ?? initialLabContent(a).content)
                    : (state.workshop?.drafts[a.id] ??
                      initialWorkshopContent(a).content),
            ),
          })),
      })),
  };
}
export function studentCourse(course: PublishedCourse): PublishedCourse {
  const copy = structuredClone(course);
  for (const topic of copy.modules)
    for (const activity of topic.activities) {
      if (activity.type === "quiz")
        for (const q of (activity.content as QuizContent).questions) {
          q.correctOptionId = null;
          q.explanation = "";
        }
      if (activity.type === "lab")
        (activity.content as LabContent).solution = "";
      if (activity.type === "workshop")
        (activity.content as WorkshopContent).feedbackGuidance = "";
    }
  return copy;
}
