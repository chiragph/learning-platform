import type { ActivityVisit } from "./curriculum-types";

export type Subject = "html" | "css" | "javascript";
export type Code = { html: string; css: string; javascript: string };
export type Lesson = { id: string; title: string; explanation: string[]; code: string; language: Subject; practice: string };
export type Course = { id: Subject; title: string; description: string; lessons: Lesson[] };
export type Question = { id: string; topic: string; prompt: string; options: [string, string, string, string]; correct: number; explanation: string };
export type QuizResult = { latest: number; best: number; attempts: number; at: string };
export type QuizAttempt = { review?: Question[]; publicationId?: string; id: string; at: string; answers: Record<string, number>; correct: number; total: number; percent: number };
export type QuizSession = { answers: Record<string, number>; index: number; at: string };
export type LabRequirementResult = { id: string; passed: boolean };
export type LabCheckRecord = { attempts: number; at: string; passed: boolean; requirements: LabRequirementResult[] };
export type WorkshopStep = { id: string; title: string; instruction: string; order: number };
export type WorkshopProgress = { completedSteps: string[]; currentStep: string; at: string };
export type Activity = { id: string; title: string; at: string; href: string };
// Optional additions let existing version-1 demo records remain valid. The local
// repository normalizes them; account identity stays in the repository key.
export type Progress = { version: 1; lessons: string[]; quizzes: Record<string, QuizResult>; challenges: string[]; projects: string[]; currentLesson: string | null; visits: ActivityVisit[]; activity: Activity[]; drafts: Record<string, Code>; quizHistory?: Record<string, QuizAttempt[]>; quizSessions?: Record<string, QuizSession>; labChecks?: Record<string, LabCheckRecord>; workshops?: Record<string, WorkshopProgress> };
export type Challenge = { id: string; subject: Subject; title: string; difficulty: "Beginner"; instructions: string; expected: string; hint: string; starter: Code; check?: "heading" | "link" | "button" };
export type Project = { requirements?: {id:string;title:string;description:string}[]; deliverables?: {id:string;title:string;description:string}[]; resources?: {id:string;title:string;url:string}[]; hints?: string; submissionInstructions?: string; evaluation?: string; id: string; title: string; difficulty: "Beginner"; overview: string; objectives: string[]; steps: WorkshopStep[]; starter: Code };
