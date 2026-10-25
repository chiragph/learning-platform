"use client";

import Link from "next/link";
import { useState } from "react";
import { challenges } from "@/app/lib/student/challenges";
import { findLab } from "@/app/lib/student/labs";
import { completePractice } from "@/app/lib/student/progress";
import { saveLabCheck } from "@/app/lib/student/activity-progress";
import type { Challenge, LabRequirementResult } from "@/app/lib/student/types";
import { PageHeading } from "./learning-overview";
import { CodeWorkspace } from "./code-workspace";
import { useProgress } from "./progress-provider";
import { useStudentPageEntry } from "./page-navigation";
import { ActivityBreadcrumb, ActivityNavigation } from "./activity-chrome";
import { StudentIcon } from "./student-icon";
import "./activities.css";

export function ChallengesIndex() {
  useStudentPageEntry();
  const { progress } = useProgress();
  const [subject, setSubject] = useState("all");
  return <><PageHeading eyebrow="CODING LABS" title="Put an idea into practice." description="Focused tasks, a coding workspace, and feedback on specific requirements. Find every lab in My Learning." /><label className="student-template-label" htmlFor="challenge-subject">Subject<select id="challenge-subject" value={subject} onChange={event => setSubject(event.target.value)}><option value="all">All subjects</option><option value="html">HTML</option><option value="css">CSS</option><option value="javascript">JavaScript</option></select></label><div className="student-grid two">{challenges.filter(challenge => subject === "all" || challenge.subject === subject).map(challenge => <article className="student-card" key={challenge.id}><span className={"student-tag " + challenge.subject}>{challenge.subject.toUpperCase()} · {challenge.difficulty}</span><h2>{challenge.title}</h2><p className="student-muted">{challenge.expected}</p><p className="student-muted">{progress.challenges.includes(challenge.id) ? "Completed" : progress.labChecks?.[challenge.id] ? "Checked " + progress.labChecks[challenge.id].attempts + " times" : "Task-specific solution checks"}</p><Link href={"/challenges/" + challenge.id} className="student-button secondary">Open lab<StudentIcon name="arrow" /></Link></article>)}</div></>;
}
export function ChallengeView({ challenge }: { challenge: Challenge }) {
  useStudentPageEntry();
  const { progress, update } = useProgress();
  const [verified, setVerified] = useState(false), [notice, setNotice] = useState("");
  const done = progress.challenges.includes(challenge.id), lab = findLab(challenge.id);
  function checked(requirements: LabRequirementResult[]) {
    const saved = update(p => saveLabCheck(p, challenge.id, requirements, new Date().toISOString()));
    setVerified(saved && requirements.every(requirement => requirement.passed));
    setNotice(saved ? "Check results saved. Code drafts are saved separately." : "Checks ran, but their results could not be saved. Retry Check Solution before completing the lab.");
  }
  return <div className="student-interactive-activity"><ActivityBreadcrumb activityId={"exercise:" + challenge.id} /><PageHeading eyebrow={challenge.subject.toUpperCase() + " LAB · " + challenge.difficulty.toUpperCase()} title={challenge.title} description={lab?.objective ?? challenge.instructions} /><div className="student-activity-summary"><span><StudentIcon name="code" />Coding lab</span><span>{progress.labChecks?.[challenge.id]?.attempts ?? 0} saved checks</span><span className="student-activity-state" data-complete={done}>{done ? "Completed" : progress.labChecks?.[challenge.id] ? "In progress · Checked" : "Ready to practice"}</span></div>
    <section className="student-activity-task"><h2>Your task</h2><p>{challenge.instructions}</p><p className="student-muted">Expected outcome: {challenge.expected}</p>{lab && <details className="student-lab-requirements"><summary>What Check Solution looks for · {lab.requirements.length} requirements</summary><ul>{lab.requirements.map(requirement => <li key={requirement.id}><strong>{requirement.title}</strong><p>{requirement.help}</p></li>)}</ul></details>}<details className="student-hint"><summary>Need a hint?</summary><p>{challenge.hint}</p></details></section>
    <CodeWorkspace key={challenge.id} workspaceId={"challenge-" + challenge.id} starter={challenge.starter} initialLanguage={challenge.subject} imageScope="lab" lab={lab} onLabChecked={checked} onWorkspaceChange={() => { setVerified(false); setNotice(""); }} />
    <section className="student-activity-completion"><div><h2>{done ? "Lab completed" : "Finish this lab"}</h2><p>{done ? "Your completion is saved. You can keep experimenting and checking your solution." : verified ? "The current code passed the listed requirements. Complete the lab to update your curriculum." : "Use Check Solution and pass every listed requirement, then record your completion."}</p></div><button className="student-button" disabled={done || !verified} onClick={() => { if (verified && update(p => completePractice(p, "challenges", challenge.id, new Date().toISOString()))) setNotice("Lab completed. Your curriculum progress is updated. Save Draft to keep your latest code."); }}>{done ? "Completion saved" : "Complete lab"}<StudentIcon name="check" /></button><p role="status" className="student-activity-notice">{notice}</p></section><ActivityNavigation activityId={"exercise:" + challenge.id} />
  </div>;
}
