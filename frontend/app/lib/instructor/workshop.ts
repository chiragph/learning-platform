import { projects } from "../student/projects";
import { activityEditorHref, instructorActivityLocation } from "./activity";
import { isIsoTimestamp } from "./dates";
import { safeResourceUrl } from "./theory";
import type { InstructorActivity, InstructorState } from "./types";
import type { WorkshopContent, WorkshopDraft, WorkshopEntry, WorkshopEntryAction } from "./workshop-types";

export const maxWorkshopEntries = 50;
export const submissionFileTypes = [".zip", ".html", ".css", ".js", ".json", ".md", ".txt", ".pdf", ".png", ".jpg", ".jpeg", ".webp"] as const;
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown, max = 10000): v is string => typeof v === "string" && v.length <= max;
const finite = (v: unknown) => v === null || typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= 1000000;
export function validWorkshopContent(v: unknown): v is WorkshopContent {
  if (!object(v) || !text(v.title, 200) || !text(v.description) || !text(v.hints) || !text(v.evaluation) || !text(v.feedbackGuidance) || !finite(v.estimatedMinutes) || !Array.isArray(v.objectives) || v.objectives.length > 30 || !v.objectives.every(s => text(s, 1000)) || !object(v.starter) || !["html", "css", "javascript"].every(k => text((v.starter as Record<string, unknown>)[k], 100000))) return false;
  if (!object(v.submission) || !text(v.submission.instructions) || !finite(v.submission.maxFileSizeMb) || !Array.isArray(v.submission.acceptedTypes) || v.submission.acceptedTypes.length > submissionFileTypes.length || !v.submission.acceptedTypes.every(s => text(s, 20)) || new Set(v.submission.acceptedTypes).size !== v.submission.acceptedTypes.length) return false;
  const ids = new Set<string>();
  const id = (v: unknown) => { if (!text(v, 200) || !v || ids.has(v)) return false; ids.add(v); return true; };
  if (![v.steps, v.requirements, v.deliverables].every(list => Array.isArray(list) && list.length <= maxWorkshopEntries && list.every(e => object(e) && id(e.id) && text(e.title, 200) && text(e.description)))) return false;
  return Array.isArray(v.resources) && v.resources.length <= 20 && v.resources.every(r => object(r) && id(r.id) && text(r.title, 200) && text(r.url, 2000));
}
export function validWorkshopDraft(v: unknown, id: string): v is WorkshopDraft {
  return object(v) && v.version === 1 && Number.isSafeInteger(v.revision) && Number(v.revision) > 0 && v.activityId === id && isIsoTimestamp(v.createdAt) && isIsoTimestamp(v.updatedAt) && validWorkshopContent(v);
}
export function workshopContentOnly(c: WorkshopContent): WorkshopContent {
  const { title, objectives, description, steps, requirements, deliverables, hints, resources, estimatedMinutes, submission, evaluation, feedbackGuidance, starter } = c;
  return { title, objectives, description, steps, requirements, deliverables, hints, resources, estimatedMinutes, submission, evaluation, feedbackGuidance, starter };
}
export const sameWorkshopContent = (a: WorkshopContent, b: WorkshopContent) => JSON.stringify(workshopContentOnly(a)) === JSON.stringify(workshopContentOnly(b));
export const workshopLocation = (state: InstructorState, id: string) => instructorActivityLocation(state, id, "workshop");
export const workshopEditorHref = (id: string, preview = false) => activityEditorHref("workshop", id, preview);
export function initialWorkshopContent(activity: InstructorActivity): { content: WorkshopContent; source: "student" | "new" | "unsupported" } {
  const reference = activity.reference ?? activity.copiedFrom?.reference, project = reference?.kind === "project" ? projects.find(p => p.id === reference.id) : undefined;
  const content: WorkshopContent = { title: activity.title, objectives: [], description: "", steps: [], requirements: [], deliverables: [], hints: "", resources: [], estimatedMinutes: activity.minutes > 0 ? activity.minutes : null, submission: { instructions: "", acceptedTypes: [], maxFileSizeMb: null }, evaluation: "", feedbackGuidance: "", starter: { html: "", css: "", javascript: "" } };
  if (project) return { source: "student", content: { ...content, objectives: [...project.objectives], description: project.overview, steps: [...project.steps].sort((a,b) => a.order-b.order).map(s => ({ id: s.id, title: s.title, description: s.instruction })), starter: { ...project.starter } } };
  return { source: reference || activity.source === "seed" ? "unsupported" : "new", content };
}
export function workshopReadiness(content: WorkshopContent) {
  const errors: { id: string; messages: string[] }[] = [];
  for (const [name, entries] of [["Step", content.steps], ["Requirement", content.requirements], ["Deliverable", content.deliverables]] as const) for (const entry of entries) {
    const messages = [!entry.title.trim() && `${name} title is required.`, !entry.description.trim() && `${name} instructions are required.`].filter((s): s is string => !!s);
    if (messages.length) errors.push({ id: entry.id, messages });
  }
  for (const resource of content.resources) if (!resource.title.trim() || !safeResourceUrl(resource.url)) errors.push({ id: resource.id, messages: ["Add a resource title and a valid HTTP(S) URL without credentials."] });
  const checklist = [
    { ready: content.title.trim().length >= 3, label: "A meaningful workshop title" },
    { ready: content.objectives.length > 0 && content.objectives.every(s => !!s.trim()), label: "Complete learning objectives" },
    { ready: !!content.description.trim(), label: "Project description" },
    { ready: content.steps.length > 0 && content.steps.every(s => s.title.trim() && s.description.trim()), label: "At least one complete step" },
    { ready: content.requirements.length > 0 && content.deliverables.length > 0 && [...content.requirements, ...content.deliverables].every(s => s.title.trim() && s.description.trim()), label: "Requirements and deliverables" },
    { ready: content.estimatedMinutes !== null && Number.isInteger(content.estimatedMinutes) && content.estimatedMinutes >= 1 && content.estimatedMinutes <= 10080, label: "Estimated time: 1–10,080 minutes" },
    { ready: !!content.submission.instructions.trim() && content.submission.acceptedTypes.length > 0 && content.submission.acceptedTypes.every(t => (submissionFileTypes as readonly string[]).includes(t)) && content.submission.maxFileSizeMb !== null && Number.isInteger(content.submission.maxFileSizeMb) && content.submission.maxFileSizeMb >= 1 && content.submission.maxFileSizeMb <= 50, label: "Submission guidance and file limits (1–50 MB)" },
    { ready: !content.resources.some(r => !r.title.trim() || !safeResourceUrl(r.url)), label: "Valid optional resource links" },
    { ready: validWorkshopContent(content), label: "Content within supported storage limits" },
  ];
  return { ready: checklist.every(c => c.ready) && !errors.length, checklist, errors };
}
export const newWorkshopId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
export const newWorkshopEntry = (fresh = newWorkshopId): WorkshopEntry => ({ id: fresh("entry"), title: "", description: "" });
export function editWorkshopEntries(entries: WorkshopEntry[], action: WorkshopEntryAction, fresh = newWorkshopId): WorkshopEntry[] {
  if (action.type === "add") return entries.length >= maxWorkshopEntries || entries.some(e => e.id === action.entry.id) ? entries : [...entries, structuredClone(action.entry)];
  const at = entries.findIndex(e => e.id === ("id" in action ? action.id : action.entry.id)); if (at < 0) return entries;
  const next = structuredClone(entries);
  if (action.type === "update") next[at] = structuredClone(action.entry);
  else if (action.type === "delete") next.splice(at, 1);
  else if (action.type === "duplicate") { if (entries.length >= maxWorkshopEntries) return entries; next.splice(at+1, 0, { ...structuredClone(entries[at]), id: fresh("entry") }); }
  else if (action.type === "move") { const to = at + action.direction; if (to < 0 || to >= entries.length) return entries; [next[at], next[to]] = [next[to], next[at]]; }
  return next;
}
export function copyWorkshopContent(content: WorkshopContent, fresh = newWorkshopId): WorkshopContent {
  const copy = structuredClone(workshopContentOnly(content));
  for (const list of [copy.steps, copy.requirements, copy.deliverables, copy.resources]) for (const entry of list) entry.id = fresh("entry");
  return copy;
}
