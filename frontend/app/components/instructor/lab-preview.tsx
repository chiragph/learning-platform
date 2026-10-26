"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { buildInstructorLabPreview, isInstructorLabError, isInstructorLabResult } from "../../lib/instructor/lab-preview";
import { labReadiness } from "../../lib/instructor/lab";
import { isPreviewMessage } from "../../lib/student/preview";
import type { LabCheckResult, LabContent } from "../../lib/instructor/lab-types";
import type { Code } from "../../lib/student/types";
import { LabCodeField } from "./lab-code-field";
import { Confirm, Icon } from "./ui";

type Job = { token: string; code: Code };
type Result = { runtimePassed: boolean; code: Code; results: LabCheckResult[]; cases: Map<number, LabCheckResult[]> };
const permissions = "camera 'none'; microphone 'none'; geolocation 'none'; clipboard-read 'none'; clipboard-write 'none'";

export function LabPreview({ content, context }: { content: LabContent; context: string }) {
  const [code, setCode] = useState<Code>(() => ({ ...content.starter })), [output, setOutput] = useState<Job | null>(null), [job, setJob] = useState<Job | null>(null), [result, setResult] = useState<Result | null>(null);
  const [notice, setNotice] = useState(""), [messages, setMessages] = useState<string[]>([]), [reset, setReset] = useState(false), [width, setWidth] = useState(800);
  const frames = useRef(new Map<number, HTMLIFrameElement>()), outputFrame = useRef<HTMLIFrameElement>(null), readiness = labReadiness(content);
  const activeJob = job?.code === code ? job : null, current = result?.code === code;
  useLayoutEffect(() => {
    if (!output) return;
    let received = 0;
    const message = (event: MessageEvent) => {
      if (event.source !== outputFrame.current?.contentWindow || !isPreviewMessage(event.data, output.token) || received++ >= 40) return;
      const text = `${event.data.type === "error" ? "Error: " : ""}${event.data.text}`;
      setMessages(previous => [...previous.slice(-19), text]);
    };
    window.addEventListener("message", message); return () => window.removeEventListener("message", message);
  }, [output]);
  // Commit subscription before a fast iframe can return a check result.
  useLayoutEffect(() => {
    if (!activeJob) return;
    const cases = new Map<number, LabCheckResult[]>(), runtime = new Map<number, boolean>(); let finished = false;
    const message = (event: MessageEvent) => {
      if (finished) return;
      const width = content.widths.find(w => event.source === frames.current.get(w)?.contentWindow);
      if (!width || cases.has(width)) return;
      const token = `${activeJob.token}:${width}`;
      if (isInstructorLabError(event.data, token)) { finished = true; setJob(null); setNotice("The checker could not finish. No preview completion was granted. Review your code and retry."); return; }
      if (!isInstructorLabResult(event.data, token, content.checks)) return;
      cases.set(width, event.data.results); runtime.set(width, event.data.runtimePassed);
      if (cases.size !== content.widths.length) return;
      finished = true;
      const results = content.checks.map(c => ({ id: c.id, passed: [...cases.values()].every(r => r.find(item => item.id === c.id)?.passed) }));
      const runtimePassed = [...runtime.values()].every(Boolean);
      setResult({ code: activeJob.code, results, cases, runtimePassed }); setJob(null);
      setNotice(!runtimePassed ? "JavaScript errors prevented preview completion. Review the runtime messages, fix your code, and retry." : results.every(r => r.passed) ? "All checks passed in this isolated preview. No student completion or publication was recorded." : "Some checks need work. Review the individual results and try again.");
    };
    window.addEventListener("message", message);
    const timeout = window.setTimeout(() => { if (!finished) { finished = true; setJob(null); setNotice("Checks timed out. Review script errors or loops and retry. No completion was granted."); } }, 7000);
    return () => { finished = true; window.clearTimeout(timeout); window.removeEventListener("message", message); };
  }, [activeJob, content]);
  function run() { setMessages([]); setOutput({ token: crypto.randomUUID(), code }); }
  return <section className="ins-lab-preview" aria-label="Isolated coding lab preview"><header className="ins-lab-preview-heading"><span className="ins-status draft">Isolated preview</span><p>{context}</p><h2>{content.title.trim() || "Untitled lab"}</h2><p>{content.objective || "Add a learning objective in the editor."}</p></header>
    {!readiness.ready && <p className="ins-notice warning" role="status">Incomplete Draft: code can run for inspection, but solution checks and completion are disabled until the lab is ready.</p>}
    <div className="ins-lab-preview-layout"><div className="ins-lab-instructions"><h3>Your task</h3><p>{content.instructions || "Task instructions are not written yet."}</p>{content.hints && <details><summary>Show hints</summary><p>{content.hints}</p></details>}<h3>Requirements</h3>{content.checks.length ? <ol>{content.checks.map(c => <li key={c.id}>{c.description || "Incomplete check"}</li>)}</ol> : <p>No checks configured.</p>}</div><div className="ins-theory-fields"><LabCodeField code={code} onChange={setCode} label="Preview code" /></div></div>
    <div className="ins-lab-run-actions"><button type="button" className="ins-button" onClick={run}><Icon name="code" />Run Code</button><button type="button" className="ins-button secondary" disabled={!readiness.ready || !!activeJob} onClick={() => { run(); setResult(null); setNotice("Checking current code in isolated viewports…"); setJob({ token: crypto.randomUUID(), code }); }}>{activeJob ? "Checking…" : "Check Solution"}</button><button type="button" className="ins-button secondary" onClick={() => setReset(true)}>Reset Code</button>{activeJob && <button type="button" className="ins-text-link" onClick={() => { setJob(null); setNotice("Check canceled. No completion recorded."); }}>Cancel check</button>}<label>Output width<select aria-label="Preview output width" value={width} onChange={e => setWidth(Number(e.target.value))}><option value={800}>Desktop · 800px</option><option value={320}>Mobile · 320px</option></select></label></div>
    <div className="ins-lab-output" data-width={width}><div className="ins-lab-output-heading"><strong>Sandboxed output</strong><span>{output && output.code !== code ? "Code changed · Run again" : "Scripts run only inside this frame"}</span></div>{output ? <iframe key={output.token} ref={outputFrame} title="Isolated instructor lab output" width={width} height={380} style={{ width, maxWidth: "100%" }} sandbox="allow-scripts" referrerPolicy="no-referrer" allow={permissions} srcDoc={buildInstructorLabPreview(output.code, output.token)} /> : <p>Run your code to see its output here.</p>}</div>
    {!!messages.length && <details className="ins-lab-messages"><summary>Runtime messages ({messages.length})</summary><ul>{messages.map((message, index) => <li key={index}>{message}</li>)}</ul></details>}
    <section className="ins-lab-results" aria-label="Preview validation results"><h3>Solution checks</h3><p role="status">{result && !current || job && !activeJob ? "Code changed since the last check. Check again for current results." : notice || "Checks test the configured requirements, not every possible solution."}</p>{result && <><strong>{current ? `${result.results.filter(r => r.passed).length} / ${content.checks.length} checks passed${result.runtimePassed && result.results.every(r => r.passed) ? " · Preview complete" : ""}` : "Results are out of date"}</strong><ul>{content.checks.map(c => { const passed = current && result.results.find(r => r.id === c.id)?.passed; return <li key={c.id} data-passed={passed}><Icon name={passed ? "check" : "clock"} /><div><strong>{!current ? "Check again" : passed ? "Passed" : "Needs work"} · {c.description}</strong>{current && <small>{content.widths.map(w => `${w}px: ${result.cases.get(w)?.find(r => r.id === c.id)?.passed ? "passed" : "needs work"}`).join(" · ")}</small>}</div></li>; })}</ul></>}</section>
    {activeJob && <div className="ins-lab-probes" aria-hidden="true" inert>{content.widths.map(w => <iframe key={`${activeJob.token}:${w}`} ref={node => { if (node) frames.current.set(w, node); else frames.current.delete(w); }} title={`Isolated instructor check at ${w}px`} tabIndex={-1} width={w} height={600} style={{ width: w, height: 600 }} sandbox="allow-scripts" referrerPolicy="no-referrer" allow={permissions} srcDoc={buildInstructorLabPreview(activeJob.code, `${activeJob.token}:${w}`, content)} />)}</div>}
    {reset && <Confirm title="Reset preview code?" label="Reset Code" onClose={() => setReset(false)} onConfirm={() => { setCode({ ...content.starter }); setJob(null); setOutput(null); setResult(null); setMessages([]); setNotice("Preview reset to the current starter code."); setReset(false); }}>Your preview edits and check results will be discarded. The instructor starter code and saved draft are unchanged.</Confirm>}
  </section>;
}
