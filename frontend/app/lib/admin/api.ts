import type { Account, ActivityQuery, Analytics, CourseDetail, CourseQuery, FilterOptions, InstructorDetail, Overview, Page, PlatformSettings, ReportQuery, User, UserDetail, UserQuery, Instructor, Course, AuditEvent } from "./types";
import { isAccount, isAnalytics, isCourse, isCourseDetail, isEvent, isFilterOptions, isInstructor, isInstructorDetail, isOverview, isPage, isPlatformSettings, isUser, isUserDetail } from "./contracts";

export type AdminErrorKind = "unauthorized" | "forbidden" | "unavailable" | "not-found" | "conflict" | "error";
export class AdminError extends Error {
  constructor(public kind: AdminErrorKind, message: string, public status = 0) { super(message); }
}
export function queryString(query: object) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== "") params.set(key, String(value));
  return params.size ? `?${params}` : "";
}
async function request<T>(path: string, check: (value: unknown) => value is T, signal: AbortSignal, body?: unknown, method = "PATCH", collection = false): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/admin/${path}`, {
      credentials: "same-origin", cache: "no-store", signal,
      method: body === undefined ? "GET" : method,
      ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    });
  } catch { throw new AdminError("error", "Unable to reach the server. Check your connection and try again."); }
  if (!response.ok) {
    const data: unknown = await response.json().catch(() => null);
    const missingRoute = !!data && typeof data === "object" && "message" in data && typeof data.message === "string" && /^Cannot (GET|PATCH|POST) /.test(data.message);
    if (response.status === 401) throw new AdminError("unauthorized", "Your session has expired. Sign in again.", 401);
    if (response.status === 403) throw new AdminError("forbidden", "The server has not authorized this admin operation.", 403);
    if (response.status === 501 || response.status === 404 && (collection || missingRoute)) throw new AdminError("unavailable", "This feature requires an admin API from the backend team. No records or changes are available yet.", response.status);
    if (response.status === 404) throw new AdminError("not-found", "This record could not be found. Refresh the list and try again.", 404);
    if (response.status === 409) throw new AdminError("conflict", "This record changed or the action is no longer allowed. Refresh and try again.", 409);
    throw new AdminError("error", response.status >= 500 ? "The admin service is temporarily unavailable. Try again." : "The server could not complete this request. Check your filters or input and try again.", response.status);
  }
  const data: unknown = await response.json().catch(() => null);
  if (!check(data)) throw new AdminError("error", "The server returned an incomplete or invalid admin response. Try again or contact the backend team.");
  return data;
}

// Proposed endpoints are intentionally real HTTP boundaries, never mock fallbacks.
export const adminApi = {
  overview: (q: ReportQuery, s: AbortSignal): Promise<Overview> => request(`overview${queryString(q)}`, isOverview, s, undefined, undefined, true),
  users: (q: UserQuery, s: AbortSignal): Promise<Page<User>> => request(`users${queryString(q)}`, isPage(isUser), s, undefined, undefined, true),
  user: (id: string, s: AbortSignal): Promise<UserDetail> => request(`users/${encodeURIComponent(id)}`, (v): v is UserDetail => isUserDetail(v) && v.id === id, s),
  setUserStatus: (id: string, status: "active" | "suspended", reason: string, s: AbortSignal): Promise<UserDetail> => request(`users/${encodeURIComponent(id)}/status`, isUserDetail, s, { status, reason }),
  instructors: (q: UserQuery, s: AbortSignal): Promise<Page<Instructor>> => request(`instructors${queryString(q)}`, isPage(isInstructor), s, undefined, undefined, true),
  instructor: (id: string, s: AbortSignal): Promise<InstructorDetail> => request(`instructors/${encodeURIComponent(id)}`, (v): v is InstructorDetail => isInstructorDetail(v) && v.id === id, s),
  courses: (q: CourseQuery, s: AbortSignal): Promise<Page<Course>> => request(`courses${queryString(q)}`, isPage(isCourse), s, undefined, undefined, true),
  course: (id: string, s: AbortSignal): Promise<CourseDetail> => request(`courses/${encodeURIComponent(id)}`, (v): v is CourseDetail => isCourseDetail(v) && v.id === id, s),
  setCourseArchive: (id: string, archived: boolean, reason: string, s: AbortSignal): Promise<CourseDetail> => request(`courses/${encodeURIComponent(id)}/archive`, isCourseDetail, s, { archived, reason }),
  analytics: (q: ReportQuery, s: AbortSignal): Promise<Analytics> => request(`analytics${queryString(q)}`, isAnalytics, s, undefined, undefined, true),
  activity: (q: ActivityQuery, s: AbortSignal): Promise<Page<AuditEvent>> => request(`activity${queryString(q)}`, isPage(isEvent), s, undefined, undefined, true),
  filterOptions: (s: AbortSignal): Promise<FilterOptions> => request("filter-options", isFilterOptions, s, undefined, undefined, true),
  settings: (s: AbortSignal): Promise<PlatformSettings> => request("settings", isPlatformSettings, s, undefined, undefined, true),
  account: (s: AbortSignal): Promise<Account> => request("account", isAccount, s, undefined, undefined, true),
  updateName: (name: string, s: AbortSignal): Promise<Account> => request("account", isAccount, s, { name }),
};
