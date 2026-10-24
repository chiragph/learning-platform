import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import React, { act, Activity, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import ts from "typescript";

const dependency = createRequire(import.meta.url);
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/playground" });
const { window } = dom;
Object.assign(globalThis, { window, document: window.document, MutationObserver: window.MutationObserver, IS_REACT_ACT_ENVIRONMENT: true });
window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

// Real React effects and Activity boundaries; only Monaco's DOM/canvas services
// are replaced. Every fake editor method fails if used after disposal.
function runtime() {
  const models = new Map(), instances = [], markerListeners = new Set(), order = [];
  const uri = (value) => ({ path: value, toString: () => value });
  const disposable = (remove = () => {}) => ({ dispose: remove });
  let theme;
  const api = {
    Uri: { parse: uri }, MarkerSeverity: { Warning: 4 }, KeyMod: { CtrlCmd: 2048 }, KeyCode: { Enter: 3, KeyS: 49 },
    editor: {
      EditorOption: { readOnly: 1 },
      getModel: (key) => models.get(key.toString()), getModels: () => [...models.values()],
      createModel(value, language, key) {
        assert.ok(!models.has(key.toString()), "model URI must have one owner");
        const model = { value, language, uri: key, markers: [], disposed: false, getValue: () => model.value, getFullModelRange: () => ({}),
          dispose() { assert.ok(!model.disposed, "model disposed twice"); model.disposed = true; order.push("model"); models.delete(key.toString()); } };
        models.set(key.toString(), model); return model;
      },
      setModelLanguage(model, language) { model.language = language; },
      getModelMarkers: ({ resource }) => models.get(resource.toString())?.markers ?? [],
      onDidChangeMarkers(listener) { markerListeners.add(listener); return disposable(() => markerListeners.delete(listener)); },
      setTheme(value) { theme = value; },
      create(_container, options) {
        let model = options.model, disposed = false;
        const changes = new Set(), actions = new Map();
        function alive() { if (disposed) throw new Error("InstantiationService has been disposed"); }
        const editor = {
          options, actions, views: [], disposeCount: 0,
          get disposed() { return disposed; },
          getModel() { alive(); return model; }, getValue() { alive(); return model.value; },
          setModel(next) { alive(); model = next; },
          setValue(value) { alive(); model.value = value; changes.forEach((listener) => listener({})); },
          executeEdits(_source, edits) { alive(); editor.setValue(edits[0].text); },
          pushUndoStop() { alive(); }, getOption() { alive(); return false; },
          saveViewState() { alive(); return { path: model.uri.toString() }; },
          restoreViewState(view) { alive(); editor.views.push(view); },
          updateOptions(next) { alive(); Object.assign(editor.options, next); },
          addAction(action) { alive(); actions.set(action.id, action); return disposable(() => actions.delete(action.id)); },
          onDidChangeModelContent(listener) { alive(); changes.add(listener); return disposable(() => changes.delete(listener)); },
          dispose() { alive(); disposed = true; editor.disposeCount++; changes.clear(); order.push("editor"); },
        };
        instances.push(editor); theme = options.theme; return editor;
      },
    },
  };
  return { api, instances, models, order, markerListeners, get theme() { return theme; }, markers(model) { markerListeners.forEach((listener) => listener([model.uri])); } };
}

function loadModule(filename, mocks, cache = new Map()) {
  filename = path.resolve(filename);
  if (cache.has(filename)) return cache.get(filename).exports;
  const compiledModule = { exports: {} }; cache.set(filename, compiledModule);
  const source = fs.readFileSync(filename, "utf8");
  const compiled = filename.endsWith(".js") ? source : ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  function require(specifier) {
    if (Object.hasOwn(mocks, specifier)) return mocks[specifier];
    if (specifier.endsWith(".css")) return {};
    if (!specifier.startsWith(".") && !specifier.startsWith("@/")) return dependency(specifier);
    const base = specifier.startsWith("@/") ? path.resolve(specifier.slice(2)) : path.resolve(path.dirname(filename), specifier);
    return loadModule([base + ".ts", base + ".tsx", base + ".js"].find(fs.existsSync), mocks, cache);
  }
  vm.runInNewContext(compiled, { module: compiledModule, exports: compiledModule.exports, require, console, window, document: window.document, MutationObserver: window.MutationObserver, process }, { filename });
  return compiledModule.exports;
}
function editorComponent(fake, initialize = () => Promise.resolve(fake.api)) {
  return loadModule("app/components/student/monaco-code-editor.tsx", {
    "@monaco-editor/react": { loader: { init: initialize } },
    "./monaco-runtime": { monaco: fake.api, defineDecodeThemes: () => "monospace" },
  }).default;
}
function state(language = "html", value = "<h1>Draft</h1>") {
  return { base: "file:///decode/student/workspace/instance/", path: `file:///decode/student/workspace/instance/${language}`, language, value, onChange: () => true, onRun() {}, onSave() {}, onReady() {}, onDiagnostics() {} };
}
function root() {
  const container = document.createElement("div"); document.body.append(container);
  const errors = [];
  const root = createRoot(container, { onUncaughtError: (error) => errors.push(error) });
  return { root, errors, container, async dispose() { await act(() => root.unmount()); container.remove(); } };
}
async function render(target, child, mode = "visible") {
  await act(async () => { target.root.render(React.createElement(StrictMode, null, React.createElement(Activity, { mode }, child))); });
}

test("characterization: installed React wrapper reuses a disposed editor on Activity resume", async () => {
  const fake = runtime();
  const initialize = () => Object.assign(Promise.resolve(fake.api), { cancel() {} });
  const integration = loadModule("node_modules/@monaco-editor/react/dist/index.js", { "@monaco-editor/loader": { __esModule: true, default: { init: initialize } } });
  const target = root();
  const child = React.createElement(integration.default, { path: "file:///characterization.html", language: "html", value: "<p>test</p>", onMount: (editor) => editor.updateOptions({ fontSize: 14 }) });
  try {
    await render(target, child); assert.equal(target.errors.length, 0);
    await render(target, child, "hidden");
    await assert.rejects(() => render(target, child), (error) => (error.errors ?? [error]).some((cause) => cause.message === "InstantiationService has been disposed"), "the unmodified installed wrapper must reproduce the reported error");
  } finally { await target.dispose(); }
});

test("editor survives Strict Mode and repeated Activity navigation, tabs and theme changes", async () => {
  const fake = runtime(), Editor = editorComponent(fake), target = root();
  let props = state(), changed = [], runs = 0, saves = 0, diagnostics = [];
  props.onChange = (value) => { changed.push(value); props = { ...props, value }; return true; };
  props.onRun = () => runs++; props.onSave = () => saves++; props.onDiagnostics = (count) => diagnostics.push(count);
  const show = (mode) => render(target, React.createElement(Editor, props), mode);
  try {
    await show(); assert.equal(fake.instances.length, 1, "cancelled Strict Mode initialization cannot create an editor");
    const first = fake.instances.at(-1);
    await act(() => first.setValue("<p>Unsaved source</p>")); await show();
    assert.equal(changed.at(-1), "<p>Unsaved source</p>");
    for (let round = 0; round < 8; round++) {
      for (const [language, value] of [["css", "p { color: blue; }"], ["javascript", "console.log('draft')"], ["html", "<p>Unsaved source</p>"]]) {
        props = { ...props, ...state(language, value), onChange: props.onChange, onRun: props.onRun, onSave: props.onSave, onDiagnostics: props.onDiagnostics };
        await show();
        assert.equal(fake.instances.at(-1).getValue(), value);
      }
    }
    assert.equal(fake.instances.length, 1, "tabs reuse the editor"); assert.equal(fake.models.size, 3);
    assert.equal(changed.length, 1, "tab/model synchronization must not write a file using another tab's callback");
    assert.ok(first.views.some((view) => view?.path.endsWith("html")), "per-file view state restores");
    const model = first.getModel(); model.markers = [{ severity: 4 }, { severity: 8 }, { severity: 1 }];
    await act(() => fake.markers(model)); assert.equal(diagnostics.at(-1), 2);
    await act(async () => { document.documentElement.dataset.theme = "dark"; });
    assert.equal(fake.theme, "decode-dark"); assert.equal(fake.instances.length, 1);
    first.actions.get("decode-run").run(); first.actions.get("decode-save").run();
    assert.equal(runs, 1); assert.equal(saves, 1);
    props = { ...props, onRun: () => runs += 10, onSave: () => saves += 10 };
    await show();
    first.actions.get("decode-run").run(); first.actions.get("decode-save").run();
    assert.equal(runs, 11); assert.equal(saves, 11, "actions use the latest committed callbacks");
    for (let round = 0; round < 5; round++) {
      await show("hidden");
      assert.equal(fake.models.size, 0); assert.equal(fake.markerListeners.size, 0);
      await show();
      assert.equal(fake.instances.at(-1).getValue(), "<p>Unsaved source</p>");
      assert.equal(fake.models.size, 1); assert.equal(fake.markerListeners.size, 1);
    }
    assert.equal(target.errors.length, 0);
    assert.equal(first.disposeCount, 1);
    assert.deepEqual(fake.order.slice(0, 4), ["editor", "model", "model", "model"]);
  } finally {
    await target.dispose(); await act(async () => { document.documentElement.dataset.theme = "light"; });
    assert.equal(fake.models.size, 0); assert.equal(fake.markerListeners.size, 0);
  }
});

test("late Monaco initialization cannot resurrect an unmounted or replaced editor", async () => {
  const fake = runtime(), pending = [];
  const Editor = editorComponent(fake, () => new Promise((resolve) => pending.push(resolve)));
  const target = root();
  try {
    await render(target, React.createElement(Editor, state()));
    assert.equal(pending.length, 2); // Strict Mode setup -> cleanup -> setup
    await render(target, React.createElement(Editor, state()), "hidden");
    await render(target, React.createElement(Editor, state()));
    await act(() => pending.at(-1)(fake.api));
    assert.equal(fake.instances.length, 1);
    await act(() => { pending.slice(0, -1).forEach((resolve) => resolve(fake.api)); });
    assert.equal(fake.instances.length, 1, "obsolete loader completions are ignored");
    await render(target, null);
    assert.equal(fake.models.size, 0); assert.equal(fake.instances[0].disposeCount, 1);
    assert.equal(target.errors.length, 0);
  } finally { await target.dispose(); }
});

test("rejected oversized edit rolls back without duplicate change callbacks; reset releases all tab models", async () => {
  const fake = runtime(), Editor = editorComponent(fake), target = root(); let calls = 0;
  let props = { ...state(), onChange: () => { calls++; return false; } };
  try {
    await render(target, React.createElement(Editor, props));
    const editor = fake.instances.at(-1);
    editor.setValue("x".repeat(100001));
    assert.equal(editor.getValue(), props.value); assert.equal(calls, 1);
    props = { ...props, ...state("css", "p {}") };
    await render(target, React.createElement(Editor, props)); assert.equal(fake.models.size, 2);
    await render(target, React.createElement(Editor, { ...state("html", "<h1>Starter</h1>") , key: "reset" }));
    assert.equal(editor.disposeCount, 1); assert.equal(fake.models.size, 1);
    assert.equal(fake.instances.at(-1).getValue(), "<h1>Starter</h1>");
    assert.equal(target.errors.length, 0);
  } finally { await target.dispose(); }
});

test("playground enters at the heading once, preserving cached restoration and hash navigation", async () => {
  const Playground = loadModule("app/components/student/playground-view.tsx", {
    "./code-workspace": { CodeWorkspace: () => React.createElement("div", null, "workspace") },
    "./learning-overview": { PageHeading: ({ title }) => React.createElement("h1", null, title) },
  }).PlaygroundView;
  const target = root(), scrolls = [];
  window.scrollTo = (options) => scrolls.push(options);
  try {
    await render(target, React.createElement(Playground));
    assert.equal(scrolls.length, 1); assert.equal(scrolls[0].top, 0); assert.equal(scrolls[0].behavior, "instant");
    await render(target, React.createElement(Playground), "hidden");
    await render(target, React.createElement(Playground));
    assert.equal(scrolls.length, 1, "cached route restoration is untouched");
    await render(target, null); window.location.hash = "saved-section";
    await render(target, React.createElement(Playground));
    assert.equal(scrolls.length, 1, "explicit hash targets are untouched");
    assert.equal(target.errors.length, 0);
  } finally { await target.dispose(); window.history.replaceState(null, "", "/playground"); }
});
