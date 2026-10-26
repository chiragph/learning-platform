"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { quizReadiness, quizTotalPoints, scoreQuizPreview } from "../../lib/instructor/quiz";
import type { QuizContent, QuizPreviewResult } from "../../lib/instructor/quiz-types";
import { Empty, Icon } from "./ui";

export function QuizPreview({ content, context }: { content: QuizContent; context: string }) {
  const [answers, setAnswers] = useState<Record<string, string>>({}), [index, setIndex] = useState(0), [result, setResult] = useState<QuizPreviewResult | null>(null), [notice, setNotice] = useState(""), [focusRequest, setFocus] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null), resultsHeading = useRef<HTMLHeadingElement>(null), readiness = quizReadiness(content);
  const question = content.questions[index], answered = content.questions.filter(q => q.options.some(o => o.id === answers[q.id])).length;
  useLayoutEffect(() => { if (focusRequest) (result ? resultsHeading : heading).current?.focus(); }, [focusRequest, index, result]);
  function go(next: number) { setIndex(next); setNotice(""); setFocus(v => v + 1); }
  function submit() {
    if (!readiness.ready) return;
    const missing = content.questions.findIndex(q => !q.options.some(o => o.id === answers[q.id]));
    if (missing >= 0) { setIndex(missing); setNotice("Answer every question before submitting. The first unanswered question is shown."); setFocus(v => v + 1); return; }
    setResult(scoreQuizPreview(content, answers)); setNotice("Preview submitted. Nothing was written to student progress or your saved draft."); setFocus(v => v + 1);
  }
  function restart() { setAnswers({}); setIndex(0); setResult(null); setNotice("Preview restarted. Previous preview answers and results have been cleared."); setFocus(v => v + 1); }
  return <article className="ins-quiz-preview" aria-label="Isolated quiz preview"><header><p className="ins-eyebrow">STUDENT-STYLE QUIZ PREVIEW</p><p className="ins-reading-context">{context}</p><h1>{content.title.trim() || "Untitled quiz"}</h1><p className="ins-quiz-instructions">{content.instructions || "Instructions have not been added yet."}</p><div className="ins-quiz-summary"><span><Icon name="quiz" />{content.questions.length} questions</span><span>{quizTotalPoints(content)} available points</span><span>Preview only · No progress recorded</span></div></header>
    {!readiness.ready && <p className="ins-notice warning">Incomplete Draft. You can inspect the questions below. Complete the readiness checklist before answering or scoring a preview.</p>}
    {!question && !result ? <Empty title="Add your first quiz question">Return to the editor to add questions and answer options.</Empty> : result ? <section aria-label="Preview results"><div className="ins-quiz-score"><div><p className="ins-eyebrow">PREVIEW RESULT</p><h2 ref={resultsHeading} tabIndex={-1}>You scored {result.percent}%</h2><p>{result.earnedPoints} / {result.totalPoints} points · {result.correct} of {result.total} questions correct</p></div><button type="button" className="ins-button secondary" onClick={restart}>Restart Preview<Icon name="arrow" /></button></div><ol className="ins-quiz-review">{content.questions.map((q, i) => {
      const reviewed = result.questions[i];
      return <li key={q.id} data-correct={reviewed.correct}><span className="ins-quiz-review-number">{i + 1}</span><div><strong>{reviewed.correct ? "Correct" : "Incorrect"} · {reviewed.points} / {q.points} points</strong><h3>{q.prompt}</h3><p>Your answer: {q.options.find(o => o.id === reviewed.selectedOptionId)?.text ?? "No valid answer"}</p><p className="ins-quiz-answer">Correct answer: {q.options.find(o => o.id === q.correctOptionId)?.text}</p>{q.explanation && <p>{q.explanation}</p>}</div></li>;
    })}</ol></section> : <section className="ins-quiz-attempt"><div className="ins-quiz-question-progress"><span>{question.topic || "Multiple choice"}</span><span>Question {index + 1} of {content.questions.length} · {question.points ?? "—"} points</span></div><div className="ins-quiz-answered"><progress max={content.questions.length} value={answered} aria-label="Preview questions answered" /><span>{answered}/{content.questions.length} answered</span></div><fieldset disabled={!readiness.ready}><legend><h2 ref={heading} tabIndex={-1}>{question.prompt || "Question text is missing."}</h2></legend><div className="ins-quiz-preview-options">{question.options.map((option, i) => <label key={option.id} className={answers[question.id] === option.id ? "selected" : ""}><input type="radio" name={`preview-${question.id}`} checked={answers[question.id] === option.id} onChange={() => { setAnswers({ ...answers, [question.id]: option.id }); setNotice(""); }} /><span aria-hidden="true">{String.fromCharCode(65 + i)}</span><span>{option.text || "Empty answer option"}</span></label>)}</div></fieldset><div className="ins-quiz-preview-actions"><button type="button" className="ins-button secondary" disabled={index === 0} onClick={() => go(index - 1)}>← Previous</button><div>{index < content.questions.length - 1 && <button type="button" className="ins-button secondary" onClick={() => go(index + 1)}>Next Question →</button>}<button type="button" className="ins-button" disabled={!readiness.ready} onClick={submit}>Submit Preview</button></div></div><nav className="ins-quiz-question-nav" aria-label="Preview questions">{content.questions.map((q, i) => <button type="button" key={q.id} aria-label={`Question ${i + 1}, ${answers[q.id] ? "answered" : "unanswered"}`} aria-current={index === i ? "step" : undefined} onClick={() => go(i)}>{i + 1}{answers[q.id] && <Icon name="check" />}</button>)}</nav></section>}
    <p className="ins-quiz-preview-notice" role="status">{notice}</p>
  </article>;
}
