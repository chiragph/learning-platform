import { curriculumRepository } from "../student/curriculum-repository";
import { isIsoTimestamp } from "./dates";
import type { CourseFields, InstructorActivity, InstructorCommand, InstructorCourse, InstructorModule, InstructorRepository, InstructorState, RepositorySnapshot } from "./types";

export const instructorStorageKey = "decode-instructor-preview-v1";
export const instructorRecoveryKey = "decode-instructor-preview-recovery";
export function seedInstructorState(): InstructorState {
  return { version: 1, changes: [], courses: curriculumRepository.getPath().courses.map(course => ({
    id: course.id, title: course.title, description: course.description, objectives: [...course.objectives],
    category: "Web development", difficulty: "Beginner", duration: `${course.modules.flatMap(m => m.activities).reduce((sum, a) => sum + a.minutes, 0)} min`, icon: course.id === "css" ? "braces" : "code",
    color: course.id === "html" ? "orange" : course.id === "javascript" ? "gold" : "blue",
    status: "published", source: "seed", archived: false, hasBeenPublished: true, createdAt: null, updatedAt: null, publishedAt: null,
    modules: [...course.modules].sort((a,b) => a.order - b.order).map(module => ({
      id: module.id, title: module.title, description: module.description, archived: false, source: "seed", status: "published", hasBeenPublished: true, createdAt: null, updatedAt: null,
      activities: [...module.activities].sort((a,b) => a.order - b.order).map(activity => ({
        id: activity.id, title: activity.title, description: activity.description, type: activity.type,
        minutes: activity.minutes, reference: activity.reference ? { ...activity.reference } : undefined,
        status: activity.availability === "available" ? "published" : "draft", source: "seed", archived: false, hasBeenPublished: activity.availability === "available", createdAt: null, updatedAt: null, publishedAt: null,
      })),
    })),
  })) };
}
export function courseCounts(course: InstructorCourse) {
  const modules = course.modules.filter(m => !m.archived);
  return { modules: modules.length, activities: modules.flatMap(m => m.activities).filter(a => !a.archived).length };
}
export function publicationIssue(course: InstructorCourse): string | null {
  if (course.archived) return "Restore this course before publishing.";
  const modules = course.modules.filter(m => !m.archived);
  if (!modules.length || modules.some(m => !m.activities.some(a => !a.archived))) return "Add curriculum to every active module before publishing.";
  if (modules.some(m => m.activities.some(a => !a.archived && (a.status === "draft" || !a.reference)))) return "Draft activities need detailed content editors in Stage 5B before publication.";
  return null;
}
const seededCourses = curriculumRepository.getPath().courses;
const seededCourseIds = new Set<string>(seededCourses.map(c => c.id));
const seededModuleIds = new Set(seededCourses.flatMap(c => c.modules.map(m => m.id)));
const seededActivityIds = new Set(seededCourses.flatMap(c => c.modules.flatMap(m => m.activities.map(a => a.id))));
function activityProtection(activity: InstructorActivity): string | null {
  if (seededActivityIds.has(activity.id) || activity.source !== "local") return "Original seeded activities are protected. Use Archive instead.";
  if (activity.status !== "draft" || activity.hasBeenPublished || activity.publishedAt) return "Published or previously published activities are protected. Use Archive instead.";
  if (activity.reference) return "This activity references existing content with potential student progress dependencies. Use Archive instead.";
  return null;
}
function moduleProtection(topic: InstructorModule): string | null {
  if (seededModuleIds.has(topic.id) || topic.source === "seed") return "Original seeded modules are protected. Use Archive instead.";
  if (topic.status === "published" || topic.hasBeenPublished) return "Published or previously published modules are protected. Use Archive instead.";
  if (topic.activities.some(a => activityProtection(a))) return "This module contains protected activities or potential student progress dependencies, including archived content. Use Archive instead.";
  return null;
}
// These guards are shared by the UI and commands. Archived descendants count:
// hiding content or returning it to Draft never removes dependency protection.
export function courseDeletionIssue(course: InstructorCourse): string | null {
  if (seededCourseIds.has(course.id) || course.source !== "local") return "Original seeded courses are protected. Use Archive instead.";
  if (course.status !== "draft" || course.hasBeenPublished || course.publishedAt) return "Published or previously published courses are protected. Use Archive instead.";
  if (course.modules.some(m => moduleProtection(m))) return "This course contains protected curriculum or potential student progress dependencies, including archived content. Use Archive instead.";
  return null;
}
// Older copies and genuine published local records can look identical. Never
// infer "never published" from a title or a bounded/missing change history.
// Recovery creates a new copy; it does not rewrite or unlock the old record.
export function needsDraftCopyRecovery(course: InstructorCourse): boolean {
  return course.source === "local" && !course.duplication && !!courseDeletionIssue(course);
}
export function moduleDeletionIssue(course: InstructorCourse, topic: InstructorModule): string | null {
  if (course.status === "published") return "Curriculum in a published course is protected. Use Archive instead.";
  return moduleProtection(topic);
}
export function activityDeletionIssue(course: InstructorCourse, topic: InstructorModule, activity: InstructorActivity): string | null {
  if (course.status === "published" || topic.status === "published") return "Activities in published curriculum are protected. Use Archive instead.";
  return activityProtection(activity);
}
function required(value: string, label: string, max = 200) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw new Error(`${label} is required and must be at most ${max} characters.`);
  return value.trim();
}
function fields(input: CourseFields): CourseFields {
  if (!["Beginner", "Intermediate", "Advanced"].includes(input.difficulty) || !["blue", "orange", "gold", "green"].includes(input.color) || !["code", "braces", "book"].includes(input.icon)) throw new Error("Choose valid course options.");
  if (!Array.isArray(input.objectives) || !input.objectives.length || input.objectives.length > 20) throw new Error("Add between 1 and 20 learning objectives.");
  return { title: required(input.title, "Course title", 100), description: required(input.description, "Description", 2000), category: required(input.category, "Category", 100), difficulty: input.difficulty, duration: required(input.duration, "Estimated duration", 100), objectives: input.objectives.map(o => required(o, "Learning objective", 300)), color: input.color, icon: input.icon };
}
function reorder<T extends { id: string; archived: boolean; updatedAt: string | null }>(list: T[], id: string, direction: number, now: string) {
  const active = list.filter(x => !x.archived); const at = active.findIndex(x => x.id === id), next = at + direction;
  if (at < 0 || next < 0 || next >= active.length) throw new Error("This item cannot move further.");
  const a = list.indexOf(active[at]), b = list.indexOf(active[next]);
  [list[a], list[b]] = [list[b], list[a]];
  list[a].updatedAt = now; list[b].updatedAt = now;
}
// Pure transactional operations are independent of React and browser persistence.
export function applyInstructorCommand(state: InstructorState, command: InstructorCommand, now = new Date().toISOString(), uuid = () => crypto.randomUUID()): { state: InstructorState; id: string } {
  if (!isIsoTimestamp(now)) throw new Error("A valid ISO timestamp is required for content changes.");
  now = new Date(now).toISOString();
  const next = structuredClone(state), ids = new Set([...next.changes.map(c => c.id), ...next.courses.flatMap(c => [c.id, ...c.modules.flatMap(m => [m.id, ...m.activities.map(a => a.id)])])]);
  const fresh = (prefix: string) => { for (let i = 0; i < 10; i++) { const id = `${prefix}-${uuid()}`; if (!ids.has(id)) { ids.add(id); return id; } } throw new Error("Could not allocate a unique identifier. Try again."); };
  let course: InstructorCourse, id: string, title: string, affectedTitle: string | undefined;
  if (command.type === "course.create") {
    id = required(command.id, "Course identifier", 80);
    if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id)) throw new Error("Use lowercase letters, numbers, and single hyphens; start with a letter.");
    if (ids.has(id)) throw new Error("This identifier is already in use, including archived records.");
    course = { ...fields(command.fields), id, status: "draft", source: "local", archived: false, hasBeenPublished: false, createdAt: now, updatedAt: now, publishedAt: null, modules: [] };
    next.courses.push(course); title = `Created ${course.title}`;
  } else {
    const found = next.courses.find(c => c.id === command.courseId);
    if (!found) throw new Error("Course not found.");
    course = found; id = course.id;
    if (course.archived && command.type !== "course.archive" && command.type !== "course.duplicate" && command.type !== "course.delete") throw new Error("Restore this course before editing it.");
    if (command.type !== "course.duplicate") course.hasBeenPublished = course.hasBeenPublished || course.status === "published" || !!course.publishedAt;
    title = `Updated ${course.title}`;
    switch (command.type) {
      case "course.update": Object.assign(course, fields(command.fields)); course.status = "draft"; break;
      case "course.duplicate": {
        // Build new draft records explicitly. No published flags, live content
        // bindings, or unknown legacy publication fields leak into a copy.
        const copy: InstructorCourse = {
          id: fresh("course"), title: `${course.title.slice(0, 93)} (copy)`, description: course.description,
          category: course.category, difficulty: course.difficulty, duration: course.duration,
          objectives: [...course.objectives], color: course.color, icon: course.icon,
          status: "draft", source: "local", archived: false, hasBeenPublished: false,
          createdAt: now, updatedAt: now, publishedAt: null, duplication: { version: 1, courseId: course.id },
          modules: course.modules.map(m => ({
            id: fresh("module"), title: m.title, description: m.description, archived: m.archived,
            source: "local", status: "draft", hasBeenPublished: false, createdAt: now, updatedAt: now,
            activities: m.activities.map(a => {
              const reference = a.reference ?? a.copiedFrom?.reference;
              return {
                id: fresh("activity"), title: a.title, description: a.description, type: a.type, minutes: a.minutes,
                archived: a.archived, source: "local", status: "draft", hasBeenPublished: false,
                createdAt: now, updatedAt: now, publishedAt: null,
                copiedFrom: { activityId: a.id, ...(reference ? { reference: { ...reference } } : {}) },
              };
            }),
          })),
        };
        next.courses.push(copy); course = copy; id = copy.id; title = `Duplicated ${found.title}`; break;
      }
      case "course.status": {
        if (!["draft", "published"].includes(command.status)) throw new Error("Invalid publication status.");
        const issue = command.status === "published" && publicationIssue(course); if (issue) throw new Error(issue);
        if (command.status === course.status) return { state, id: course.id };
        course.status = command.status;
        if (command.status === "published") {
          course.hasBeenPublished = true; course.publishedAt = now;
          course.modules.filter(m => !m.archived).forEach(m => {
            if (m.status !== "published") m.updatedAt = now;
            m.status = "published"; m.hasBeenPublished = true;
            // These activities were already published. Republishing their
            // container must not invent their historical publication dates.
            m.activities.filter(a => !a.archived).forEach(a => { a.hasBeenPublished = true; });
          });
        }
        title = `${command.status === "published" ? "Published locally" : "Unpublished locally"}: ${course.title}`; break;
      }
      case "course.archive": course.archived = command.archived; title = `${command.archived ? "Archived" : "Restored"} ${course.title}`; break;
      case "course.delete": {
        const issue = courseDeletionIssue(course); if (issue) throw new Error(issue);
        next.courses = next.courses.filter(c => c.id !== course.id); title = `Deleted course: ${course.title}`; break;
      }
      case "module.create": {
        id = fresh("module"); affectedTitle = required(command.title, "Module title"); course.modules.push({ id, title: affectedTitle, description: required(command.description, "Description", 2000), archived: false, source: "local", status: "draft", hasBeenPublished: false, createdAt: now, updatedAt: now, activities: [] }); course.status = "draft"; title = `Added module: ${affectedTitle}`; break;
      }
      default: {
        const topic = course.modules.find(m => m.id === command.moduleId); if (!topic) throw new Error("Module not found.");
        id = topic.id;
        if (topic.archived && command.type !== "module.archive" && command.type !== "module.delete" && command.type !== "activity.delete") throw new Error("Restore this module before editing it.");
        topic.hasBeenPublished = topic.hasBeenPublished || topic.status === "published";
        if (command.type === "module.update") { topic.title = required(command.title, "Module title"); topic.description = required(command.description, "Description", 2000); title = `Updated module: ${topic.title}`; }
        else if (command.type === "module.archive") { topic.archived = command.archived; title = `${command.archived ? "Archived" : "Restored"} module: ${topic.title}`; }
        else if (command.type === "module.reorder") { reorder(course.modules, topic.id, command.direction, now); title = `Reordered module: ${topic.title}`; }
        else if (command.type === "module.delete") {
          const issue = moduleDeletionIssue(course, topic); if (issue) throw new Error(issue);
          course.modules = course.modules.filter(m => m.id !== topic.id); title = `Deleted module: ${topic.title}`;
        }
        else if (command.type === "activity.create") {
          if (!["theory", "quiz", "lab", "workshop"].includes(command.activityType)) throw new Error("Choose an activity type.");
          id = fresh("activity"); affectedTitle = required(command.title, "Activity title"); topic.activities.push({ id, type: command.activityType, title: affectedTitle, description: required(command.description, "Description", 2000), status: "draft", source: "local", archived: false, hasBeenPublished: false, minutes: 0, createdAt: now, updatedAt: now, publishedAt: null }); title = `Added draft: ${affectedTitle}`;
        } else {
          const activity = topic.activities.find(a => a.id === command.activityId); if (!activity) throw new Error("Activity not found.");
          id = activity.id;
          if (activity.archived && command.type !== "activity.archive" && command.type !== "activity.delete") throw new Error("Restore this activity before editing it.");
          if (command.type === "activity.update") { activity.title = required(command.title, "Activity title"); activity.description = required(command.description, "Description", 2000); title = `Updated activity: ${activity.title}`; }
          else if (command.type === "activity.archive") { activity.archived = command.archived; title = `${command.archived ? "Archived" : "Restored"} activity: ${activity.title}`; }
          else if (command.type === "activity.reorder") { reorder(topic.activities, activity.id, command.direction, now); title = `Reordered activity: ${activity.title}`; }
          else if (command.type === "activity.delete") {
            const issue = activityDeletionIssue(course, topic, activity); if (issue) throw new Error(issue);
            topic.activities = topic.activities.filter(a => a.id !== activity.id); title = `Deleted activity: ${activity.title}`;
          }
          else if (command.type === "activity.move") {
            const target = course.modules.find(m => m.id === command.targetModuleId && !m.archived);
            if (!target || target === topic) throw new Error("Choose another active module.");
            topic.activities = topic.activities.filter(a => a.id !== activity.id); target.activities.push(activity); target.updatedAt = now; title = `Moved ${activity.title} to ${target.title}`;
          }
          activity.updatedAt = now;
          affectedTitle = activity.title;
        }
        if (command.type.startsWith("module.")) affectedTitle = topic.title;
        topic.updatedAt = now; topic.status = "draft";
        // Structural edits change only this local snapshot. Re-review it before publication.
        course.status = "draft";
      }
    }
    course.updatedAt = now;
  }
  const kind = command.type.startsWith("activity.") ? "activity" : command.type.startsWith("module.") ? "module" : "course";
  next.changes.unshift({ id: fresh("change"), courseId: course.id, title, at: now, action: command.type, content: { kind, id, title: affectedTitle ?? course.title } }); next.changes = next.changes.slice(0, 60);
  return { state: next, id };
}

type StoragePort = Pick<Storage, "getItem" | "setItem">;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string";
function validState(value: unknown): value is InstructorState {
  if (!object(value) || value.version !== 1 || !Array.isArray(value.courses) || !Array.isArray(value.changes)) return false;
  const ids = new Set<string>();
  const timestamp = (v: unknown) => v === undefined || v === null || isIsoTimestamp(v);
  const record = (v: unknown) => { if (!object(v) || !text(v.id) || !v.id || ids.has(v.id) || typeof v.archived !== "boolean" || !(v.hasBeenPublished === undefined || typeof v.hasBeenPublished === "boolean") || !timestamp(v.createdAt) || !timestamp(v.updatedAt)) return false; ids.add(v.id); return true; };
  const publication = (v: Record<string, unknown>) => ["draft", "published"].includes(String(v.status)) && ["seed", "local"].includes(String(v.source));
  const reference = (v: unknown) => object(v) && ["lesson", "quiz", "exercise", "project"].includes(String(v.kind)) && text(v.id) && !!v.id;
  for (const c of value.courses) {
    if (!object(c) || !record(c) || !publication(c) || !timestamp(c.publishedAt) || !text(c.title) || !c.title.trim() || !text(c.description) || !text(c.category) || !text(c.duration) || !["Beginner", "Intermediate", "Advanced"].includes(String(c.difficulty)) || !["blue", "orange", "gold", "green"].includes(String(c.color)) || !["code", "braces", "book"].includes(String(c.icon)) || !Array.isArray(c.objectives) || !c.objectives.every(text) || !Array.isArray(c.modules)) return false;
    if (c.duplication !== undefined && (!object(c.duplication) || c.duplication.version !== 1 || !text(c.duplication.courseId) || !c.duplication.courseId)) return false;
    for (const m of c.modules) {
      if (!object(m) || !record(m) || !text(m.title) || !text(m.description) || !Array.isArray(m.activities) || !(m.source === undefined || ["seed", "local"].includes(String(m.source))) || !(m.status === undefined || ["draft", "published"].includes(String(m.status)))) return false;
      for (const a of m.activities) {
        if (!object(a) || !record(a) || !publication(a) || !timestamp(a.publishedAt) || !text(a.title) || !text(a.description) || !["theory", "quiz", "lab", "workshop"].includes(String(a.type)) || typeof a.minutes !== "number" || !Number.isFinite(a.minutes) || a.minutes < 0) return false;
        if (a.reference !== undefined && !reference(a.reference)) return false;
        if (a.copiedFrom !== undefined && (!object(a.copiedFrom) || !text(a.copiedFrom.activityId) || !a.copiedFrom.activityId || a.copiedFrom.reference !== undefined && !reference(a.copiedFrom.reference))) return false;
      }
    }
  }
  // Reject partial/truncated snapshots rather than silently dropping seeded content.
  for (const seed of seedInstructorState().courses) {
    const c = value.courses.find((c: InstructorCourse) => c.id === seed.id); if (!c) return false;
    for (const m of seed.modules) {
      if (!c.modules.some((entry: { id: string }) => entry.id === m.id)) return false;
      for (const a of m.activities) {
        const saved = c.modules.flatMap((m: { activities: unknown[] }) => m.activities).find((v: { id: string }) => v.id === a.id);
        if (!saved || saved.type !== a.type || JSON.stringify(saved.reference) !== JSON.stringify(a.reference)) return false;
      }
    }
  }
  const actions: InstructorCommand["type"][] = ["course.create", "course.update", "course.duplicate", "course.status", "course.archive", "course.delete", "module.create", "module.update", "module.reorder", "module.archive", "module.delete", "activity.create", "activity.update", "activity.reorder", "activity.move", "activity.archive", "activity.delete"];
  return value.changes.every(v => object(v) && text(v.id) && text(v.title) && text(v.courseId) && isIsoTimestamp(v.at) && (v.action === undefined || actions.includes(v.action as InstructorCommand["type"])) && (v.content === undefined || object(v.content) && ["course", "module", "activity"].includes(String(v.content.kind)) && text(v.content.id) && text(v.content.title)));
}
// Additive version-1 migration: unknown history becomes null, never "now".
// Known ISO offsets are normalized to UTC without changing the instant.
function normalizeTimestamps(state: InstructorState): InstructorState {
  const iso = (v?: string | null) => v ? new Date(v).toISOString() : null;
  return { ...state, courses: state.courses.map(c => ({ ...c, createdAt: iso(c.createdAt), updatedAt: iso(c.updatedAt), publishedAt: iso(c.publishedAt), modules: c.modules.map(m => ({ ...m, createdAt: iso(m.createdAt), updatedAt: iso(m.updatedAt), activities: m.activities.map(a => ({ ...a, createdAt: iso(a.createdAt), updatedAt: iso(a.updatedAt), publishedAt: iso(a.publishedAt) })) })) })), changes: state.changes.map(change => ({ ...change, at: new Date(change.at).toISOString() })) };
}
export function decodeInstructorStorage(raw: string | null): { state: InstructorState; recovery: "none" | "malformed" | "unsupported" } {
  if (raw === null) return { state: seedInstructorState(), recovery: "none" };
  try {
    const value: unknown = JSON.parse(raw);
    if (object(value) && typeof value.version === "number" && value.version !== 1) return { state: seedInstructorState(), recovery: "unsupported" };
    if (validState(value)) return { state: normalizeTimestamps(value), recovery: "none" };
  } catch { /* Preserve the raw record before allowing a recovered write. */ }
  return { state: seedInstructorState(), recovery: "malformed" };
}
export class LocalInstructorRepository implements InstructorRepository {
  private listeners = new Set<() => void>();
  private server: RepositorySnapshot = { state: seedInstructorState(), ready: false, writable: false, warning: "" };
  private snapshot = this.server;
  private raw: string | null = null;
  constructor(private storage: () => StoragePort = () => window.localStorage) {}
  getSnapshot = () => this.snapshot;
  getServerSnapshot = () => this.server;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private notify() { this.listeners.forEach(listener => listener()); }
  initialize = () => {
    try {
      this.raw = this.storage().getItem(instructorStorageKey);
      const { state, recovery } = decodeInstructorStorage(this.raw);
      if (recovery === "malformed") this.storage().setItem(instructorRecoveryKey, this.raw!);
      this.snapshot = { state, ready: true, writable: recovery !== "unsupported", warning: recovery === "unsupported" ? "This browser has an unsupported repository version. Editing is disabled to preserve it. Use a compatible app version or a separate browser profile." : recovery === "malformed" ? "Invalid local content was recovered from the original curriculum. The previous record is backed up in this browser." : "" };
    } catch { this.snapshot = { ...this.snapshot, ready: true, writable: false, warning: "Browser storage is unavailable. Content is read-only; enable local storage to save changes." }; }
    this.notify();
  };
  execute = (command: InstructorCommand) => {
    if (!this.snapshot.ready || !this.snapshot.writable) throw new Error("Local storage is not ready for editing.");
    if (this.storage().getItem(instructorStorageKey) !== this.raw) { this.initialize(); throw new Error("Content changed in another tab. Review the refreshed content and retry."); }
    const result = applyInstructorCommand(this.snapshot.state, command), raw = JSON.stringify(result.state);
    try { this.storage().setItem(instructorStorageKey, raw); } catch { throw new Error("Changes were not saved. Browser storage may be full or disabled."); }
    this.raw = raw; this.snapshot = { ...this.snapshot, state: result.state }; this.notify(); return result.id;
  };
}
