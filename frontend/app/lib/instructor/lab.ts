import { challenges } from "../student/challenges";
import { findLab, labIds, labs } from "../student/labs";
import { activityEditorHref, instructorActivityLocation } from "./activity";
import { isIsoTimestamp } from "./dates";
import type { InstructorActivity, InstructorState } from "./types";
import type { LabCheck, LabCheckAction, LabContent, LabDraft } from "./lab-types";

export const maxLabChecks = 50;
export const labCheckTypes = { element: "Element count", text: "Element text", attribute: "Attribute value", style: "Computed CSS value", "click-text": "Text after a click", runtime: "No JavaScript errors", student: "Existing DECODE task check" } as const;
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown, max = 10000): v is string => typeof v === "string" && v.length <= max;
const number = (v: unknown) => v === null || typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= 1000000;
export function validLabCheck(v: unknown): v is LabCheck {
  if (!object(v) || !text(v.id, 200) || !v.id || !text(v.description, 500)) return false;
  switch (v.type) {
    case "element": return text(v.selector, 200) && number(v.min) && number(v.max);
    case "text": return text(v.selector, 200) && text(v.expected, 2000) && ["exact", "contains"].includes(String(v.match));
    case "attribute": return text(v.selector, 200) && text(v.attribute, 80) && text(v.expected, 2000);
    case "style": return text(v.selector, 200) && text(v.property, 80) && text(v.expected, 2000);
    case "click-text": return text(v.selector, 200) && text(v.target, 200) && text(v.expected, 2000);
    case "runtime": return true;
    case "student": return typeof v.labId === "string" && labIds.includes(v.labId as typeof labIds[number]) && text(v.requirementId, 200);
    default: return false;
  }
}
export function validLabContent(v: unknown): v is LabContent {
  return object(v) && text(v.title, 200) && text(v.objective) && text(v.instructions) && text(v.hints) && text(v.solution, 100000) && object(v.starter) && ["html", "css", "javascript"].every(k => text((v.starter as Record<string, unknown>)[k], 100000)) && Array.isArray(v.widths) && v.widths.length <= 2 && v.widths.every(w => w === 320 || w === 800) && new Set(v.widths).size === v.widths.length && Array.isArray(v.checks) && v.checks.length <= maxLabChecks && v.checks.every(validLabCheck) && new Set(v.checks.map(c => c.id)).size === v.checks.length;
}
export function validLabDraft(v: unknown, id: string): v is LabDraft {
  return object(v) && v.version === 1 && Number.isSafeInteger(v.revision) && Number(v.revision) > 0 && v.activityId === id && isIsoTimestamp(v.createdAt) && isIsoTimestamp(v.updatedAt) && validLabContent(v);
}
export function labContentOnly(content: LabContent): LabContent {
  const { title, objective, instructions, hints, solution, starter, checks, widths } = content;
  return { title, objective, instructions, hints, solution, starter, checks, widths };
}
export const sameLabContent = (a: LabContent, b: LabContent) => JSON.stringify(labContentOnly(a)) === JSON.stringify(labContentOnly(b));
export const labLocation = (state: InstructorState, id: string) => instructorActivityLocation(state, id, "lab");
export const labEditorHref = (id: string, preview = false) => activityEditorHref("lab", id, preview);
export function initialLabContent(activity: InstructorActivity): { content: LabContent; source: "student" | "new" | "unsupported" } {
  const reference = activity.reference ?? activity.copiedFrom?.reference;
  const challenge = reference?.kind === "exercise" ? challenges.find(c => c.id === reference.id) : undefined;
  const lab = challenge && findLab(challenge.id);
  if (challenge && lab) return { source: "student", content: {
    title: activity.title, objective: lab.objective, instructions: challenge.instructions, hints: challenge.hint,
    starter: { ...challenge.starter }, solution: challenge.expected, widths: [...lab.widths],
    checks: lab.requirements.map(r => ({ id: `${activity.id}:check:${r.id}`, description: r.title, ...(r.id === "runtime" ? { type: "runtime" as const } : { type: "student" as const, labId: lab.id, requirementId: r.id }) })),
  } };
  return { source: reference || activity.source === "seed" ? "unsupported" : "new", content: { title: activity.title, objective: "", instructions: "", hints: "", starter: { html: "", css: "", javascript: "" }, solution: "", widths: [800], checks: [] } };
}
// A deliberately small CSS selector language: tags, IDs, classes, attribute
// existence/exact value, descendants and direct children. No authored regex/code.
export function validLabSelector(value: string): boolean {
  if (!value || value.length > 200 || value.trim() !== value) return false;
  const qualifier = "(?:[.#]-?[_a-zA-Z][\\w-]*|\\[[a-zA-Z][\\w-]*(?:=(?:\"[^\"\\\\\\]\\s>]*\"|'[^'\\\\\\]\\s>]*'|[\\w-]+))?\\])";
  const atom = new RegExp(`^(?:[a-zA-Z][\\w-]*|\\*)${qualifier}*$|^${qualifier}+$`);
  // Split combinators first: no nested whitespace repetitions or authored
  // regular expressions can cause expensive backtracking in the main app.
  return value.split(">").every(part => !!part.trim() && part.trim().split(/\s+/).every(segment => atom.test(segment)));
}
export function labCheckIssues(check: LabCheck): string[] {
  const issues: string[] = [];
  if (!check.description.trim()) issues.push("Describe what this check verifies.");
  if ("selector" in check && !validLabSelector(check.selector)) issues.push("Use a supported selector, such as h1, #message, .card, or main > p.");
  if (check.type === "element" && (check.min === null || !Number.isInteger(check.min) || check.min < 0 || check.min > 1000 || check.max !== null && (!Number.isInteger(check.max) || check.max < check.min || check.max > 1000))) issues.push("Use a minimum count from 0 to 1,000 and an optional maximum at least as large.");
  if ("expected" in check && !check.expected.trim()) issues.push("Enter the expected value.");
  if (check.type === "attribute" && !/^[a-zA-Z][\w:-]{0,79}$/.test(check.attribute)) issues.push("Enter an attribute name, such as href or aria-label.");
  if (check.type === "style" && !/^[a-z][a-z-]{0,79}$/.test(check.property)) issues.push("Use a CSS property name, such as display or background-color.");
  if (check.type === "click-text" && !validLabSelector(check.target)) issues.push("Enter a supported selector for the element whose text changes.");
  if (check.type === "student" && !labs[check.labId].requirements.some(r => r.id === check.requirementId)) issues.push("Select an existing DECODE requirement.");
  return issues;
}
export function labReadiness(content: LabContent) {
  const errors = content.checks.flatMap(c => { const messages = labCheckIssues(c); return messages.length ? [{ id: c.id, messages }] : []; });
  const meaningfulTitle = content.title.trim().length >= 3, objective = !!content.objective.trim(), instructions = !!content.instructions.trim(), hasChecks = content.checks.length > 0, widths = content.widths.length > 0;
  const format = validLabContent(content);
  return { ready: format && meaningfulTitle && objective && instructions && hasChecks && widths && !errors.length, meaningfulTitle, objective, instructions, hasChecks, widths, format, errors };
}
export function newLabCheck(type: LabCheck["type"] = "element", id = `check-${crypto.randomUUID()}`): LabCheck {
  const base = { id, description: "" };
  switch (type) {
    case "element": return { ...base, type, selector: "", min: 1, max: null };
    case "text": return { ...base, type, selector: "", expected: "", match: "exact" };
    case "attribute": return { ...base, type, selector: "", attribute: "", expected: "" };
    case "style": return { ...base, type, selector: "", property: "", expected: "" };
    case "click-text": return { ...base, type, selector: "", target: "", expected: "" };
    case "student": return { ...base, type, labId: "html-heading", requirementId: "heading" };
    default: return { ...base, type: "runtime", description: "Code runs without JavaScript errors" };
  }
}
export function editLabChecks(checks: LabCheck[], action: LabCheckAction): LabCheck[] {
  if (action.type === "add") return checks.length >= maxLabChecks || checks.some(c => c.id === action.check.id) ? checks : [...checks, structuredClone(action.check)];
  const id = "id" in action ? action.id : action.check.id, at = checks.findIndex(c => c.id === id);
  if (at < 0) return checks;
  const next = structuredClone(checks);
  if (action.type === "update") next[at] = structuredClone(action.check);
  else if (action.type === "delete") next.splice(at, 1);
  else { const to = at + action.direction; if (to < 0 || to >= checks.length) return checks; [next[at], next[to]] = [next[to], next[at]]; }
  return next;
}
