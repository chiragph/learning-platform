import { findLesson } from "../student/courses";
import { isIsoTimestamp } from "./dates";
import { decodeInstructorActivityParam, instructorActivityLocation } from "./activity";
import type { InstructorActivity, InstructorState } from "./types";
import { theoryLanguages, type TheoryBlock, type TheoryBlockAction, type TheoryContent, type TheoryDraft } from "./theory-types";

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown, max = 100_000): v is string => typeof v === "string" && v.length <= max;
export function safeResourceUrl(value: string): string | null {
  if (/[\u0000-\u0020\u007f]/.test(value.trim())) return null;
  try { const url = new URL(value.trim()); return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; }
}
export function validTheoryContent(value: unknown): value is TheoryContent {
  if (!object(value) || !text(value.title, 200) || !Array.isArray(value.blocks) || value.blocks.length > 200) return false;
  const ids = new Set<string>();
  return value.blocks.every(b => {
    if (!object(b) || !text(b.id, 200) || !b.id || ids.has(b.id)) return false;
    ids.add(b.id);
    switch (b.type) {
      case "heading": return text(b.text) && (b.level === 2 || b.level === 3);
      case "paragraph": return text(b.text);
      case "list": return typeof b.ordered === "boolean" && Array.isArray(b.items) && b.items.length <= 200 && b.items.every(i => text(i));
      case "code": return theoryLanguages.includes(b.language as typeof theoryLanguages[number]) && text(b.code) && text(b.title, 200) && text(b.explanation);
      case "callout": return ["tip", "note"].includes(String(b.tone)) && text(b.title, 200) && text(b.text);
      case "resource": return text(b.title, 200) && text(b.url, 2000) && text(b.description);
      default: return false;
    }
  });
}
export function validTheoryDraft(value: unknown, activityId: string): value is TheoryDraft {
  return object(value) && value.version === 1 && Number.isSafeInteger(value.revision) && Number(value.revision) > 0 && value.activityId === activityId && isIsoTimestamp(value.createdAt) && isIsoTimestamp(value.updatedAt) && validTheoryContent(value);
}
export function sameTheoryContent(a: TheoryContent, b: TheoryContent): boolean {
  return JSON.stringify({ title: a.title, blocks: a.blocks }) === JSON.stringify({ title: b.title, blocks: b.blocks });
}
// Next's route params carry the URL segment, not the repository's stable ID.
// Decode once at the route boundary, never during repository lookup or loading.
export const decodeTheoryActivityParam = decodeInstructorActivityParam;
export function theoryLocation(state: InstructorState, id: string) {
  return instructorActivityLocation(state, id, "theory");
}
export function initialTheoryContent(activity: InstructorActivity): { content: TheoryContent; source: "student" | "new" | "unsupported" } {
  const reference = activity.reference ?? activity.copiedFrom?.reference;
  if (reference?.kind === "lesson") {
    const lesson = findLesson(reference.id);
    if (lesson) return { source: "student", content: { title: activity.title, blocks: [
      ...lesson.explanation.map((text, i): TheoryBlock => ({ id: `import-paragraph-${i}`, type: "paragraph", text })),
      { id: "import-example", type: "code", language: lesson.language, code: lesson.code, title: "Syntax & example", explanation: "" },
      { id: "import-practice", type: "callout", tone: "tip", title: "Try it yourself", text: lesson.practice },
    ] } };
  }
  return { content: { title: activity.title, blocks: [] }, source: reference || activity.source === "seed" ? "unsupported" : "new" };
}
export function newTheoryBlock(type: TheoryBlock["type"], id = `block-${crypto.randomUUID()}`): TheoryBlock {
  switch (type) {
    case "heading": return { id, type, text: "", level: 2 };
    case "paragraph": return { id, type, text: "" };
    case "list": return { id, type, ordered: false, items: [""] };
    case "code": return { id, type, language: "html", code: "", title: "", explanation: "" };
    case "callout": return { id, type, tone: "tip", title: "", text: "" };
    case "resource": return { id, type, title: "", url: "", description: "" };
  }
}
export function editTheoryBlocks(blocks: TheoryBlock[], action: TheoryBlockAction): TheoryBlock[] {
  if (action.type === "add") { if (blocks.some(b => b.id === action.block.id) || blocks.length >= 200) return blocks; return [...blocks, structuredClone(action.block)]; }
  const id = "id" in action ? action.id : action.block.id, at = blocks.findIndex(b => b.id === id);
  if (at < 0) return blocks;
  const next = structuredClone(blocks);
  if (action.type === "delete") next.splice(at, 1);
  else if (action.type === "update") next[at] = structuredClone(action.block);
  else if (action.type === "duplicate") {
    if (!action.newId || blocks.some(b => b.id === action.newId) || blocks.length >= 200) return blocks;
    next.splice(at + 1, 0, { ...structuredClone(blocks[at]), id: action.newId });
  } else {
    const to = at + action.direction;
    if (to < 0 || to >= blocks.length) return blocks;
    [next[at], next[to]] = [next[to], next[at]];
  }
  return next;
}
export function theoryReadiness(content: TheoryContent) {
  const errors: { id: string; message: string }[] = [];
  for (const [i, b] of content.blocks.entries()) {
    let issue = "";
    if ((b.type === "heading" || b.type === "paragraph" || b.type === "callout") && !b.text.replace(/[*`_\s]/g, "")) issue = "Add text.";
    if (b.type === "list" && (!b.items.length || b.items.some(i => !i.replace(/[*`_\s]/g, "")))) issue = "Fill every list item.";
    if (b.type === "code" && (!theoryLanguages.includes(b.language) || !b.code.trim())) issue = "Choose a supported language and add code.";
    if (b.type === "resource" && (!b.title.trim() || !safeResourceUrl(b.url))) issue = "Add a resource title and a valid HTTP or HTTPS link.";
    if (issue) errors.push({ id: b.id, message: `Block ${i + 1}: ${issue}` });
  }
  const meaningfulTitle = content.title.trim().replace(/[*`_\s]/g, "").length >= 3;
  const substantive = content.blocks.some(b => b.type === "code" ? !!b.code.trim() : b.type === "list" ? b.items.some(i => !!i.replace(/[*`_\s]/g, "")) : b.type !== "resource" && b.type !== "heading" && !!b.text.replace(/[*`_\s]/g, ""));
  return { ready: meaningfulTitle && substantive && !errors.length, meaningfulTitle, substantive, errors };
}
export const theoryEditorHref = (id: string, preview = false) => `/instructor/theory/${encodeURIComponent(id)}${preview ? "?preview=1" : ""}`;
export const theoryCurriculumHref = (courseId: string, moduleId: string, activityId: string, archived = false) => `/instructor/curriculum?course=${encodeURIComponent(courseId)}&module=${encodeURIComponent(moduleId)}&activity=${encodeURIComponent(activityId)}${archived ? "&archived=1" : ""}`;
