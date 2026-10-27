"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import { publishedActivities } from "@/app/lib/learning/catalog";
import { quizzes } from "@/app/lib/student/quizzes";
import { saveQuizSession } from "@/app/lib/student/activity-progress";
import type { QuizAttempt, Subject } from "@/app/lib/student/types";
import { PageHeading } from "./learning-overview";
import { useProgress } from "./progress-provider";
import { useStudentPageEntry } from "./page-navigation";
import { ActivityBreadcrumb, ActivityNavigation } from "./activity-chrome";
import { ActivityConfirmDialog } from "./activity-confirm-dialog";
import { StudentIcon } from "./student-icon";
import "./activities.css";

export function QuizzesIndex() {
  useStudentPageEntry();
  const { progress } = useProgress();
  return <><PageHeading eyebrow="QUIZZES" title="Check your understanding." description="One question at a time, with explanations after submission. A best score of 70% completes the curriculum activity." /><div className="student-grid">{Object.keys(quizzes).map(id => { const course = {id: id as Subject, title: publishedActivities.get("quiz:" + id)?.title ?? id};
    const saved = progress.quizzes[course.id], session = progress.quizSessions?.[course.id];
    return <article className="student-card" key={course.id}><span className={"student-tag " + course.id}>{course.id.toUpperCase()}</span><h2>{course.title} quiz</h2><p className="student-muted">{quizzes[course.id].length} questions · {session ? "Unfinished attempt saved" : saved ? saved.best >= 70 ? "Passed · Curriculum completed" : "Attempted · Not passed yet" : "Not attempted"}</p><p className="student-muted">{saved ? "Latest " + saved.latest + "% · Best " + saved.best + "% · " + saved.attempts + " attempts" : "Your answers are saved to your account."}</p><Link className="student-button secondary" href={"/quizzes/" + course.id}>{session ? "Resume quiz" : saved ? "Review or retry" : "Start quiz"}<StudentIcon name="arrow" /></Link></article>;
  })}</div></>;
}

export function QuizView({ subject }: { subject: Subject }) {
  useStudentPageEntry();
  const { progress, update, submitQuiz } = useProgress();
  const published = publishedActivities.get("quiz:" + subject);
  const baseQuestions = quizzes[subject], session = progress.quizSessions?.[subject];
  const [index, setIndex] = useState(session?.index ?? 0);
  const [answers, setAnswers] = useState<Record<string, number>>(session?.answers ?? {});
  const [result, setResult] = useState<QuizAttempt | null>(() => session ? null : progress.quizHistory?.[subject]?.[0] ?? null);
  const [confirm, setConfirm] = useState(false);
  const [notice, setNotice] = useState("");
  const [saved, setSaved] = useState(true);
  const [focusRequest, setFocusRequest] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null), resultsHeading = useRef<HTMLHeadingElement>(null);
  const submitting = useRef(false), attemptKey = useRef(crypto.randomUUID());
  const questions = result?.review ?? baseQuestions;
  const question = questions[index], aggregate = progress.quizzes[subject];
  const answered = questions.filter(question => answers[question.id] !== undefined).length;
  useLayoutEffect(() => { if (focusRequest) { const target = (result ? resultsHeading : heading).current; target?.focus({ preventScroll: true }); target?.scrollIntoView({ block: "start", behavior: "instant" }); } }, [focusRequest, result]);
  function persist(nextAnswers: Record<string, number>, nextIndex: number) {
    const ok = update(p => saveQuizSession(p, subject, nextAnswers, nextIndex, new Date().toISOString()));
    setNotice(ok ? "Answers saved for this account." : "Answers are in this open page but could not be saved. Keep this page open and retry.");
  }
  function go(next: number) { setIndex(next); persist(answers, next); setFocusRequest(value => value + 1); }
  function requestSubmit() {
    const missing = questions.findIndex(question => answers[question.id] === undefined);
    if (missing !== -1) { setIndex(missing); setNotice("Answer every question before submitting. Your first unanswered question is shown."); setFocusRequest(value => value + 1); return; }
    setConfirm(true);
  }
  async function submit() {
    if (submitting.current) return;
    submitting.current = true;
    try { const attempt = await submitQuiz(subject, answers, attemptKey.current); setResult(attempt); setSaved(true); setConfirm(false); setNotice("Attempt saved. Review the explanations below."); setFocusRequest(value => value + 1); }
    catch(e) { setNotice(e instanceof Error ? e.message : "Unable to submit."); setConfirm(false); }
    finally { submitting.current = false; }
  }

  function retry() {
    if (!update(p => saveQuizSession(p, subject, {}, 0, new Date().toISOString()))) { setNotice("A new attempt could not be saved. Free browser storage and try again."); return; }
    submitting.current = false; attemptKey.current = crypto.randomUUID(); setAnswers({}); setIndex(0); setResult(null); setNotice("New attempt started. Your previous attempts and best score are kept."); setFocusRequest(value => value + 1);
  }
  return <div className="student-interactive-activity student-quiz-page"><ActivityBreadcrumb activityId={"quiz:" + subject} /><PageHeading eyebrow={(published?.courseTitle ?? subject).toUpperCase() + " QUIZ"} title={published?.title ?? "Put your knowledge to the test."} description={published?.instructions ?? "Choose an answer, revisit any question, and submit when ready. A score of 70% passes this quiz."} />
    <div className="student-activity-summary"><span><StudentIcon name="quiz" />{questions.length} questions</span><span>{aggregate ? aggregate.attempts + " saved attempts · Best " + aggregate.best + "%" : "No submitted attempts"}</span><span className="student-activity-state" data-complete={(aggregate?.best ?? 0) >= 70}>{(aggregate?.best ?? 0) >= 70 ? "Curriculum completed" : aggregate ? "Attempted · Not passed" : "Not completed"}</span></div>
    {result ? <section aria-label="Quiz results"><div className="student-quiz-result"><div><p className="student-kicker">{result.percent >= 70 ? "PASSED" : "ATTEMPTED · NOT PASSED"}</p><h2 ref={resultsHeading} tabIndex={-1}>You scored {result.percent}%</h2><p>{result.correct} of {result.total} correct. {result.percent >= 70 ? "You reached the passing score." : "Review the explanations and try again when you are ready."}</p><p className="student-muted">{(aggregate?.best ?? 0) >= 70 ? "Your passing best score keeps this curriculum activity completed, including after a lower retry score." : "The quiz activity completes when a saved attempt reaches 70%."}</p></div><div className="student-quiz-result-actions">{session && saved && <button className="student-button secondary" onClick={() => { setResult(null); setNotice("Resumed your unfinished quiz."); setFocusRequest(value => value + 1); }}>Resume unfinished quiz</button>}{!saved && <button className="student-button" onClick={() => { void submit(); }}>Retry saving attempt</button>}<button className="student-button secondary" disabled={!saved} onClick={retry}>Retry quiz<StudentIcon name="arrow" /></button></div></div><p className="student-activity-notice" role="status">{notice}</p><ol className="student-quiz-review">{questions.map((question, index) => <li key={question.id} data-correct={result.answers[question.id] === question.correct}><span className="student-quiz-review-number">{index + 1}</span><div><span className="student-tag">{result.answers[question.id] === question.correct ? "Correct" : "Incorrect"} · {question.topic}</span><h3>{question.prompt}</h3><p>Your answer: {question.options[result.answers[question.id]]}</p><p className="student-quiz-correct-answer">Correct answer: {question.options[question.correct]}</p><p className="student-muted">{question.explanation}</p></div></li>)}</ol></section> : <section className="student-quiz-question"><div className="student-row"><span className="student-tag">{question.topic}</span><span>Question {index + 1} of {questions.length}</span></div><div className="student-quiz-answer-progress"><progress className="student-progress" max={questions.length} value={answered} aria-label="Questions answered" /><span>{answered}/{questions.length} answered</span></div><fieldset><legend><h2 ref={heading} tabIndex={-1}>{question.prompt}</h2></legend><div className="student-quiz-options">{question.options.map((option, optionIndex) => <label key={option} className={answers[question.id] === optionIndex ? "selected" : ""}><input type="radio" name={question.id} value={optionIndex} checked={answers[question.id] === optionIndex} onChange={() => { const next = { ...answers, [question.id]: optionIndex }; setAnswers(next); persist(next, index); }} /><span className="student-quiz-option-letter" aria-hidden="true">{String.fromCharCode(65 + optionIndex)}</span><span>{option}</span></label>)}</div></fieldset><p role="status" className="student-activity-notice">{notice}</p><div className="student-row student-quiz-question-actions"><button className="student-button secondary" disabled={index === 0} onClick={() => go(index - 1)}>← Previous</button><div>{index < questions.length - 1 && <button className="student-button secondary" onClick={() => go(index + 1)}>Next question →</button>}<button className="student-button" onClick={requestSubmit}>Review & submit</button></div></div><nav aria-label="Quiz questions" className="student-question-nav">{questions.map((question, i) => <button key={question.id} aria-label={"Question " + (i + 1) + ", " + (answers[question.id] === undefined ? "unanswered" : "answered")} aria-current={index === i ? "step" : undefined} className="student-button secondary" onClick={() => go(i)}>{i + 1}{answers[question.id] !== undefined && <StudentIcon name="check" />}</button>)}</nav></section>}
    {(progress.quizHistory?.[subject]?.length ?? 0) > 0 && <details className="student-quiz-history"><summary>Saved attempts ({aggregate?.attempts ?? 0})</summary><ul>{progress.quizHistory![subject].map((attempt, index) => <li key={attempt.id}><span>Saved attempt · {new Date(attempt.at).toLocaleDateString()}</span><strong>{attempt.percent}% · {attempt.percent >= 70 ? "Passed" : "Not passed"}</strong><button className="student-text-action" disabled={!saved} onClick={() => { setResult(attempt); setSaved(true); setNotice("Reviewing a saved attempt. Any unfinished quiz remains saved."); setFocusRequest(value => value + 1); }}>Review answers<span className="sr-only"> for saved attempt {index + 1}</span></button></li>)}</ul><p>Answer details are kept for the most recent 20 submissions. Earlier demo attempts retain their total count and best score.</p></details>}
    {confirm && <ActivityConfirmDialog title="Submit your quiz?" confirmLabel="Submit quiz" onConfirm={submit} onCancel={() => setConfirm(false)}><p>You answered all {questions.length} questions. Submitting records an attempt and reveals the correct answers and explanations.</p><p>You can retry afterward; your best score is kept.</p></ActivityConfirmDialog>}
    <ActivityNavigation activityId={"quiz:" + subject} />
  </div>;
}
