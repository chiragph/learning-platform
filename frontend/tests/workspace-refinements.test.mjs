import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import React, { act, StrictMode } from "react";
import { JSDOM } from "jsdom";
import ts from "typescript";

const dependency = createRequire(import.meta.url);
const dom = new JSDOM("<!doctype html><body></body>", { url: "http://localhost/lessons/html-links-images", pretendToBeVisual: true });
const { window } = dom;
Object.assign(globalThis, { window, document: window.document, IS_REACT_ACT_ENVIRONMENT: true });
const { createRoot } = await import("react-dom/client");
function load(filename, mocks = {}, cache = new Map()) {
  filename = path.resolve(filename);
  if (cache.has(filename)) return cache.get(filename).exports;
  const compiledModule = { exports: {} }; cache.set(filename, compiledModule);
  const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  const require = specifier => {
    if (Object.hasOwn(mocks, specifier)) return mocks[specifier];
    if (specifier.endsWith(".css")) return {};
    if (!specifier.startsWith(".") && !specifier.startsWith("@/")) return dependency(specifier);
    const base = specifier.startsWith("@/") ? path.resolve(specifier.slice(2)) : path.resolve(path.dirname(filename), specifier);
    return load([base + ".ts", base + ".tsx"].find(fs.existsSync), mocks, cache);
  };
  vm.runInNewContext(source, { module: compiledModule, exports: compiledModule.exports, require, window, document, console, FileReader: window.FileReader, atob: window.atob.bind(window), crypto: globalThis.crypto, requestAnimationFrame: callback => setTimeout(callback, 0) }, { filename });
  return compiledModule.exports;
}
const imageLogic = load("app/lib/student/workspace-images.ts");
const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jX1kAAAAASUVORK5CYII=";
const image = (id = "11111111-1111-4111-8111-111111111111") => ({ id, name: 'A "small" image.png', data: png });
const plain = value => JSON.parse(JSON.stringify(value));

test("lesson images validate type, signature, size and storage budgets without touching code drafts", () => {
  const logic = imageLogic, storage = window.localStorage; storage.clear();
  assert.equal(logic.validateImageFile({ type: "image/png", size: 32 }), "");
  for (const type of ["image/svg+xml", "text/html", ""]) assert.match(logic.validateImageFile({ type, size: 32 }), /Choose a PNG/);
  for (const size of [0, 256 * 1024 + 1]) assert.match(logic.validateImageFile({ type: "image/jpeg", size }), /256 KiB/);
  assert.equal(logic.imageSignatureMatches(new Uint8Array([137,80,78,71,13,10,26,10]), "image/png"), true);
  assert.equal(logic.imageSignatureMatches(new Uint8Array([255,216,255]), "image/jpeg"), true);
  assert.equal(logic.imageSignatureMatches(new TextEncoder().encode("GIF89a"), "image/gif"), true);
  assert.equal(logic.imageSignatureMatches(new TextEncoder().encode("RIFF1234WEBP"), "image/webp"), true);
  assert.equal(logic.imageSignatureMatches(new TextEncoder().encode("<script>"), "image/png"), false);
  storage.setItem("decode-learning-v1-student", "existing drafts and progress");
  logic.saveWorkspaceImages(storage, "student", "lesson-a", [image()]);
  assert.equal(logic.readWorkspaceImages(storage, "student", "lesson-a")[0].data, png);
  assert.equal(logic.readWorkspaceImages(storage, "student", "lesson-b").length, 0);
  assert.equal(logic.readWorkspaceImages(storage, "other", "lesson-a").length, 0);
  const fresh = load("app/lib/student/workspace-images.ts");
  assert.equal(fresh.readWorkspaceImages(storage, "student", "lesson-a")[0].id, image().id);
  assert.equal(storage.getItem("decode-learning-v1-student"), "existing drafts and progress");
  assert.match(logic.imageTag(image()), /alt="A &quot;small&quot; image.png"/);
  assert.throws(() => logic.saveWorkspaceImages(storage, "student", "lesson-a", Array(5).fill(image())), /up to four/);
  assert.throws(() => logic.saveWorkspaceImages(storage, "student", "lesson-a", [{ ...image(), data: "data:image/svg+xml;base64,PHN2Zz4=" }]), /PNG/);
  const large = { ...image(), data: "data:image/png;base64," + "A".repeat(300000) };
  assert.throws(() => logic.saveWorkspaceImages(storage, "student", "lesson-b", [large, large, large]), /workspace’s image storage is full/);
  storage.setItem(logic.imageStorageKey("other", "huge"), "x".repeat(logic.MAX_TOTAL_IMAGE_CHARACTERS));
  assert.throws(() => logic.saveWorkspaceImages(storage, "student", "lesson-b", [image()]), /browser’s demo image storage is full/);
  storage.removeItem(logic.imageStorageKey("other", "huge"));
  const quota = { get length() { return 0; }, setItem() { throw new Error("quota"); } };
  assert.throws(() => logic.saveWorkspaceImages(quota, "student", "lesson-a", [image()]), /could not be saved/);
  logic.saveWorkspaceImages(storage, "student", "lesson-a", []);
  assert.equal(logic.readWorkspaceImages(storage, "student", "lesson-a").length, 0);
  storage.setItem(logic.imageStorageKey("student", "broken"), "{broken");
  assert.equal(logic.readWorkspaceImages(storage, "student", "broken").length, 0);
});

test("preview resolves only this lesson’s image references, reports missing images and preserves isolation", async () => {
  const { buildPreview } = load("app/lib/student/preview.ts");
  const code = { html: `<img src="${imageLogic.imageReference(image().id)}" alt="Local"><img src="decode-image:missing" alt="Removed"><img src="https://example.test/image.png" alt="Online">`, css: "", javascript: "" };
  const source = buildPreview(code, "image-test", undefined, { images: [image()], allowOnlineImages: true });
  assert.match(source, /img-src data: https:;/);
  for (const restriction of ["connect-src 'none'", "object-src 'none'", "frame-src 'none'", "worker-src 'none'", "base-uri 'none'"]) assert.ok(source.includes(restriction));
  assert.match(buildPreview(code, "playground"), /img-src data:;/);
  const messages = [], preview = new JSDOM(source, { runScripts: "dangerously", beforeParse(win) { win.postMessage = message => messages.push(message); } });
  try {
    const images = preview.window.document.querySelectorAll("img");
    assert.equal(images[0].getAttribute("src"), png);
    assert.equal(images[1].hasAttribute("src"), false); assert.match(images[1].alt, /local image missing/);
    assert.equal(images[2].getAttribute("src"), "https://example.test/image.png");
    assert.ok(messages.some(message => /local image is missing/.test(message.text)));
  } finally { preview.window.close(); }
});

test("image upload persists per lesson, inserts escaped HTML, confirms removal and aborts pending readers", async () => {
  window.localStorage.clear();
  const calls = [], inserted = [], instances = [];
  const NativeReader = window.FileReader;
  class TrackedReader extends NativeReader { constructor() { super(); instances.push(this); } abort() { this.aborted = true; super.abort(); } }
  window.FileReader = TrackedReader;
  const { WorkspaceImages } = load("app/components/student/workspace-images.tsx");
  const container = document.createElement("div"); document.body.append(container); const root = createRoot(container);
  const show = (workspaceId = "lesson-a") => act(() => root.render(React.createElement(StrictMode, null, React.createElement(WorkspaceImages, { studentId: "student", workspaceId, onImages: images => calls.push(plain(images)), onInsert: text => inserted.push(text) }))));
  async function upload(file) {
    const input = container.querySelector("input"); Object.defineProperty(input, "files", { configurable: true, value: [file] });
    await act(async () => { input.dispatchEvent(new window.Event("change", { bubbles: true })); await new Promise(resolve => { const active = instances.at(-1); if (active && active.readyState === 1) active.addEventListener("loadend", resolve, { once: true }); else resolve(); }); });
  }
  try {
    await show();
    await upload(new window.File(["not a PNG"], "bad.png", { type: "image/png" }));
    assert.match(container.textContent, /contents do not match/); assert.equal(calls.at(-1).length, 0);
    await upload(new window.File([Buffer.from(png.split(",")[1], "base64")], 'A "small" image.png', { type: "image/png" }));
    assert.equal(calls.at(-1).length, 1); assert.match(container.textContent, /Image saved for this lesson/);
    await act(() => [...container.querySelectorAll("button")].find(button => button.textContent === "Insert <img>").click());
    assert.match(inserted[0], /src="decode-image:/); assert.match(inserted[0], /&quot;small&quot;/);
    await show("lesson-b"); assert.equal(calls.at(-1).length, 0);
    await show(); assert.equal(calls.at(-1).length, 1, "reload/scope switch restores durable local assets");
    await act(() => container.querySelector('[aria-label^="Remove "]').click());
    assert.equal(calls.at(-1).length, 1, "removal needs confirmation");
    await act(() => [...container.querySelectorAll("button")].find(button => button.textContent === "Remove image").click());
    assert.equal(calls.at(-1).length, 0);
    const input = container.querySelector("input"); Object.defineProperty(input, "files", { configurable: true, value: [new window.File(["pending"], "pending.gif", { type: "image/gif" })] });
    await act(() => { input.dispatchEvent(new window.Event("change", { bubbles: true })); root.unmount(); });
    assert.equal(instances.at(-1).aborted, true);
  } finally { if (container.querySelector("input")) await act(() => root.unmount()); container.remove(); window.FileReader = NativeReader; }
});

// Real maintained Emmet provider/expander with a small Monaco API double. DOM
// rendering, real tokenizer loading and physical keyboard dispatch need a browser.
function emmetRuntime() {
  const providers = new Set(), editors = [];
  class Range { constructor(startLineNumber, startColumn, endLineNumber, endColumn) { Object.assign(this, { startLineNumber, startColumn, endLineNumber, endColumn }); } static isIRange(value) { return typeof value?.startColumn === "number"; } isEmpty() { return this.startColumn === this.endColumn && this.startLineNumber === this.endLineNumber; } }
  const position = column => ({ lineNumber: 1, column, equals: other => other?.lineNumber === 1 && other.column === column });
  const api = {
    Range, Uri: { parse: value => ({ toString: () => value }) }, MarkerSeverity: { Warning: 4 }, KeyMod: { CtrlCmd: 2048 }, KeyCode: { Tab: 2, Enter: 3, KeyS: 49 },
    languages: { CompletionItemKind: { Property: 9, Snippet: 27 }, CompletionItemInsertTextRule: { InsertAsSnippet: 4 }, CompletionTriggerKind: { Invoke: 0 }, registerCompletionItemProvider(language, provider) { assert.equal(language, "html"); providers.add(provider); return { dispose: () => providers.delete(provider) }; } },
    editor: {
      createModel(value, language, uri) {
        let version = 1;
        const model = { uri, value, invalidContext: false, disposed: false, getLanguageId: () => language, getValue: () => model.value, getLineContent: () => model.value, getFullModelRange: () => new Range(1, 1, 1, model.value.length + 1), getVersionId: () => version, changed: () => version++, dispose: () => { model.disposed = true; } };
        model.tokenization = { _tokenization: { _tokenizationStateStore: { getBeginState: () => ({ clone: () => ({}) }), tokenizationSupport: { tokenize: () => ({ tokens: [{ offset: 0, type: model.invalidContext ? "comment.html" : "", language: "html" }] }) } } } };
        return model;
      },
      getModelMarkers: () => [], onDidChangeMarkers: () => ({ dispose() {} }),
      create(_container, options) {
        let model = options.model, disposed = false, selection = new Range(1, model.value.length + 1, 1, model.value.length + 1);
        const listeners = new Set();
        const editor = { actions: new Map(), tabs: 0, snippets: [], getModel: () => model, getValue: () => model.value, getPosition: () => position(selection.endColumn), getSelection: () => selection, getSelections: () => [selection], setSelection: value => { selection = value; }, get disposed() { return disposed; },
          setValue(value) { model.value = value; model.changed(); selection = new Range(1, value.length + 1, 1, value.length + 1); listeners.forEach(callback => callback()); },
          trigger(_source, command, payload) { if (command === "tab") editor.tabs++; else { assert.equal(command, "editor.action.insertSnippet"); editor.snippets.push(payload.snippet); const text = payload.snippet.replace(/\$\{\d+(?::([^}]*))?\}/g, "$1"); editor.setValue(model.value.slice(0, selection.startColumn - 1) + text + model.value.slice(selection.endColumn - 1)); } },
          addAction(action) { editor.actions.set(action.id, action); return { dispose: () => editor.actions.delete(action.id) }; }, onDidChangeModelContent(callback) { listeners.add(callback); return { dispose: () => listeners.delete(callback) }; },
          dispose() { disposed = true; }, pushUndoStop() {}, focus() {}, layout() {}, updateOptions() {},
        }; editors.push(editor); return editor;
      },
    },
  };
  return { api, providers, editors };
}

test("HTML Tab expands all requested abbreviations through the real Emmet provider and disposes registrations", async () => {
  const fake = emmetRuntime(), { createEditorSession } = load("app/lib/student/editor-session.ts");
  const state = { path: "file:///a/index.html", language: "html", value: "", onChange: () => true, onDiagnostics() {}, onRun() {}, onSave() {} };
  const first = createEditorSession(fake.api, {}, () => state, {}), editor = fake.editors[0];
  const second = createEditorSession(fake.api, {}, () => ({ ...state, path: "file:///b/index.html" }), {});
  assert.equal(fake.providers.size, 1, "concurrent editors share a single language provider");
  const action = editor.actions.get("decode-emmet-tab"); assert.deepEqual(plain(action.keybindings), [fake.api.KeyCode.Tab]);
  for (const context of ["!editorTabMovesFocus", "!suggestWidgetVisible", "!inSnippetMode"]) assert.ok(action.precondition.includes(context));
  try {
    for (const abbreviation of ["h2", "p", "div", "ul>li*3", ".container", "lorem", "lorem10"]) {
      editor.setValue(abbreviation); await action.run();
      if (["h2", "p", "div"].includes(abbreviation)) assert.equal(editor.getValue(), `<${abbreviation}></${abbreviation}>`);
      if (abbreviation === "ul>li*3") { assert.equal((editor.getValue().match(/<li>/g) ?? []).length, 3); assert.match(editor.getValue(), /<ul>/); }
      if (abbreviation === ".container") assert.equal(editor.getValue(), '<div class="container"></div>');
      if (abbreviation.startsWith("lorem")) { const words = editor.getValue().trim().split(/\s+/); assert.ok(words.length >= 10); if (abbreviation === "lorem10") assert.equal(words.length, 10); }
    }
    assert.equal(editor.tabs, 0);
    editor.setValue("    "); await action.run(); assert.equal(editor.tabs, 1, "whitespace retains normal Tab indentation");
    editor.setValue("h2"); editor.getModel().invalidContext = true; await action.run(); assert.equal(editor.tabs, 2, "comments/invalid token contexts retain normal Tab");
    editor.getModel().invalidContext = false;
    const expanding = action.run(); first.dispose(); await expanding;
    assert.equal(fake.providers.size, 1, "disposing one editor keeps the other editor’s provider");
    assert.equal(first.focus(), false, "disposed session controls are inert");
  } finally { first.dispose(); second.dispose(); }
  assert.equal(fake.providers.size, 0);
  assert.equal(fake.editors.every(editor => editor.disposed && editor.actions.size === 0), true);
});
