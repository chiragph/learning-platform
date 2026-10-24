"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { templates } from "@/app/lib/student/templates";
import { PageHeading } from "./learning-overview";
import { CodeWorkspace } from "./code-workspace";
import { StudentIcon } from "./student-icon";

export function PlaygroundView() {
  const entered = useRef(false);
  useLayoutEffect(() => {
    // Only this route's first entry starts at its heading. Do not scroll again
    // on editor load, theme changes, template changes or cached Activity resume.
    if (entered.current) return;
    entered.current = true;
    if (!window.location.hash) window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, []);
  const [template, setTemplate] = useState(templates[0]);
  const [pending, setPending] = useState<(typeof templates)[number] | null>(null);
  const [dirty, setDirty] = useState(false);
  function select(id: string) {
    const next = templates.find((t) => t.id === id); if (!next || next.id === template.id) return;
    if (dirty) setPending(next); else setTemplate(next);
  }
  return <div className="student-playground">
    <div className="student-playground-heading"><PageHeading eyebrow="YOUR CODING WORKSPACE" title="An idea. Three files. Endless possibilities." description="Write, run, and refine. A focused place to explore HTML, CSS, and JavaScript at your own pace." /><span className="student-playground-label"><StudentIcon name="code" />Local workspace</span></div>
    <div className="student-playground-template"><label className="student-template-label" htmlFor="template">Starter template<select id="template" value={template.id} onChange={(event) => select(event.target.value)}>{templates.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</select></label><p>Each template has its own saved draft. Preview updates when you run.</p></div>
    {pending && <section className="student-notice student-playground-switch" role="region" aria-label="Unsaved template changes"><p>You have unsaved changes. Cancel and use Save Draft to keep them, or discard your editor changes and switch to {pending.title}. Your previous saved draft will stay unchanged.</p><div className="student-row"><button className="student-button secondary" onClick={() => setPending(null)}>Cancel switch</button><button className="student-button secondary" onClick={() => { setTemplate(pending); setDirty(false); setPending(null); }}>Discard edits and switch</button></div></section>}
    <CodeWorkspace key={template.id} workspaceId={`playground-${template.id}`} starter={template.code} onDirtyChange={setDirty} />
  </div>;
}
