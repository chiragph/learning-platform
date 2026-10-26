"use client";

import { useLayoutEffect, useRef } from "react";
import { editorFontFamily, monaco } from "../student/monaco-runtime";
import type { Code } from "../../lib/student/types";

export default function LabCodeEditor({ value, language, readOnly, onChange }: { value: string; language: keyof Code; readOnly: boolean; onChange: (value: string) => void }) {
  const container = useRef<HTMLDivElement>(null), editor = useRef<monaco.editor.IStandaloneCodeEditor | null>(null), callback = useRef(onChange), updating = useRef(false);
  useLayoutEffect(() => { callback.current = onChange; });
  useLayoutEffect(() => {
    const theme = () => document.documentElement.dataset.theme === "dark" ? "vs-dark" : "vs";
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const owned = monaco.editor.create(container.current!, { value: "", language: "html", theme: theme(), automaticLayout: true, minimap: { enabled: false }, fontSize: 13, fontFamily: editorFontFamily(), scrollBeyondLastLine: false, wordWrap: "on", tabSize: 2, tabFocusMode: true, smoothScrolling: false, cursorBlinking: motion.matches ? "solid" : "blink", cursorSmoothCaretAnimation: "off", ariaLabel: "Lab code editor. Control M toggles Tab focus mode." });
    editor.current = owned;
    const subscription = owned.onDidChangeModelContent(() => { if (!updating.current) callback.current(owned.getValue()); });
    const observer = new MutationObserver(() => owned.updateOptions({ theme: theme() }));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const updateMotion = () => owned.updateOptions({ cursorBlinking: motion.matches ? "solid" : "blink" });
    motion.addEventListener("change", updateMotion);
    return () => { observer.disconnect(); motion.removeEventListener("change", updateMotion); subscription.dispose(); const model = owned.getModel(); owned.dispose(); model?.dispose(); editor.current = null; };
  }, []);
  useLayoutEffect(() => {
    const owned = editor.current;
    if (!owned) return;
    updating.current = true;
    try { owned.updateOptions({ readOnly }); monaco.editor.setModelLanguage(owned.getModel()!, language); if (owned.getValue() !== value) owned.setValue(value); }
    finally { updating.current = false; }
  }, [value, language, readOnly]);
  return <div ref={container} className="ins-lab-monaco" />;
}
