"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useId, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from "react";
import { buildPreview, isPreviewMessage, type PreviewMessage } from "@/app/lib/student/preview";
import { fileNames, MAX_CODE_LENGTH, modelBase } from "@/app/lib/student/editor-settings";
import type { Challenge, Code, Subject } from "@/app/lib/student/types";
import { useProgress } from "./progress-provider";
import { useStudent } from "./student-provider";
import { ResizablePanels } from "./resizable-panels";
import { EditorBoundary } from "./editor-boundary";
import { StudentIcon } from "./student-icon";
import type { EditorControls } from "@/app/lib/student/editor-session";
import type { WorkspaceImage } from "@/app/lib/student/workspace-images";
import { WorkspaceImages } from "./workspace-images";
import { LabCheckRunner } from "./lab-check-runner";
import type { LabDefinition } from "@/app/lib/student/labs";
import type { LabRequirementResult } from "@/app/lib/student/types";
import "./code-workspace.css";

const MonacoCodeEditor = dynamic(() => import("./monaco-code-editor"), { ssr: false, loading: () => <div className="student-ide-loading" role="status">Loading Monaco Editor…</div> });
const languages: Subject[] = ["html", "css", "javascript"];
export type WorkspaceControls = { focusEditor: () => void };
type Props = { workspaceId: string; starter: Code; check?: Challenge["check"]; onCheck?: (passed: boolean) => void; initialLanguage?: Subject; embedded?: boolean; imageScope?: "lesson" | "lab" | "workshop"; lab?: LabDefinition; onLabChecked?: (requirements: LabRequirementResult[]) => void; onWorkspaceChange?: () => void; onDirtyChange?: (dirty: boolean) => void; ref?: Ref<WorkspaceControls> };

export function CodeWorkspace({ workspaceId, starter, check, onCheck, initialLanguage = "html", embedded = false, imageScope, lab, onLabChecked, onWorkspaceChange, onDirtyChange, ref }: Props) {
  const { progress, update } = useProgress();
  const student = useStudent();
  const instanceId = useId();
  const domId = `workspace-${encodeURIComponent(instanceId)}`;
  const base = modelBase(student.id, workspaceId, instanceId);
  const [code, setCode] = useState<Code>(() => progress.drafts[workspaceId] ?? { ...starter });
  const currentCode = useRef(code);
  const editorTarget = useRef<HTMLDivElement>(null);
  const accessibleInput = useRef<HTMLTextAreaElement>(null);
  const editorControls = useRef<EditorControls | null>(null);
  const focusRequested = useRef(false);
  const pendingInsert = useRef<string | null>(null);
  const [insertRequest, setInsertRequest] = useState(0);
  const images = useRef<WorkspaceImage[]>([]);
  const [imageAssets, setImageAssets] = useState<WorkspaceImage[]>([]);
  const imagesEnabled = embedded || Boolean(imageScope);
  const [language, setLanguage] = useState<Subject>(initialLanguage);
  const [run, setRun] = useState<{ token: string; document: string } | null>(null);
  const [messages, setMessages] = useState<PreviewMessage[]>([]);
  const [status, setStatus] = useState("Ready. Run code to update the preview.");
  const [saveNotice, setSaveNotice] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [accessible, setAccessible] = useState(false);
  const [editorReady, setEditorReady] = useState<EditorControls | null>(null);
  const [editorRevision, setEditorRevision] = useState(0);
  const [loadNotice, setLoadNotice] = useState("");
  const [diagnostics, setDiagnostics] = useState<number | null>(null);
  const iframe = useRef<HTMLIFrameElement>(null);
  const tabs = useRef<HTMLDivElement>(null);
  const resetButton = useRef<HTMLButtonElement>(null);
  const resetConfirm = useRef<HTMLButtonElement>(null);
  const checkCallback = useRef(onCheck);
  const workspaceChange = useRef(onWorkspaceChange);
  const changedSinceRun = useRef(false);
  useLayoutEffect(() => () => { focusRequested.current = false; pendingInsert.current = null; editorControls.current = null; }, []);
  useLayoutEffect(() => { checkCallback.current = onCheck; workspaceChange.current = onWorkspaceChange; }, [onCheck, onWorkspaceChange]);
  const dirty = JSON.stringify(code) !== JSON.stringify(progress.drafts[workspaceId] ?? starter);
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", unload); return () => window.removeEventListener("beforeunload", unload);
  }, [dirty]);
  useEffect(() => {
    if (editorReady || accessible) return;
    const timeout = window.setTimeout(() => setLoadNotice("Monaco is taking longer than expected. You can switch to the accessible editor while keeping your code."), 12000);
    return () => window.clearTimeout(timeout);
  }, [editorReady, accessible]);
  useEffect(() => {
    const failed = () => setLoadNotice("A local language worker could not load. Save your draft and reload, or use the accessible editor. Code preview is still available.");
    window.addEventListener("decode-editor-worker-error", failed); return () => window.removeEventListener("decode-editor-worker-error", failed);
  }, []);
  useEffect(() => { if (confirmReset) resetConfirm.current?.focus(); }, [confirmReset]);
  useEffect(() => {
    if (!run) return;
    let received = 0;
    const message = (event: MessageEvent) => {
      // The preview remains an opaque origin. Only this frame and run token count.
      if (event.source !== iframe.current?.contentWindow || !isPreviewMessage(event.data, run.token) || received++ >= 60) return;
      const data = event.data;
      if (data.type === "ready") setStatus(data.text);
      else setMessages((current) => [...current, data].slice(-40));
      if (data.type === "check" && !changedSinceRun.current) checkCallback.current?.(data.passed === true);
    };
    window.addEventListener("message", message);
    const timeout = window.setTimeout(() => setStatus((s) => s.startsWith("Running") ? "Preview did not respond. Stop the preview, check for an infinite loop, and run again." : s), 5000);
    return () => { window.removeEventListener("message", message); window.clearTimeout(timeout); };
  }, [run]);

  const execute = useCallback(() => {
    const token = crypto.randomUUID();
    changedSinceRun.current = false; checkCallback.current?.(false);
    setMessages([]); setStatus("Running code in the isolated preview…");
    setRun({ token, document: buildPreview(currentCode.current, token, check, imagesEnabled ? { images: images.current, allowOnlineImages: true } : undefined) });
  }, [check, imagesEnabled]);
  const save = useCallback(() => {
    if (update((p) => ({ ...p, drafts: { ...p.drafts, [workspaceId]: currentCode.current } }))) setSaveNotice("Draft saved in this browser for this account.");
    else setSaveNotice("Draft could not be saved. Copy your code before leaving.");
  }, [update, workspaceId]);
  const revealEditor = useCallback(() => {
    const target = editorTarget.current;
    if (!focusRequested.current || !target || target.closest("[hidden]")) return;
    if (accessible) {
      if (!accessibleInput.current) return;
      accessibleInput.current.focus({ preventScroll: true });
    } else if (!editorControls.current?.focus()) return;
    focusRequested.current = false;
    target.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }, [accessible]);
  useImperativeHandle(ref, () => ({ focusEditor() { focusRequested.current = true; revealEditor(); } }), [revealEditor]);
  const ready = useCallback((controls: EditorControls) => { editorControls.current = controls; setEditorReady(controls); setLoadNotice(""); revealEditor(); }, [revealEditor]);
  const change = useCallback((value: string) => {
    if (value.length > MAX_CODE_LENGTH) { setSaveNotice("Each file is limited to 100,000 characters. That edit was not applied."); return false; }
    currentCode.current = { ...currentCode.current, [language]: value };
    setCode(currentCode.current); setSaveNotice("");
    changedSinceRun.current = true; checkCallback.current?.(false); workspaceChange.current?.(); return true;
  }, [language]);
  function reset() {
    currentCode.current = { ...starter }; setCode(currentCode.current); setRun(null); setMessages([]); setConfirmReset(false);
    // Reset inactive Monaco models as well, including files with equal values.
    setEditorRevision((revision) => revision + 1); setEditorReady(null);
    setSaveNotice("Starter code restored. Save draft to replace the saved version.");
    setStatus("Ready. Run code to update the preview."); changedSinceRun.current = true; checkCallback.current?.(false); workspaceChange.current?.();
    requestAnimationFrame(() => resetButton.current?.focus());
  }
  function selectLanguage(next: Subject) { setLanguage(next); setDiagnostics(null); }
  // Switching to HTML commits the correct model before an upload is inserted.
  // A loading editor keeps the insertion queued until its owned session is ready.
  useLayoutEffect(() => {
    const text = pendingInsert.current;
    if (text && language === "html") {
      if (code.html.length + text.length > MAX_CODE_LENGTH) { pendingInsert.current = null; focusRequested.current = false; setSaveNotice("Not enough room in index.html to insert this image tag."); return; }
      if (accessible && accessibleInput.current) {
        const input = accessibleInput.current;
        const value = code.html.slice(0, input.selectionStart) + text + code.html.slice(input.selectionEnd);
        change(value); input.focus({ preventScroll: true });
        pendingInsert.current = null;
      } else if (editorReady && editorControls.current?.insert(text)) pendingInsert.current = null;
    }
    revealEditor();
  }, [language, revealEditor, code.html, accessible, editorReady, change, insertRequest]);

  const editorPanel = <>
    <div ref={tabs} className="student-ide-tabs" role="tablist" aria-label="Code files">{languages.map((lang) => <button id={`${domId}-tab-${lang}`} key={lang} type="button" role="tab" aria-selected={language === lang} aria-controls={`${domId}-code`} tabIndex={language === lang ? 0 : -1} onClick={() => selectLanguage(lang)} onKeyDown={(event) => {
      const index = languages.indexOf(lang);
      const next = event.key === "ArrowRight" ? (index + 1) % 3 : event.key === "ArrowLeft" ? (index + 2) % 3 : event.key === "Home" ? 0 : event.key === "End" ? 2 : null;
      if (next !== null) { event.preventDefault(); selectLanguage(languages[next]); tabs.current?.querySelectorAll<HTMLButtonElement>("button")[next]?.focus(); }
    }}><span className={`student-ide-file-icon ${lang}`} aria-hidden="true">{lang === "html" ? "<>" : lang === "css" ? "#" : "JS"}</span>{fileNames[lang]}{code[lang] !== (progress.drafts[workspaceId] ?? starter)[lang] && <span className="student-ide-dirty-dot" aria-label="Unsaved changes" />}</button>)}</div>
    <div className="student-ide-file-path" aria-hidden="true">workspace <StudentIcon name="chevron" />{fileNames[language]}</div>
    <div ref={editorTarget} id={`${domId}-code`} role="tabpanel" aria-labelledby={`${domId}-tab-${language}`} className="student-ide-code">
      {accessible ? <><label className="sr-only" htmlFor={`${domId}-accessible`}>{language.toUpperCase()} accessible code editor</label><textarea ref={accessibleInput} id={`${domId}-accessible`} value={code[language]} maxLength={MAX_CODE_LENGTH} spellCheck={false} autoCapitalize="off" autoCorrect="off" onChange={(event) => change(event.target.value)} /></> : <EditorBoundary key={editorRevision}><MonacoCodeEditor value={code[language]} language={language} path={base + fileNames[language]} base={base} onChange={change} onRun={execute} onSave={save} onReady={ready} onDiagnostics={setDiagnostics} /></EditorBoundary>}
    </div>
    <div className="student-ide-editor-status"><span>{language === "javascript" ? "JavaScript" : language.toUpperCase()} · UTF-8 · Spaces: 2</span><span>{accessible ? "Accessible editor" : diagnostics === null ? "Language tools" : `${diagnostics} active-file issue${diagnostics === 1 ? "" : "s"}`}</span></div>
  </>;
  const previewPanel = <>
    <div className="student-ide-preview-toolbar"><h2><StudentIcon name="code" />Preview</h2><div><button aria-pressed={narrow} onClick={() => setNarrow(!narrow)}>{narrow ? "Full width" : "320px"}</button>{run && <button onClick={() => { setRun(null); setStatus("Preview stopped. Your code remains in the editors."); }}>Stop</button>}</div></div>
    <div className="student-ide-preview-canvas"><div className={narrow ? "student-ide-preview-document narrow" : "student-ide-preview-document"}>
      {run ? <iframe key={run.token} ref={iframe} title="Isolated code output" sandbox="allow-scripts" referrerPolicy="no-referrer" allow="camera 'none'; microphone 'none'; geolocation 'none'; clipboard-read 'none'; clipboard-write 'none'" srcDoc={run.document} /> : <div className="student-ide-preview-empty"><StudentIcon name="code" /><h3>Your ideas, in the browser.</h3><p>Run code to see the result here. Edit any file, then run again to refresh the output.</p><button className="student-button secondary" onClick={execute}>Run your code <StudentIcon name="arrow" /></button></div>}
    </div></div><div className="student-ide-preview-status"><span className={run ? "running" : ""} aria-hidden="true" />{run ? "Isolated preview" : "Preview not running"}<span>Updates on Run</span></div>
  </>;

  return <section className={`student-workspace student-ide${embedded ? " embedded" : ""}`} aria-label="Coding workspace">
    <div className="student-ide-toolbar"><div className="student-ide-actions"><button className="student-button" onClick={execute}><StudentIcon name="arrow" />Run Code</button><button className="student-button secondary" onClick={save}>Save Draft</button><button ref={resetButton} className="student-button secondary" aria-expanded={confirmReset} onClick={() => setConfirmReset(!confirmReset)}>Reset</button></div><div className="student-ide-tools"><span className={dirty ? "unsaved" : ""}>{dirty ? "Unsaved changes" : progress.drafts[workspaceId] ? "Saved draft" : "Starter code"}</span><button className="student-ide-accessible-toggle" aria-pressed={accessible} onClick={() => setAccessible(!accessible)}>{accessible ? "Use Monaco" : "Accessible editor"}</button></div></div>
    {confirmReset && <div className="student-notice student-ide-reset"><p>Replace all three files with starter code? Your saved draft stays unchanged until you save again.</p><div className="student-row"><button ref={resetConfirm} className="student-button secondary" onClick={reset}>Replace editor contents</button><button className="student-button secondary" onClick={() => { setConfirmReset(false); resetButton.current?.focus(); }}>Cancel</button></div></div>}
    {loadNotice && <p className="student-notice" role="alert">{loadNotice}</p>}
    <p className="student-ide-save-status" role="status">{saveNotice}</p>
    {imagesEnabled && <WorkspaceImages studentId={student.id} workspaceId={workspaceId} scope={imageScope ?? "lesson"} onImages={(next) => { if (JSON.stringify(images.current) !== JSON.stringify(next)) { images.current = next; setImageAssets(next); workspaceChange.current?.(); } }} onInsert={(text) => { pendingInsert.current = text; focusRequested.current = true; selectLanguage("html"); setInsertRequest((value) => value + 1); }} />}
    <ResizablePanels id={domId} editor={editorPanel} preview={previewPanel} embedded={embedded} />
    {lab && onLabChecked && <LabCheckRunner lab={lab} code={code} images={imageAssets} onChecked={onLabChecked} onChecking={() => workspaceChange.current?.()} />}
    <div className="student-ide-console"><div className="student-ide-console-heading"><span><StudentIcon name="code" />Console & runtime</span><button onClick={() => setMessages([])} disabled={!messages.length}>Clear messages</button></div><p role="status">{status}</p>{messages.length > 0 && <ul aria-label="Preview messages">{messages.map((message, index) => <li key={index} className={message.type === "error" ? "student-error" : ""}><span>{message.type.toUpperCase()}</span>{message.text}</li>)}</ul>}</div>
    <details className="student-ide-help"><summary>Editor shortcuts & preview limits</summary><p>In HTML, type an abbreviation such as h2 or ul&gt;li*3 and press Tab to expand it. Ctrl/Cmd+Enter runs code. Ctrl/Cmd+S saves your draft. Ctrl+M (Windows/Linux) or Ctrl+Shift+M (macOS) toggles whether Tab indents or moves focus. Drag the divider or focus it and use arrow keys to resize. The accessible editor uses Tab to move focus.</p><p>Code stays local. JavaScript executes only in the isolated preview, with no same-origin permission or access to DECODE storage. {imagesEnabled ? "HTTPS images and this workspace’s uploaded images can load. Other network requests, external scripts, native form submission, and external link clicks remain blocked." : "Existing restrictions block network requests, external assets, native form submission, and external link clicks."} Put scripts in script.js. Avoid infinite loops; the browser cannot guarantee a CPU timeout. Each file supports up to 100,000 characters.</p></details>
  </section>;
}
