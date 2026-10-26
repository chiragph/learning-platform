import type { InstructorCourse } from "./types";

export type CourseSort = "catalog" | "newest-created" | "oldest-created" | "recently-updated";

export function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
}

// No fixed timezone: the browser formats using the instructor's local zone.
// The explicit zone parameter makes timezone conversion independently testable.
export function formatInstructorTimestamp(value?: string | null, timeZone?: string): string | null {
  if (!isIsoTimestamp(value)) return null;
  const parts = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true, ...(timeZone ? { timeZone } : {}) }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value ?? "";
  return `${part("day")} ${part("month")} ${part("year")}, ${Number(part("hour"))}:${part("minute")} ${part("dayPeriod").toUpperCase()}`;
}

// Unknown dates always come last, including ascending order. Stable ties retain
// catalog order; sorting never changes the persisted course/curriculum order.
export function sortInstructorCourses(courses: readonly InstructorCourse[], sort: CourseSort): InstructorCourse[] {
  if (sort === "catalog") return [...courses];
  const key = sort === "recently-updated" ? "updatedAt" : "createdAt";
  return courses.map((course, index) => ({ course, index })).sort((a, b) => {
    const first = isIsoTimestamp(a.course[key]) ? Date.parse(a.course[key]!) : null;
    const second = isIsoTimestamp(b.course[key]) ? Date.parse(b.course[key]!) : null;
    if (first === null || second === null) return first === second ? a.index - b.index : first === null ? 1 : -1;
    return (sort === "oldest-created" ? first - second : second - first) || a.index - b.index;
  }).map(entry => entry.course);
}
