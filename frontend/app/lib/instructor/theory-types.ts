export const theoryLanguages = ["html", "css", "javascript", "plaintext"] as const;
export type TheoryLanguage = typeof theoryLanguages[number];
export type TheoryBlock = { id: string } & (
  | { type: "heading"; text: string; level: 2 | 3 }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "code"; language: TheoryLanguage; code: string; title: string; explanation: string }
  | { type: "callout"; tone: "tip" | "note"; title: string; text: string }
  | { type: "resource"; title: string; url: string; description: string }
);
export type TheoryContent = { title: string; blocks: TheoryBlock[] };
// Working drafts never replace the published activity or its student reference.
export type TheoryDraft = TheoryContent & { version: 1; revision: number; activityId: string; createdAt: string; updatedAt: string };
export type TheoryStore = { version: 1; drafts: Record<string, TheoryDraft> };
export type TheoryBlockAction =
  | { type: "add"; block: TheoryBlock }
  | { type: "update"; block: TheoryBlock }
  | { type: "delete"; id: string }
  | { type: "duplicate"; id: string; newId: string }
  | { type: "move"; id: string; direction: -1 | 1 };
