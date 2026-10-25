"use client";

import { loader } from "@monaco-editor/react";
import { useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { EDITOR_THEME, editorOptions } from "@/app/lib/student/editor-settings";
import { createEditorSession, startEditorSession, type EditorSession, type EditorControls } from "@/app/lib/student/editor-session";
import type { Subject } from "@/app/lib/student/types";
import { editorFontFamily, monaco } from "./monaco-runtime";

function subscribeMotion(change: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", change); return () => media.removeEventListener("change", change);
}
const getMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type Props = { value: string; language: Subject; path: string; base: string; onChange: (value: string) => boolean; onRun: () => void; onSave: () => void; onReady: (controls: EditorControls) => void; onDiagnostics: (count: number) => void };
export default function MonacoCodeEditor(props: Props) {
  const theme = EDITOR_THEME;
  const reducedMotion = useSyncExternalStore(subscribeMotion, getMotion, () => false);
  const container = useRef<HTMLDivElement>(null);
  const loading = useRef<HTMLDivElement>(null);
  const session = useRef<EditorSession | null>(null);
  const [error, setError] = useState<{ cause: unknown } | null>(null);
  const callbacks = useRef(props);
  const settings = useMemo<monaco.editor.IStandaloneEditorConstructionOptions>(() => ({ ...editorOptions, theme, cursorBlinking: reducedMotion ? "solid" : "blink", cursorSmoothCaretAnimation: "off", smoothScrolling: false, ariaLabel: `${props.language.toUpperCase()} code editor. Control or Command Enter runs code. Control or Command S saves the draft. Control M on Windows or Linux, or Control Shift M on macOS, changes Tab focus mode.` }), [theme, reducedMotion, props.language]);
  const configuration = useRef(settings);
  useLayoutEffect(() => { callbacks.current = props; configuration.current = settings; });
  useLayoutEffect(() => {
    const loadingNode = loading.current;
    // Keep @monaco-editor/react's configured local loader, but own the editor
    // lifecycle: its <Editor> retains a disposed ref/ready flag on Activity resume.
    const stop = startEditorSession(loader.init(), () => {
      const owned = createEditorSession(monaco, container.current!, () => callbacks.current, { ...configuration.current, fontFamily: editorFontFamily() });
      session.current = owned;
      if (loadingNode) loadingNode.hidden = true;
      try { callbacks.current.onReady(owned); } catch (cause) { owned.dispose(); throw cause; }
      return owned;
    }, (cause) => setError({ cause }));
    return () => {
      session.current = null;
      stop();
      if (loadingNode) loadingNode.hidden = false;
    };
  }, [props.base]);
  useLayoutEffect(() => {
    session.current?.update(callbacks.current, settings);
  }, [props.path, props.value, props.language, settings]);

  if (error) throw error.cause;
  return <div style={{ height: "100%", width: "100%", position: "relative" }}>
    <div ref={loading} role="status" style={{ position: "absolute", inset: 0 }}><div className="student-ide-loading">Loading Monaco Editor…</div></div>
    <div ref={container} style={{ height: "100%", width: "100%" }} />
  </div>;
}
