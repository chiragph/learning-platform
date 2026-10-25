import { curriculumRepository } from "./curriculum-repository";
import { displayOrder, type ActivityLocation, type ActivityStatus, type CurriculumActivity, type CurriculumCourse, type CurriculumPath } from "./curriculum-types";
import type { Progress, Subject } from "./types";

export { displayOrder } from "./curriculum-types";
export type { ActivityType, ActivityStatus, CurriculumActivity, CurriculumCourse, CurriculumModule } from "./curriculum-types";
export const learningPath = curriculumRepository.getPath();
export const curriculumCourses = displayOrder(learningPath.courses);
export const curricula = Object.fromEntries(curriculumCourses.map((c) => [c.id, c])) as Record<Subject, CurriculumCourse>;

export function activityLocations(path: CurriculumPath = learningPath): ActivityLocation[] {
  return displayOrder(path.courses).flatMap((course) => displayOrder(course.modules).flatMap((module) => displayOrder(module.activities).map((activity) => ({ course, module, activity }))));
}
export function findCurriculumActivity(id: string, path: CurriculumPath = learningPath) { return activityLocations(path).find((entry) => entry.activity.id === id); }
export function activityForRoute(href: string, path: CurriculumPath = learningPath) { return activityLocations(path).find((entry) => entry.activity.href === href); }
export function courseItems(subject: Subject) { return displayOrder(curricula[subject].modules).flatMap((module) => displayOrder(module.activities)); }

export function activityComplete(activity: CurriculumActivity, progress: Progress): boolean {
  if (activity.availability !== "available") return false;
  const { kind, id } = activity.reference;
  switch (kind) {
    case "lesson": return progress.lessons.includes(id);
    case "quiz": return (progress.quizzes[id]?.best ?? 0) >= 70;
    case "exercise": return progress.challenges.includes(id);
    case "project": return progress.projects.includes(id);
  }
}
export function activityStatus(activity: CurriculumActivity, progress: Progress): ActivityStatus {
  if (activityComplete(activity, progress)) return "completed";
  const reference = activity.reference;
  const visited = (progress.visits ?? []).some((visit) => visit.activityId === activity.id && Number.isFinite(Date.parse(visit.at)));
  const legacyStarted = reference?.kind === "lesson" && (reference.id === progress.currentLesson || Boolean(progress.drafts[`lesson-${reference.id}`]))
    || reference?.kind === "quiz" && Boolean(progress.quizzes[reference.id]?.attempts || progress.quizSessions?.[reference.id])
    || reference?.kind === "exercise" && Boolean(progress.drafts[`challenge-${reference.id}`] || progress.labChecks?.[reference.id])
    || reference?.kind === "project" && Boolean(progress.drafts[`project-${reference.id}`] || progress.workshops?.[reference.id]);
  return visited || legacyStarted ? "in-progress" : "not-started";
}
export function completionStats(activities: readonly CurriculumActivity[], progress: Progress) {
  const unique = [...new Map(activities.map((a) => [a.id, a])).values()];
  const total = unique.length;
  const completed = unique.filter((a) => activityComplete(a, progress)).length;
  return { completed, total, percent: total ? Math.round(completed / total * 100) : 0, isComplete: total > 0 && completed === total };
}
export function curriculumStats(subject: Subject, progress: Progress) {
  const items = courseItems(subject);
  return { ...completionStats(items, progress), modules: curricula[subject].modules.length, lessons: items.filter((a) => a.type === "theory").length, exercises: items.filter((a) => a.type === "lab").length, projects: items.filter((a) => a.type === "workshop").length, minutes: items.reduce((sum, a) => sum + a.minutes, 0) };
}
export function mostRecentActivity(progress: Progress, path: CurriculumPath = learningPath): ActivityLocation | null {
  const recent = [...(progress.visits ?? [])].filter((visit) => Number.isFinite(Date.parse(visit.at))).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  for (const visit of recent) { const location = findCurriculumActivity(visit.activityId, path); if (location) return location; }
  // Old v1 records only captured opened theory lessons. Completion events are
  // deliberately not inferred to be visits and have no invented timestamps.
  return activityLocations(path).find((entry) => entry.activity.reference?.kind === "lesson" && entry.activity.reference.id === progress.currentLesson) ?? null;
}
export function nextCourseItem(subject: Subject, progress: Progress) {
  const recent = mostRecentActivity(progress, { ...learningPath, courses: [curricula[subject]] });
  if (recent) return recent.activity;
  return courseItems(subject).find((a) => a.availability === "available" && !activityComplete(a, progress)) ?? null;
}
export function learningSuggestion(progress: Progress) {
  const recent = mostRecentActivity(progress);
  if (recent) return { ...recent, reason: "resume" as const };
  const next = activityLocations().find(({ activity }) => activity.availability === "available" && !activityComplete(activity, progress));
  return next ? { ...next, reason: "path" as const } : null;
}
export function recordVisit(progress: Progress, activityId: string, at: string): Progress {
  const location = findCurriculumActivity(activityId);
  if (!location || !Number.isFinite(Date.parse(at))) return progress;
  const reference = location.activity.reference;
  return { ...progress, currentLesson: reference?.kind === "lesson" ? reference.id : progress.currentLesson, visits: [{ activityId, at }, ...(progress.visits ?? []).filter((visit) => visit.activityId !== activityId)] };
}
export function estimatedTime(minutes: number) { return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60 ? `${minutes % 60}m` : ""}`.trim() : `${minutes} min`; }
