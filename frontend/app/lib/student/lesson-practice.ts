import { allLessons } from "./courses";
import type { Code, Lesson } from "./types";

export const practiceLessonIds = allLessons.map((lesson) => lesson.id);
// New workspaces start empty. CodeWorkspace always gives an existing draft priority.
export function lessonStarter(lesson: Lesson): Code {
  if (!practiceLessonIds.includes(lesson.id)) throw new Error("Unknown lesson workspace.");
  return { html: "<!-- Write your HTML code here -->", css: "/* Write your CSS code here */", javascript: "// Write your JavaScript code here" };
}
