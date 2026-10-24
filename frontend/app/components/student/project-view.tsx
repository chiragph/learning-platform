"use client";

import Link from "next/link";
import { useState } from "react";
import { projects } from "@/app/lib/student/projects";
import { completePractice } from "@/app/lib/student/progress";
import type { Project } from "@/app/lib/student/types";
import { PageHeading } from "./learning-overview";
import { CodeWorkspace } from "./code-workspace";
import { useProgress } from "./progress-provider";

export function ProjectsIndex() {
  const { progress } = useProgress();
  return <><PageHeading title="Turn your learning into something." description="Guided projects that connect HTML, CSS, and JavaScript. Save drafts locally and build at your own pace." /><div className="student-grid two">{projects.map((project, index) => <article className="student-card" key={project.id}><span className="student-tag">PROJECT {String(index + 1).padStart(2, "0")} · {project.difficulty}</span><h2>{project.title}</h2><p className="student-muted">{project.overview}</p><p className="student-muted mt-3">{progress.projects.includes(project.id) ? "✓ Self-reviewed completion" : progress.drafts[`project-${project.id}`] ? "Saved draft available" : "Ready to start"}</p><Link className="student-button secondary" href={`/projects/${project.id}`}>Open project →</Link></article>)}</div></>;
}
export function ProjectView({ project }: { project: Project }) {
  const { progress, update } = useProgress();
  const [reviewed, setReviewed] = useState(false);
  const [notice, setNotice] = useState("");
  const done = progress.projects.includes(project.id);
  function complete() {
    if (!reviewed) return;
    if (update((p) => completePractice(p, "projects", project.id, new Date().toISOString()))) setNotice("Project completion saved. Save your code draft separately to keep the latest edits.");
  }
  return <><Link className="student-link" href="/projects">← All projects</Link><PageHeading eyebrow={`GUIDED PROJECT · ${project.difficulty.toUpperCase()}`} title={project.title} description={project.overview} /><div className="student-grid two"><section className="student-card"><h2>What you will practice</h2><ul className="student-steps" style={{ listStyleType: "disc" }}>{project.objectives.map((objective) => <li key={objective}>{objective}</li>)}</ul><p className="student-muted mt-4">This project is self-reviewed. DECODE does not automatically grade its design or functionality.</p></section><section className="student-card"><h2>Build it step by step</h2><ol className="student-steps">{project.steps.map((step) => <li key={step}>{step}</li>)}</ol></section></div><CodeWorkspace workspaceId={`project-${project.id}`} starter={project.starter} onCheck={() => setReviewed(false)} /><section className="student-card student-section"><h2>{done ? "✓ Project completed" : "Review your project"}</h2><p className="student-muted">Run your code, follow every step, and test the result at narrow and wide widths. Save your draft before leaving.</p>{!done && <label className="student-check"><input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} />I have tested my project and reviewed it against the instructions.</label>}<button className="student-button" disabled={done || !reviewed} onClick={complete}>{done ? "Self-reviewed completion saved" : "Mark project as self-reviewed"}</button><p role="status">{notice}</p></section></>;
}
