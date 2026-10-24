import type { editor } from "monaco-editor";
import type { Subject } from "./types";

export const MAX_CODE_LENGTH = 100000;
export const fileNames: Record<Subject, string> = { html: "index.html", css: "styles.css", javascript: "script.js" };
export function modelBase(accountId: string, workspaceId: string, instanceId: string) {
  return `file:///decode/${encodeURIComponent(accountId)}/${encodeURIComponent(workspaceId)}/${encodeURIComponent(instanceId)}/`;
}
export function workerUrl(label: string) {
  const name = label === "javascript" || label === "typescript" ? "typescript" : ["html", "handlebars", "razor"].includes(label) ? "html" : ["css", "scss", "less"].includes(label) ? "css" : "editor";
  return `/monaco-workers/${name}.worker.js`;
}
export function clampSplit(value: number) { return Number.isFinite(value) ? Math.max(30, Math.min(70, Math.round(value))) : 50; }
export const editorOptions: editor.IStandaloneEditorConstructionOptions = {
  automaticLayout: true, fontSize: 14, lineHeight: 23, tabSize: 2, insertSpaces: true,
  autoIndent: "full", formatOnPaste: true, formatOnType: true, matchBrackets: "always",
  autoClosingBrackets: "always", autoClosingQuotes: "always", lineNumbers: "on",
  minimap: { enabled: false }, scrollBeyondLastLine: false, padding: { top: 16, bottom: 16 },
  roundedSelection: true, renderLineHighlight: "gutter", wordWrap: "on", folding: true,
  quickSuggestions: { other: true, comments: false, strings: true }, suggestOnTriggerCharacters: true,
  parameterHints: { enabled: true }, snippetSuggestions: "top", accessibilitySupport: "auto",
  stickyScroll: { enabled: false }, links: false, contextmenu: true, fixedOverflowWidgets: true,
};
