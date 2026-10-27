import type { PublishedCourse } from "./domain";
import type { QuizContent } from "../instructor/quiz-types";
import type { TheoryContent } from "../instructor/theory-types";
import type { LabContent } from "../instructor/lab-types";
import type { WorkshopContent } from "../instructor/workshop-types";
import type { Course, Subject, Question } from "../student/types";
import type {
  CurriculumCourse,
  CurriculumActivity,
} from "../student/curriculum-types";
import { practiceLessonIds } from "../student/lesson-practice";
import { courses, allLessons } from "../student/courses";
import { quizzes } from "../student/quizzes";
import { challenges } from "../student/challenges";
import { projects } from "../student/projects";
import {
  learningPath,
  curriculumCourses,
  curricula,
} from "../student/curriculum";
import { labs, type LabId } from "../student/labs";
export type CatalogCourse = PublishedCourse & { publicationId: string };
export const publishedActivities = new Map<
  string,
  {
    activityId: string;
    publicationId: string;
    title: string;
    courseId: string;
    courseTitle: string;
    instructions: string;
    type: string;
  }
>();
export const publicationIds: Record<string, string> = {};
export const authoredLabs = new Map<string, LabContent>();
export const theoryBlocks = new Map<string, TheoryContent>();
export function installCatalog(catalog: CatalogCourse[]) {
  courses.splice(0);
  allLessons.splice(0);
  challenges.splice(0);
  projects.splice(0);
  curriculumCourses.splice(0);
  for (const key of Object.keys(quizzes)) delete quizzes[key as Subject];
  for (const key of Object.keys(curricula)) delete curricula[key as Subject];
  for (const key of Object.keys(publicationIds)) delete publicationIds[key];
  publishedActivities.clear();
  authoredLabs.clear();
  theoryBlocks.clear();
  for (const entry of catalog) {
    publicationIds[entry.id] = entry.publicationId;
    const course: Course = {
      id: entry.id as Subject,
      title: entry.title,
      description: entry.description,
      lessons: [],
    };
    const curriculum: CurriculumCourse = {
      id: course.id,
      title: entry.title,
      description: entry.description,
      objectives: entry.objectives,
      order: courses.length + 1,
      modules: entry.modules.map((m, mi) => ({
        id: m.id,
        title: m.title,
        description: m.description,
        order: mi + 1,
        activities: m.activities.map((a, ai) => {
          const reference = a.reference!;
          const id = reference.id;
          publishedActivities.set(reference.kind + ":" + id, {
            activityId: a.id,
            publicationId: entry.publicationId,
            title: a.content.title,
            courseId: entry.id,
              courseTitle: entry.title,
              instructions: a.type === "quiz" ? (a.content as QuizContent).instructions : a.description,
            type: a.type,
          });
          if (a.type === "theory") {
            const content = a.content as TheoryContent;
            theoryBlocks.set(id, content);
            const code = content.blocks.find((b) => b.type === "code");
            const language: Subject =
              code?.type === "code" && code.language !== "plaintext"
                ? code.language
                : ["html", "css", "javascript"].includes(entry.id)
                  ? (entry.id as Subject)
                  : "html";
            course.lessons.push({
              id,
              title: content.title,
              language,
              explanation: content.blocks.flatMap((b) =>
                b.type === "paragraph" ||
                b.type === "heading" ||
                b.type === "callout"
                  ? [b.text]
                  : b.type === "list"
                    ? b.items
                    : [],
              ),
              code: code?.type === "code" ? code.code : "",
              practice: a.description,
            });
          } else if (a.type === "quiz") {
            quizzes[id as Subject] = (a.content as QuizContent).questions.map(
              (q) => ({
                id: q.id,
                topic: q.topic,
                prompt: q.prompt,
                options: q.options.map((o) => o.text) as Question["options"],
                correct: -1,
                explanation: "",
              }),
            );
          } else if (a.type === "lab") {
            const content = a.content as LabContent;
            authoredLabs.set(id, content);
            challenges.push({
              id,
              title: content.title,
              subject: ["html", "css", "javascript"].includes(entry.id)
                ? (entry.id as Subject)
                : "html",
              difficulty: "Beginner",
              instructions: content.instructions,
              expected: content.objective,
              hint: content.hints,
              starter: content.starter,
            });
            labs[id as LabId] = {
              id: id as LabId,
              objective: content.objective,
              widths: content.widths,
              requirements: content.checks.map((c) => ({
                id: c.id,
                title: c.description,
                help: content.hints,
              })),
            };
          } else {
            const content = a.content as WorkshopContent;
            projects.push({
              id,
              title: content.title,
              difficulty: "Beginner",
              overview: content.description,
                requirements: content.requirements, deliverables: content.deliverables, resources: content.resources, hints: content.hints, submissionInstructions: content.submission.instructions, evaluation: content.evaluation,
              objectives: content.objectives,
              steps: content.steps.map((s, i) => ({
                id: s.id,
                title: s.title,
                instruction: s.description,
                order: i + 1,
              })),
              starter: content.starter,
            });
          }
          return {
            id: reference.kind + ":" + id,
            title: a.content.title,
            description: a.description,
            type: a.type,
            minutes: a.minutes,
            order: ai + 1,
            availability: "available",
            reference,
            href:
              "/" +
              {
                lesson: "lessons",
                quiz: "quizzes",
                exercise: "challenges",
                project: "projects",
              }[reference.kind] +
              "/" +
              encodeURIComponent(id),
          } as CurriculumActivity;
        }),
      })),
    };
    courses.push(course);
    allLessons.push(...course.lessons);
    curriculumCourses.push(curriculum);
    curricula[course.id] = curriculum;
  }
  practiceLessonIds.splice(
    0,
    practiceLessonIds.length,
    ...allLessons.map((l) => l.id),
  );
  learningPath.courses = curriculumCourses;
}
