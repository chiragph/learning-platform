import type { Code } from "../student/types";

export type WorkshopEntry = { id: string; title: string; description: string };
export type WorkshopResource = { id: string; title: string; url: string };
export type WorkshopContent = {
  title: string; objectives: string[]; description: string;
  steps: WorkshopEntry[]; requirements: WorkshopEntry[]; deliverables: WorkshopEntry[];
  hints: string; resources: WorkshopResource[]; estimatedMinutes: number | null;
  submission: { instructions: string; acceptedTypes: string[]; maxFileSizeMb: number | null };
  evaluation: string; feedbackGuidance: string; starter: Code;
};
export type WorkshopDraft = WorkshopContent & { version: 1; revision: number; activityId: string; createdAt: string; updatedAt: string };
export type WorkshopStore = { version: 1; drafts: Record<string, WorkshopDraft> };
export type WorkshopEntryAction = { type: "add" | "update"; entry: WorkshopEntry } | { type: "delete" | "duplicate"; id: string } | { type: "move"; id: string; direction: -1 | 1 };
