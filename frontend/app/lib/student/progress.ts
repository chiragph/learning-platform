import { allLessons, courses } from "./courses";
import { challenges } from "./challenges";
import { projects } from "./projects";
import { templates } from "./templates";
import { practiceLessonIds } from "./lesson-practice";
import type { Code, Progress, Subject } from "./types";

export function emptyProgress(): Progress { return { version: 1, lessons: [], quizzes: {}, challenges: [], projects: [], currentLesson: null, activity: [], drafts: {} }; }
export function progressKey(studentId: string) { return `decode-learning-v1-${studentId}`; }
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
export function isCode(value: unknown): value is Code { return isRecord(value) && ["html", "css", "javascript"].every((key) => typeof value[key] === "string" && value[key].length <= 100000); }
export function normalizeProgress(value: unknown): Progress {
  const fresh = emptyProgress();
  if (!isRecord(value) || value.version !== 1) return fresh;
  const strings = (v: unknown): string[] => Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string"))] : [];
  fresh.lessons = strings(value.lessons).filter((id) => allLessons.some((lesson) => lesson.id === id));
  fresh.challenges = strings(value.challenges).filter((id) => challenges.some((c) => c.id === id));
  fresh.projects = strings(value.projects).filter((id) => projects.some((p) => p.id === id));
  fresh.currentLesson = typeof value.currentLesson === "string" && allLessons.some((l) => l.id === value.currentLesson) ? value.currentLesson : null;
  if (isRecord(value.quizzes)) for (const [id, result] of Object.entries(value.quizzes)) {
    if (!courses.some((c) => c.id === id)) continue;
    if (isRecord(result) && typeof result.latest === "number" && typeof result.best === "number" && typeof result.attempts === "number" && typeof result.at === "string" && result.latest >= 0 && result.latest <= 100 && result.best >= result.latest && result.best <= 100 && Number.isInteger(result.attempts) && result.attempts > 0) fresh.quizzes[id] = { latest: result.latest, best: result.best, attempts: result.attempts, at: result.at };
  }
  const draftIds = [...projects.map((p) => `project-${p.id}`), ...challenges.map((c) => `challenge-${c.id}`), ...templates.map((t) => `playground-${t.id}`), ...practiceLessonIds.map((id) => `lesson-${id}`)];
  if (isRecord(value.drafts)) for (const [id, code] of Object.entries(value.drafts)) { if (draftIds.includes(id) && isCode(code)) fresh.drafts[id] = { html: code.html, css: code.css, javascript: code.javascript }; }
  if (Array.isArray(value.activity)) fresh.activity = value.activity.filter((item) => isRecord(item) && typeof item.id === "string" && typeof item.title === "string" && typeof item.at === "string" && typeof item.href === "string" && /^\/(lessons|quizzes|challenges|projects)\/[a-z0-9-]+$/.test(item.href)).slice(0, 20) as Progress["activity"];
  return fresh;
}
export function recordActivity(progress: Progress, title: string, href: string, at: string): Progress {
  return { ...progress, activity: [{ id: `${at}-${title}`, title, href, at }, ...progress.activity].slice(0, 20) };
}
export function completeLesson(progress: Progress, id: string, at: string): Progress {
  if (!allLessons.some((lesson) => lesson.id === id)) return progress;
  if (progress.lessons.includes(id)) return { ...progress, currentLesson: id };
  return recordActivity({ ...progress, lessons: [...progress.lessons, id], currentLesson: id }, `Completed ${allLessons.find((l) => l.id === id)!.title}`, `/lessons/${id}`, at);
}
export function saveQuiz(progress: Progress, subject: Subject, score: number, at: string): Progress {
  const safe = Math.max(0, Math.min(100, Math.round(score)));
  const previous = progress.quizzes[subject];
  return recordActivity({ ...progress, quizzes: { ...progress.quizzes, [subject]: { latest: safe, best: Math.max(previous?.best ?? 0, safe), attempts: (previous?.attempts ?? 0) + 1, at } } }, `${subject.toUpperCase()} quiz: ${safe}%`, `/quizzes/${subject}`, at);
}
// Course units: each lesson + one passed quiz (best >= 70%) + each course challenge.
// Cross-course projects are tracked separately and do not inflate course completion.
export function courseProgress(progress: Progress, subject: Subject, challengeIds: string[]) {
  const lessons = courses.find((c) => c.id === subject)!.lessons;
  const completed = lessons.filter((l) => progress.lessons.includes(l.id)).length + (progress.quizzes[subject]?.best >= 70 ? 1 : 0) + challengeIds.filter((id) => progress.challenges.includes(id)).length;
  const total = lessons.length + 1 + challengeIds.length;
  return { completed, total, percent: Math.round(completed / total * 100) };
}
export function recommendedLesson(progress: Progress) { return allLessons.find((l) => !progress.lessons.includes(l.id)) ?? null; }
export function completePractice(progress: Progress, kind: "challenges" | "projects", id: string, at: string): Progress {
  const item = kind === "challenges" ? challenges.find((c) => c.id === id) : projects.find((p) => p.id === id);
  if (!item || progress[kind].includes(id)) return progress;
  const label = kind === "challenges" && "check" in item && item.check ? "Basic checks passed" : "Self-reviewed";
  return recordActivity({ ...progress, [kind]: [...progress[kind], id] }, `${label}: ${item.title}`, `/${kind}/${id}`, at);
}
