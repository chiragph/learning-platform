import { quizzes, scoreQuiz } from "./quizzes";
import { projects } from "./projects";
import { findLab, validLabResults } from "./labs";
import type { Progress, Question, QuizAttempt } from "./types";

const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
export const validRecordTime = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));
export function quizAnswers(questions: Question[], value: unknown) {
  const answers: Record<string, number> = {};
  if (record(value)) for (const question of questions) {
    const answer = value[question.id];
    if (typeof answer === "number" && Number.isInteger(answer) && answer >= 0 && answer < question.options.length) answers[question.id] = answer;
  }
  return answers;
}
export function normalizeActivityRecords(value: Record<string, unknown>) {
  const result: Required<Pick<Progress, "quizHistory" | "quizSessions" | "labChecks" | "workshops">> = { quizHistory: {}, quizSessions: {}, labChecks: {}, workshops: {} };
  for (const [subject, questions] of Object.entries(quizzes)) {
    const history = record(value.quizHistory) ? value.quizHistory[subject] : undefined;
    if (Array.isArray(history)) {
      const attempts: QuizAttempt[] = [];
      for (const item of history.slice(0, 20)) {
        if (!record(item) || typeof item.id !== "string" || !item.id || item.id.length > 100 || !validRecordTime(item.at) || attempts.some(attempt => attempt.id === item.id)) continue;
        const answers = quizAnswers(questions, item.answers);
        if (Object.keys(answers).length === questions.length) attempts.push({ id: item.id, at: item.at, answers, ...scoreQuiz(questions, answers) });
      }
      if (attempts.length) result.quizHistory[subject] = attempts;
    }
    const session = record(value.quizSessions) ? value.quizSessions[subject] : undefined;
    if (record(session) && validRecordTime(session.at) && typeof session.index === "number" && Number.isInteger(session.index) && session.index >= 0 && session.index < questions.length) result.quizSessions[subject] = { answers: quizAnswers(questions, session.answers), index: session.index, at: session.at };
  }
  if (record(value.labChecks)) for (const [id, item] of Object.entries(value.labChecks)) {
    const lab = findLab(id);
    if (!lab || !record(item) || typeof item.attempts !== "number" || !Number.isSafeInteger(item.attempts) || item.attempts < 1 || !validRecordTime(item.at) || !validLabResults(lab, item.requirements)) continue;
    result.labChecks[id] = { attempts: item.attempts, at: item.at, passed: item.requirements.every(requirement => requirement.passed), requirements: item.requirements.map(({ id, passed }) => ({ id, passed })) };
  }
  if (record(value.workshops)) for (const project of projects) {
    const item = value.workshops[project.id];
    if (!record(item) || !validRecordTime(item.at) || !Array.isArray(item.completedSteps)) continue;
    const steps = [...project.steps].sort((a, b) => a.order - b.order);
    if (!steps.length) continue;
    const completedSteps = steps.filter(step => (item.completedSteps as unknown[]).includes(step.id)).map(step => step.id);
    result.workshops[project.id] = { completedSteps, currentStep: steps.find(step => step.id === item.currentStep)?.id ?? (steps.find(step => !completedSteps.includes(step.id)) ?? steps[0]).id, at: item.at };
  }
  return result;
}
