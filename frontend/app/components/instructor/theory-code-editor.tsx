"use client";

import { useLayoutEffect, useRef } from "react";
import { editorFontFamily, monaco } from "../student/monaco-runtime";
import type { TheoryLanguage } from "../../lib/instructor/theory-types";

// Only the explicitly selected code block mounts this editor. The local Monaco
// runtime/workers are shared with DECODE; no Run, eval, iframe, or CDN loader.
export default function TheoryCodeEditor({ value, language, onChange }: { value: string; language: TheoryLanguage; onChange: (value: string) => void }) {
  const container = useRef<HTMLDivElement>(null), editor = useRef<monaco.editor.IStandaloneCodeEditor | null>(null), callback = useRef(onChange);
  useLayoutEffect(() => { callback.current = onChange; });
  useLayoutEffect(() => {
    const node = container.current!;
    let owned: monaco.editor.IStandaloneCodeEditor | undefined;
    try {
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const theme = () => document.documentElement.dataset.theme === "dark" ? "vs-dark" : "vs";
      owned = monaco.editor.create(node, { value: "", language: "plaintext", theme: theme(), automaticLayout: true, minimap: { enabled: false }, scrollBeyondLastLine: false, fontSize: 13, fontFamily: editorFontFamily(), lineNumbers: "on", wordWrap: "on", cursorBlinking: reducedMotion ? "solid" : "blink", cursorSmoothCaretAnimation: "off", smoothScrolling: false, tabFocusMode: true, ariaLabel: "Lesson code example editor. Code is never executed. Control M toggles Tab focus mode." });
      editor.current = owned;
      const subscription = owned.onDidChangeModelContent(() => callback.current(owned!.getValue()));
      const observer = new MutationObserver(() => owned?.updateOptions({ theme: theme() }));
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
      return () => { observer.disconnect(); subscription.dispose(); const model = owned?.getModel(); owned?.dispose(); model?.dispose(); editor.current = null; };
    } catch { owned?.getModel()?.dispose(); owned?.dispose(); throw new Error("Syntax editor unavailable. Use the plain code field."); }
  }, []);
  useLayoutEffect(() => {
    const owned = editor.current;
    if (!owned) return;
    monaco.editor.setModelLanguage(owned.getModel()!, language);
    if (owned.getValue() !== value) { const position = owned.getPosition(); owned.setValue(value); if (position) owned.setPosition(position); }
  }, [value, language]);
  return <div ref={container} className="ins-theory-monaco" />;
}
