import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

// Compile the actual pure TS modules without adding a runtime/test dependency.
function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key), clear: () => values.clear(), values };
}
function loader(environment = "development", localStorage = memoryStorage(), sessionStorage = memoryStorage()) {
  const cache = new Map();
  function load(name) {
    const filename = path.resolve(name);
    if (cache.has(filename)) return cache.get(filename).exports;
    const compiledModule = { exports: {} }; cache.set(filename, compiledModule);
    const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    const context = { module: compiledModule, exports: compiledModule.exports, process: { env: { NODE_ENV: environment } }, localStorage, sessionStorage, console, require: (relative) => load(path.resolve(path.dirname(filename), relative + ".ts")) };
    vm.runInNewContext(source, context, { filename });
    return compiledModule.exports;
  }
  return { load: (name) => load(`app/lib/student/${name}.ts`), localStorage, sessionStorage };
}
const plain = (value) => JSON.parse(JSON.stringify(value));

test("Monaco settings route every supported language to a local, parseable worker", () => {
  const settings = loader().load("editor-settings");
  const expected = { html: "html", handlebars: "html", css: "css", scss: "css", javascript: "typescript", typescript: "typescript", editorWorkerService: "editor" };
  for (const [label, name] of Object.entries(expected)) assert.equal(settings.workerUrl(label), `/monaco-workers/${name}.worker.js`);
  for (const name of new Set(Object.values(expected))) {
    const filename = `public/monaco-workers/${name}.worker.js`;
    assert.ok(fs.statSync(filename).size > 10000);
    assert.doesNotThrow(() => new vm.Script(fs.readFileSync(filename, "utf8"), { filename }));
  }
  assert.equal(settings.editorOptions.lineNumbers, "on");
  assert.equal(settings.editorOptions.autoIndent, "full");
  assert.equal(settings.editorOptions.matchBrackets, "always");
  assert.equal(settings.editorOptions.suggestOnTriggerCharacters, true);
  assert.notEqual(settings.modelBase("student", "playground-welcome", "one"), settings.modelBase("learner", "playground-welcome", "one"));
  assert.notEqual(settings.modelBase("student", "playground-welcome", "one"), settings.modelBase("student", "playground-welcome", "two"));
  assert.equal(settings.clampSplit(-100), 30); assert.equal(settings.clampSplit(99), 70); assert.equal(settings.clampSplit(45.4), 45);
  assert.equal(settings.clampSplit(Number.NaN), 50);
});

test("optional lesson workspaces use actual examples and persist without losing existing drafts", () => {
  const context = loader(); const { allLessons } = context.load("courses"); const { lessonStarter, practiceLessonIds } = context.load("lesson-practice"); const logic = context.load("progress");
  assert.equal(practiceLessonIds.length, 12); assert.ok(practiceLessonIds.length < allLessons.length);
  const p = logic.emptyProgress();
  p.drafts["project-calculator"] = { html: "<h1>Existing project</h1>", css: "", javascript: "" };
  for (const id of practiceLessonIds) {
    const lesson = allLessons.find(l => l.id === id); assert.ok(lesson);
    const starter = lessonStarter(lesson); assert.ok(logic.isCode(starter));
    assert.ok(starter[lesson.language].includes(lesson.code));
    p.drafts[`lesson-${id}`] = starter;
  }
  assert.equal(lessonStarter(allLessons.find(l => l.id === "html-introduction")), null);
  const restored = logic.normalizeProgress(JSON.parse(JSON.stringify(p)));
  assert.equal(Object.keys(restored.drafts).length, 13);
  assert.equal(restored.drafts["project-calculator"].html, "<h1>Existing project</h1>");
  assert.equal(restored.lessons.length, 0);
});

test("curriculum covers all existing content with stable, resolvable ordered items", () => {
  const context = loader(); const curriculum = context.load("curriculum"); const { courses } = context.load("courses");
  const { challenges } = context.load("challenges"); const { projects } = context.load("projects");
  const projectIds = new Set();
  for (const course of courses) {
    const entry = curriculum.curricula[course.id]; const items = curriculum.courseItems(course.id);
    assert.equal(entry.modules.length, 3); assert.equal(entry.objectives.length, 3);
    assert.equal(new Set(items.map(curriculum.itemKey)).size, items.length);
    assert.deepEqual(plain(items.filter(i => i.kind === "lesson").map(i => i.id)), plain(course.lessons.map(l => l.id)));
    assert.deepEqual(plain(items.filter(i => i.kind === "exercise").map(i => i.id)), plain(challenges.filter(c => c.subject === course.id).map(c => c.id)));
    assert.equal(items.filter(i => i.kind === "quiz").length, 1);
    for (const item of items) { assert.ok(curriculum.itemDetails(item)?.href.startsWith("/")); assert.ok(item.minutes > 0); if (item.kind === "project") projectIds.add(item.id); }
  }
  assert.deepEqual([...projectIds].sort(), plain(projects.map(p => p.id).sort()));
});

test("curriculum completion preserves core percentages and keeps projects separate", () => {
  const context = loader(); const logic = context.load("progress"); const curriculum = context.load("curriculum");
  let progress = logic.emptyProgress();
  assert.equal(curriculum.curriculumStats("html", progress).total, 11);
  assert.equal(curriculum.curriculumStats("css", progress).total, 11);
  assert.equal(curriculum.curriculumStats("javascript", progress).total, 12);
  progress = logic.completePractice(progress, "projects", "portfolio", "now");
  assert.equal(curriculum.itemComplete({ id: "portfolio", kind: "project" }, progress), true);
  assert.equal(curriculum.curriculumStats("html", progress).percent, 0);
  progress = logic.saveQuiz(progress, "html", 63, "now");
  assert.equal(curriculum.itemComplete({ id: "html", kind: "quiz" }, progress), false);
  progress = logic.saveQuiz(progress, "html", 75, "later");
  assert.equal(curriculum.itemComplete({ id: "html", kind: "quiz" }, progress), true);
  for (const item of curriculum.courseItems("html")) {
    if (item.kind === "lesson") progress = logic.completeLesson(progress, item.id, item.id);
    if (item.kind === "exercise") progress = logic.completePractice(progress, "challenges", item.id, item.id);
  }
  assert.equal(curriculum.curriculumStats("html", progress).percent, 100);
  assert.equal(curriculum.nextCourseItem("html", progress), null);
});

test("learning suggestions distinguish first visit, resume, course continuation and completion", () => {
  const context = loader(); const logic = context.load("progress"); const curriculum = context.load("curriculum");
  let progress = logic.emptyProgress();
  assert.equal(curriculum.learningSuggestion(progress).reason, "path");
  assert.equal(curriculum.learningSuggestion(progress).item.id, "html-introduction");
  progress.currentLesson = "css-flexbox";
  assert.equal(curriculum.learningSuggestion(progress).reason, "resume");
  assert.equal(curriculum.learningSuggestion(progress).item.id, "css-flexbox");
  progress = logic.completeLesson(progress, "css-flexbox", "now");
  assert.equal(curriculum.learningSuggestion(progress).reason, "course");
  assert.equal(curriculum.learningSuggestion(progress).subject, "css");
  for (const subject of ["html", "css", "javascript"]) for (const item of curriculum.courseItems(subject)) {
    if (item.kind === "lesson") progress = logic.completeLesson(progress, item.id, item.id);
    if (item.kind === "quiz") progress = logic.saveQuiz(progress, subject, 100, "now");
    if (item.kind === "exercise") progress = logic.completePractice(progress, "challenges", item.id, item.id);
  }
  assert.equal(curriculum.learningSuggestion(progress), null);
  assert.equal(progress.projects.length, 0);
});

test("quiz scoring, latest/best results and passed-quiz progress", () => {
  const context = loader(); const { quizzes, scoreQuiz } = context.load("quizzes"); const logic = context.load("progress");
  for (const questions of Object.values(quizzes)) {
    assert.ok(questions.length >= 8);
    assert.ok(questions.every((q) => q.options.length === 4 && q.correct >= 0 && q.correct < 4 && q.explanation));
    const answers = Object.fromEntries(questions.map((q) => [q.id, q.correct]));
    assert.equal(scoreQuiz(questions, answers).percent, 100);
    assert.equal(scoreQuiz(questions, {}).percent, 0);
  }
  let p = logic.saveQuiz(logic.emptyProgress(), "html", 88, "now");
  p = logic.saveQuiz(p, "html", 50, "later");
  assert.equal(p.quizzes.html.latest, 50); assert.equal(p.quizzes.html.best, 88); assert.equal(p.quizzes.html.attempts, 2);
  assert.equal(logic.courseProgress(p, "html", ["html-heading", "html-link"]).completed, 1);
  assert.equal(logic.normalizeProgress(p).quizzes.html.best, 88);
});

test("preview serializes code safely and only accepts current-run message schemas", () => {
  const { buildPreview, isPreviewMessage } = loader().load("preview");
  const document = buildPreview({ html: '<h1>Test</h1><script>parent.bad=true</script>', css: 'body::after{content:"</style>"}', javascript: 'console.log("</script><script>bad()</script>");' }, "run-1", "heading");
  assert.equal((document.match(/<script>/g) ?? []).length, 1);
  assert.equal((document.match(/<\/script>/g) ?? []).length, 1);
  assert.match(document, /connect-src 'none'/); assert.match(document, /form-action 'none'/);
  assert.ok(!document.includes("allow-same-origin"));
  assert.equal(isPreviewMessage({ channel: "decode-preview", token: "run-1", type: "check", text: "ok", passed: true }, "run-1"), true);
  assert.equal(isPreviewMessage({ channel: "decode-preview", token: "old", type: "ready", text: "ok" }, "run-1"), false);
  assert.equal(isPreviewMessage({ channel: "decode-preview", token: "run-1", type: "check", text: "ok" }, "run-1"), false);
  assert.equal(isPreviewMessage({ channel: "decode-preview", token: "run-1", type: "log", text: "x".repeat(2001) }, "run-1"), false);
  const workspace = fs.readFileSync("app/components/student/code-workspace.tsx", "utf8");
  assert.match(workspace, /sandbox="allow-scripts"/);
  assert.match(workspace, /event.source !== iframe.current\?\.contentWindow/);
  assert.ok(!workspace.includes("eval("));
});

test("preview bridge runs basic DOM checks and reports logs and script errors", () => {
  const { buildPreview } = loader().load("preview");
  function execute(check, javascript, valid) {
    const messages = []; const callbacks = []; const listeners = {};
    const messageNode = { textContent: "Waiting" };
    let handler;
    const button = { addEventListener: (_, fn) => { handler = fn; }, click: () => handler?.() };
    const doc = {
      head: { append() {} },
      body: { replaceChildren() {}, append(script) { try { vm.runInContext(script.textContent, context); } catch (error) { listeners.error({ message: error.message, lineno: 1 }); } } },
      addEventListener() {}, createElement: () => ({ textContent: "" }),
      querySelectorAll: (selector) => selector === "h1" ? [{ textContent: valid ? "Hello, DECODE!" : "Wrong" }] : selector === "p" ? [{ textContent: "A paragraph" }] : selector === 'nav a[href="#learning"]' ? valid ? [{ textContent: "Start learning" }] : [] : [],
      querySelector: (selector) => selector === "h1" ? { textContent: valid ? "Hello, DECODE!" : "Wrong" } : selector === "main#learning h1" ? valid ? {} : null : selector === "button#greet" ? button : selector === "#message" ? messageNode : null,
    };
    const context = vm.createContext({ document: doc, console: { log() {}, warn() {}, error() {} }, parent: { postMessage: (message) => messages.push(message) }, setTimeout: (fn) => callbacks.push(fn), addEventListener: (name, fn) => { listeners[name] = fn; }, DOMParser: class { parseFromString() { return { head: { children: [] }, body: { childNodes: [] }, querySelectorAll: () => [] }; } } });
    const source = buildPreview({ html: "", css: "", javascript }, "current", check).match(/<script>([\s\S]*)<\/script>/)[1];
    vm.runInContext(source, context); callbacks.forEach((fn) => fn());
    return messages;
  }
  for (const check of ["heading", "link"]) {
    assert.equal(execute(check, "", true).find((m) => m.type === "check").passed, true);
    assert.equal(execute(check, "", false).find((m) => m.type === "check").passed, false);
  }
  const buttonMessages = execute("button", 'document.querySelector("button#greet").addEventListener("click", () => { document.querySelector("#message").textContent = "Hello, developer!"; }); console.log("wired");', true);
  assert.equal(buttonMessages.find((m) => m.type === "check").passed, true);
  assert.equal(buttonMessages.find((m) => m.type === "log").text, "wired");
  const errorMessages = execute("heading", 'throw new Error("Test failure")', true);
  assert.equal(errorMessages.find((m) => m.type === "check").passed, false);
  assert.match(errorMessages.find((m) => m.type === "error").text, /Test failure/);
});

test("development registration, duplicate detection, login errors and session restoration", () => {
  const context = loader(); const auth = context.load("mock-auth");
  assert.equal(auth.restoreSession(), null);
  assert.throws(() => auth.authenticateDemo("real@gmail.com", "Decode123!", true, false), /fictional/);
  assert.throws(() => auth.authenticateDemo("student@example.test", "wrong", false, false), /passphrase/);
  assert.throws(() => auth.authenticateDemo("missing@example.test", "Decode123!", false, false), /not found/);
  const account = auth.authenticateDemo("learner@example.test", "Decode123!", true, true);
  assert.equal(account.id, "learner");
  assert.throws(() => auth.authenticateDemo("learner@example.test", "Decode123!", true, false), /already registered/);
  const restored = loader("development", context.localStorage, context.sessionStorage).load("mock-auth");
  assert.equal(restored.restoreSession().id, "learner");
  assert.ok(![...context.localStorage.values.values()].join().includes("Decode123!"));
  auth.logoutDemo(); assert.equal(auth.restoreSession(), null);
  auth.authenticateDemo("student@example.test", "Decode123!", false, false);
  assert.equal(context.localStorage.getItem("decode-demo-session-v1"), null);
  assert.equal(auth.restoreSession().id, "student");
});
test("production rejects demo login and ignores existing demo sessions", () => {
  const storage = memoryStorage(); storage.setItem("decode-demo-session-v1", '"student"');
  const auth = loader("production", storage).load("mock-auth");
  assert.equal(auth.restoreSession(), null);
  assert.throws(() => auth.authenticateDemo("student@example.test", "Decode123!", false, true), /disabled/);
});

test("registration validation covers name, email, password length and confirmation", () => {
  const { validateAuth } = loader().load("../../components/auth/validation");
  const invalid = validateAuth({ name: "A", email: "broken", password: "short", confirmPassword: "different" }, "register");
  assert.deepEqual(Object.keys(invalid).sort(), ["confirmPassword", "email", "name", "password"]);
  assert.equal(Object.keys(validateAuth({ name: "Demo Learner", email: "learner@example.test", password: "Decode123!", confirmPassword: "Decode123!" }, "register")).length, 0);
});

test("saved drafts and progress restore per account, and reset is isolated", () => {
  const context = loader(); const logic = context.load("progress"); const storage = context.load("storage");
  let first = logic.completeLesson(logic.emptyProgress(), "css-grid", "2026-10-24T12:00:00Z");
  first = logic.completePractice(first, "projects", "calculator", "2026-10-24T12:01:00Z");
  first.drafts["project-calculator"] = { html: "<h1>My draft</h1>", css: "h1{color:blue}", javascript: "console.log(1);" };
  const key = logic.progressKey("student"); const otherKey = logic.progressKey("learner");
  storage.writeStorage(context.localStorage, key, first);
  storage.writeStorage(context.localStorage, otherKey, logic.emptyProgress());
  const fresh = loader("development", context.localStorage); const freshLogic = fresh.load("progress");
  const restored = freshLogic.normalizeProgress(fresh.load("storage").readStorage(context.localStorage, key, null));
  assert.equal(restored.drafts["project-calculator"].html, "<h1>My draft</h1>"); assert.equal(restored.projects[0], "calculator");
  assert.equal(freshLogic.normalizeProgress(fresh.load("storage").readStorage(context.localStorage, otherKey, null)).lessons.length, 0);
  storage.writeStorage(context.localStorage, otherKey, logic.completeLesson(logic.emptyProgress(), "html-lists", "now"));
  storage.writeStorage(context.localStorage, key, logic.emptyProgress());
  assert.equal(storage.readStorage(context.localStorage, otherKey, null).lessons.length, 1);
  assert.equal(Object.keys(storage.readStorage(context.localStorage, key, null).drafts).length, 0);
});

test("all course units yield 100%, project completion remains separate", () => {
  const context = loader(); const logic = context.load("progress"); const { courses } = context.load("courses"); const { challenges } = context.load("challenges");
  let p = logic.emptyProgress();
  for (const course of courses) {
    for (const lesson of course.lessons) p = logic.completeLesson(p, lesson.id, lesson.id);
    p = logic.saveQuiz(p, course.id, 100, "now");
    const ids = challenges.filter((c) => c.subject === course.id).map((c) => c.id);
    for (const id of ids) p = logic.completePractice(p, "challenges", id, id);
    assert.equal(logic.courseProgress(p, course.id, ids).percent, 100);
  }
  assert.equal(p.activity.length, 20);
  assert.equal(p.projects.length, 0);
  const withProject = logic.completePractice(p, "projects", "portfolio", "later");
  assert.equal(withProject.projects.length, 1);
  assert.equal(logic.completePractice(withProject, "projects", "portfolio", "later").activity.length, 20);
  assert.equal(logic.completePractice(p, "challenges", "unknown", "now"), p);
});

test("corrupted storage and unknown content cannot inflate progress", () => {
  const context = loader(); const logic = context.load("progress");
  const p = logic.normalizeProgress({ version: 1, lessons: ["missing"], challenges: ["missing"], projects: ["missing"], quizzes: { admin: { latest: 100, best: 100, attempts: 1, at: "now" }, html: { latest: 101, best: 101, attempts: 1, at: "now" } }, drafts: { "project-calculator": { html: 2, css: "", javascript: "" }, unknown: { html: "", css: "", javascript: "" } }, activity: [{ id: "x", title: "x", at: "now", href: "javascript:alert(1)" }] });
  assert.equal(p.lessons.length + p.challenges.length + p.projects.length + p.activity.length, 0);
  assert.equal(Object.keys(p.quizzes).length + Object.keys(p.drafts).length, 0);
  context.localStorage.setItem("broken", "{nope");
  assert.equal(context.load("storage").readStorage(context.localStorage, "broken", null), null);
});
test("lesson completion is idempotent, immutable and calculated consistently", () => {
  const context = loader(); const logic = context.load("progress"); const { allLessons } = context.load("courses");
  assert.equal(allLessons.length, 25);
  const initial = logic.emptyProgress();
  const done = logic.completeLesson(initial, "html-introduction", "2026-10-24T12:00:00Z");
  assert.equal(initial.lessons.length, 0); assert.equal(done.lessons.length, 1);
  assert.equal(logic.completeLesson(done, "html-introduction", "later").activity.length, 1);
  assert.deepEqual(plain(logic.courseProgress(done, "html", ["html-heading", "html-link"])), { completed: 1, total: 11, percent: 9 });
  assert.equal(logic.recommendedLesson(done).id, "html-document");
  assert.equal(logic.normalizeProgress({ version: 1, lessons: ["bad", "html-introduction", "html-introduction"] }).lessons.length, 1);
  assert.equal(logic.normalizeProgress("invalid").lessons.length, 0);
});
