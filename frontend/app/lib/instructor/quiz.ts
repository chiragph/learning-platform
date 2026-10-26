import { quizzes } from "../student/quizzes";
import type { Subject } from "../student/types";
import { instructorActivityLocation, activityEditorHref } from "./activity";
import { isIsoTimestamp } from "./dates";
import type { InstructorActivity, InstructorState } from "./types";
import type { QuizContent, QuizDraft, QuizPreviewResult, QuizQuestion, QuizQuestionAction } from "./quiz-types";

export const maxQuizQuestions = 100;
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown, max = 10000): v is string => typeof v === "string" && v.length <= max;
export function validQuizContent(value: unknown): value is QuizContent {
  if (!object(value) || !text(value.title, 200) || !text(value.instructions) || !Array.isArray(value.questions) || value.questions.length > maxQuizQuestions) return false;
  const ids = new Set<string>();
  const id = (v: unknown) => { if (!text(v, 200) || !v || ids.has(v)) return false; ids.add(v); return true; };
  return value.questions.every(q => object(q) && id(q.id) && text(q.topic, 200) && text(q.prompt) && text(q.explanation) && (q.correctOptionId === null || text(q.correctOptionId, 200)) && (q.points === null || typeof q.points === "number" && Number.isFinite(q.points) && Math.abs(q.points) <= 1_000_000) && Array.isArray(q.options) && q.options.length <= 6 && q.options.every(o => object(o) && id(o.id) && text(o.text, 2000)));
}
export function validQuizDraft(value: unknown, activityId: string): value is QuizDraft {
  return object(value) && value.version === 1 && Number.isSafeInteger(value.revision) && Number(value.revision) > 0 && value.activityId === activityId && isIsoTimestamp(value.createdAt) && isIsoTimestamp(value.updatedAt) && validQuizContent(value);
}
export function sameQuizContent(a: QuizContent, b: QuizContent) {
  return JSON.stringify({ title: a.title, instructions: a.instructions, questions: a.questions }) === JSON.stringify({ title: b.title, instructions: b.instructions, questions: b.questions });
}
export const quizLocation = (state: InstructorState, id: string) => instructorActivityLocation(state, id, "quiz");
export const quizEditorHref = (id: string, preview = false) => activityEditorHref("quiz", id, preview);
export function initialQuizContent(activity: InstructorActivity): { content: QuizContent; source: "student" | "new" | "unsupported" } {
  const reference = activity.reference ?? activity.copiedFrom?.reference;
  if (reference?.kind === "quiz" && Object.hasOwn(quizzes, reference.id)) {
    return { source: "student", content: { title: activity.title, instructions: "Choose one answer for each question, then submit to review your score and explanations.", questions: quizzes[reference.id as Subject].map(q => ({
      id: q.id, topic: q.topic, prompt: q.prompt, explanation: q.explanation, points: 1,
      options: q.options.map((text, i) => ({ id: `${q.id}-option-${i + 1}`, text })), correctOptionId: `${q.id}-option-${q.correct + 1}`,
    })) } };
  }
  return { source: reference || activity.source === "seed" ? "unsupported" : "new", content: { title: activity.title, instructions: "", questions: [] } };
}
export const newQuizId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
export function newQuizQuestion(fresh = newQuizId): QuizQuestion {
  return { id: fresh("question"), topic: "", prompt: "", options: [{ id: fresh("option"), text: "" }, { id: fresh("option"), text: "" }], correctOptionId: null, points: 1, explanation: "" };
}
export function copyQuizQuestion(question: QuizQuestion, fresh = newQuizId): QuizQuestion {
  const options = question.options.map(o => ({ id: fresh("option"), text: o.text }));
  const correctIndex = question.options.findIndex(o => o.id === question.correctOptionId);
  return { ...structuredClone(question), id: fresh("question"), options, correctOptionId: correctIndex >= 0 ? options[correctIndex].id : null };
}
export function editQuizQuestions(questions: QuizQuestion[], action: QuizQuestionAction, fresh = newQuizId): QuizQuestion[] {
  if (action.type === "add") {
    if (questions.length >= maxQuizQuestions || questions.some(q => q.id === action.question.id)) return questions;
    return [...questions, structuredClone(action.question)];
  }
  const id = "id" in action ? action.id : action.question.id, at = questions.findIndex(q => q.id === id);
  if (at < 0) return questions;
  const next = structuredClone(questions);
  if (action.type === "update") next[at] = structuredClone(action.question);
  else if (action.type === "delete") next.splice(at, 1);
  else if (action.type === "duplicate") { if (questions.length >= maxQuizQuestions) return questions; next.splice(at + 1, 0, copyQuizQuestion(questions[at], fresh)); }
  else { const to = at + action.direction; if (to < 0 || to >= questions.length) return questions; [next[at], next[to]] = [next[to], next[at]]; }
  return next;
}
const validPoints = (points: number | null): points is number => points !== null && Number.isInteger(points) && points >= 1 && points <= 1000;
export const quizTotalPoints = (content: QuizContent) => content.questions.reduce((sum, q) => sum + (validPoints(q.points) ? q.points : 0), 0);
export function quizReadiness(content: QuizContent) {
  const errors: { id: string; messages: string[] }[] = [];
  for (const q of content.questions) {
    const messages: string[] = [];
    if (!q.prompt.trim()) messages.push("Enter a question.");
    if (q.options.length < 2 || q.options.length > 6) messages.push("Use 2–6 answer options.");
    if (q.options.some(o => !o.text.trim())) messages.push("Fill every answer option.");
    if (new Set(q.options.map(o => o.text.trim())).size !== q.options.length) messages.push("Give each answer option distinct text.");
    if (!q.correctOptionId || q.options.filter(o => o.id === q.correctOptionId).length !== 1) messages.push("Mark exactly one existing option as correct.");
    if (!validPoints(q.points)) messages.push("Use whole-number points from 1 to 1,000.");
    if (messages.length) errors.push({ id: q.id, messages });
  }
  const meaningfulTitle = content.title.trim().length >= 3, instructions = !!content.instructions.trim(), hasQuestions = content.questions.length > 0;
  return { ready: meaningfulTitle && instructions && hasQuestions && !errors.length, meaningfulTitle, instructions, hasQuestions, errors };
}
// A pure, weighted preview calculation. It has no progress, storage, account,
// timestamp, publication, or backend dependencies.
export function scoreQuizPreview(content: QuizContent, answers: Record<string, string>): QuizPreviewResult {
  if (!validQuizContent(content) || !quizReadiness(content).ready) throw new Error("Complete the quiz readiness checks before scoring a preview.");
  const questions = content.questions.map(q => {
    const selectedOptionId = q.options.some(o => o.id === answers[q.id]) ? answers[q.id] : null;
    const correct = selectedOptionId !== null && selectedOptionId === q.correctOptionId;
    return { questionId: q.id, correct, selectedOptionId, points: correct ? q.points! : 0 };
  });
  const totalPoints = quizTotalPoints(content), earnedPoints = questions.reduce((sum, q) => sum + q.points, 0);
  return { questions, correct: questions.filter(q => q.correct).length, total: questions.length, earnedPoints, totalPoints, percent: Math.round(earnedPoints / totalPoints * 100) };
}
