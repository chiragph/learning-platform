import type { Code } from "../student/types";
import type { LabId } from "../student/labs";

type CheckBase = { id: string; description: string };
export type LabCheck = CheckBase & (
  | { type: "element"; selector: string; min: number | null; max: number | null }
  | { type: "text"; selector: string; expected: string; match: "exact" | "contains" }
  | { type: "attribute"; selector: string; attribute: string; expected: string }
  | { type: "style"; selector: string; property: string; expected: string }
  | { type: "click-text"; selector: string; target: string; expected: string }
  | { type: "runtime" }
  | { type: "student"; labId: LabId; requirementId: string }
);
export type LabContent = {
  title: string; objective: string; instructions: string; hints: string;
  starter: Code; checks: LabCheck[]; widths: number[]; solution: string;
};
export type LabDraft = LabContent & { version: 1; revision: number; activityId: string; createdAt: string; updatedAt: string };
export type LabStore = { version: 1; drafts: Record<string, LabDraft> };
export type LabCheckAction = { type: "add"; check: LabCheck } | { type: "update"; check: LabCheck } | { type: "delete"; id: string } | { type: "move"; id: string; direction: -1 | 1 };
export type LabCheckResult = { id: string; passed: boolean };
