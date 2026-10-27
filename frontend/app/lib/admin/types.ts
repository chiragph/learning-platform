import type { AuthUser } from "../../components/auth/auth-client";

export type Role = AuthUser["role"];
export type AccountStatus = "active" | "suspended" | "unknown";
export type CourseStatus = "draft" | "published" | "archived";
export type Period = "7d" | "30d" | "90d" | "all";
export type Metric = number | null;
export type Page<T> = { items: T[]; page: number; pageSize: number; total: number };
export type Person = { id: string; name: string; email: string };
export type User = Person & { role: Role; status: AccountStatus; createdAt: string | null };
export type UserDetail = User & {
  participation: { courses: Metric; completedCourses: Metric; completedActivities: Metric; completionRate: Metric };
  capabilities: { changeStatus: boolean };
};
export type Instructor = User & { publishedCourses: Metric; draftCourses: Metric; activeStudents: Metric };
export type InstructorDetail = Instructor & {
  courses: Course[];
  recentPublications: { courseId: string; title: string; publishedAt: string }[];
};
export type Course = {
  id: string; title: string; description: string; instructor: Person | null;
  moduleCount: Metric; activityCount: Metric; status: CourseStatus;
  updatedAt: string | null; publishedAt: string | null;
};
export type CourseDetail = Course & {
  modules: { id: string; title: string; activities: { id: string; title: string; type: "theory" | "quiz" | "lab" | "workshop" }[] }[];
  participation: { learners: Metric; completed: Metric; completionRate: Metric };
  capabilities: { archive: boolean; restore: boolean };
};
export const eventTypes = ["user.registered", "course.published", "course.archived", "course.restored", "account.suspended", "account.reactivated", "settings.changed"] as const;
export type EventType = typeof eventTypes[number];
export type AuditEvent = {
  id: string; type: EventType; actor: Person | null;
  target: { id: string; label: string; kind: string } | null;
  description: string; createdAt: string;
};
export type SeriesPoint = { date: string; value: number };
export type Overview = {
  generatedAt: string;
  metrics: { students: Metric; instructors: Metric; courses: Metric; publishedCourses: Metric; activeLearners: Metric; completionRate: Metric };
  registrations: SeriesPoint[] | null; learningActivity: SeriesPoint[] | null;
  courseDistribution: { status: CourseStatus; count: number }[] | null;
  recentActivity: AuditEvent[] | null;
};
export type Analytics = {
  generatedAt: string;
  users: { byRole: { role: Role; count: number }[] | null; active: Metric; registrations: SeriesPoint[] | null };
  learning: { participants: Metric; lessonsCompleted: Metric; courseCompletionRate: Metric; averageQuizScore: Metric; labsCompleted: Metric; activity: SeriesPoint[] | null };
  workshops: { total: Metric; pending: Metric; approved: Metric; changesRequested: Metric };
};
export type FilterOption = { id: string; label: string };
export type FilterOptions = { courses: FilterOption[]; instructors: FilterOption[] };
export type PlatformSettings = { uploadLimitBytes: Metric; accountPolicy: string | null };
export type Account = { user: User; capabilities: { editName: boolean } };
export type UserQuery = { search?: string; role?: Role; status?: AccountStatus; sort?: "name:asc" | "name:desc" | "createdAt:asc" | "createdAt:desc"; page: number; pageSize: number };
export type CourseQuery = { search?: string; instructorId?: string; status?: CourseStatus; page: number; pageSize: number };
export type ReportQuery = { period: Period; courseId?: string; instructorId?: string };
export type ActivityQuery = { search?: string; type?: EventType; from?: string; to?: string; page: number; pageSize: number };
