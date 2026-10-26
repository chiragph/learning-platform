import type { ActivityType, ContentReference } from "../student/curriculum-types";

export type PublicationStatus = "draft" | "published";
export type Difficulty = "Beginner" | "Intermediate" | "Advanced";
export type CourseColor = "blue" | "orange" | "gold" | "green";
export type CourseIcon = "code" | "braces" | "book";
export type ContentTimestamps = { createdAt: string | null; updatedAt: string | null };
type RecordState = ContentTimestamps & { id: string; archived: boolean; hasBeenPublished?: boolean };
export type InstructorActivity = RecordState & {
  type: ActivityType; title: string; description: string; status: PublicationStatus;
  source: "seed" | "local"; reference?: ContentReference; minutes: number; publishedAt: string | null;
  // Copy provenance is read-only source information, never a live progress or
  // publication binding for this newly identified draft activity.
  copiedFrom?: { activityId: string; reference?: ContentReference };
};
// Optional metadata keeps existing version-1 browser snapshots compatible.
export type InstructorModule = RecordState & { title: string; description: string; activities: InstructorActivity[]; source?: "seed" | "local"; status?: PublicationStatus };
export type CourseFields = {
  title: string; description: string; category: string; difficulty: Difficulty;
  duration: string; objectives: string[]; color: CourseColor; icon: CourseIcon;
};
// The ID is the stable slug. Array position is the canonical display order.
export type InstructorCourse = RecordState & CourseFields & { status: PublicationStatus; source: "seed" | "local"; publishedAt: string | null; modules: InstructorModule[]; duplication?: { version: 1; courseId: string } };
export type ContentChange = { id: string; courseId: string; title: string; at: string; action?: InstructorCommand["type"]; content?: { kind: "course" | "module" | "activity"; id: string; title: string } };
export type InstructorState = { version: 1; courses: InstructorCourse[]; changes: ContentChange[] };
export type InstructorCommand =
  | { type: "course.create"; id: string; fields: CourseFields }
  | { type: "course.update"; courseId: string; fields: CourseFields }
  | { type: "course.duplicate"; courseId: string }
  | { type: "course.status"; courseId: string; status: PublicationStatus }
  | { type: "course.archive"; courseId: string; archived: boolean }
  | { type: "course.delete"; courseId: string }
  | { type: "module.create"; courseId: string; title: string; description: string }
  | { type: "module.update"; courseId: string; moduleId: string; title: string; description: string }
  | { type: "module.reorder"; courseId: string; moduleId: string; direction: -1 | 1 }
  | { type: "module.archive"; courseId: string; moduleId: string; archived: boolean }
  | { type: "module.delete"; courseId: string; moduleId: string }
  | { type: "activity.create"; courseId: string; moduleId: string; activityType: ActivityType; title: string; description: string }
  | { type: "activity.update"; courseId: string; moduleId: string; activityId: string; title: string; description: string }
  | { type: "activity.reorder"; courseId: string; moduleId: string; activityId: string; direction: -1 | 1 }
  | { type: "activity.move"; courseId: string; moduleId: string; activityId: string; targetModuleId: string }
  | { type: "activity.archive"; courseId: string; moduleId: string; activityId: string; archived: boolean }
  | { type: "activity.delete"; courseId: string; moduleId: string; activityId: string };

export type RepositorySnapshot = { state: InstructorState; ready: boolean; warning: string; writable: boolean };
export interface InstructorRepository {
  getSnapshot(): RepositorySnapshot;
  getServerSnapshot(): RepositorySnapshot;
  subscribe(listener: () => void): () => void;
  initialize(): void;
  execute(command: InstructorCommand): string;
}
