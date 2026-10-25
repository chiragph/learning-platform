import { courses } from "./courses";
import { challenges } from "./challenges";
import { projects } from "./projects";
import type { ActivityType, ContentReference, CurriculumActivity, CurriculumModule, CurriculumPath, CurriculumRepository } from "./curriculum-types";
import type { Subject } from "./types";

// Namespaced IDs match the previous curriculum's itemKey. Content reference IDs,
// existing routes, quiz records and draft keys remain unchanged.
export function legacyActivityId(reference: ContentReference) { return `${reference.kind}:${reference.id}`; }
const activityTypes: Record<ContentReference["kind"], ActivityType> = { lesson: "theory", quiz: "quiz", exercise: "lab", project: "workshop" };

function activity(kind: ContentReference["kind"], id: string, order: number, minutes: number): CurriculumActivity {
  const reference = { kind, id };
  const lesson = kind === "lesson" ? courses.flatMap((c) => c.lessons).find((l) => l.id === id) : undefined;
  const challenge = kind === "exercise" ? challenges.find((c) => c.id === id) : undefined;
  const project = kind === "project" ? projects.find((p) => p.id === id) : undefined;
  const course = kind === "quiz" ? courses.find((c) => c.id === id) : undefined;
  const title = lesson?.title ?? challenge?.title ?? project?.title ?? (course && `${course.id === "javascript" ? "JavaScript" : course.id.toUpperCase()} knowledge check`);
  if (!title) throw new Error(`Missing seeded curriculum reference: ${legacyActivityId(reference)}`);
  const route = { lesson: "lessons", quiz: "quizzes", exercise: "challenges", project: "projects" }[kind];
  return { id: legacyActivityId(reference), reference, type: activityTypes[kind], title, description: lesson?.practice ?? challenge?.instructions ?? project?.overview ?? "Check your understanding. A best score of 70% completes this quiz.", order, minutes, availability: "available", href: `/${route}/${id}` };
}
type SeedItem = [ContentReference["kind"], string, number?];
function module(id: string, title: string, description: string, order: number, entries: SeedItem[]): CurriculumModule {
  return { id, title, description, order, activities: entries.map(([kind, referenceId, minutes], index) => activity(kind, referenceId, index + 1, minutes ?? ({ lesson: 6, quiz: 10, exercise: 15, project: 45 }[kind]))) };
}
const modules: Record<Subject, CurriculumModule[]> = {
  html: [
    module("html-first-page", "Your first web page", "Elements, documents, and readable content.", 1, [["lesson", "html-introduction"], ["lesson", "html-document"], ["lesson", "html-text"], ["exercise", "html-heading"]]),
    module("html-content", "Connect and organize content", "Links, media, lists, and tables.", 2, [["lesson", "html-links-images"], ["lesson", "html-lists"], ["lesson", "html-tables"]]),
    module("html-meaning", "Build with meaning", "Accessible forms and semantic page layouts.", 3, [["lesson", "html-forms"], ["lesson", "html-semantic"], ["exercise", "html-link"], ["quiz", "html"], ["project", "portfolio"]]),
  ],
  css: [
    module("css-foundations", "The language of style", "Selectors, color, and typography.", 1, [["lesson", "css-introduction"], ["lesson", "css-selectors"], ["lesson", "css-colors-type"]]),
    module("css-layout", "Think in layouts", "Space, Flexbox, and Grid.", 2, [["lesson", "css-box-model"], ["lesson", "css-flexbox"], ["lesson", "css-grid"], ["exercise", "css-card"], ["exercise", "css-grid"]]),
    module("css-responsive", "Design for every screen", "Positioning and responsive interfaces.", 3, [["lesson", "css-positioning"], ["lesson", "css-responsive"], ["quiz", "css"], ["project", "landing-page", 60]]),
  ],
  javascript: [
    module("js-language", "Learn the language", "Values, expressions, and decisions.", 1, [["lesson", "javascript-introduction"], ["lesson", "javascript-variables"], ["lesson", "javascript-operators"], ["lesson", "javascript-conditions"]]),
    module("js-data", "Work with data", "Loops, functions, and collections.", 2, [["lesson", "javascript-loops"], ["lesson", "javascript-functions"], ["lesson", "javascript-collections"]]),
    module("js-interactions", "Make it interactive", "DOM updates, events, and practical projects.", 3, [["lesson", "javascript-dom"], ["lesson", "javascript-events"], ["exercise", "javascript-button"], ["exercise", "javascript-list"], ["quiz", "javascript"], ["project", "calculator"], ["project", "todo-list", 60]]),
  ],
};
const objectives: Record<Subject, string[]> = {
  html: ["Build a well-structured HTML document", "Organize text, links, images, and data", "Create labeled forms and semantic page layouts"],
  css: ["Apply selectors, color, and readable typography", "Build layouts with the box model, Flexbox, and Grid", "Adapt pages to different screens"],
  javascript: ["Work with values, conditions, loops, and functions", "Model collections using arrays and objects", "Update the DOM and respond to events"],
};
const path: CurriculumPath = { id: "web-development", title: "Web Development", courses: courses.map((course, index) => ({ id: course.id, title: course.id === "javascript" ? "JavaScript" : course.id.toUpperCase(), description: course.description, order: index + 1, modules: modules[course.id], objectives: objectives[course.id] })) };

// Replace this adapter with published content later. Student views consume the
// typed path independently of any instructor implementation or content store.
export const curriculumRepository: CurriculumRepository = { getPath: () => path };
