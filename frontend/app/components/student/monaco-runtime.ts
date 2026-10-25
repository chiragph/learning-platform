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

export function editorFontFamily() {
  return getComputedStyle(document.body).getPropertyValue("--font-geist-mono").trim() || "Consolas, monospace";
}
export { monaco };
