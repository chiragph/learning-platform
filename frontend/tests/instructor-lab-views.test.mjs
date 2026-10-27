import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import React, { act, StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { JSDOM, VirtualConsole } from "jsdom";
import ts from "typescript";

const dom = new JSDOM("<!doctype html><body></body>", { url: "http://localhost/instructor/labs/exercise%3Ahtml-heading", pretendToBeVisual: true }), { window } = dom;
Object.assign(globalThis, { window, document: window.document, IS_REACT_ACT_ENVIRONMENT: true });
window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
window.HTMLDialogElement.prototype.close = function () { this.open = false; };
window.confirm = () => false;
window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
const { createRoot, hydrateRoot } = await import("react-dom/client"), dependency = createRequire(import.meta.url);
function application(runtime) {
  const cache = new Map(), navigation = [];
  function load(file) {
    file = path.resolve(file); if (cache.has(file)) return cache.get(file).exports;
    const compiled = { exports: {} }; cache.set(file, compiled);
    const source = ts.transpileModule(fs.readFileSync(file.endsWith("/progress-provider.tsx") || file.endsWith("\\progress-provider.tsx") ? path.resolve("tests/fixtures/local-progress-provider.txt") : file, "utf8"), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    function require(specifier) {
      if (specifier === "../../lib/instructor/remote-repository") return { RemoteInstructorRepository: load("app/lib/instructor/repository.ts").LocalInstructorRepository };
      if (specifier.endsWith(".css")) return {};
      if (specifier === "next/link") return { __esModule: true, default: ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children) };
      if (specifier === "../student/monaco-runtime" && runtime) return runtime;
      if (specifier === "next/dynamic") return { __esModule: true, default: () => props => React.createElement("textarea", { "aria-label": `Syntax ${props.language}`, value: props.value, readOnly: props.readOnly, onChange: e => props.onChange(e.target.value) }) };
      if (specifier === "next/navigation") return { usePathname: () => window.location.pathname, useSearchParams: () => new URLSearchParams(window.location.search), useRouter: () => ({ push: href => navigation.push(href) }) };
      if (!specifier.startsWith(".") && !specifier.startsWith("@/")) return dependency(specifier);
      const base = specifier.startsWith("@/") ? path.resolve(specifier.slice(2)) : path.resolve(path.dirname(file), specifier);
      return load([base + ".ts", base + ".tsx"].find(fs.existsSync));
    }
    vm.runInNewContext(source, { module: compiled, exports: compiled.exports, require, window, document, console, Error, MutationObserver: window.MutationObserver, localStorage: window.localStorage, FormData: window.FormData, Element: window.Element, structuredClone, URL, crypto: globalThis.crypto, requestAnimationFrame: window.requestAnimationFrame.bind(window) }, { filename: file });
    return compiled.exports;
  }
  const { InstructorProvider } = load("app/components/instructor/instructor-provider.tsx");
  return { load, navigation, tree: (View, props) => React.createElement(StrictMode, null, React.createElement(InstructorProvider, null, React.createElement(View, props))) };
}
async function routeElement(app, href) {
  const url = new URL(href, "http://localhost"), Page = app.load("app/instructor/labs/[activityId]/page.tsx").default;
  const page = Page({ params: Promise.resolve({ activityId: url.pathname.slice("/instructor/labs/".length) }), searchParams: Promise.resolve({ preview: url.searchParams.get("preview") ?? undefined }) });
  assert.equal(page.type, React.Suspense); return page.props.children.type(page.props.children.props);
}
async function mount(name, exportName, props, stored, { href = "/instructor/labs/exercise%3Ahtml-heading", hydrate = false, route = false } = {}) {
  window.localStorage.clear(); window.history.replaceState(null, "", href);
  if (stored) window.localStorage.setItem("decode-instructor-preview-v1", typeof stored === "string" ? stored : JSON.stringify(stored));
  const app = application(), element = route ? await routeElement(app, href) : { type: app.load(`app/components/instructor/${name}.tsx`)[exportName], props }, tree = app.tree(element.type, element.props), node = document.createElement("div"), errors = []; document.body.append(node); let root;
  if (hydrate) { node.innerHTML = renderToString(tree); assert.doesNotMatch(node.textContent, /Coding lab not found/); await act(async () => { root = hydrateRoot(node, tree, { onRecoverableError: error => errors.push(error) }); }); }
  else { root = createRoot(node); await act(async () => root.render(tree)); }
  return { app, node, errors, async renderRoute(nextHref) { window.history.replaceState(null, "", nextHref); const next = await routeElement(app, nextHref); await act(async () => root.render(app.tree(next.type, next.props))); }, async close() { await act(async () => root.unmount()); node.remove(); } };
}
const button = (root, text) => [...root.querySelectorAll("button")].find(b => b.textContent.trim().replace(/^＋\s*/, "") === text);
async function click(node) { assert.ok(node, "Expected an actionable element"); await act(async () => node.click()); }
async function value(node, text) {
  assert.ok(node, "Expected a field"); await act(async () => { const proto = node.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : node.tagName === "SELECT" ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, "value").set.call(node, text); node.dispatchEvent(new window.Event(node.tagName === "SELECT" ? "change" : "input", { bubbles: true })); });
}
async function submit(root) { await act(async () => root.querySelector("form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }))); }
const content = () => ({ title: "Local heading lab", objective: "Build a semantic heading", instructions: "Add an h1 with Hello.", hints: "Use h1", starter: { html: "<h1>Hello</h1>\n", css: "body {\n  padding: 16px;\n}\n", javascript: "// Local code\n\n" }, solution: "Expected: Hello", widths: [320, 800], checks: [{ id: "heading", description: "Heading exists", type: "element", selector: "h1", min: 1, max: 1 }, { id: "runtime", type: "runtime", description: "No script errors" }] });
function fixture() {
  const app = application(), repo = app.load("app/lib/instructor/repository.ts"); let state = repo.seedInstructorState();
  function run(command) { const result = repo.applyInstructorCommand(state, command); state = result.state; return result.id; }
  const courseId = run({ type: "course.create", id: "local-lab-course", fields: { title: "Local lab course", description: "Practice labs", category: "Web development", difficulty: "Beginner", duration: "1 hour", objectives: ["Build a page"], color: "blue", icon: "code" } });
  const moduleId = run({ type: "module.create", courseId, title: "Local lab module", description: "Local sequence" });
  const activityId = run({ type: "activity.create", courseId, moduleId, activityType: "lab", title: "New local lab", description: "A practical task" });
  return { app, run, courseId, moduleId, activityId, get state() { return state; }, save(content) { const draft = state.lab?.drafts[activityId]; run({ type: "lab.save", courseId, moduleId, activityId, content, expectedUpdatedAt: draft?.updatedAt ?? null, expectedRevision: draft?.revision ?? null }); } };
}

test("Lab library lists six originals once, composes course/module/status/title filters and exposes both navigation actions", async () => {
  const page = await mount("lab-library", "LabLibrary");
  try {
    assert.equal(page.node.querySelectorAll('.ins-lab-row').length, 6); assert.ok(page.node.querySelector('a[href="/instructor/labs/exercise%3Ahtml-heading"]')); assert.ok(page.node.querySelector('a[href="/instructor/labs/exercise%3Ahtml-heading?preview=1"]'));
    await value(page.node.querySelector('[aria-label="Filter labs by course"]'), "html"); assert.equal(page.node.querySelectorAll('.ins-lab-row').length, 2);
    const moduleSelect = page.node.querySelector('[aria-label="Filter labs by module"]'); await value(moduleSelect, moduleSelect.options[1].value); assert.ok(page.node.querySelectorAll('.ins-lab-row').length < 2);
    await value(page.node.querySelector('[aria-label="Filter labs by course"]'), "all"); assert.equal(moduleSelect.value, "all");
    await value(page.node.querySelector('[type="search"]'), "no matching lab"); assert.match(page.node.textContent, /No matching labs/);
    await value(page.node.querySelector('[type="search"]'), ""); await value(page.node.querySelector('[aria-label="Filter labs by status"]'), "working"); assert.equal(page.node.querySelectorAll('.ins-lab-row').length, 0);
  } finally { await page.close(); }
});

test("encoded seeded lab URLs hydrate, save separate working drafts and reopen after refresh without altering originals", async () => {
  let page = await mount(null, null, null, undefined, { route: true, hydrate: true }), raw;
  try {
    assert.equal(page.errors.length, 0); assert.match(page.node.textContent, /Published Original \/ Working Draft/); assert.equal(page.node.querySelectorAll('.ins-lab-check').length, 4);
    const before = JSON.stringify(page.app.load("app/lib/instructor/repository.ts").seedInstructorState().courses);
    await value(page.node.querySelector('[aria-label="Lab title"]'), "Local HTML lab revision"); await click(button(page.node, "Save Draft")); assert.match(page.node.textContent, /Lab working draft saved/); raw = window.localStorage.getItem("decode-instructor-preview-v1"); assert.equal(JSON.stringify(JSON.parse(raw).courses), before);
  } finally { await page.close(); }
  for (const href of ["/instructor/labs/exercise%3Ahtml-heading", "/instructor/labs/exercise:html-heading", "/instructor/labs/exercise%3Ahtml-heading?preview=1"]) {
    page = await mount(null, null, null, raw, { route: true, hydrate: true, href });
    try { assert.equal(page.errors.length, 0); assert.match(page.node.textContent, /Local HTML lab revision/); assert.equal(window.localStorage.getItem("decode-instructor-preview-v1"), raw); }
    finally { await page.close(); }
  }
});

test("new lab editor preserves all starter tabs and multiline whitespace through Save Draft and refresh", async () => {
  const local = fixture(); let page = await mount("lab-editor", "LabEditor", { activityId: local.activityId }, local.state), raw;
  try {
    for (const [label, text] of [["Learning objective", content().objective], ["Task instructions", content().instructions], ["Lab hints", content().hints], ["Solution reference", content().solution]]) await value(page.node.querySelector(`[aria-label="${label}"]`), text);
    for (const key of ["html", "css", "javascript"]) { await click(button(page.node, key === "javascript" ? "JavaScript" : key.toUpperCase())); await value(page.node.querySelector(`[aria-label="Syntax ${key}"]`), content().starter[key]); }
    assert.match(page.node.textContent, /Unsaved changes/); await click(button(page.node, "Save Draft")); raw = window.localStorage.getItem("decode-instructor-preview-v1"); assert.deepEqual(JSON.parse(raw).lab.drafts[local.activityId].starter, content().starter); assert.match(page.node.querySelector('.ins-readiness').textContent, /Incomplete Draft/);
  } finally { await page.close(); }
  page = await mount(null, null, null, raw, { route: true, hydrate: true, href: `/instructor/labs/${local.activityId}` });
  try { assert.equal(page.errors.length, 0); assert.equal(page.node.querySelector('[aria-label="Syntax html"]').value, content().starter.html); await click(button(page.node, "CSS")); assert.equal(page.node.querySelector('[aria-label="Syntax css"]').value, content().starter.css); assert.equal(button(page.node, "Save Draft").disabled, true); }
  finally { await page.close(); }
});

test("validation builder adds, configures, reorders, cancels/confirms deletion and persists readiness", async () => {
  const local = fixture(); local.save(content()); const page = await mount("lab-editor", "LabEditor", { activityId: local.activityId }, local.state);
  try {
    await click(button(page.node, "Add Check")); let check = page.node.querySelectorAll('.ins-lab-check')[2]; await value(check.querySelector('[aria-label="Check description"]'), "Heading has text"); await value(check.querySelector('[aria-label="Validation type"]'), "text"); await value(check.querySelector('[aria-label="Element selector"]'), "h1"); await value(check.querySelector('[aria-label="Expected value"]'), "Hello");
    assert.match(page.node.querySelector('.ins-readiness').textContent, /Ready for Publication/); const id = check.id; await click(page.node.querySelector('[aria-label="Move check 3 up"]')); assert.equal(page.node.querySelectorAll('.ins-lab-check')[1].id, id);
    await click(page.node.querySelector('[aria-label="Delete check 1"]')); assert.equal(document.activeElement.textContent, "Cancel"); await click(button(page.node.querySelector('dialog'), "Cancel")); assert.equal(page.node.querySelectorAll('.ins-lab-check').length, 3);
    await click(page.node.querySelector('[aria-label="Delete check 1"]')); await click(button(page.node.querySelector('dialog'), "Delete Check")); assert.equal(page.node.querySelectorAll('.ins-lab-check').length, 2); await click(button(page.node, "Save Draft"));
    const saved = JSON.parse(window.localStorage.getItem("decode-instructor-preview-v1")).lab.drafts[local.activityId]; assert.equal(saved.checks[0].description, "Heading has text"); assert.equal(saved.checks[0].expected, "Hello");
    await act(async () => new Promise(resolve => window.requestAnimationFrame(resolve)));
  } finally { await page.close(); }
});

test("all validation types expose structured controls and show invalid configuration without blocking draft saving", async () => {
  const local = fixture(), page = await mount("lab-editor", "LabEditor", { activityId: local.activityId }, local.state);
  try {
    await click(button(page.node, "Add Check")); const check = page.node.querySelector('.ins-lab-check');
    for (const [type, field] of [["element", "Minimum count"], ["text", "Text comparison"], ["attribute", "Attribute name"], ["style", "CSS property"], ["click-text", "Updated text element"], ["student", "Task requirement"], ["runtime", "Check description"]]) { await value(check.querySelector('[aria-label="Validation type"]'), type); assert.ok(check.querySelector(`[aria-label="${field}"]`)); }
    await value(check.querySelector('[aria-label="Validation type"]'), "element"); await value(check.querySelector('[aria-label="Element selector"]'), "a::broken("); assert.match(check.textContent, /Use a supported selector/); await click(button(page.node, "Save Draft")); assert.match(page.node.textContent, /Lab working draft saved/);
  } finally { await page.close(); }
});

test("preview edits, Run, checks, results and Reset stay isolated from saved starter code and real student progress", async () => {
  const local = fixture(); local.save(content()); const page = await mount("lab-editor", "LabEditor", { activityId: local.activityId, initialPreview: true }, local.state);
  const raw = window.localStorage.getItem("decode-instructor-preview-v1"); window.localStorage.setItem("student-progress", "unchanged");
  try {
    await value(page.node.querySelector('[aria-label="Syntax html"]'), "<h1>Preview only</h1>"); await click(button(page.node, "Run Code")); const output = page.node.querySelector('iframe[title="Isolated instructor lab output"]'); assert.equal(output.getAttribute('sandbox'), "allow-scripts"); assert.match(output.srcdoc, /connect-src 'none'/); assert.match(output.srcdoc, /Preview only/);
    await click(button(page.node, "Check Solution")); const probes = [...page.node.querySelectorAll('.ins-lab-probes iframe')]; assert.equal(probes.length, 2);
    const descriptor = probes.map(frame => { assert.equal(frame.getAttribute('sandbox'), "allow-scripts"); const match = frame.srcdoc.match(/const token = "([^"]+)"/); assert.ok(match); return { frame, token: match[1] }; });
    await act(async () => window.dispatchEvent(new window.MessageEvent("message", { source: output.contentWindow, data: { channel: "decode-instructor-lab", token: descriptor[0].token, type: "result", runtimePassed: true, results: content().checks.map(c => ({ id: c.id, passed: true })) } }))); assert.match(page.node.textContent, /Checking current code/);
    for (const { frame, token } of descriptor) await act(async () => window.dispatchEvent(new window.MessageEvent("message", { source: frame.contentWindow, data: { channel: "decode-instructor-lab", token, type: "result", runtimePassed: true, results: content().checks.map(c => ({ id: c.id, passed: true })) } })));
    assert.match(page.node.textContent, /2 \/ 2 checks passed/); assert.match(page.node.textContent, /Preview complete/); assert.equal(page.node.querySelector('.ins-lab-probes'), null);
    await value(page.node.querySelector('[aria-label="Syntax html"]'), "Changed again"); assert.match(page.node.textContent, /Code changed since the last check/);
    await click(button(page.node, "Reset Code")); await click(button(page.node.querySelector('dialog'), "Cancel")); assert.equal(page.node.querySelector('[aria-label="Syntax html"]').value, "Changed again");
    await click(button(page.node, "Reset Code")); await click(button(page.node.querySelector('dialog'), "Reset Code")); assert.equal(page.node.querySelector('[aria-label="Syntax html"]').value, content().starter.html); assert.equal(page.node.querySelector('iframe'), null);
    assert.equal(window.localStorage.getItem("decode-instructor-preview-v1"), raw); assert.equal(window.localStorage.getItem("student-progress"), "unchanged"); await click(button(page.node, "Back to Editor")); assert.equal(page.node.querySelector('[aria-label="Syntax html"]').value, content().starter.html); assert.equal(button(page.node, "Save Draft").disabled, true);
  } finally { await page.close(); }
});

test("incomplete lab preview permits inspection and Run but disables checking and completion", async () => {
  const local = fixture(), page = await mount("lab-editor", "LabEditor", { activityId: local.activityId, initialPreview: true }, local.state);
  try { assert.equal(button(page.node, "Check Solution").disabled, true); assert.match(page.node.textContent, /completion are disabled/); await click(button(page.node, "Run Code")); assert.ok(page.node.querySelector('iframe')); assert.equal(page.node.querySelector('.ins-lab-probes'), null); assert.doesNotMatch(page.node.textContent, /Preview complete/); }
  finally { await page.close(); }
});

async function executeProbes(page) {
  for (const frame of [...page.node.querySelectorAll('.ins-lab-probes iframe')]) {
    let probe, timer;
    await act(async () => {
      try {
        const result = await new Promise((resolve, reject) => {
          timer = setTimeout(() => reject(Error("No lab probe result")), 2000);
          probe = new JSDOM(frame.srcdoc, { runScripts: "dangerously", virtualConsole: new VirtualConsole(), beforeParse(view) { view.requestAnimationFrame = () => 1; view.postMessage = message => { if (message.channel === "decode-instructor-lab") resolve(message); }; } });
        });
        window.dispatchEvent(new window.MessageEvent("message", { source: frame.contentWindow, data: result }));
      } finally { clearTimeout(timer); probe?.window.close(); }
    });
  }
}

test("actual sandbox probes report failing and passing solutions at both widths without persistent attempts", async () => {
  const local = fixture(); local.save(content()); const raw = JSON.stringify(local.state), page = await mount("lab-editor", "LabEditor", { activityId: local.activityId, initialPreview: true }, raw);
  try {
    await value(page.node.querySelector('[aria-label="Syntax html"]'), "<p>No heading</p>"); await click(button(page.node, "Check Solution")); await executeProbes(page); assert.match(page.node.textContent, /1 \/ 2 checks passed/); assert.doesNotMatch(page.node.textContent, /Preview complete/);
    await value(page.node.querySelector('[aria-label="Syntax html"]'), "<h1>Hello</h1>"); await click(button(page.node, "Check Solution")); await executeProbes(page); assert.match(page.node.textContent, /2 \/ 2 checks passed/); assert.match(page.node.textContent, /Preview complete/);
    assert.equal(window.localStorage.getItem("decode-instructor-preview-v1"), raw);
  } finally { await page.close(); }
});

test("cancelled and obsolete checks ignore late results and JavaScript failures block completion even without a runtime check", async () => {
  const local = fixture(), lab = content(); lab.checks = [lab.checks[0]]; lab.starter.javascript = 'throw Error("runtime problem");'; local.save(lab);
  const page = await mount("lab-editor", "LabEditor", { activityId: local.activityId, initialPreview: true }, local.state);
  try {
    await click(button(page.node, "Check Solution")); const frame = page.node.querySelector('.ins-lab-probes iframe'), source = frame.contentWindow, token = frame.srcdoc.match(/const token = "([^"]+)"/)[1]; await click(button(page.node, "Cancel check"));
    await act(async () => window.dispatchEvent(new window.MessageEvent("message", { source, data: { channel: "decode-instructor-lab", type: "result", token, runtimePassed: true, results: lab.checks.map(c => ({ id: c.id, passed: true })) } })));
    assert.doesNotMatch(page.node.textContent, /Preview complete/); await click(button(page.node, "Check Solution")); await executeProbes(page); assert.match(page.node.textContent, /JavaScript errors prevented preview completion/); assert.doesNotMatch(page.node.textContent, /Preview complete/);
  } finally { await page.close(); }
});

test("curriculum creation opens Theory, Quiz and Lab editors only after persistence and retains order/counts", async () => {
  for (const type of ["theory", "quiz", "lab"]) {
    const local = fixture(), page = await mount("curriculum-view", "CurriculumView", undefined, local.state, { href: `/instructor/curriculum?course=${local.courseId}&module=${local.moduleId}` });
    try {
      await click(button(page.node, "Add Curriculum Item")); const dialog = page.node.querySelector('dialog'); await value(dialog.querySelector('[name="type"]'), type); await value(dialog.querySelector('[name="title"]'), `Created ${type}`); await value(dialog.querySelector('[name="description"]'), "A new activity in order"); await submit(dialog);
      const saved = JSON.parse(window.localStorage.getItem("decode-instructor-preview-v1")), activities = saved.courses.find(c => c.id === local.courseId).modules[0].activities, created = activities.at(-1);
      assert.equal(created.type, type); assert.equal(created.status, "draft"); assert.equal(activities[0].id, local.activityId); assert.equal(activities.length, 2); const segment = type === "theory" ? "theory" : type === "quiz" ? "quizzes" : "labs"; assert.equal(page.app.navigation.at(-1), `/instructor/${segment}/${encodeURIComponent(created.id)}`); assert.match(page.node.querySelector('.ins-selector-counts').textContent, /2 activities/);
    } finally { await page.close(); }
  }
});

test("library and curriculum Edit/Preview actions open seeded/local lab IDs and show saved readiness", async () => {
  const local = fixture(); local.save(content());
  for (const [name, exportName, href] of [["lab-library", "LabLibrary", "/instructor/labs"], ["curriculum-view", "CurriculumView", `/instructor/curriculum?course=${local.courseId}`]]) {
    const page = await mount(name, exportName, undefined, local.state, { href }); let links;
    try { links = [...new Set([...page.node.querySelectorAll('a')].map(a => a.getAttribute('href')).filter(h => h.startsWith(`/instructor/labs/${local.activityId}`)))]; assert.equal(links.length, 2); assert.match(page.node.textContent, /Ready for Publication/); } finally { await page.close(); }
    for (const href of links) { const opened = await mount(null, null, null, local.state, { href, route: true, hydrate: true }); try { assert.equal(opened.errors.length, 0); assert.match(opened.node.textContent, /Local heading lab/); } finally { await opened.close(); } }
  }
});

test("dirty lab navigation warns, failed saves preserve edits, and reverting changes clears the guard", async () => {
  const local = fixture(), page = await mount("lab-editor", "LabEditor", { activityId: local.activityId }, local.state);
  try {
    const field = page.node.querySelector('[aria-label="Lab title"]'); await value(field, "Unsaved lab title"); const event = new window.Event("beforeunload", { cancelable: true }); window.dispatchEvent(event); assert.equal(event.defaultPrevented, true);
    const storageProto = Object.getPrototypeOf(window.localStorage), original = storageProto.setItem; storageProto.setItem = () => { throw Error("Quota"); };
    try { await click(button(page.node, "Save Draft")); assert.match(page.node.textContent, /Changes were not saved/); assert.equal(field.value, "Unsaved lab title"); } finally { storageProto.setItem = original; }
    await value(field, "New local lab"); const clean = new window.Event("beforeunload", { cancelable: true }); window.dispatchEvent(clean); assert.equal(clean.defaultPrevented, false); assert.equal(button(page.node, "Save Draft").disabled, true);
  } finally { await page.close(); }
});

test("external lab revisions disable saving and require a cancellable explicit reload", async () => {
  const local = fixture(); local.save(content()); const page = await mount("lab-editor", "LabEditor", { activityId: local.activityId }, local.state);
  try {
    await value(page.node.querySelector('[aria-label="Lab title"]'), "Keep my unsaved lab"); local.save({ ...content(), title: "Saved elsewhere" }); window.localStorage.setItem("decode-instructor-preview-v1", JSON.stringify(local.state));
    await act(async () => window.dispatchEvent(new window.StorageEvent("storage", { key: "decode-instructor-preview-v1" }))); assert.equal(button(page.node, "Save Draft").disabled, true); assert.match(page.node.textContent, /saved lab changed in another tab/);
    await click(button(page.node, "Reload saved draft")); await click(button(page.node.querySelector('dialog'), "Cancel")); assert.equal(page.node.querySelector('[aria-label="Lab title"]').value, "Keep my unsaved lab");
    await click(button(page.node, "Reload saved draft")); await click(button(page.node.querySelector('dialog'), "Reload Draft")); assert.equal(page.node.querySelector('[aria-label="Lab title"]').value, "Saved elsewhere"); assert.equal(button(page.node, "Save Draft").disabled, true);
  } finally { await page.close(); }
});

test("same-activity edit/preview URL changes select the requested mode and missing/deleted/wrong-type IDs never recreate records", async () => {
  const local = fixture(); local.save(content()); let page = await mount(null, null, null, local.state, { route: true, href: `/instructor/labs/${local.activityId}` });
  try { await page.renderRoute(`/instructor/labs/${local.activityId}?preview=1`); assert.ok(page.node.querySelector('.ins-lab-preview')); await page.renderRoute(`/instructor/labs/${local.activityId}`); assert.ok(page.node.querySelector('[aria-label="Lab title"]')); }
  finally { await page.close(); }
  local.run({ type: "activity.delete", courseId: local.courseId, moduleId: local.moduleId, activityId: local.activityId });
  for (const id of [local.activityId, "missing", "quiz%3Ahtml", "exercise%253Ahtml-heading"]) {
    page = await mount(null, null, null, local.state, { route: true, hydrate: true, href: `/instructor/labs/${id}` });
    try { const before = window.localStorage.getItem("decode-instructor-preview-v1"); assert.equal(page.errors.length, 0); assert.match(page.node.textContent, /Coding lab not found/); assert.equal(window.localStorage.getItem("decode-instructor-preview-v1"), before); }
    finally { await page.close(); }
  }
});

test("archived, unsupported legacy and future-version lab content are read-only and never replaced by blank drafts", async () => {
  for (const scenario of ["archived", "unsupported", "future"]) {
    const local = fixture(); if (scenario === "archived") { local.save(content()); local.run({ type: "activity.archive", courseId: local.courseId, moduleId: local.moduleId, activityId: local.activityId, archived: true }); } if (scenario === "unsupported") local.state.courses.at(-1).modules[0].activities[0].reference = { kind: "exercise", id: "legacy-missing" }; if (scenario === "future") { local.save(content()); local.state.lab.version = 2; }
    const raw = JSON.stringify(local.state), page = await mount("lab-editor", "LabEditor", { activityId: local.activityId }, raw);
    try { assert.equal(button(page.node, "Save Draft").disabled, true); assert.equal(page.node.querySelector('.ins-theory-fields').disabled, true); await click(button(page.node, "CSS")); assert.equal(page.node.querySelector('[aria-label="Syntax css"]').readOnly, true); if (scenario === "archived") assert.equal(page.node.querySelector('[aria-label="Syntax css"]').value, content().starter.css); assert.equal(window.localStorage.getItem("decode-instructor-preview-v1"), raw); }
    finally { await page.close(); }
  }
});

test("lab preview safely renders untrusted instructions and hints as text without active links or HTML", async () => {
  const local = fixture(), lab = content(); lab.instructions = '<img src=x onerror="window.hacked=true"><script>alert(1)</script>'; lab.hints = '<a href="javascript:alert(1)">Click</a>'; local.save(lab);
  const page = await mount("lab-editor", "LabEditor", { activityId: local.activityId, initialPreview: true }, local.state);
  try { assert.equal(page.node.querySelector('.ins-lab-instructions img'), null); assert.equal(page.node.querySelector('.ins-lab-instructions a'), null); assert.match(page.node.textContent, /onerror=/); assert.equal(window.hacked, undefined); }
  finally { await page.close(); }
});

test("nested Lab routes preserve active sidebar navigation, breadcrumb and the animated DECODE wordmark", async () => {
  const page = await mount("instructor-shell", "InstructorShell", { children: React.createElement("p", null, "Lab route") });
  try { assert.equal(page.node.querySelector('.ins-sidebar nav a[aria-current="page"]').textContent, "Coding Labs"); assert.equal(page.node.querySelector('.ins-breadcrumb span').textContent, "Coding Lab Editor"); assert.ok(page.node.querySelector('.ins-brand .decode-wordmark')); }
  finally { await page.close(); }
});

test("Lab Monaco owns one editor, survives Strict Mode and tab switches, follows themes and disposes its model", async () => {
  const editors = [], callbacks = [], changes = [], runtime = { editorFontFamily: () => "monospace", monaco: { editor: {
    setModelLanguage(model, language) { model.language = language; },
    create(node, options) { const model = { disposed: false, dispose() { this.disposed = true; } }; const editor = { node, options, value: "", disposed: false, getValue() { assert.equal(this.disposed, false); return this.value; }, getModel: () => model, setValue(value) { this.value = value; callbacks.forEach(cb => cb()); }, onDidChangeModelContent(callback) { callbacks.push(callback); return { dispose() { callbacks.splice(callbacks.indexOf(callback), 1); } }; }, updateOptions(next) { assert.equal(this.disposed, false); Object.assign(this.options, next); }, dispose() { assert.equal(this.disposed, false); this.disposed = true; } }; editors.push(editor); return editor; }
  } } };
  const app = application(runtime), Editor = app.load("app/components/instructor/lab-code-editor.tsx").default, node = document.createElement("div"); document.body.append(node); const root = createRoot(node);
  const props = { value: "<h1>One</h1>", language: "html", readOnly: false, onChange: value => changes.push(value) };
  try {
    await act(async () => root.render(React.createElement(StrictMode, null, React.createElement(Editor, props)))); assert.equal(editors.filter(e => !e.disposed).length, 1); const active = editors.at(-1); assert.equal(active.getValue(), props.value); assert.equal(changes.length, 0);
    await act(async () => active.setValue("<h1>Typed</h1>")); assert.equal(changes.at(-1), "<h1>Typed</h1>");
    await act(async () => root.render(React.createElement(StrictMode, null, React.createElement(Editor, { ...props, value: "body {\n  color: red;\n}", language: "css", readOnly: true })))); assert.equal(editors.at(-1), active); assert.equal(active.getModel().language, "css"); assert.equal(active.options.readOnly, true); assert.equal(changes.length, 1);
    await act(async () => { document.documentElement.dataset.theme = "dark"; }); assert.equal(active.options.theme, "vs-dark"); assert.equal(active.options.tabFocusMode, true);
  } finally { await act(async () => root.unmount()); node.remove(); document.documentElement.removeAttribute("data-theme"); }
  assert.equal(editors.every(e => e.disposed && e.getModel().disposed), true); assert.equal(callbacks.length, 0);
});
