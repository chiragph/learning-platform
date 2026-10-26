import { isIsoTimestamp } from "./dates";
import type { DemoSubmission, DemoSubmissionCommand, DemoSubmissionRepository, DemoSubmissionSnapshot, DemoSubmissionState, DemoWorkshopContext, ReviewStatus } from "./submission-types";

export const demoSubmissionStorageKey = "decode-instructor-submissions-demo-v1";
export const demoSubmissionRecoveryKey = "decode-instructor-submissions-demo-recovery";
export const reviewStatusLabels: Record<ReviewStatus, string> = { pending: "Pending review", "in-review": "In review", "changes-requested": "Changes requested", reviewed: "Reviewed" };
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown, max = 200): v is string => typeof v === "string" && v.length <= max;
const status = (v: unknown): v is ReviewStatus => typeof v === "string" && Object.hasOwn(reviewStatusLabels, v);
const required = (value: string, label: string, max = 200) => { if (!text(value, max) || !value.trim()) throw new Error(`${label} is required (maximum ${max} characters).`); return value.trim(); };
const validContext = (v: unknown): v is DemoWorkshopContext & Record<string, unknown> => object(v) && [v.courseId, v.activityId, v.courseTitle, v.workshopTitle].every(s => text(s, 200) && !!s.trim());
const finalReview = (s: ReviewStatus) => s === "reviewed" || s === "changes-requested";
function validRecord(v: unknown): v is DemoSubmission {
  if (!object(v) || !validContext(v) || v.mode !== "local-demo" || !text(v.id, 200) || !v.id.startsWith("demo-submission-") || !text(v.fictionalStudentName, 80) || !v.fictionalStudentName.trim() || !text(v.projectTitle) || !v.projectTitle.trim() || !status(v.status) || !text(v.feedback, 10000) || !Number.isSafeInteger(v.revision) || Number(v.revision) < 1 || ![v.createdAt, v.updatedAt, v.submittedAt].every(isIsoTimestamp) || !(v.reviewedAt === null || isIsoTimestamp(v.reviewedAt))) return false;
  const allowed = ["mode", "id", "courseId", "activityId", "courseTitle", "workshopTitle", "fictionalStudentName", "projectTitle", "status", "feedback", "revision", "createdAt", "updatedAt", "submittedAt", "reviewedAt"];
  return Object.keys(v).every(key => allowed.includes(key)) && (!finalReview(v.status) || v.feedback.trim().length >= 3 && v.reviewedAt !== null);
}
export function decodeDemoSubmissions(raw: string | null): { state: DemoSubmissionState; recovery: "none" | "malformed" | "unsupported" } {
  const empty: DemoSubmissionState = { version: 1, records: [] };
  if (raw === null) return { state: empty, recovery: "none" };
  try {
    const value: unknown = JSON.parse(raw);
    if (object(value) && typeof value.version === "number" && value.version !== 1) return { state: empty, recovery: "unsupported" };
    if (object(value) && value.version === 1 && Array.isArray(value.records) && value.records.length <= 100) {
      const ids = new Set<string>(), records = value.records.filter((record): record is DemoSubmission => { if (!validRecord(record) || ids.has(record.id)) return false; ids.add(record.id); return true; });
      return { state: { version: 1, records }, recovery: records.length === value.records.length ? "none" : "malformed" };
    }
  } catch { /* The adapter backs up malformed demo data before recovered edits. */ }
  return { state: empty, recovery: "malformed" };
}
export function demoSubmissionCounts(state: DemoSubmissionState) {
  return { total: state.records.length, pending: state.records.filter(r => r.status === "pending" || r.status === "in-review").length, reviewed: state.records.filter(r => r.status === "reviewed").length, changesRequested: state.records.filter(r => r.status === "changes-requested").length };
}
export function filterDemoSubmissions(state: DemoSubmissionState, filters: { course: string; workshop: string; status: string; query: string }) {
  const query = filters.query.trim().toLowerCase();
  return state.records.filter(r => (filters.course === "all" || r.courseId === filters.course) && (filters.workshop === "all" || r.activityId === filters.workshop) && (filters.status === "all" || r.status === filters.status) && `${r.fictionalStudentName} ${r.projectTitle} ${r.workshopTitle}`.toLowerCase().includes(query)).sort((a,b) => Date.parse(b.submittedAt)-Date.parse(a.submittedAt));
}
export function applyDemoSubmissionCommand(state: DemoSubmissionState, command: DemoSubmissionCommand, now = new Date().toISOString(), uuid = () => crypto.randomUUID()): { state: DemoSubmissionState; id: string } {
  if (!isIsoTimestamp(now)) throw new Error("A valid timestamp is required.");
  now = new Date(now).toISOString(); const next = structuredClone(state), ids = new Set(next.records.map(r => r.id));
  function create(workshop: DemoWorkshopContext, name: string, title: string) {
    if (!validContext(workshop)) throw new Error("Choose a workshop for this local demo.");
    if (next.records.length >= 100) throw new Error("The local demo limit of 100 records is reached.");
    let id = ""; for (let i=0; i<10; i++) { const candidate = `demo-submission-${uuid()}`; if (!ids.has(candidate)) { id = candidate; ids.add(id); break; } } if (!id) throw new Error("Could not allocate a unique demo identifier.");
    next.records.push({ mode: "local-demo", id, courseId: workshop.courseId, activityId: workshop.activityId, courseTitle: workshop.courseTitle, workshopTitle: workshop.workshopTitle, fictionalStudentName: required(name, "Fictional student name", 80), projectTitle: required(title, "Demo project title"), status: "pending", feedback: "", revision: 1, createdAt: now, submittedAt: now, updatedAt: now, reviewedAt: null }); return id;
  }
  if (command.type === "demo.load") {
    if (next.records.length) return { state, id: next.records[0].id };
    if (!command.workshops.length) throw new Error("Add or restore a workshop before loading local demos.");
    command.workshops.slice(0, 4).forEach((w, i) => create(w, `Demo learner ${i+1}`, `Demo project: ${w.workshopTitle}`.slice(0, 200)));
    return { state: next, id: next.records[0].id };
  }
  if (command.type === "demo.create") return { state: next, id: create(command.workshop, command.fictionalStudentName, command.projectTitle) };
  const record = next.records.find(r => r.id === command.id);
  if (!record) throw new Error("Local demo submission not found.");
  if (record.revision !== command.expectedRevision) throw new Error("This demo review changed elsewhere. Reload the saved review before saving.");
  if (!status(command.status) || !text(command.feedback, 10000)) throw new Error("Choose a supported status and feedback of at most 10,000 characters.");
  if (finalReview(command.status) && command.feedback.trim().length < 3) throw new Error("Add feedback before marking this demo reviewed or requesting changes.");
  if (record.status === command.status && record.feedback === command.feedback) return { state, id: record.id };
  record.status = command.status; record.feedback = command.feedback; record.updatedAt = now; record.revision++; record.reviewedAt = finalReview(record.status) ? now : null;
  return { state: next, id: record.id };
}
type StoragePort = Pick<Storage, "getItem" | "setItem">;
export class LocalDemoSubmissionRepository implements DemoSubmissionRepository {
  private listeners = new Set<() => void>();
  private server: DemoSubmissionSnapshot = { state: { version: 1, records: [] }, ready: false, writable: false, warning: "" };
  private snapshot = this.server;
  private raw: string | null = null;
  constructor(private storage: () => StoragePort = () => window.localStorage) {}
  getSnapshot = () => this.snapshot;
  getServerSnapshot = () => this.server;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private notify() { this.listeners.forEach(listener => listener()); }
  initialize = () => {
    let recovered = this.snapshot.state;
    try {
      this.raw = this.storage().getItem(demoSubmissionStorageKey);
      const { state, recovery } = decodeDemoSubmissions(this.raw); recovered = state;
      if (recovery === "malformed") this.storage().setItem(demoSubmissionRecoveryKey, this.raw!);
      this.snapshot = { state, ready: true, writable: recovery !== "unsupported", warning: recovery === "unsupported" ? "Unsupported demo submission format. Editing is disabled; stored data is unchanged." : recovery === "malformed" ? "Invalid demo records were isolated. The original demo record is backed up; valid demos are preserved." : "" };
    } catch { this.snapshot = { state: recovered, ready: true, writable: false, warning: "Demo storage is unavailable. Reviews are read-only; unsaved feedback stays on this page." }; }
    this.notify();
  };
  execute = (command: DemoSubmissionCommand) => {
    if (!this.snapshot.ready || !this.snapshot.writable) throw new Error("Demo storage is not ready for editing.");
    if (this.storage().getItem(demoSubmissionStorageKey) !== this.raw) { this.initialize(); throw new Error("Demo reviews changed in another tab. Review the refreshed records before saving."); }
    const result = applyDemoSubmissionCommand(this.snapshot.state, command); if (result.state === this.snapshot.state) return result.id;
    const raw = JSON.stringify(result.state);
    try { this.storage().setItem(demoSubmissionStorageKey, raw); } catch { throw new Error("Demo review was not saved. Browser storage may be full or disabled."); }
    this.raw = raw; this.snapshot = { ...this.snapshot, state: result.state }; this.notify(); return result.id;
  };
}
