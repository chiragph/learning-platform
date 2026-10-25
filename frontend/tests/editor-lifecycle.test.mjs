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
Object.assign(globalThis, { window, FileReader: window.FileReader, atob: window.atob.bind(window), document: window.document, MutationObserver: window.MutationObserver, IS_REACT_ACT_ENVIRONMENT: true });
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
        let selection = { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 };
        const changes = new Set(), actions = new Map();
        function alive() { if (disposed) throw new Error("InstantiationService has been disposed"); }
        const editor = {
          options, actions, views: [], disposeCount: 0,
          focusCount: 0, layoutCount: 0,
          focus() { alive(); editor.focusCount++; }, layout() { alive(); editor.layoutCount++; },
          getSelection() { alive(); return selection; }, setSelection(value) { alive(); selection = value; },
          get disposed() { return disposed; },
          getModel() { alive(); return model; }, getValue() { alive(); return model.value; },
          setModel(next) { alive(); model = next; },
          setValue(value) { alive(); model.value = value; changes.forEach((listener) => listener({})); },
          executeEdits(_source, edits) { alive(); const edit = edits[0]; editor.setValue(edit.range.startColumn ? model.value.slice(0, edit.range.startColumn - 1) + edit.text + model.value.slice(edit.range.endColumn - 1) : edit.text); },
          pushUndoStop() { alive(); }, getOption() { alive(); return false; },
          saveViewState() { alive(); return { path: model.uri.toString(), selection }; },
          restoreViewState(view) { alive(); editor.views.push(view); if (view?.selection) selection = view.selection; },
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
  vm.runInNewContext(compiled, { module: compiledModule, exports: compiledModule.exports, require, console, window, document: window.document, MutationObserver: window.MutationObserver, Element: window.Element, URL: window.URL, crypto: globalThis.crypto, ResizeObserver: class { observe() {} disconnect() {} }, requestAnimationFrame: (callback) => setTimeout(callback, 0), cancelAnimationFrame: clearTimeout, process }, { filename });
  return compiledModule.exports;
}
function editorComponent(fake, initialize = () => Promise.resolve(fake.api)) {
  return loadModule("app/components/student/monaco-code-editor.tsx", {
    "@monaco-editor/react": { loader: { init: initialize } },
    "./editor-emmet": { acquireHtmlEmmet: () => ({ expand: async () => false, dispose() {} }) },
    "./monaco-runtime": { monaco: fake.api, editorFontFamily: () => "monospace" },
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
    assert.equal(fake.theme, "vs-dark"); assert.equal(fake.instances.length, 1);
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
    "next/navigation": { usePathname: () => window.location.pathname },
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

test("integrated lesson editors retain local drafts through reading mode and cached route lifecycle", async () => {
  const fake = runtime(), Editor = editorComponent(fake), target = root();
  const initial = { version: 1, lessons: [], quizzes: { html: { latest: 20, best: 60, attempts: 2, at: "2026-10-25T00:00:00Z" } }, challenges: [], projects: [], currentLesson: null, visits: [], activity: [], drafts: { "playground-welcome": { html: "Keep playground", css: "", javascript: "" } } };
  const Store = React.createContext(null);
  let snapshot = initial, currentPath = "/lessons/html-introduction";
  function Provider({ children }) {
    const [progress, setProgress] = React.useState(initial);
    const current = React.useRef(progress); snapshot = progress;
    const update = React.useCallback((change) => { current.current = change(current.current); setProgress(current.current); return true; }, []);
    return React.createElement(Store, { value: { progress, update, ready: true } }, children);
  }
  const cache = new Map();
  const mocks = {
    "./progress-provider": { useProgress: () => React.useContext(Store) },
    "./student-provider": { useStudent: () => ({ id: "student", label: "Demo", email: "student@example.test" }) },
    "next/navigation": { usePathname: () => currentPath },
    "next/link": { __esModule: true, default: ({ children, href, ...props }) => React.createElement("a", { ...props, href }, children) },
    "next/dynamic": { __esModule: true, default: () => Editor },
  };
  const LessonView = loadModule("app/components/student/lesson-view.tsx", mocks, cache).LessonView;
  const lessons = loadModule("app/lib/student/courses.ts", mocks, cache).allLessons;
  const a = lessons.find(l => l.id === "html-introduction"), b = lessons.find(l => l.id === "css-introduction");
  const show = async (active = "a") => {
    currentPath = "/lessons/" + (active === "a" ? a.id : b.id);
    window.history.replaceState(null, "", currentPath);
    const child = React.createElement(Provider, null,
      React.createElement(Activity, { mode: active === "a" ? "visible" : "hidden" }, React.createElement(LessonView, { lesson: a })),
      React.createElement(Activity, { mode: active === "b" ? "visible" : "hidden" }, React.createElement(LessonView, { lesson: b })));
    await act(async () => target.root.render(React.createElement(StrictMode, null, child)));
  };
  const practiceScrolls = []; window.HTMLElement.prototype.scrollIntoView = function(options) { practiceScrolls.push({ node: this, options }); };
  const practiceButton = id => [...panel(id).parentElement.querySelectorAll("button")].find(node => node.textContent.startsWith("Practice this lesson"));
  const panel = (id) => target.container.querySelector("#lesson-" + id + "-workspace");
  const button = (id, label) => [...panel(id).querySelectorAll("button")].find(node => node.textContent.trim() === label);
  window.scrollTo = () => {};
  try {
    await show(); assert.equal(fake.models.size, 1); assert.equal(fake.theme, "vs-dark");
    assert.equal(panel(a.id).hidden, false); assert.equal(target.container.querySelectorAll("iframe").length, 0);
    const first = fake.instances.at(-1);
    await act(() => first.setValue("<h1>Lesson A draft</h1>"));
    await act(() => button(a.id, "Save Draft").click());
    assert.equal(snapshot.drafts["lesson-" + a.id].html, "<h1>Lesson A draft</h1>");
    const read = [...target.container.querySelector(".student-theory-workspace").querySelectorAll("button")].find(node => node.textContent === "Read");
    await act(() => read.click());
    assert.equal(panel(a.id).hidden, true); assert.equal(first.disposeCount, 0);
    const readPractice = [...target.container.querySelector(".student-theory-workspace").querySelectorAll("button")].find(node => node.textContent.includes("Read & practice"));
    await act(() => practiceButton(a.id).click());
    assert.equal(first.focusCount, 1); assert.equal(practiceScrolls.length, 1);
    assert.equal(practiceScrolls[0].node.className, "student-ide-code");
    assert.deepEqual(JSON.parse(JSON.stringify(practiceScrolls[0].options)), { block: "start", behavior: "smooth" });
    await act(() => practiceButton(a.id).click());
    assert.equal(first.focusCount, 2); assert.equal(practiceScrolls.length, 2, "repeated practice clicks focus and scroll again");
    await act(() => readPractice.click());
    assert.equal(panel(a.id).hidden, false); assert.equal(fake.instances.at(-1), first);
    await act(() => button(a.id, "Run Code").click());
    const frame = panel(a.id).querySelector("iframe");
    assert.equal(frame.getAttribute("sandbox"), "allow-scripts");
    assert.ok(!frame.getAttribute("sandbox").includes("allow-same-origin"));
    assert.equal(snapshot.lessons.length, 0);

    await show("b");
    await act(() => practiceButton(b.id).click());
    assert.equal(fake.instances.at(-1).focusCount, 1, "lesson B owns its focus target");
    assert.equal(practiceScrolls.at(-1).node, panel(b.id).querySelector(".student-ide-code"));
    assert.equal(first.disposeCount, 1); assert.equal(fake.models.size, 1);
    assert.equal(fake.instances.at(-1).getValue(), "/* Write your CSS code here */");
    await act(() => fake.instances.at(-1).setValue("p { color: rebeccapurple; }"));
    await act(() => button(b.id, "Save Draft").click());
    assert.equal(snapshot.drafts["lesson-" + b.id].css, "p { color: rebeccapurple; }");
    for (let round = 0; round < 3; round++) {
      await show("a"); assert.equal(fake.instances.at(-1).getValue(), "<h1>Lesson A draft</h1>"); assert.equal(fake.models.size, 1);
      await show("b"); assert.equal(fake.instances.at(-1).getValue(), "p { color: rebeccapurple; }"); assert.equal(fake.models.size, 1);
    }
    await show("a");
    await act(() => button(a.id, "Reset").click());
    await act(() => button(a.id, "Replace editor contents").click());
    assert.equal(fake.instances.at(-1).getValue(), "<!-- Write your HTML code here -->");
    assert.equal(snapshot.drafts["lesson-" + a.id].html, "<h1>Lesson A draft</h1>", "Reset preserves the saved draft until Save");
    assert.equal(snapshot.drafts["playground-welcome"].html, "Keep playground");
    assert.equal(snapshot.lessons.length, 0); assert.equal(snapshot.quizzes.html.attempts, 2); assert.equal(snapshot.quizzes.html.best, 60);
    const instanceCount = fake.instances.length;
    await act(async () => { document.documentElement.dataset.theme = "dark"; });
    await act(async () => { document.documentElement.dataset.theme = "light"; });
    assert.equal(fake.theme, "vs-dark"); assert.equal(fake.instances.length, instanceCount);
    assert.equal(target.errors.length, 0);
  } finally { await target.dispose(); window.history.replaceState(null, "", "/playground"); assert.equal(fake.models.size, 0); assert.equal(fake.markerListeners.size, 0); }
});

test("page navigation resets only document scroll for new links and preserves history, hashes and editor offsets", async () => {
  let currentPath = "/dashboard";
  const { StudentNavigationProvider, useStudentPageEntry } = loadModule("app/components/student/page-navigation.tsx", {
    "next/navigation": { usePathname: () => currentPath },
  });
  const paths = ["/dashboard", "/courses", "/lessons/html-introduction", "/playground"];
  const target = root(), scrolls = []; window.scrollTo = options => scrolls.push(options);
  function Page({ id }) {
    useStudentPageEntry();
    return React.createElement("section", null, React.createElement("h1", null, id), React.createElement("div", { id: "editor-" + id, style: { overflow: "auto", height: 100 } }, "Code"));
  }
  function App({ active }) {
    return React.createElement(StudentNavigationProvider, null,
      React.createElement("nav", null, paths.map(pathname => React.createElement("a", { key: pathname, href: pathname, onClick: event => event.preventDefault() }, pathname))),
      paths.map(pathname => React.createElement(Activity, { key: pathname, mode: pathname === active ? "visible" : "hidden" }, React.createElement(Page, { id: pathname }))));
  }
  async function show(pathname, kind = "push", hash = "") {
    if (kind === "push") {
      const link = [...target.container.querySelectorAll("a")].find(a => a.getAttribute("href") === pathname);
      if (hash) link.setAttribute("href", pathname + hash);
      await act(() => link.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })));
      if (hash) link.setAttribute("href", pathname);
    }
    currentPath = pathname;
    window.history.replaceState(null, "", pathname + hash);
    if (kind === "pop") window.dispatchEvent(new window.PopStateEvent("popstate"));
    await act(async () => target.root.render(React.createElement(StrictMode, null, React.createElement(App, { active: pathname }))));
  }
  try {
    window.history.replaceState(null, "", currentPath);
    await act(async () => target.root.render(React.createElement(StrictMode, null, React.createElement(App, { active: currentPath }))));
    assert.equal(scrolls.length, 1);
    const editor = [...target.container.querySelectorAll("div[id]")].find(node => node.id === "editor-/dashboard"); editor.scrollTop = 44;
    for (const pathname of paths.slice(1)) await show(pathname);
    assert.equal(scrolls.length, 4); assert.ok(scrolls.every(options => options.top === 0 && options.behavior === "instant"));
    await show("/dashboard"); assert.equal(scrolls.length, 5, "new link to a cached page resets document position");
    assert.equal(editor.scrollTop, 44, "nested editor scrolling is retained");
    await show("/playground", "pop"); assert.equal(scrolls.length, 5);
    await show("/dashboard", "pop"); assert.equal(scrolls.length, 5);
    await show("/courses", "push", "#html-first-page"); assert.equal(scrolls.length, 5, "hash positioning belongs to the browser");
    assert.equal(editor.scrollTop, 44); assert.equal(target.errors.length, 0);
  } finally { await target.dispose(); window.history.replaceState(null, "", "/playground"); }
});

test("a reloaded or back-forward document retains browser scroll restoration", async () => {
  const { useStudentPageEntry } = loadModule("app/components/student/page-navigation.tsx", {
    "next/navigation": { usePathname: () => window.location.pathname },
  });
  const original = window.performance.getEntriesByType, scrolls = []; window.scrollTo = options => scrolls.push(options);
  function Page() { useStudentPageEntry(); return React.createElement("h1", null, "Lesson"); }
  try {
    for (const type of ["reload", "back_forward"]) {
      Object.defineProperty(window.performance, "getEntriesByType", { configurable: true, value: () => [{ type }] });
      const target = root();
      try { await render(target, React.createElement(Page)); assert.equal(scrolls.length, 0); }
      finally { await target.dispose(); }
    }
  } finally { Object.defineProperty(window.performance, "getEntriesByType", { configurable: true, value: original }); }
});

test("practice waits for Monaco readiness, respects reduced motion, and cancels obsolete focus requests", async () => {
  const fake = runtime(), pending = [], Editor = editorComponent(fake, () => new Promise(resolve => pending.push(resolve))), target = root();
  const cache = new Map(), scrolls = [], originalMotion = window.matchMedia;
  window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
  window.HTMLElement.prototype.scrollIntoView = function(options) { scrolls.push({ node: this, options }); };
  window.scrollTo = () => {};
  const initial = { version: 1, lessons: [], quizzes: {}, challenges: [], projects: [], visits: [], activity: [], drafts: {} };
  const mocks = {
    "./progress-provider": { useProgress: () => ({ progress: initial, update: () => true }) },
    "./student-provider": { useStudent: () => ({ id: "delayed-student", label: "Demo" }) },
    "next/navigation": { usePathname: () => "/lessons/html-introduction" },
    "next/link": { __esModule: true, default: ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children) },
    "next/dynamic": { __esModule: true, default: () => Editor },
  };
  const Lesson = loadModule("app/components/student/lesson-view.tsx", mocks, cache).LessonView;
  const lesson = loadModule("app/lib/student/courses.ts", mocks, cache).allLessons[0];
  const child = React.createElement(Lesson, { lesson });
  const click = label => act(() => [...target.container.querySelectorAll("button")].find(button => button.textContent.trim().startsWith(label)).click());
  try {
    await render(target, child);
    await click("Read"); await click("Practice this lesson");
    assert.equal(scrolls.length, 0, "loading editor cannot receive focus");
    await act(() => pending.at(-1)(fake.api));
    assert.equal(scrolls.length, 1); assert.equal(scrolls[0].options.behavior, "instant"); assert.equal(fake.instances.at(-1).focusCount, 1);
    await render(target, child, "hidden"); await render(target, child);
    await click("Practice this lesson");
    const count = scrolls.length;
    await render(target, child, "hidden");
    await act(() => pending.forEach(resolve => resolve(fake.api)));
    assert.equal(scrolls.length, count, "a late loader cannot focus the hidden lesson");
    await render(target, child);
    await act(() => pending.at(-1)(fake.api));
    assert.equal(scrolls.length, count, "cached route restoration does not replay old practice scrolling");
    await click("Practice this lesson");
    assert.equal(scrolls.length, count + 1); assert.equal(target.errors.length, 0);
  } finally { await target.dispose(); window.matchMedia = originalMotion; }
});

test("lesson image insertion switches to the HTML model, uses its cursor, and preserves other files and progress", async () => {
  const fake = runtime(), Editor = editorComponent(fake), target = root();
  const image = { id: "11111111-1111-4111-8111-111111111111", name: "Test.png", data: "data:image/png;base64,iVBORw0KGgo=" };
  window.localStorage.setItem("decode-images-v1-student/lesson-image-test", JSON.stringify([image]));
  let progress = { version: 1, lessons: ["html-introduction"], quizzes: {}, challenges: [], projects: [], activity: [], visits: [], drafts: { "lesson-image-test": { html: "<main></main>", css: "p { color: blue; }", javascript: "console.log('keep')" }, "lesson-other": { html: "Other draft", css: "", javascript: "" } } };
  const before = JSON.stringify(progress);
  const { CodeWorkspace } = loadModule("app/components/student/code-workspace.tsx", {
    "./progress-provider": { useProgress: () => ({ progress, update: change => { progress = change(progress); return true; } }) },
    "./student-provider": { useStudent: () => ({ id: "student" }) },
    "next/dynamic": { __esModule: true, default: () => Editor },
  });
  window.HTMLElement.prototype.scrollIntoView = () => {};
  const click = text => act(() => [...target.container.querySelectorAll("button")].find(button => button.textContent.trim() === text).click());
  try {
    await render(target, React.createElement(CodeWorkspace, { workspaceId: "lesson-image-test", starter: { html: "Blank", css: "", javascript: "" }, embedded: true }));
    const editor = fake.instances.at(-1);
    editor.setSelection({ startLineNumber: 1, startColumn: 7, endLineNumber: 1, endColumn: 7 });
    await act(() => target.container.querySelector('[role="tab"][id$="css"]').click());
    assert.equal(editor.getValue(), "p { color: blue; }");
    await click("Insert <img>");
    assert.equal(target.container.querySelector('[role="tab"][id$="html"]').getAttribute("aria-selected"), "true");
    assert.equal(editor.getValue(), `<main><img src="decode-image:${image.id}" alt="Test.png"></main>`);
    assert.equal(JSON.stringify(progress), before, "insertion never saves drafts or grants completion implicitly");
    await click("Save Draft");
    assert.equal(progress.drafts["lesson-image-test"].css, "p { color: blue; }");
    assert.equal(progress.drafts["lesson-image-test"].javascript, "console.log('keep')");
    assert.equal(progress.drafts["lesson-other"].html, "Other draft");
    assert.equal(progress.lessons.length, 1);
    await click("Run Code");
    const frame = target.container.querySelector("iframe");
    assert.equal(frame.getAttribute("sandbox"), "allow-scripts");
    assert.ok(frame.srcdoc.includes(image.data));
    assert.equal(target.errors.length, 0);
  } finally { await target.dispose(); window.localStorage.removeItem("decode-images-v1-student/lesson-image-test"); }
});
