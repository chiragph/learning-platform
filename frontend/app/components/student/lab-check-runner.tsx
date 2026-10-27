"use client";
import { authoredLabs } from "@/app/lib/learning/catalog";
import { buildInstructorLabPreview } from "@/app/lib/instructor/lab-preview";


import { useLayoutEffect, useRef, useState } from "react";
import type { Code, LabRequirementResult } from "@/app/lib/student/types";
import type { LabDefinition } from "@/app/lib/student/labs";
import { buildPreview, isLabCheckError, isLabCheckMessage } from "@/app/lib/student/preview";
import type { WorkspaceImage } from "@/app/lib/student/workspace-images";
import { StudentIcon } from "./student-icon";

type Job = { token: string; code: Code; images: WorkspaceImage[] };
type Result = { code: Code; images: WorkspaceImage[]; requirements: LabRequirementResult[]; cases: Map<number, LabRequirementResult[]> };
export function LabCheckRunner({ lab, code, images, onChecked, onChecking }: { lab: LabDefinition; code: Code; images: WorkspaceImage[]; onChecked: (requirements: LabRequirementResult[]) => void; onChecking?: () => void }) {
  const [job, setJob] = useState<Job | null>(null), [result, setResult] = useState<Result | null>(null), [notice, setNotice] = useState("");
  const frames = useRef(new Map<number, HTMLIFrameElement>()), callback = useRef(onChecked);
  useLayoutEffect(() => { callback.current = onChecked; });
  const current = Boolean(result && result.code === code && result.images === images);
  const activeJob = job?.code === code && job?.images === images ? job : null;
  // Subscribe in the commit before a fast srcDoc can post its result.
  useLayoutEffect(() => {
    if (!activeJob) return;
    const job = activeJob;
    const cases = new Map<number, LabRequirementResult[]>(); let finished = false;
    const message = (event: MessageEvent) => {
      if (finished) return;
      const width = lab.widths.find(width => event.source === frames.current.get(width)?.contentWindow);
      if (width && authoredLabs.has(lab.id) && event.data?.channel === "decode-instructor-lab" && event.data?.token === job.token + ":" + width && event.data?.type === "result") { event = { ...event, data: {channel:"decode-preview", token:job.token + ":" + width, type:"lab-result", labId:lab.id, requirements:event.data.results} } as MessageEvent; }
      if (!width || cases.has(width)) return;
      if (isLabCheckError(event.data, job.token + ":" + width)) {
        finished = true; setJob(null);
        setNotice("The lab checker could not evaluate this solution. Retry Check Solution. No completion was granted.");
        return;
      }
      if (!isLabCheckMessage(event.data, job.token + ":" + width, lab)) return;
      cases.set(width, event.data.requirements);
      if (cases.size !== lab.widths.length) return;
      finished = true;
      const requirements = lab.requirements.map(requirement => ({ id: requirement.id, passed: [...cases.values()].every(results => results.find(item => item.id === requirement.id)?.passed) }));
      setResult({ code: job.code, images: job.images, requirements, cases }); setJob(null);
      setNotice(requirements.every(item => item.passed) ? "All supported requirements passed. You can now complete this lab." : "Some requirements need another look. Use the feedback below, then check again.");
      callback.current(requirements);
    };
    window.addEventListener("message", message);
    const timeout = window.setTimeout(() => { if (!finished) { finished = true; setJob(null); setNotice("Checks did not finish. Stop any running code, review possible errors or loops, and try again. No completion was granted."); } }, 7000);
    return () => { finished = true; window.clearTimeout(timeout); window.removeEventListener("message", message); };
  }, [activeJob, lab]);
  return <section className="student-lab-checks" aria-label="Lab solution checks"><div className="student-row"><div><h2>Check your solution</h2><p>Checks test the listed requirements{lab.widths.length > 1 ? " at 320px and 800px" : " in an isolated preview"}. They do not grade every possible design or implementation.</p></div><button className="student-button" disabled={Boolean(activeJob)} onClick={() => { onChecking?.(); setResult(null); setNotice("Checking the current code…"); setJob({ token: crypto.randomUUID(), code, images }); }}>{activeJob ? "Checking…" : "Check Solution"}<StudentIcon name="check" /></button>{activeJob && <button className="student-text-action" onClick={() => { setJob(null); setNotice("Check canceled. Your code and progress are unchanged."); }}>Cancel check</button>}</div><p className="student-activity-notice" role="status">{result && !current || job && !activeJob ? "Code or images changed since the last check. Check again before completing the lab." : notice}</p>
    {result && <ul className="student-lab-results">{lab.requirements.map(requirement => {
      const passed = current && result.requirements.find(item => item.id === requirement.id)?.passed;
      return <li key={requirement.id} data-passed={passed}><StudentIcon name={passed ? "check" : "code"} /><div><strong>{passed ? "Passed" : current ? "Needs work" : "Check again"} · {requirement.title}</strong>{!passed && <p>{requirement.help}</p>}{lab.widths.length > 1 && current && <small>{lab.widths.map(width => width + "px: " + (result.cases.get(width)?.find(item => item.id === requirement.id)?.passed ? "passed" : "needs work")).join(" · ")}</small>}</div></li>;
    })}</ul>}
    {activeJob && <div className="student-lab-probes" aria-hidden="true" inert>{lab.widths.map(width => <iframe key={activeJob.token + width} ref={node => { if (node) frames.current.set(width, node); else frames.current.delete(width); }} title={"Isolated lab check at " + width + " pixels"} tabIndex={-1} width={width} height={600} style={{ width, height: 600 }} sandbox="allow-scripts" referrerPolicy="no-referrer" allow="camera 'none'; microphone 'none'; geolocation 'none'; clipboard-read 'none'; clipboard-write 'none'" srcDoc={authoredLabs.has(lab.id) ? buildInstructorLabPreview(activeJob.code, activeJob.token + ":" + width, authoredLabs.get(lab.id)) : buildPreview(activeJob.code, activeJob.token + ":" + width, undefined, { images: activeJob.images, allowOnlineImages: true }, lab.id)} />)}</div>}
  </section>;
}
