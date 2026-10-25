"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import { projects } from "@/app/lib/student/projects";
import { completeWorkshop, selectWorkshopStep, setWorkshopStep } from "@/app/lib/student/activity-progress";
import type { Project } from "@/app/lib/student/types";
import { PageHeading } from "./learning-overview";
import { CodeWorkspace } from "./code-workspace";
import { useProgress } from "./progress-provider";
import { useStudentPageEntry } from "./page-navigation";
import { ActivityBreadcrumb, ActivityNavigation } from "./activity-chrome";
import { StudentIcon } from "./student-icon";
import "./activities.css";

export function ProjectsIndex() {
  useStudentPageEntry();
  const { progress } = useProgress();
  return <><PageHeading eyebrow="GUIDED WORKSHOPS" title="Build something, step by step." description="Bring your skills together in a mini-project. Your steps and code drafts are saved separately for this account." /><div className="student-grid two">{projects.map(project => <article className="student-card" key={project.id}><span className="student-tag">WORKSHOP · {project.difficulty}</span><h2>{project.title}</h2><p className="student-muted">{project.overview}</p><p className="student-muted">{progress.projects.includes(project.id) ? "Completed · Self-reviewed" : (progress.workshops?.[project.id]?.completedSteps.length ?? 0) + "/" + project.steps.length + " steps reviewed"}{progress.drafts["project-" + project.id] ? " · Draft saved" : ""}</p><Link className="student-button secondary" href={"/projects/" + project.id}>{progress.projects.includes(project.id) ? "Revisit workshop" : progress.workshops?.[project.id] || progress.drafts["project-" + project.id] ? "Resume workshop" : "Start workshop"}<StudentIcon name="arrow" /></Link></article>)}</div></>;
}
export function ProjectView({ project }: { project: Project }) {
  useStudentPageEntry();
  const { progress, update } = useProgress();
  const [reviewed, setReviewed] = useState(false), [dirty, setDirty] = useState(false), [notice, setNotice] = useState(""), [focusRequest, setFocusRequest] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const steps = [...project.steps].sort((a, b) => a.order - b.order), record = progress.workshops?.[project.id];
  const current = steps.find(step => step.id === record?.currentStep) ?? steps[0], index = steps.indexOf(current);
  const completedSteps = record?.completedSteps ?? [], done = progress.projects.includes(project.id), allReviewed = steps.every(step => completedSteps.includes(step.id));
  useLayoutEffect(() => { if (focusRequest) { heading.current?.focus({ preventScroll: true }); heading.current?.scrollIntoView({ block: "nearest", behavior: "instant" }); } }, [focusRequest]);
  function go(stepId: string) {
    if (update(p => selectWorkshopStep(p, project.id, stepId, new Date().toISOString()))) { setNotice("Your workshop place is saved."); setFocusRequest(value => value + 1); }
    else setNotice("Your workshop place could not be saved. Previous records are unchanged.");
  }
  function mark(checked: boolean) {
    if (update(p => setWorkshopStep(p, project.id, current.id, checked, new Date().toISOString()))) { setReviewed(false); setNotice(checked ? "Step reviewed and saved. Continue with any step." : "Step reopened. Workshop completion is a separate action."); setFocusRequest(value => value + 1); }
    else setNotice("The step could not be saved. Your previous progress is unchanged.");
  }
  return <div className="student-interactive-activity"><ActivityBreadcrumb activityId={"project:" + project.id} /><PageHeading eyebrow={"GUIDED WORKSHOP · " + project.difficulty.toUpperCase()} title={project.title} description={project.overview} /><div className="student-activity-summary"><span><StudentIcon name="project" />{completedSteps.length}/{steps.length} steps reviewed</span><span>{progress.drafts["project-" + project.id] ? "Saved code draft available" : "Save Draft to keep your code"}</span><span className="student-activity-state" data-complete={done}>{done ? "Completed · Self-reviewed" : record ? "In progress" : "Ready to build"}</span></div>
    <details className="student-workshop-objectives"><summary>What you will build and practice</summary><ul>{project.objectives.map(objective => <li key={objective}>{objective}</li>)}</ul><p>Work through the steps, then test the finished project in the preview. Workshop completion records your own review; it is not an automated grade.</p></details>
    {done && !record && <p className="student-notice">Your earlier project completion is preserved. Step-by-step records were not collected for that completion; you can revisit every step below.</p>}
    <section className="student-workshop-guide" aria-label="Workshop guide"><div className="student-workshop-step-list"><div className="student-row"><h2>Your steps</h2><span>{Math.round(completedSteps.length / steps.length * 100)}%</span></div><progress className="student-progress" value={completedSteps.length} max={steps.length} aria-label="Workshop steps reviewed" /><nav aria-label="Workshop steps"><ol>{steps.map((step, stepIndex) => <li key={step.id}><button aria-current={step.id === current.id ? "step" : undefined} onClick={() => go(step.id)}><span>{completedSteps.includes(step.id) ? <StudentIcon name="check" /> : stepIndex + 1}</span><strong>{step.title}</strong><span className="sr-only">{completedSteps.includes(step.id) ? ", reviewed" : ", not reviewed"}</span></button></li>)}</ol></nav></div><div className="student-workshop-step"><p className="student-kicker">STEP {index + 1} OF {steps.length}</p><h2 ref={heading} tabIndex={-1}>{current.title}</h2><p>{current.instruction}</p><p className="student-muted">Implement this step in the workspace below. Run the preview and review the result. Every step remains accessible.</p><div className="student-workshop-step-actions"><button className="student-button" disabled={done} onClick={() => mark(!completedSteps.includes(current.id))}>{completedSteps.includes(current.id) ? "Reopen this step" : "Mark step reviewed"}<StudentIcon name="check" /></button><div><button className="student-button secondary" disabled={index === 0} onClick={() => go(steps[index - 1].id)}>← Previous</button><button className="student-button secondary" disabled={index === steps.length - 1} onClick={() => go(steps[index + 1].id)}>Next →</button></div></div></div></section>
    <p className="student-workshop-save-note">Step progress saves as you go. Use Save Draft to save your HTML, CSS, JavaScript, and resume your code later. Run starts a fresh preview; runtime form values and task lists are not saved.</p>
    <CodeWorkspace key={project.id} workspaceId={"project-" + project.id} starter={project.starter} imageScope="workshop" onDirtyChange={setDirty} onWorkspaceChange={() => setReviewed(false)} />
    <section className="student-activity-completion student-workshop-finish"><div><h2>{done ? "Workshop completed" : "Review your finished project"}</h2><p>{done ? "Your self-reviewed completion is saved. The workspace and every guide step remain available." : "Review every step, save any code changes, and test the final result at narrow and wide widths."}</p></div>{!done && <label className="student-check"><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} />I tested my project and reviewed its outcome against all the workshop steps.</label>}<button className="student-button" disabled={done || !allReviewed || !reviewed || dirty} onClick={() => { if (allReviewed && reviewed && !dirty && update(p => completeWorkshop(p, project.id, new Date().toISOString()))) setNotice("Workshop completed. Your curriculum progress is updated."); }}>{done ? "Self-reviewed completion saved" : "Complete workshop"}<StudentIcon name="check" /></button>{!done && <p className="student-muted">{dirty ? "Save Draft before completing to keep your latest code." : !allReviewed ? "Review and mark all " + steps.length + " guide steps before completing." : !reviewed ? "Confirm your final review to complete the workshop." : "Ready to record your self-reviewed completion."}</p>}<p role="status" className="student-activity-notice">{notice}</p></section><ActivityNavigation activityId={"project:" + project.id} />
  </div>;
}
