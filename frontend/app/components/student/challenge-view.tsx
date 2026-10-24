"use client";

import Link from "next/link";
import { useState } from "react";
import { challenges } from "@/app/lib/student/challenges";
import { completePractice } from "@/app/lib/student/progress";
import type { Challenge } from "@/app/lib/student/types";
import { PageHeading } from "./learning-overview";
import { CodeWorkspace } from "./code-workspace";
import { useProgress } from "./progress-provider";

export function ChallengesIndex() {
  const { progress } = useProgress();
  const [subject, setSubject] = useState("all");
  return <><PageHeading title="Small challenges. Real practice." description="Apply one idea at a time. Some exercises have basic checks; visual and open-ended exercises are self-reviewed." /><label className="student-template-label" htmlFor="challenge-subject">Subject<select id="challenge-subject" value={subject} onChange={(e) => setSubject(e.target.value)}><option value="all">All subjects</option><option value="html">HTML</option><option value="css">CSS</option><option value="javascript">JavaScript</option></select></label><div className="student-grid two">{challenges.filter((c) => subject === "all" || c.subject === subject).map((challenge) => <article className="student-card" key={challenge.id}><span className={`student-tag ${challenge.subject}`}>{challenge.subject.toUpperCase()} · {challenge.difficulty}</span><h2>{challenge.title}</h2><p className="student-muted">{challenge.expected}</p><p className="student-muted">{progress.challenges.includes(challenge.id) ? "✓ Completed" : challenge.check ? "Basic automatic checks" : "Self-reviewed practice"}</p><Link href={`/challenges/${challenge.id}`} className="student-button secondary">Open challenge →</Link></article>)}</div></>;
}
export function ChallengeView({ challenge }: { challenge: Challenge }) {
  const { progress, update } = useProgress();
  const [passed, setPassed] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [notice, setNotice] = useState("");
  const done = progress.challenges.includes(challenge.id);
  function complete() {
    if (!(challenge.check ? passed : reviewed)) return;
    const saved = update((p) => completePractice(p, "challenges", challenge.id, new Date().toISOString()));
    if (saved) setNotice("Challenge completion saved.");
  }
  return <><Link className="student-link" href="/challenges">← All challenges</Link><PageHeading eyebrow={`${challenge.subject.toUpperCase()} · ${challenge.difficulty.toUpperCase()}`} title={challenge.title} description={challenge.instructions} /><section className="student-card"><h2>Expected result</h2><p>{challenge.expected}</p><p className="student-muted mt-3">{challenge.check ? "Run performs only the basic checks described in the instructions. It is a learning aid, not full automated grading." : "Preview-based practice: review the result yourself. Completion is recorded as self-reviewed, not automatically verified."}</p><details className="student-hint"><summary>Need a hint?</summary><p>{challenge.hint}</p></details></section><CodeWorkspace workspaceId={`challenge-${challenge.id}`} starter={challenge.starter} check={challenge.check} onCheck={(valid) => { setPassed(valid); if (!valid) setReviewed(false); }} /><section className="student-card student-section"><h2>{done ? "✓ Challenge completed" : "Record your practice"}</h2>{!challenge.check && !done && <label className="student-check"><input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} />I have run the preview and reviewed it against the expected result.</label>}<p className="student-muted">{challenge.check ? passed ? "Basic checks passed for the current editor contents." : "Run your code and pass the basic checks before recording completion." : "Check narrow and wide previews, readability, and keyboard interactions where relevant."}</p><button className="student-button" disabled={done || !(challenge.check ? passed : reviewed)} onClick={complete}>{done ? "Completion saved" : challenge.check ? "Save checked completion" : "Mark as self-reviewed"}</button><p role="status">{notice}</p></section></>;
}
