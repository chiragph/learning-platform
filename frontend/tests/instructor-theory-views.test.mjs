import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import React, { act, StrictMode } from "react";
import { renderToStaticMarkup, renderToString } from "react-dom/server";
import { JSDOM } from "jsdom";
import ts from "typescript";

const dom = new JSDOM("<!doctype html><body></body>", { url: "http://localhost/instructor/theory/lesson%3Ahtml-introduction", pretendToBeVisual: true }), { window } = dom;
Object.assign(globalThis, { window, document: window.document, IS_REACT_ACT_ENVIRONMENT: true });
window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
window.HTMLDialogElement.prototype.close = function () { this.open = false; };
window.confirm = () => false;
const { createRoot, hydrateRoot } = await import("react-dom/client"), dependency = createRequire(import.meta.url);
function application() {
  const cache = new Map();
  function load(file) {
    file = path.resolve(file); if (cache.has(file)) return cache.get(file).exports;
    const compiled = { exports: {} }; cache.set(file, compiled);
    const source = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    function require(specifier) {
      if (specifier.endsWith(".css")) return {};
      if (specifier === "next/link") return { __esModule: true, default: ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children) };
      if (specifier === "next/navigation") return { useSearchParams: () => new URLSearchParams(window.location.search), useRouter: () => ({ push() {} }) };
      if (specifier === "next/dynamic") return { __esModule: true, default: () => () => React.createElement("div", { "data-monaco": true }, "Syntax editor") };
      if (!specifier.startsWith(".") && !specifier.startsWith("@/")) return dependency(specifier);
      const base = specifier.startsWith("@/") ? path.resolve(specifier.slice(2)) : path.resolve(path.dirname(file), specifier);
      return load([base + ".ts", base + ".tsx"].find(fs.existsSync));
    }
    vm.runInNewContext(source, { module: compiled, exports: compiled.exports, require, window, document, console, Error, localStorage: window.localStorage, FormData: window.FormData, Element: window.Element, structuredClone, URL, crypto: globalThis.crypto, navigator: window.navigator, requestAnimationFrame: window.requestAnimationFrame.bind(window) }, { filename: file });
    return compiled.exports;
  }
  const { InstructorProvider } = load("app/components/instructor/instructor-provider.tsx");
  return { load, tree: (View, props) => React.createElement(StrictMode, null, React.createElement(InstructorProvider, null, React.createElement(View, props))) };
}
async function mount(name, exportName, props, stored) {
  window.localStorage.clear(); window.history.replaceState(null, "", "/instructor/theory/lesson%3Ahtml-introduction");
  if (stored) window.localStorage.setItem("decode-instructor-preview-v1", typeof stored === "string" ? stored : JSON.stringify(stored));
  const app = application(), node = document.createElement("div"); document.body.append(node); const root = createRoot(node);
  await act(async () => root.render(app.tree(app.load(`app/components/instructor/${name}.tsx`)[exportName], props)));
  return { app, node, async close() { await act(async () => root.unmount()); node.remove(); } };
}
const button = (root, text) => [...root.querySelectorAll("button")].find(b => b.textContent.trim().replace(/^＋\s*/, "") === text);
async function click(node) { assert.ok(node, "Expected an actionable element"); await act(async () => node.click()); }
async function value(node, text) {
  assert.ok(node, "Expected an input"); await act(async () => { const proto = node.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : node.tagName === "SELECT" ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, "value").set.call(node, text); node.dispatchEvent(new window.Event(node.tagName === "SELECT" ? "change" : "input", { bubbles: true })); });
}
const firstId = "lesson:html-introduction";

// Invoke the actual server page and its async child, with the encoded segment
// supplied by Next 16.4.2. Earlier tests skipped this boundary by passing raw IDs.
async function routeElement(app, href) {
  const url = new URL(href, "http://localhost"), Page = app.load("app/instructor/theory/[activityId]/page.tsx").default;
  const page = Page({ params: Promise.resolve({ activityId: url.pathname.slice("/instructor/theory/".length) }), searchParams: Promise.resolve({ preview: url.searchParams.get("preview") ?? undefined }) });
  assert.equal(page.type, React.Suspense);
  return page.props.children.type(page.props.children.props);
}
async function mountRoute(href, stored, hydrate = false) {
  window.localStorage.clear(); window.history.replaceState(null, "", href);
  if (stored) window.localStorage.setItem("decode-instructor-preview-v1", typeof stored === "string" ? stored : JSON.stringify(stored));
  const app = application(), element = await routeElement(app, href), node = document.createElement("div"); document.body.append(node);
  const tree = app.tree(element.type, element.props), errors = []; let root;
  if (hydrate) {
    node.innerHTML = renderToString(tree);
    assert.doesNotMatch(node.textContent, /Theory lesson not found/);
    await act(async () => { root = hydrateRoot(node, tree, { onRecoverableError: error => errors.push(error) }); });
  } else { root = createRoot(node); await act(async () => root.render(tree)); }
  return { app, node, errors, async close() { await act(async () => root.unmount()); node.remove(); } };
}
function localTheoryFixture() {
  const app = application(), repo = app.load("app/lib/instructor/repository.ts"); let state = repo.seedInstructorState();
  function run(command) { const result = repo.applyInstructorCommand(state, command); state = result.state; return result.id; }
  const courseId = run({ type: "course.create", id: "route-regression", fields: { title: "Local route course", description: "Testing local theory routes", category: "Web development", difficulty: "Beginner", duration: "30 min", objectives: ["Write a lesson"], color: "blue", icon: "book" } });
  const moduleId = run({ type: "module.create", courseId, title: "Local route module", description: "A local sequence" });
  const activityId = run({ type: "activity.create", courseId, moduleId, activityType: "theory", title: "New local lesson", description: "Local explanation" });
  run({ type: "theory.save", courseId, moduleId, activityId, content: { title: "Saved local lesson", blocks: [{ id: "local-block", type: "paragraph", text: "Saved content survives a refresh." }] }, expectedUpdatedAt: null, expectedRevision: null });
  return { state, run, getState: () => state, courseId, moduleId, activityId };
}

test("dynamic page awaits URL params and decodes the activity ID exactly once before mounting the editor", async () => {
  const app = application(), Page = app.load("app/instructor/theory/[activityId]/page.tsx").default; let resolve, settled = false;
  const params = new Promise(done => { resolve = done; }), page = Page({ params, searchParams: Promise.resolve({ preview: "1" }) });
  const result = page.props.children.type(page.props.children.props); result.then(() => { settled = true; });
  await Promise.resolve(); assert.equal(settled, false);
  resolve({ activityId: "lesson%3Ahtml-introduction" }); const editor = await result;
  assert.equal(editor.props.activityId, firstId); assert.equal(editor.props.initialPreview, true);
  assert.equal((await routeElement(app, "/instructor/theory/lesson%253Ahtml-introduction")).props.activityId, "lesson%3Ahtml-introduction");
});

test("encoded seeded URLs hydrate, open saved drafts and refresh without changing IDs or storage", async () => {
  let page = await mountRoute("/instructor/theory/lesson%3Ahtml-introduction", undefined, true), raw;
  try {
    assert.equal(page.errors.length, 0); assert.equal(page.node.querySelector('[aria-label="Lesson title"]').value, "Introduction to HTML");
    await value(page.node.querySelector('[aria-label="Lesson title"]'), "Retained seeded working draft"); await click(button(page.node, "Save Draft")); raw = window.localStorage.getItem("decode-instructor-preview-v1");
    assert.ok(JSON.parse(raw).theory.drafts[firstId]); assert.equal(JSON.parse(raw).courses[0].modules[0].activities[0].id, firstId);
  } finally { await page.close(); }
  for (const href of ["/instructor/theory/lesson%3Ahtml-introduction", "/instructor/theory/lesson:html-introduction", "/instructor/theory/lesson%3Ahtml-introduction?preview=1"]) {
    page = await mountRoute(href, raw, true);
    try { assert.equal(page.errors.length, 0); assert.match(page.node.textContent, /Retained seeded working draft/); assert.equal(window.localStorage.getItem("decode-instructor-preview-v1"), raw); if (href.endsWith("preview=1")) assert.ok(page.node.querySelector('.ins-lesson-preview')); }
    finally { await page.close(); }
  }
});

test("new local theory lesson URLs hydrate and reopen persisted content after direct navigation and refresh", async () => {
  const fixture = localTheoryFixture(), raw = JSON.stringify(fixture.state), href = `/instructor/theory/${encodeURIComponent(fixture.activityId)}`;
  for (const url of [href, href, `${href}?preview=1`]) {
    const page = await mountRoute(url, raw, true);
    try { assert.equal(page.errors.length, 0); assert.match(page.node.textContent, /Saved local lesson/); assert.equal(window.localStorage.getItem("decode-instructor-preview-v1"), raw); if (url.endsWith("preview=1")) assert.match(page.node.textContent, /Saved content survives a refresh/); else assert.equal(page.node.querySelector('textarea').value, "Saved content survives a refresh."); }
    finally { await page.close(); }
  }
});

test("Theory library and Curriculum Builder edit/preview links reach the same seeded and local lesson routes", async () => {
  const fixture = localTheoryFixture();
  for (const [id, title, state] of [[firstId, "Introduction to HTML", undefined], [fixture.activityId, "Saved local lesson", fixture.state]]) {
    const links = [];
    let page = await mount("theory-library", "TheoryLibrary", undefined, state);
    try { const row = [...page.node.querySelectorAll('.ins-theory-row')].find(row => row.textContent.includes(title)); links.push(...[...row.querySelectorAll('.ins-theory-row-actions a')].map(a => a.getAttribute('href'))); }
    finally { await page.close(); }
    page = await mount("curriculum-view", "CurriculumView", undefined, state);
    try {
      if (state) await value(page.node.querySelector('[aria-label="Select course"]'), fixture.courseId);
      const row = [...page.node.querySelectorAll('.ins-activity')].find(row => row.textContent.includes(title));
      links.push(...[...row.querySelectorAll('a')].filter(a => ["Open Theory Lesson Editor", "Preview Lesson"].includes(a.textContent)).map(a => a.getAttribute('href')));
    } finally { await page.close(); }
    assert.equal(links.length, 4); assert.ok(links.every(href => href.split('?')[0] === `/instructor/theory/${encodeURIComponent(id)}`));
    for (const href of links) {
      page = await mountRoute(href, state);
      try { assert.doesNotMatch(page.node.textContent, /Theory lesson not found/); assert.match(page.node.textContent, new RegExp(title)); if (href.endsWith('preview=1')) assert.ok(page.node.querySelector('.ins-lesson-preview')); }
      finally { await page.close(); }
    }
  }
});

test("missing, deleted and double-encoded lesson routes show the missing state without restoring records or changing drafts", async () => {
  const fixture = localTheoryFixture(); fixture.run({ type: "activity.delete", courseId: fixture.courseId, moduleId: fixture.moduleId, activityId: fixture.activityId });
  const raw = JSON.stringify(fixture.getState());
  for (const href of ["/instructor/theory/missing%3Alesson", `/instructor/theory/${fixture.activityId}`, "/instructor/theory/lesson%253Ahtml-introduction"]) {
    const page = await mountRoute(href, raw, true);
    try { assert.equal(page.errors.length, 0); assert.match(page.node.textContent, /Theory lesson not found/); assert.equal(window.localStorage.getItem("decode-instructor-preview-v1"), raw); }
    finally { await page.close(); }
  }
});

test("Theory library lists seeded lessons once, filters course/module/title/status, and links to the shared editor and curriculum", async () => {
  const page = await mount("theory-library", "TheoryLibrary");
  try {
    assert.equal(page.node.querySelectorAll(".ins-theory-row").length, 25);
    assert.ok([...page.node.querySelectorAll(".ins-theory-row-actions a")].every(a => a.href.includes("/instructor/theory/")));
    assert.ok([...page.node.querySelectorAll(".ins-content-name p a")].every(a => a.href.includes("module=")));
    await value(page.node.querySelector('[aria-label="Filter lessons by course"]'), "html"); assert.equal(page.node.querySelectorAll(".ins-theory-row").length, 8);
    const modules = page.node.querySelector('[aria-label="Filter lessons by module"]'); await value(modules, modules.options[1].value); assert.ok(page.node.querySelectorAll(".ins-theory-row").length < 8);
    await value(page.node.querySelector('[type="search"]'), "nothing-matches"); assert.match(page.node.textContent, /No matching theory lessons/);
    await value(page.node.querySelector('[type="search"]'), ""); await value(page.node.querySelector('[aria-label="Filter lessons by course"]'), "all");
    assert.equal(page.node.querySelector('[aria-label="Filter lessons by module"]').value, "all");
    await value(page.node.querySelector('[aria-label="Filter lessons by status"]'), "working"); assert.equal(page.node.querySelectorAll(".ins-theory-row").length, 0);
  } finally { await page.close(); }
});

test("editor imports the published lesson, saves an independent draft, and reopens after a provider refresh", async () => {
  let page = await mount("theory-editor", "TheoryEditor", { activityId: firstId }), saved;
  try {
    assert.match(page.node.textContent, /separate local working draft/); assert.equal(page.node.querySelectorAll(".ins-theory-block").length, 4);
    assert.equal(button(page.node, "Save Draft").disabled, true); assert.match(page.node.textContent, /Not saved locally/);
    const catalog = page.app.load("app/lib/instructor/repository.ts").seedInstructorState().courses;
    await value(page.node.querySelector('[aria-label="Lesson title"]'), "New local explanation"); assert.match(page.node.textContent, /Unsaved changes/);
    await click(button(page.node, "Save Draft")); assert.match(page.node.textContent, /Working draft saved in this browser/); assert.equal(button(page.node, "Save Draft").disabled, true);
    saved = window.localStorage.getItem("decode-instructor-preview-v1"); assert.deepEqual(JSON.parse(saved).courses, JSON.parse(JSON.stringify(catalog)));
    const title = page.node.querySelector('[aria-label="Lesson title"]'); await value(title, "Another edit"); await value(title, "New local explanation"); assert.equal(button(page.node, "Save Draft").disabled, true);
  } finally { await page.close(); }
  page = await mount("theory-editor", "TheoryEditor", { activityId: firstId }, saved);
  try { assert.equal(page.node.querySelector('[aria-label="Lesson title"]').value, "New local explanation"); assert.equal(page.node.querySelectorAll(".ins-theory-block").length, 4); assert.equal(button(page.node, "Save Draft").disabled, true); }
  finally { await page.close(); }
  page = await mount("theory-library", "TheoryLibrary", undefined, saved);
  try { assert.match(page.node.textContent, /New local explanation/); await value(page.node.querySelector('[aria-label="Filter lessons by status"]'), "working"); assert.equal(page.node.querySelectorAll(".ins-theory-row").length, 1); assert.match(page.node.textContent, /Draft saved/); }
  finally { await page.close(); }
});

test("block controls add all types, format text, duplicate/reorder, cancel deletion and save confirmed removal", async () => {
  const page = await mount("theory-editor", "TheoryEditor", { activityId: firstId });
  try {
    await click(button(page.node, "Add Block")); let block = page.node.querySelectorAll(".ins-theory-block")[4];
    await value(block.querySelector("textarea"), "A new explanation"); await click(button(block, "Bold"));
    assert.match(block.querySelector("textarea").value, /\*\*/);
    await click(block.querySelector('[aria-label="Duplicate block 5"]')); assert.equal(page.node.querySelectorAll(".ins-theory-block").length, 6);
    await click(page.node.querySelector('[aria-label="Move block 6 up"]'));
    const before = page.node.querySelectorAll(".ins-theory-block")[4].id;
    await click(page.node.querySelector('[aria-label="Delete block 5"]')); assert.equal(document.activeElement.textContent, "Cancel"); await click(button(page.node.querySelector("dialog"), "Cancel")); assert.equal(page.node.querySelectorAll(".ins-theory-block").length, 6);
    await click(page.node.querySelector('[aria-label="Delete block 5"]')); await click(button(page.node.querySelector("dialog"), "Delete Block")); assert.equal(page.node.querySelectorAll(".ins-theory-block").length, 5); assert.equal(document.getElementById(before), null);
    for (const type of ["heading", "list", "code", "callout", "resource"]) { await value(page.node.querySelector('[aria-label="Block type"]'), type); await click(button(page.node, "Add Block")); }
    assert.equal(page.node.querySelectorAll(".ins-theory-block").length, 10);
    await click(button(page.node, "Save Draft")); assert.equal(JSON.parse(window.localStorage.getItem("decode-instructor-preview-v1")).theory.drafts[firstId].blocks.length, 10);
    assert.match(page.node.querySelector(".ins-readiness").textContent, /Keep shaping/);
    await act(async () => new Promise(resolve => window.requestAnimationFrame(resolve)));
  } finally { await page.close(); }
});

test("preview uses unsaved content, is read-only, switches widths and never publishes", async () => {
  const page = await mount("theory-editor", "TheoryEditor", { activityId: firstId });
  try {
    await value(page.node.querySelector('[aria-label="Lesson title"]'), "Unsaved preview title");
    await click(button(page.node, "Preview")); assert.equal(page.node.querySelectorAll("textarea,input").length, 0);
    assert.equal(page.node.querySelector(".ins-reading-article h1").textContent, "Unsaved preview title"); assert.match(page.node.textContent, /Includes unsaved changes/);
    await click(button(page.node, "Mobile")); assert.ok(page.node.querySelector(".ins-lesson-preview.mobile"));
    await click(button(page.node, "Desktop")); assert.ok(page.node.querySelector(".ins-lesson-preview.desktop"));
    assert.ok(button(page.node, "Copy Code")); assert.equal(window.localStorage.getItem("decode-instructor-preview-v1"), null);
    await click(button(page.node, "Back to Editor")); assert.equal(page.node.querySelector('[aria-label="Lesson title"]').value, "Unsaved preview title");
  } finally { await page.close(); }
});

test("preview escapes untrusted text and source code, renders formatting, and disables unsafe resource links", () => {
  const app = application(), { TheoryPreview } = app.load("app/components/instructor/theory-preview.tsx");
  const content = { title: '<img src=x onerror="alert(1)">', blocks: [
    { id: "p", type: "paragraph", text: '<script>alert(1)</script> **bold** *italic* `code`' },
    { id: "c", type: "code", language: "html", title: "Example", explanation: "", code: '<img src=x onerror="alert(1)"><script>alert(1)</script>' },
    ...["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "https://example.com/learn"].map((url, i) => ({ id: `r-${i}`, type: "resource", title: "Resource", url, description: "<iframe src=x>" })),
    { id: "l", type: "list", ordered: true, items: ["**First**", "Second"] },
    { id: "n", type: "callout", tone: "note", title: "Note", text: "Safe content" },
  ] };
  const fragment = JSDOM.fragment(renderToStaticMarkup(React.createElement(TheoryPreview, { content, context: "HTML", width: "mobile" })));
  assert.equal(fragment.querySelectorAll("script,img,iframe").length, 0); assert.match(fragment.textContent, /<script>alert\(1\)<\/script>/);
  assert.equal(fragment.querySelectorAll("a").length, 1); assert.equal(fragment.querySelector("a").href, "https://example.com/learn"); assert.equal(fragment.querySelector("a").rel, "noopener noreferrer");
  assert.equal(fragment.querySelector("p strong").textContent, "bold"); assert.equal(fragment.querySelector("p em").textContent, "italic"); assert.equal(fragment.querySelector("p code").textContent, "code");
  assert.ok(fragment.querySelector("ol li strong")); assert.ok(fragment.querySelector(".ins-reading-callout.note")); assert.ok(fragment.querySelector(".ins-syntax-tag"));
});

test("incomplete inline-format markers remain literal text instead of disappearing from preview", () => {
  const app = application(), { InlineText } = app.load("app/components/instructor/theory-preview.tsx");
  for (const text of ["*", "**", "***", "`", "**line one\nline two**", "Unfinished **bold", "Literal <b>text</b>"]) {
    const fragment = JSDOM.fragment(renderToStaticMarkup(React.createElement(InlineText, { text })));
    assert.equal(fragment.textContent, text);
  }
});

test("unsaved changes guard cancels or accepts links, ignores new tabs, warns on unload and restores cancelled history", () => {
  const app = application(), { installTheoryLeaveGuard } = app.load("app/lib/instructor/theory-navigation.ts");
  window.history.replaceState({ test: "editor" }, "", "/instructor/theory/lesson%3Ahtml-introduction");
  let dirty = true, confirms = 0, allow = false;
  window.confirm = () => { confirms++; return allow; };
  const cleanup = installTheoryLeaveGuard(window, () => dirty), anchor = document.createElement("a"); anchor.href = "/instructor/curriculum"; document.body.append(anchor);
  // Prevent JSDOM navigation after observing whether our capture guard cancelled.
  let cancelled; const observe = e => { cancelled = e.defaultPrevented; e.preventDefault(); }; document.addEventListener("click", observe);
  try {
    let event = new window.MouseEvent("click", { bubbles: true, cancelable: true }); assert.equal(anchor.dispatchEvent(event), false); assert.equal(confirms, 1); assert.equal(event.defaultPrevented, true);
    allow = true; cancelled = undefined; event = new window.MouseEvent("click", { bubbles: true, cancelable: true }); anchor.dispatchEvent(event); assert.equal(cancelled, false); assert.equal(confirms, 2);
    anchor.target = "_blank"; anchor.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true })); assert.equal(confirms, 2); anchor.target = "";
    const unload = new window.Event("beforeunload", { cancelable: true }); window.dispatchEvent(unload); assert.equal(unload.defaultPrevented, true);
    allow = false; window.history.replaceState({}, "", "/instructor/courses"); window.dispatchEvent(new window.PopStateEvent("popstate", { state: {} })); assert.match(window.location.pathname, /\/instructor\/theory\//); assert.equal(window.history.state.test, "editor");
    dirty = false; const cleanUnload = new window.Event("beforeunload", { cancelable: true }); window.dispatchEvent(cleanUnload); assert.equal(cleanUnload.defaultPrevented, false);
  } finally { cleanup(); anchor.remove(); document.removeEventListener("click", observe); window.confirm = () => false; }
});

test("the mounted editor guards dirty navigation, saves failures honestly, and keeps externally updated drafts from being overwritten", async () => {
  const page = await mount("theory-editor", "TheoryEditor", { activityId: firstId });
  try {
    await value(page.node.querySelector('[aria-label="Lesson title"]'), "My unsaved title");
    const before = new window.Event("beforeunload", { cancelable: true }); window.dispatchEvent(before); assert.equal(before.defaultPrevented, true);
    const port = window.localStorage, nativeSet = window.Storage.prototype.setItem;
    window.Storage.prototype.setItem = () => { throw new Error("quota"); };
    await click(button(page.node, "Save Draft")); assert.match(page.node.textContent, /Changes were not saved/); assert.match(page.node.textContent, /Unsaved changes/);
    window.Storage.prototype.setItem = nativeSet; await click(button(page.node, "Save Draft"));
    const clean = new window.Event("beforeunload", { cancelable: true }); window.dispatchEvent(clean); assert.equal(clean.defaultPrevented, false);
    await value(page.node.querySelector('[aria-label="Lesson title"]'), "Keep this text");
    const state = JSON.parse(port.getItem("decode-instructor-preview-v1")); state.theory.drafts[firstId].updatedAt = "2026-10-28T10:00:00.000Z"; state.theory.drafts[firstId].title = "Other tab title";
    port.setItem("decode-instructor-preview-v1", JSON.stringify(state)); await act(async () => window.dispatchEvent(new window.StorageEvent("storage", { key: "decode-instructor-preview-v1" })));
    assert.equal(page.node.querySelector('[aria-label="Lesson title"]').value, "Keep this text"); assert.equal(button(page.node, "Save Draft").disabled, true); assert.match(page.node.textContent, /changed in another tab/);
    await click(button(page.node, "Reload saved draft")); await click(button(page.node.querySelector("dialog"), "Cancel")); assert.equal(page.node.querySelector('[aria-label="Lesson title"]').value, "Keep this text");
    await click(button(page.node, "Reload saved draft")); await click(button(page.node.querySelector("dialog"), "Reload Draft")); assert.equal(page.node.querySelector('[aria-label="Lesson title"]').value, "Other tab title"); assert.equal(button(page.node, "Save Draft").disabled, true);
  } finally { await page.close(); }
});

test("archived, missing and unsupported lessons render clear read-only states", async () => {
  const app = application(), repo = app.load("app/lib/instructor/repository.ts"), state = repo.seedInstructorState(); state.courses[0].archived = true;
  let page = await mount("theory-editor", "TheoryEditor", { activityId: firstId, initialPreview: true }, state);
  try { assert.ok(page.node.querySelector(".ins-lesson-preview")); assert.equal(button(page.node, "Save Draft").disabled, true); assert.match(page.node.textContent, /is archived/); }
  finally { await page.close(); }
  page = await mount("theory-editor", "TheoryEditor", { activityId: "unknown" });
  try { assert.match(page.node.textContent, /Theory lesson not found/); } finally { await page.close(); }
  state.courses[0].archived = false; const course = state.courses[0], topic = course.modules[0]; topic.activities.push({ ...topic.activities[0], id: "local-legacy", source: "local", reference: { kind: "lesson", id: "missing-lesson" } });
  page = await mount("theory-editor", "TheoryEditor", { activityId: "local-legacy" }, state);
  try { assert.match(page.node.textContent, /cannot be imported safely/); assert.equal(page.node.querySelector("fieldset").disabled, true); assert.equal(window.localStorage.getItem("decode-instructor-preview-v1"), JSON.stringify(state)); }
  finally { await page.close(); }
});

test("only one selected code example mounts the syntax editor, and code is never run", async () => {
  const page = await mount("theory-editor", "TheoryEditor", { activityId: firstId });
  try {
    assert.equal(page.node.querySelectorAll("[data-monaco]").length, 0);
    await click(button(page.node, "Open syntax editor")); assert.equal(page.node.querySelectorAll("[data-monaco]").length, 1);
    await value(page.node.querySelector('[aria-label="Block type"]'), "code"); await click(button(page.node, "Add Block"));
    await click(button(page.node, "Open syntax editor")); assert.equal(page.node.querySelectorAll("[data-monaco]").length, 1);
    assert.equal(button(page.node, "Run Code"), undefined);
  } finally { await page.close(); }
});
