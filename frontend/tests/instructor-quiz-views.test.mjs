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

const dom = new JSDOM("<!doctype html><body></body>", { url: "http://localhost/instructor/quizzes/quiz%3Ahtml", pretendToBeVisual: true }), { window } = dom;
Object.assign(globalThis, { window, document: window.document, IS_REACT_ACT_ENVIRONMENT: true });
window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
window.HTMLDialogElement.prototype.close = function () { this.open = false; };
window.confirm = () => false;
window.matchMedia = () => ({ matches: false });
const { createRoot, hydrateRoot } = await import("react-dom/client"), dependency = createRequire(import.meta.url);
function application() {
  const cache = new Map(), navigation = [];
  function load(file) {
    file = path.resolve(file); if (cache.has(file)) return cache.get(file).exports;
    const compiled = { exports: {} }; cache.set(file, compiled);
    const source = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    function require(specifier) {
      if (specifier.endsWith(".css")) return {};
      if (specifier === "next/link") return { __esModule: true, default: ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children) };
      if (specifier === "next/navigation") return { usePathname: () => window.location.pathname, useSearchParams: () => new URLSearchParams(window.location.search), useRouter: () => ({ push: href => navigation.push(href) }) };
      if (!specifier.startsWith(".") && !specifier.startsWith("@/")) return dependency(specifier);
      const base = specifier.startsWith("@/") ? path.resolve(specifier.slice(2)) : path.resolve(path.dirname(file), specifier);
      return load([base + ".ts", base + ".tsx"].find(fs.existsSync));
    }
    vm.runInNewContext(source, { module: compiled, exports: compiled.exports, require, window, document, console, Error, localStorage: window.localStorage, FormData: window.FormData, Element: window.Element, structuredClone, URL, crypto: globalThis.crypto, requestAnimationFrame: window.requestAnimationFrame.bind(window) }, { filename: file });
    return compiled.exports;
  }
  const { InstructorProvider } = load("app/components/instructor/instructor-provider.tsx");
  return { load, navigation, tree: (View, props) => React.createElement(StrictMode, null, React.createElement(InstructorProvider, null, React.createElement(View, props))) };
}
async function routeElement(app, href) {
  const url = new URL(href, "http://localhost"), Page = app.load("app/instructor/quizzes/[activityId]/page.tsx").default;
  const page = Page({ params: Promise.resolve({ activityId: url.pathname.slice("/instructor/quizzes/".length) }), searchParams: Promise.resolve({ preview: url.searchParams.get("preview") ?? undefined }) });
  assert.equal(page.type, React.Suspense); return page.props.children.type(page.props.children.props);
}
async function mount(name, exportName, props, stored, { href = "/instructor/quizzes/quiz%3Ahtml", hydrate = false, route = false } = {}) {
  window.localStorage.clear(); window.history.replaceState(null, "", href);
  if (stored) window.localStorage.setItem("decode-instructor-preview-v1", typeof stored === "string" ? stored : JSON.stringify(stored));
  const app = application(), element = route ? await routeElement(app, href) : { type: app.load(`app/components/instructor/${name}.tsx`)[exportName], props }, tree = app.tree(element.type, element.props), node = document.createElement("div"), errors = []; document.body.append(node); let root;
  if (hydrate) { node.innerHTML = renderToString(tree); assert.doesNotMatch(node.textContent, /Quiz not found/); await act(async () => { root = hydrateRoot(node, tree, { onRecoverableError: error => errors.push(error) }); }); }
  else { root = createRoot(node); await act(async () => root.render(tree)); }
  return { app, node, errors, async renderRoute(nextHref) { window.history.replaceState(null, "", nextHref); const next = await routeElement(app, nextHref); await act(async () => root.render(app.tree(next.type, next.props))); }, async close() { await act(async () => root.unmount()); node.remove(); } };
}
const button = (root, text) => [...root.querySelectorAll("button")].find(b => b.textContent.trim().replace(/^＋\s*/, "") === text);
async function click(node) { assert.ok(node, "Expected an actionable element"); await act(async () => node.click()); }
async function value(node, text) {
  assert.ok(node, "Expected a field"); await act(async () => { const proto = node.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : node.tagName === "SELECT" ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, "value").set.call(node, text); node.dispatchEvent(new window.Event(node.tagName === "SELECT" ? "change" : "input", { bubbles: true })); });
}
async function submit(root) { await act(async () => root.querySelector("form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }))); }
const question = (id, points) => ({ id, topic: "Concepts", prompt: `Question ${id}?`, options: [{ id: `${id}-a`, text: "Correct answer" }, { id: `${id}-b`, text: "Wrong answer" }], correctOptionId: `${id}-a`, explanation: `Explanation for ${id}.`, points });
const previewContent = () => ({ title: "Weighted preview", instructions: "Choose one answer per question.", questions: [question("heavy", 3), question("light", 1)] });
function fixture() {
  const app = application(), repo = app.load("app/lib/instructor/repository.ts"); let state = repo.seedInstructorState();
  function run(command) { const result = repo.applyInstructorCommand(state, command); state = result.state; return result.id; }
  const courseId = run({ type: "course.create", id: "local-quiz-course", fields: { title: "Local quiz course", description: "Quiz routing checks", category: "Web development", difficulty: "Beginner", duration: "1 hour", objectives: ["Practice quizzes"], color: "blue", icon: "book" } });
  const moduleId = run({ type: "module.create", courseId, title: "Local quiz module", description: "Local quiz sequence" });
  const activityId = run({ type: "activity.create", courseId, moduleId, activityType: "quiz", title: "New local quiz", description: "Local assessment" });
  return { app, run, courseId, moduleId, activityId, get state() { return state; }, save(content) { const draft = state.quiz?.drafts[activityId]; run({ type: "quiz.save", courseId, moduleId, activityId, content, expectedUpdatedAt: draft?.updatedAt ?? null, expectedRevision: draft?.revision ?? null }); } };
}

test("Quiz library lists the three seeded activities once and composes title/course/module/status filters", async () => {
  const page = await mount("quiz-library", "QuizLibrary");
  try {
    assert.equal(page.node.querySelectorAll('.ins-quiz-row').length, 3); assert.ok([...page.node.querySelectorAll('.ins-quiz-row a')].some(a => a.getAttribute('href') === "/instructor/quizzes/quiz%3Ahtml"));
    await value(page.node.querySelector('[aria-label="Filter quizzes by course"]'), "html"); assert.equal(page.node.querySelectorAll('.ins-quiz-row').length, 1);
    const moduleSelect = page.node.querySelector('[aria-label="Filter quizzes by module"]'); await value(moduleSelect, moduleSelect.options[1].value); assert.equal(page.node.querySelectorAll('.ins-quiz-row').length, 0);
    await value(page.node.querySelector('[aria-label="Filter quizzes by course"]'), "all"); assert.equal(moduleSelect.value, "all");
    await value(page.node.querySelector('[type="search"]'), "no matching quiz"); assert.match(page.node.textContent, /No matching quizzes/);
    await value(page.node.querySelector('[type="search"]'), ""); await value(page.node.querySelector('[aria-label="Filter quizzes by status"]'), "working"); assert.equal(page.node.querySelectorAll('.ins-quiz-row').length, 0);
  } finally { await page.close(); }
});

test("encoded seeded quiz routes hydrate, save independent drafts and survive refresh in edit and preview mode", async () => {
  let page = await mount(null, null, null, undefined, { route: true, hydrate: true }), raw;
  try {
    assert.equal(page.errors.length, 0); assert.equal(page.node.querySelectorAll('.ins-quiz-question').length, 8); assert.match(page.node.textContent, /Published Original \/ Working Draft/);
    const catalog = JSON.stringify(page.app.load("app/lib/instructor/repository.ts").seedInstructorState().courses);
    assert.equal(button(page.node, "Save Draft").disabled, true); await value(page.node.querySelector('[aria-label="Quiz title"]'), "Local HTML quiz revision");
    await click(button(page.node, "Save Draft")); assert.match(page.node.textContent, /Quiz working draft saved/); raw = window.localStorage.getItem("decode-instructor-preview-v1");
    assert.equal(JSON.stringify(JSON.parse(raw).courses), catalog); assert.ok(JSON.parse(raw).quiz.drafts["quiz:html"]);
  } finally { await page.close(); }
  for (const href of ["/instructor/quizzes/quiz%3Ahtml", "/instructor/quizzes/quiz:html", "/instructor/quizzes/quiz%3Ahtml?preview=1"]) {
    page = await mount(null, null, null, raw, { route: true, hydrate: true, href });
    try { assert.equal(page.errors.length, 0); assert.match(page.node.textContent, /Local HTML quiz revision/); assert.equal(window.localStorage.getItem("decode-instructor-preview-v1"), raw); if (href.endsWith("preview=1")) assert.ok(page.node.querySelector('.ins-quiz-preview')); }
    finally { await page.close(); }
  }
});

test("same-activity URL changes select Preview and Edit modes without relying on a fresh provider mount", async () => {
  const page = await mount(null, null, null, undefined, { route: true });
  try {
    assert.ok(page.node.querySelector('[aria-label="Quiz title"]'));
    await page.renderRoute("/instructor/quizzes/quiz%3Ahtml?preview=1"); assert.ok(page.node.querySelector('.ins-quiz-preview')); assert.equal(page.node.querySelector('[aria-label="Quiz title"]'), null);
    await page.renderRoute("/instructor/quizzes/quiz%3Ahtml"); assert.ok(page.node.querySelector('[aria-label="Quiz title"]')); assert.equal(page.node.querySelector('.ins-quiz-preview'), null); assert.equal(window.localStorage.getItem("decode-instructor-preview-v1"), null);
  } finally { await page.close(); }
});

test("question controls edit fields, duplicate independent options, reorder, cancel and confirm deletion, and save numbering/points", async () => {
  const local = fixture(); let page = await mount("quiz-editor", "QuizEditor", { activityId: local.activityId }, local.state), raw;
  try {
    await value(page.node.querySelector('[aria-label="Quiz instructions"]'), "Choose the matching answer."); await click(button(page.node, "Add Question"));
    let card = page.node.querySelector('.ins-quiz-question'); await value(card.querySelector('[aria-label="Question text"]'), "Which value is correct?"); await value(card.querySelector('[aria-label="Option A"]'), "First answer"); await value(card.querySelector('[aria-label="Option B"]'), "Second answer"); await click(card.querySelector('[aria-label="Mark option B as correct"]')); await value(card.querySelector('[aria-label="Question points"]'), "5"); await value(card.querySelector('[aria-label="Answer explanation"]'), "Second answer is correct.");
    assert.match(page.node.querySelector('.ins-readiness').textContent, /Ready for Publication/);
    await click(card.querySelector('[aria-label="Duplicate question 1"]')); assert.equal(page.node.querySelectorAll('.ins-quiz-question').length, 2);
    const originalNodeId = page.node.querySelector('.ins-quiz-question').id, duplicateNodeId = page.node.querySelectorAll('.ins-quiz-question')[1].id;
    await click(page.node.querySelector('[aria-label="Move question 2 up"]')); assert.equal(page.node.querySelector('.ins-quiz-question').id, duplicateNodeId);
    await click(page.node.querySelector('[aria-label="Delete question 2"]')); assert.equal(document.activeElement.textContent, "Cancel"); await click(button(page.node.querySelector('dialog'), "Cancel")); assert.equal(page.node.querySelectorAll('.ins-quiz-question').length, 2);
    await click(page.node.querySelector('[aria-label="Delete question 2"]')); await click(button(page.node.querySelector('dialog'), "Delete Question")); assert.equal(page.node.querySelectorAll('.ins-quiz-question').length, 1); assert.equal(document.getElementById(originalNodeId), null);
    await click(button(page.node, "Save Draft")); raw = window.localStorage.getItem("decode-instructor-preview-v1"); const saved = JSON.parse(raw).quiz.drafts[local.activityId];
    assert.equal(saved.questions[0].points, 5); assert.equal(saved.questions[0].options.find(o => o.id === saved.questions[0].correctOptionId).text, "Second answer"); assert.notEqual(saved.questions[0].id, originalNodeId.slice('quiz-question-'.length)); assert.match(page.node.textContent, /5 total available points/);
    await act(async () => new Promise(resolve => window.requestAnimationFrame(resolve)));
  } finally { await page.close(); }
  page = await mount(null, null, null, raw, { route: true, hydrate: true, href: `/instructor/quizzes/${local.activityId}` });
  try { assert.equal(page.errors.length, 0); assert.equal(page.node.querySelector('[aria-label="Question text"]').value, "Which value is correct?"); assert.equal(page.node.querySelector('[aria-label="Question points"]').value, "5"); assert.equal(button(page.node, "Save Draft").disabled, true); }
  finally { await page.close(); }
});

test("answer options enforce UI limits, exactly one selection, and clearing a removed correct answer while incomplete drafts still save", async () => {
  const local = fixture(), page = await mount("quiz-editor", "QuizEditor", { activityId: local.activityId }, local.state);
  try {
    await click(button(page.node, "Add Question")); const card = page.node.querySelector('.ins-quiz-question');
    assert.equal(card.querySelector('[aria-label="Remove option A"]').disabled, true);
    await click(card.querySelector('[aria-label="Mark option A as correct"]')); await click(card.querySelector('[aria-label="Mark option B as correct"]')); assert.equal(card.querySelectorAll('input[type=radio]:checked').length, 1);
    await click(button(card, "Add Option")); await click(card.querySelector('[aria-label="Mark option C as correct"]')); await click(card.querySelector('[aria-label="Remove option C"]')); assert.equal(card.querySelectorAll('input[type=radio]:checked').length, 0);
    for (let i = 0; i < 4; i++) await click(button(card, "Add Option")); assert.equal(button(card, "Add Option").disabled, true); assert.equal(card.querySelectorAll('input[type=radio]').length, 6);
    await value(card.querySelector('[aria-label="Question points"]'), ""); await click(button(page.node, "Save Draft"));
    const saved = JSON.parse(window.localStorage.getItem("decode-instructor-preview-v1")).quiz.drafts[local.activityId]; assert.equal(saved.questions[0].points, null); assert.equal(saved.questions[0].correctOptionId, null); assert.match(page.node.querySelector('.ins-readiness').textContent, /Incomplete Draft/);
  } finally { await page.close(); }
});

test("weighted quiz preview accepts answers, redirects missing submissions, scores, explains and restarts without storage writes", async () => {
  const page = await mount("quiz-preview", "QuizPreview", { content: previewContent(), context: "HTML / Concepts" });
  try {
    window.localStorage.setItem("student-progress", "unchanged"); window.localStorage.setItem("student-quiz-attempts", "unchanged"); const before = { ...window.localStorage };
    await click(button(page.node, "Submit Preview")); assert.match(page.node.textContent, /first unanswered question/);
    await click(page.node.querySelectorAll('input[type=radio]')[1]); await click(button(page.node, "Next Question →")); await click(page.node.querySelector('input[type=radio]'));
    await click(button(page.node, "← Previous")); assert.equal(page.node.querySelectorAll('input[type=radio]')[1].checked, true); await click(button(page.node, "Next Question →"));
    await click(button(page.node, "Submit Preview")); assert.match(page.node.textContent, /You scored 25%/); assert.match(page.node.textContent, /1 \/ 4 points/); assert.match(page.node.textContent, /Correct answer: Correct answer/); assert.match(page.node.textContent, /Explanation for heavy/);
    assert.deepEqual({ ...window.localStorage }, before); assert.equal(page.node.querySelectorAll('.ins-quiz-review li').length, 2);
    await click(button(page.node, "Restart Preview")); assert.equal(page.node.querySelectorAll('input[type=radio]:checked').length, 0); assert.equal(page.node.querySelector('.ins-quiz-score'), null); assert.deepEqual({ ...window.localStorage }, before);
  } finally { await page.close(); }
});

test("preview of unsaved quiz edits stays separate from content dirty state and refuses scoring incomplete content", async () => {
  const local = fixture(); local.save(previewContent()); const raw = JSON.stringify(local.state), page = await mount("quiz-editor", "QuizEditor", { activityId: local.activityId }, raw);
  try {
    await click(button(page.node, "Preview Quiz")); await click(page.node.querySelectorAll('.ins-quiz-preview input[type=radio]')[1]);
    const unload = new window.Event("beforeunload", { cancelable: true }); window.dispatchEvent(unload); assert.equal(unload.defaultPrevented, false); assert.equal(window.localStorage.getItem("decode-instructor-preview-v1"), raw);
    await click(button(page.node, "Back to Editor")); await value(page.node.querySelector('[aria-label="Quiz title"]'), "Unsaved preview title"); await click(button(page.node, "Preview Quiz")); assert.match(page.node.querySelector('.ins-quiz-preview').textContent, /Unsaved preview title/); assert.equal(window.localStorage.getItem("decode-instructor-preview-v1"), raw);
    await click(button(page.node, "Back to Editor")); await click(button(page.node.querySelector('.ins-quiz-question'), "Clear correct answer")); await click(button(page.node, "Preview Quiz")); assert.equal(button(page.node, "Submit Preview").disabled, true); assert.match(page.node.textContent, /Complete the readiness checklist/);
  } finally { await page.close(); }
});

test("preview renders untrusted titles, instructions, questions, answers and explanations as text", () => {
  const app = application(), { QuizPreview } = app.load("app/components/instructor/quiz-preview.tsx"), data = previewContent();
  data.title = '<img src=x onerror="alert(1)">'; data.instructions = "<script>alert(1)</script>"; data.questions[0].prompt = "<iframe src=x>"; data.questions[0].options[0].text = "<svg onload=alert(1)>";
  const fragment = JSDOM.fragment(renderToStaticMarkup(React.createElement(QuizPreview, { content: data, context: "HTML" })));
  assert.equal(fragment.querySelectorAll('script,img,iframe,svg[onload]').length, 0); assert.match(fragment.textContent, /<script>alert\(1\)<\/script>/); assert.match(fragment.textContent, /<iframe src=x>/); assert.match(fragment.textContent, /<svg onload=alert\(1\)>/);
});

test("Curriculum creates a stable Quiz activity, appends it in order, persists counts and navigates to its editor", async () => {
  let page = await mount("curriculum-view", "CurriculumView", undefined, undefined, { href: "/instructor/curriculum?course=html" }), raw, href, id;
  try {
    const repo = page.app.load("app/lib/instructor/repository.ts"), seed = repo.seedInstructorState().courses[0], beforeIds = seed.modules[0].activities.map(a => a.id);
    await click(button(page.node, "Add Curriculum Item")); await value(page.node.querySelector('[name="type"]'), "quiz"); await value(page.node.querySelector('[name="title"]'), "New curriculum quiz"); await value(page.node.querySelector('[name="description"]'), "Check the new concept"); await submit(page.node);
    raw = window.localStorage.getItem("decode-instructor-preview-v1"); const course = JSON.parse(raw).courses[0], created = course.modules[0].activities.at(-1); id = created.id;
    assert.equal(created.type, "quiz"); assert.equal(created.status, "draft"); assert.deepEqual(course.modules[0].activities.slice(0, -1).map(a => a.id), JSON.parse(JSON.stringify(beforeIds)));
    assert.equal(repo.courseCounts(course).activities, repo.courseCounts(seed).activities + 1); assert.equal(page.app.navigation.length, 1); href = page.app.navigation[0]; assert.equal(href, `/instructor/quizzes/${encodeURIComponent(id)}`);
  } finally { await page.close(); }
  page = await mount(null, null, null, raw, { route: true, hydrate: true, href });
  try { assert.equal(page.errors.length, 0); assert.equal(page.node.querySelector('[aria-label="Quiz title"]').value, "New curriculum quiz"); assert.equal(page.node.querySelectorAll('.ins-quiz-question').length, 0); await click(button(page.node, "Add Question")); await click(button(page.node, "Save Draft")); assert.ok(JSON.parse(window.localStorage.getItem("decode-instructor-preview-v1")).quiz.drafts[id]); }
  finally { await page.close(); }
});

test("library and Curriculum edit/preview links resolve seeded and newly created quiz routes", async () => {
  const local = fixture(); local.save(previewContent());
  for (const [id, state, title] of [["quiz:html", undefined, "HTML"], [local.activityId, local.state, "Weighted preview"]]) {
    const links = []; let page = await mount("quiz-library", "QuizLibrary", undefined, state);
    try { const row = [...page.node.querySelectorAll('.ins-quiz-row')].find(row => row.textContent.includes(title)); links.push(...[...row.querySelectorAll('.ins-theory-row-actions a')].map(a => a.getAttribute('href'))); }
    finally { await page.close(); }
    page = await mount("curriculum-view", "CurriculumView", undefined, state);
    try { if (state) await value(page.node.querySelector('[aria-label="Select course"]'), local.courseId); const row = [...page.node.querySelectorAll('.ins-activity')].find(row => row.querySelector(`a[href="/instructor/quizzes/${encodeURIComponent(id)}"]`)); links.push(...[...row.querySelectorAll('a')].filter(a => ["Edit Quiz", "Preview Quiz"].includes(a.textContent)).map(a => a.getAttribute('href'))); }
    finally { await page.close(); }
    assert.equal(links.length, 4);
    for (const href of links) { page = await mount(null, null, null, state, { href, route: true }); try { assert.doesNotMatch(page.node.textContent, /Quiz not found/); if (href.endsWith("preview=1")) assert.ok(page.node.querySelector('.ins-quiz-preview')); else assert.ok(page.node.querySelector('[aria-label="Quiz title"]')); } finally { await page.close(); } }
  }
});

test("unsaved quiz navigation warns, reverting edits clears dirty state and unchanged saves preserve timestamps", async () => {
  const local = fixture(); local.save(previewContent()); const raw = JSON.stringify(local.state), page = await mount("quiz-editor", "QuizEditor", { activityId: local.activityId }, raw);
  try {
    const title = page.node.querySelector('[aria-label="Quiz title"]'); await value(title, "Unsaved quiz title");
    const unload = new window.Event("beforeunload", { cancelable: true }); window.dispatchEvent(unload); assert.equal(unload.defaultPrevented, true);
    let questionText = ""; window.confirm = text => { questionText = text; return false; };
    const link = [...page.node.querySelectorAll('a')].find(a => a.textContent === "Back to Curriculum"), event = new window.MouseEvent("click", { bubbles: true, cancelable: true }); await act(async () => link.dispatchEvent(event)); assert.equal(event.defaultPrevented, true); assert.match(questionText, /unsaved quiz changes/);
    await value(title, previewContent().title); assert.equal(button(page.node, "Save Draft").disabled, true); assert.equal(window.localStorage.getItem("decode-instructor-preview-v1"), raw);
    const clean = new window.Event("beforeunload", { cancelable: true }); window.dispatchEvent(clean); assert.equal(clean.defaultPrevented, false);
  } finally { window.confirm = () => false; await page.close(); }
});

test("failed saves keep edits; external draft conflicts cannot overwrite and reload confirmation is cancellable", async () => {
  const local = fixture(); local.save(previewContent()); const raw = JSON.stringify(local.state), page = await mount("quiz-editor", "QuizEditor", { activityId: local.activityId }, raw), originalSet = window.Storage.prototype.setItem;
  try {
    await value(page.node.querySelector('[aria-label="Quiz title"]'), "Keep this unsaved quiz"); window.Storage.prototype.setItem = () => { throw new Error("quota"); };
    await click(button(page.node, "Save Draft")); assert.match(page.node.textContent, /Changes were not saved/); assert.match(page.node.textContent, /Unsaved changes/); assert.equal(window.localStorage.getItem("decode-instructor-preview-v1"), raw);
    window.Storage.prototype.setItem = originalSet; const external = JSON.parse(raw); external.quiz.drafts[local.activityId].revision++; external.quiz.drafts[local.activityId].title = "Other tab quiz";
    window.localStorage.setItem("decode-instructor-preview-v1", JSON.stringify(external)); await act(async () => window.dispatchEvent(new window.StorageEvent("storage", { key: "decode-instructor-preview-v1" })));
    assert.equal(button(page.node, "Save Draft").disabled, true); assert.equal(page.node.querySelector('[aria-label="Quiz title"]').value, "Keep this unsaved quiz");
    await click(button(page.node, "Reload saved draft")); await click(button(page.node.querySelector('dialog'), "Cancel")); assert.equal(page.node.querySelector('[aria-label="Quiz title"]').value, "Keep this unsaved quiz");
    await click(button(page.node, "Reload saved draft")); await click(button(page.node.querySelector('dialog'), "Reload Draft")); assert.equal(page.node.querySelector('[aria-label="Quiz title"]').value, "Other tab quiz"); assert.equal(button(page.node, "Save Draft").disabled, true);
  } finally { window.Storage.prototype.setItem = originalSet; await page.close(); }
});

test("missing, deleted, wrong-type and double-encoded quiz URLs never recreate content or change stored drafts", async () => {
  const local = fixture(); local.save(previewContent()); local.run({ type: "activity.delete", courseId: local.courseId, moduleId: local.moduleId, activityId: local.activityId }); const raw = JSON.stringify(local.state);
  for (const id of ["missing%3Aquiz", local.activityId, "lesson%3Ahtml-introduction", "quiz%253Ahtml"]) {
    const page = await mount(null, null, null, raw, { route: true, hydrate: true, href: `/instructor/quizzes/${id}` });
    try { assert.equal(page.errors.length, 0); assert.match(page.node.textContent, /Quiz not found/); assert.equal(window.localStorage.getItem("decode-instructor-preview-v1"), raw); }
    finally { await page.close(); }
  }
});

test("archived and unsupported legacy quizzes are explicitly read-only without blank replacement saves", async () => {
  const local = fixture(); local.run({ type: "activity.archive", courseId: local.courseId, moduleId: local.moduleId, activityId: local.activityId, archived: true });
  let page = await mount("quiz-editor", "QuizEditor", { activityId: local.activityId }, local.state);
  try { assert.equal(page.node.querySelector('.ins-theory-fields').disabled, true); assert.equal(button(page.node, "Save Draft").disabled, true); assert.match(page.node.textContent, /archived/); }
  finally { await page.close(); }
  const activity = local.state.courses.at(-1).modules[0].activities[0]; activity.archived = false; activity.reference = { kind: "quiz", id: "missing-legacy" }; const raw = JSON.stringify(local.state);
  page = await mount("quiz-editor", "QuizEditor", { activityId: local.activityId }, raw);
  try { assert.match(page.node.textContent, /cannot be imported safely/); assert.equal(page.node.querySelector('.ins-theory-fields').disabled, true); assert.equal(window.localStorage.getItem("decode-instructor-preview-v1"), raw); }
  finally { await page.close(); }
});

test("nested quiz shell navigation retains the animated logo, breadcrumbs and active state", async () => {
  const page = await mount("instructor-shell", "InstructorShell", { children: React.createElement("p", null, "Quiz route") });
  try { assert.equal(page.node.querySelector('.ins-sidebar nav a[aria-current="page"]').textContent, "Quizzes"); assert.equal(page.node.querySelector('.ins-breadcrumb span').textContent, "Quiz Builder"); assert.ok(page.node.querySelector('.ins-brand .decode-wordmark')); }
  finally { await page.close(); }
});
