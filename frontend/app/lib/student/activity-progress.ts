import { quizzes, scoreQuiz } from "./quizzes";
import { quizAnswers, validRecordTime } from "./activity-records";
import { projects } from "./projects";
import { findLab, validLabResults } from "./labs";
import { completePractice, recordActivity, saveQuiz } from "./progress";
import type { LabRequirementResult, Progress, QuizAttempt, Subject } from "./types";

export function saveQuizSession(progress: Progress, subject: Subject, answers: Record<string, number>, index: number, at: string): Progress {
  if (!Object.prototype.hasOwnProperty.call(quizzes, subject)) return progress;
  const questions = quizzes[subject];
  if (!questions || !validRecordTime(at) || !Number.isInteger(index) || index < 0 || index >= questions.length) return progress;
  return { ...progress, quizSessions: { ...progress.quizSessions, [subject]: { answers: quizAnswers(questions, answers), index, at } } };
}
export function submitQuizAttempt(progress: Progress, subject: Subject, attempt: Pick<QuizAttempt, "id" | "answers" | "at">): Progress {
  if (!Object.prototype.hasOwnProperty.call(quizzes, subject)) return progress;
  const questions = quizzes[subject];
  if (!questions || !attempt.id || attempt.id.length > 100 || !validRecordTime(attempt.at) || (progress.quizHistory?.[subject] ?? []).some(item => item.id === attempt.id)) return progress;
  const answers = quizAnswers(questions, attempt.answers);
  if (Object.keys(answers).length !== questions.length) return progress;
  const score = scoreQuiz(questions, answers);
  const next = saveQuiz(progress, subject, score.percent, attempt.at);
  const sessions = { ...progress.quizSessions }; delete sessions[subject];
  return { ...next, quizSessions: sessions, quizHistory: { ...progress.quizHistory, [subject]: [{ id: attempt.id, at: attempt.at, answers, ...score }, ...(progress.quizHistory?.[subject] ?? [])].slice(0, 20) } };
}
export function saveLabCheck(progress: Progress, id: string, requirements: LabRequirementResult[], at: string): Progress {
  const lab = findLab(id);
  if (!lab || !validRecordTime(at) || !validLabResults(lab, requirements)) return progress;
  const passed = requirements.every(requirement => requirement.passed);
  const next = { ...progress, labChecks: { ...progress.labChecks, [id]: { at, attempts: (progress.labChecks?.[id]?.attempts ?? 0) + 1, passed, requirements: requirements.map(({ id, passed }) => ({ id, passed })) } } };
  return recordActivity(next, `Lab check ${passed ? "passed" : "reviewed"}: ${lab.objective}`, `/challenges/${id}`, at);
}
export function selectWorkshopStep(progress: Progress, id: string, stepId: string, at: string): Progress {
  const project = projects.find(project => project.id === id);
  if (!project?.steps.some(step => step.id === stepId) || !validRecordTime(at)) return progress;
  return { ...progress, workshops: { ...progress.workshops, [id]: { completedSteps: progress.workshops?.[id]?.completedSteps ?? [], currentStep: stepId, at } } };
}
export function setWorkshopStep(progress: Progress, id: string, stepId: string, checked: boolean, at: string): Progress {
  const project = projects.find(project => project.id === id);
  if (!project || !validRecordTime(at) || !project.steps.some(step => step.id === stepId)) return progress;
  const steps = [...project.steps].sort((a, b) => a.order - b.order), old = progress.workshops?.[id]?.completedSteps ?? [];
  const completedSteps = steps.filter(step => step.id === stepId ? checked : old.includes(step.id)).map(step => step.id);
  const index = steps.findIndex(step => step.id === stepId);
  const currentStep = checked ? [...steps.slice(index + 1), ...steps.slice(0, index + 1)].find(step => !completedSteps.includes(step.id))?.id ?? stepId : stepId;
  const next = { ...progress, workshops: { ...progress.workshops, [id]: { completedSteps, currentStep, at } } };
  return old.includes(stepId) === checked ? next : recordActivity(next, `${checked ? "Reviewed" : "Reopened"} step: ${project.title} — ${steps[index].title}`, `/projects/${id}`, at);
}
export function completeWorkshop(progress: Progress, id: string, at: string): Progress {
  const project = projects.find(project => project.id === id);
  if (!project?.steps.length || !validRecordTime(at) || !project.steps.every(step => progress.workshops?.[id]?.completedSteps.includes(step.id))) return progress;
  return completePractice(progress, "projects", id, at);
}
