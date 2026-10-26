"use client";

import dynamic from "next/dynamic";
import { Component, useId, useState, type ReactNode } from "react";
import type { Code } from "../../lib/student/types";

const Monaco = dynamic(() => import("./lab-code-editor"), { ssr: false, loading: () => <p role="status">Loading Monaco Editor… Use Plain text if it does not load.</p> });
class CodeBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <p role="alert">Monaco could not load. Choose Plain text to keep editing; your code is preserved.</p> : this.props.children; }
}
export function LabCodeField({ code, onChange, readOnly = false, label }: { code: Code; onChange: (code: Code) => void; readOnly?: boolean; label: string }) {
  const [language, setLanguage] = useState<keyof Code>("html"), [plain, setPlain] = useState(false), id = useId();
  return <section className="ins-lab-code" aria-label={label}><div className="ins-lab-code-toolbar"><div role="group" aria-label={`${label} files`}>{(["html", "css", "javascript"] as const).map(key => <button type="button" key={key} aria-pressed={key === language} onClick={() => setLanguage(key)}>{key === "javascript" ? "JavaScript" : key.toUpperCase()}</button>)}</div><button type="button" aria-pressed={plain} onClick={() => setPlain(!plain)}>{plain ? "Use Monaco" : "Plain text"}</button></div>
    <p id={id} className="ins-muted">{label} · {language.toUpperCase()} · {readOnly ? "Read-only" : "Control M toggles Tab focus in Monaco"}</p>
    {plain ? <label className="ins-lab-plain"><span className="sr-only">{label} {language}</span><textarea aria-describedby={id} spellCheck={false} readOnly={readOnly} maxLength={100000} rows={15} className="ins-code-input" value={code[language]} onChange={e => onChange({ ...code, [language]: e.target.value })} /></label> : <CodeBoundary><Monaco value={code[language]} language={language} readOnly={readOnly} onChange={value => { if (!readOnly) onChange({ ...code, [language]: value }); }} /></CodeBoundary>}
  </section>;
}
