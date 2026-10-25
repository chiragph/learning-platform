import type { Subject } from "./types";

export type ActivityType = "theory" | "quiz" | "lab" | "workshop";
export type ActivityStatus = "not-started" | "in-progress" | "completed";
export type ContentReference = { kind: "lesson" | "quiz" | "exercise" | "project"; id: string };

// Content has no student state. A future repository can return these same records.
export type CurriculumActivity = {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  order: number;
  minutes: number;
} & (
  | { availability: "available"; href: string; reference: ContentReference }
  | { availability: "upcoming"; href: string; reference?: never }
);
export type CurriculumModule = { id: string; title: string; description: string; order: number; activities: readonly CurriculumActivity[] };
export type CurriculumCourse = { id: Subject; title: string; description: string; order: number; objectives: readonly string[]; modules: readonly CurriculumModule[] };
export type CurriculumPath = { id: string; title: string; courses: readonly CurriculumCourse[] };
export type CurriculumRepository = { getPath(): CurriculumPath };
export type ActivityVisit = { activityId: string; at: string };
export type ActivityLocation = { course: CurriculumCourse; module: CurriculumModule; activity: CurriculumActivity };

export function displayOrder<T extends { id: string; order: number }>(entries: readonly T[]): T[] {
  return [...entries].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}
