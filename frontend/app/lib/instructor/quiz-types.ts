export type QuizOption = { id: string; text: string };
export type QuizQuestion = {
  id: string; topic: string; prompt: string; options: QuizOption[];
  correctOptionId: string | null; explanation: string; points: number | null;
};
export type QuizContent = { title: string; instructions: string; questions: QuizQuestion[] };
export type QuizDraft = QuizContent & { version: 1; revision: number; activityId: string; createdAt: string; updatedAt: string };
export type QuizStore = { version: 1; drafts: Record<string, QuizDraft> };
export type QuizQuestionAction =
  | { type: "add"; question: QuizQuestion }
  | { type: "update"; question: QuizQuestion }
  | { type: "delete"; id: string }
  | { type: "duplicate"; id: string }
  | { type: "move"; id: string; direction: -1 | 1 };
export type QuizPreviewResult = {
  correct: number; total: number; earnedPoints: number; totalPoints: number; percent: number;
  questions: { questionId: string; correct: boolean; selectedOptionId: string | null; points: number }[];
};
