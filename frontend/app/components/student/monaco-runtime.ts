"use client";

import * as monaco from "monaco-editor";
import { loader } from "@monaco-editor/react";
import { workerUrl } from "@/app/lib/student/editor-settings";

globalThis.MonacoEnvironment = {
  getWorker(_moduleId, label) {
    const worker = new Worker(workerUrl(label), { name: `decode-${label}` });
    worker.addEventListener("error", () => window.dispatchEvent(new Event("decode-editor-worker-error")));
    return worker;
  },
};
// Supply the bundled ESM runtime: the React loader must never fetch its CDN default.
loader.config({ monaco });
monaco.typescript.javascriptDefaults.setCompilerOptions({
  allowJs: true, checkJs: true, allowNonTsExtensions: true,
  target: monaco.typescript.ScriptTarget.ES2020,
});
monaco.typescript.javascriptDefaults.setDiagnosticsOptions({ noSemanticValidation: false, noSyntaxValidation: false });
monaco.typescript.javascriptDefaults.setEagerModelSync(true);

export function defineDecodeThemes() {
  const css = getComputedStyle(document.body);
  const font = css.getPropertyValue("--font-geist-mono").trim() || "Consolas, monospace";
  monaco.editor.defineTheme("decode-light", {
    base: "vs", inherit: true,
    rules: [{ token: "comment", foreground: "69737B" }, { token: "keyword", foreground: "315DB5" }, { token: "string", foreground: "87602A" }, { token: "tag", foreground: "954322" }],
    colors: { "editor.background": "#FFFFFF", "editor.foreground": "#202A32", "editorLineNumber.foreground": "#8C959E", "editorLineNumber.activeForeground": "#315DB5", "editor.selectionBackground": "#DCE7FC", "editor.inactiveSelectionBackground": "#EDF3FA", "editorCursor.foreground": "#315DB5", "editorIndentGuide.background1": "#ECEEF0", "editorWidget.background": "#FFFFFF", "editorWidget.border": "#D8DDE4", "focusBorder": "#315DB5" },
  });
  monaco.editor.defineTheme("decode-dark", {
    base: "vs-dark", inherit: true,
    rules: [{ token: "comment", foreground: "A5AFBA" }, { token: "keyword", foreground: "7FA5F4" }, { token: "string", foreground: "DFC18D" }, { token: "tag", foreground: "F2A582" }],
    colors: { "editor.background": "#19222C", "editor.foreground": "#F1F3F5", "editorLineNumber.foreground": "#8593A2", "editorLineNumber.activeForeground": "#A0BEFF", "editor.selectionBackground": "#354C70", "editor.inactiveSelectionBackground": "#2A3B51", "editorCursor.foreground": "#7FA5F4", "editorIndentGuide.background1": "#303B47", "editorWidget.background": "#202934", "editorWidget.border": "#303B47", "focusBorder": "#7FA5F4" },
  });
  return font;
}
export { monaco };
