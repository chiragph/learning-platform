"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { courses } from "@/app/lib/student/courses";
import { quizzes, scoreQuiz } from "@/app/lib/student/quizzes";
import { saveQuiz } from "@/app/lib/student/progress";
import type { Subject } from "@/app/lib/student/types";
import { PageHeading } from "./learning-overview";
import { useProgress } from "./progress-provider";

export function QuizzesIndex() {
  const { progress } = useProgress();
  return <><PageHeading title="Check your understanding." description="Topic-based questions with explanations after submission. Reach 70% to complete the quiz unit for a course." /><div className="student-grid">{courses.map((course) => <article className="student-card" key={course.id}><span className={`student-tag ${course.id}`}>{course.id.toUpperCase()}</span><h2>{course.title} quiz</h2><p className="student-muted">{quizzes[course.id].length} questions · Four options per question</p><p className="student-muted">{progress.quizzes[course.id] ? `Latest: ${progress.quizzes[course.id].latest}% · Best: ${progress.quizzes[course.id].best}%` : "No attempts yet"}</p><Link className="student-button" href={`/quizzes/${course.id}`}>Start quiz →</Link></article>)}</div></>;
}
export function QuizView({ subject }: { subject: Subject }) {
  const questions = quizzes[subject];
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [notice, setNotice] = useState("");
  const question = questions[index];
  const heading = useRef<HTMLHeadingElement>(null);
  const resultsHeading = useRef<HTMLHeadingElement>(null);
  const { progress, update } = useProgress();
  const result = submitted ? scoreQuiz(questions, answers) : null;
  function go(next: number) { setIndex(next); requestAnimationFrame(() => heading.current?.focus()); }
  function submit() {
    const missing = questions.findIndex((q) => answers[q.id] === undefined);
    if (missing !== -1) { setNotice("Answer every question before submitting. Your first unanswered question is shown."); go(missing); return; }
    const score = scoreQuiz(questions, answers);
    setSubmitted(true); setNotice("");
    update((p) => saveQuiz(p, subject, score.percent, new Date().toISOString()));
    requestAnimationFrame(() => resultsHeading.current?.focus());
  }
  return <><Link className="student-link" href="/quizzes">← All quizzes</Link><PageHeading eyebrow={`${subject.toUpperCase()} QUIZ`} title="Put your knowledge to the test." description="Take your time. Answers and explanations appear after you submit the entire quiz." />
    {result ? <section><div className="student-card"><h2 ref={resultsHeading} tabIndex={-1}>You scored {result.percent}%</h2><p>{result.correct} of {result.total} correct. {result.percent >= 70 ? "Quiz unit completed." : "Review the explanations and try again when you are ready."}</p><p className="student-muted">Saved best: {progress.quizzes[subject]?.best ?? "—"}%</p><button className="student-button" onClick={() => { setAnswers({}); setSubmitted(false); setIndex(0); requestAnimationFrame(() => heading.current?.focus()); }}>Retry quiz</button></div><ol className="student-section student-list">{questions.map((q) => <li className="student-card" key={q.id}><span className="student-tag">{answers[q.id] === q.correct ? "✓ Correct" : "Incorrect"} · {q.topic}</span><h3>{q.prompt}</h3><p>Your answer: {q.options[answers[q.id]]}</p><p>Correct answer: {q.options[q.correct]}</p><p className="student-muted">{q.explanation}</p></li>)}</ol></section> : <section className="student-card student-quiz"><div className="student-row"><span className="student-tag">{question.topic}</span><span className="student-muted">Question {index + 1} of {questions.length}</span></div><fieldset><legend><h2 ref={heading} tabIndex={-1}>{question.prompt}</h2></legend><div className="student-quiz-options">{question.options.map((option, optionIndex) => <label key={option} className={answers[question.id] === optionIndex ? "selected" : ""}><input type="radio" name={question.id} value={optionIndex} checked={answers[question.id] === optionIndex} onChange={() => { setAnswers((a) => ({ ...a, [question.id]: optionIndex })); setNotice(""); }} /><span>{option}</span></label>)}</div></fieldset><p role="status" className="student-error">{notice}</p><div className="student-row student-section"><button className="student-button secondary" disabled={index === 0} onClick={() => go(index - 1)}>← Previous</button>{index < questions.length - 1 ? <button className="student-button" onClick={() => go(index + 1)}>Next question →</button> : <button className="student-button" onClick={submit}>Submit quiz</button>}</div><nav aria-label="Quiz questions" className="student-question-nav">{questions.map((q, i) => <button key={q.id} aria-label={`Question ${i + 1}, ${answers[q.id] === undefined ? "unanswered" : "answered"}`} aria-current={index === i ? "step" : undefined} className="student-button secondary" onClick={() => go(i)}>{i + 1}{answers[q.id] !== undefined && <span aria-hidden="true">·</span>}</button>)}</nav></section>}
  </>;
}
