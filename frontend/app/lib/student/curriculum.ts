import { courses, findCourse } from "./courses";
import { challenges, challengeIds } from "./challenges";
import { projects } from "./projects";
import { quizzes } from "./quizzes";
import { courseProgress } from "./progress";
import type { Progress, Subject } from "./types";

// A presentation layer over the existing stable content IDs. Content editing,
// publishing and repository migration remain outside the Stage 1–2 review.
export type LearningItem = { id: string; kind: "lesson" | "quiz" | "exercise" | "project"; minutes: number };
export type LearningModule = { id: string; title: string; description: string; items: LearningItem[] };
export type Curriculum = { subject: Subject; headline: string; objectives: string[]; modules: LearningModule[] };
const lesson = (id: string): LearningItem => ({ id, kind: "lesson", minutes: 6 });
const exercise = (id: string): LearningItem => ({ id, kind: "exercise", minutes: 15 });
const quiz = (id: Subject): LearningItem => ({ id, kind: "quiz", minutes: 10 });
const project = (id: string, minutes = 45): LearningItem => ({ id, kind: "project", minutes });

export const curricula: Record<Subject, Curriculum> = {
  html: {
    subject: "html", headline: "Give your ideas a structure.",
    objectives: ["Build a well-structured HTML document", "Organize text, links, images, and data", "Create labeled forms and semantic page layouts"],
    modules: [
      { id: "html-first-page", title: "Your first web page", description: "Get comfortable with elements, documents, and readable content.", items: [lesson("html-introduction"), lesson("html-document"), lesson("html-text"), exercise("html-heading")] },
      { id: "html-content", title: "Connect and organize content", description: "Make information useful with links, media, lists, and tables.", items: [lesson("html-links-images"), lesson("html-lists"), lesson("html-tables")] },
      { id: "html-meaning", title: "Build with meaning", description: "Create accessible structures, check your understanding, and apply it.", items: [lesson("html-forms"), lesson("html-semantic"), exercise("html-link"), quiz("html"), project("portfolio")] },
    ],
  },
  css: {
    subject: "css", headline: "Make the web feel considered.",
    objectives: ["Apply selectors, color, and readable typography", "Build flexible layouts with the box model, Flexbox, and Grid", "Adapt pages to different screens and user preferences"],
    modules: [
      { id: "css-foundations", title: "The language of style", description: "Connect your stylesheet and build a clear visual foundation.", items: [lesson("css-introduction"), lesson("css-selectors"), lesson("css-colors-type")] },
      { id: "css-layout", title: "Think in layouts", description: "Understand space and arrange content with flexible tools.", items: [lesson("css-box-model"), lesson("css-flexbox"), lesson("css-grid"), exercise("css-card"), exercise("css-grid")] },
      { id: "css-responsive", title: "Design for every screen", description: "Position with purpose and bring everything together responsively.", items: [lesson("css-positioning"), lesson("css-responsive"), quiz("css"), project("landing-page", 60)] },
    ],
  },
  javascript: {
    subject: "javascript", headline: "Bring your pages to life.",
    objectives: ["Work with values, conditions, loops, and functions", "Model collections using arrays and objects", "Update the DOM and respond to user interactions"],
    modules: [
      { id: "js-language", title: "Learn the language", description: "Build your first programs with values, expressions, and decisions.", items: [lesson("javascript-introduction"), lesson("javascript-variables"), lesson("javascript-operators"), lesson("javascript-conditions")] },
      { id: "js-data", title: "Work with data", description: "Repeat tasks, write reusable functions, and organize information.", items: [lesson("javascript-loops"), lesson("javascript-functions"), lesson("javascript-collections")] },
      { id: "js-interactions", title: "Make it interactive", description: "Connect your programs to the page, then build something useful.", items: [lesson("javascript-dom"), lesson("javascript-events"), exercise("javascript-button"), exercise("javascript-list"), quiz("javascript"), project("calculator"), project("todo-list", 60)] },
    ],
  },
};

export function itemKey(item: LearningItem) { return `${item.kind}:${item.id}`; }
export function itemDetails(item: LearningItem) {
  if (item.kind === "lesson") {
    const entry = courses.flatMap((c) => c.lessons).find((l) => l.id === item.id);
    return entry ? { title: entry.title, href: `/lessons/${entry.id}`, label: "Theory lesson" } : null;
  }
  if (item.kind === "quiz") {
    const course = findCourse(item.id);
    return course ? { title: `${course.id === "javascript" ? "JavaScript" : course.id.toUpperCase()} knowledge check`, href: `/quizzes/${course.id}`, label: `Quiz · ${quizzes[course.id].length} questions` } : null;
  }
  if (item.kind === "exercise") {
    const entry = challenges.find((c) => c.id === item.id);
    return entry ? { title: entry.title, href: `/challenges/${entry.id}`, label: entry.check ? "Exercise · basic checks" : "Exercise · self-review" } : null;
  }
  const entry = projects.find((p) => p.id === item.id);
  return entry ? { title: entry.title, href: `/projects/${entry.id}`, label: "Guided project · optional" } : null;
}
export function itemComplete(item: LearningItem, progress: Progress) {
  switch (item.kind) {
    case "lesson": return progress.lessons.includes(item.id);
    case "quiz": return (progress.quizzes[item.id]?.best ?? 0) >= 70;
    case "exercise": return progress.challenges.includes(item.id);
    case "project": return progress.projects.includes(item.id);
  }
}
export function courseItems(subject: Subject) { return curricula[subject].modules.flatMap((m) => m.items); }
export function nextCourseItem(subject: Subject, progress: Progress) {
  const items = courseItems(subject);
  const current = items.find((i) => i.kind === "lesson" && i.id === progress.currentLesson && !itemComplete(i, progress));
  return current ?? items.find((i) => i.kind !== "project" && !itemComplete(i, progress)) ?? null;
}
export function learningSuggestion(progress: Progress) {
  const current = courses.find((c) => c.lessons.some((l) => l.id === progress.currentLesson));
  const next = current && nextCourseItem(current.id, progress);
  if (current && next) return { subject: current.id, item: next, reason: next.id === progress.currentLesson ? "resume" as const : "course" as const };
  // First unfinished course unit in the suggested path, without locking access.
  for (const course of courses) {
    const item = nextCourseItem(course.id, progress);
    if (item) return { subject: course.id, item, reason: "path" as const };
  }
  return null;
}
export function curriculumStats(subject: Subject, progress: Progress) {
  const items = courseItems(subject);
  return { ...courseProgress(progress, subject, challengeIds(subject)), modules: curricula[subject].modules.length, lessons: items.filter((i) => i.kind === "lesson").length, exercises: items.filter((i) => i.kind === "exercise").length, projects: items.filter((i) => i.kind === "project").length, minutes: items.filter((i) => i.kind !== "project").reduce((total, i) => total + i.minutes, 0) };
}
export function estimatedTime(minutes: number) { return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60 ? `${minutes % 60}m` : ""}`.trim() : `${minutes} min`; }
