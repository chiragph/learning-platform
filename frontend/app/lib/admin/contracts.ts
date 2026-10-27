// Runtime validation keeps incomplete backend integrations out of management UI.
// Null metrics mean unavailable; an empty array means a successful empty result.
import type { Account, Analytics, AuditEvent, Course, CourseDetail, FilterOptions, Instructor, InstructorDetail, Overview, Page, PlatformSettings, User, UserDetail } from "./types";
import { eventTypes } from "./types";

type Check<T> = (value: unknown) => value is T;
type Shape = Record<string, (value: unknown) => boolean>;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const shape = (fields: Shape) => (value: unknown) => object(value) && Object.entries(fields).every(([key, check]) => check(value[key]));
const str = (v: unknown) => typeof v === "string";
const id = (v: unknown) => str(v) && (v as string).length > 0;
const bool = (v: unknown) => typeof v === "boolean";
const count = (v: unknown) => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const positive = (v: unknown) => count(v) && (v as number) > 0;
const date = (v: unknown) => typeof v === "string" && Number.isFinite(Date.parse(v));
const nullable = (check: (v: unknown) => boolean) => (v: unknown) => v === null || check(v);
const array = (check: (v: unknown) => boolean) => (v: unknown) => Array.isArray(v) && v.every(check);
const oneOf = (values: readonly string[]) => (v: unknown) => typeof v === "string" && values.includes(v);
const metric = nullable(count);
const percent = nullable((v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100);
const role = oneOf(["ADMIN", "INSTRUCTOR", "STUDENT"]);
const status = oneOf(["active", "suspended", "unknown"]);
const courseStatus = oneOf(["draft", "published", "archived"]);
const personFields = { id, name: id, email: id };
const person = shape(personFields);
const userFields = { ...personFields, role, status, createdAt: nullable(date) };
const courseFields = { id, title: id, description: str, instructor: nullable(person), moduleCount: metric, activityCount: metric, status: courseStatus, updatedAt: nullable(date), publishedAt: nullable(date) };
const series = nullable(array(shape({ date, value: count })));
const event = shape({ id, type: oneOf(eventTypes), actor: nullable(person), target: nullable(shape({ id, label: str, kind: id })), description: str, createdAt: date });
const instructorFields = { ...userFields, role: oneOf(["INSTRUCTOR"]), publishedCourses: metric, draftCourses: metric, activeStudents: metric };

export const isUser = shape(userFields) as Check<User>;
export const isUserDetail = shape({ ...userFields, participation: shape({ courses: metric, completedCourses: metric, completedActivities: metric, completionRate: percent }), capabilities: shape({ changeStatus: bool }) }) as Check<UserDetail>;
export const isInstructor = shape(instructorFields) as Check<Instructor>;
export const isCourse = shape(courseFields) as Check<Course>;
export const isInstructorDetail = shape({ ...instructorFields, courses: array(isCourse), recentPublications: array(shape({ courseId: id, title: id, publishedAt: date })) }) as Check<InstructorDetail>;
export const isCourseDetail = shape({ ...courseFields, modules: array(shape({ id, title: id, activities: array(shape({ id, title: id, type: oneOf(["theory", "quiz", "lab", "workshop"]) })) })), participation: shape({ learners: metric, completed: metric, completionRate: percent }), capabilities: shape({ archive: bool, restore: bool }) }) as Check<CourseDetail>;
export const isEvent = event as Check<AuditEvent>;
export function isPage<T>(check: Check<T>): Check<Page<T>> {
  return ((v: unknown) => shape({ items: array(check), page: positive, pageSize: positive, total: count })(v) && object(v) && (v.items as unknown[]).length <= (v.pageSize as number) && (v.items as unknown[]).length <= (v.total as number)) as Check<Page<T>>;
}
export const isOverview = shape({ generatedAt: date, metrics: shape({ students: metric, instructors: metric, courses: metric, publishedCourses: metric, activeLearners: metric, completionRate: percent }), registrations: series, learningActivity: series, courseDistribution: nullable(array(shape({ status: courseStatus, count }))), recentActivity: nullable(array(event)) }) as Check<Overview>;
export const isAnalytics = shape({ generatedAt: date, users: shape({ byRole: nullable(array(shape({ role, count }))), active: metric, registrations: series }), learning: shape({ participants: metric, lessonsCompleted: metric, courseCompletionRate: percent, averageQuizScore: percent, labsCompleted: metric, activity: series }), workshops: shape({ total: metric, pending: metric, approved: metric, changesRequested: metric }) }) as Check<Analytics>;
export const isFilterOptions = shape({ courses: array(shape({ id, label: id })), instructors: array(shape({ id, label: id })) }) as Check<FilterOptions>;
export const isPlatformSettings = shape({ uploadLimitBytes: metric, accountPolicy: nullable(str) }) as Check<PlatformSettings>;
export const isAccount = shape({ user: isUser, capabilities: shape({ editName: bool }) }) as Check<Account>;
