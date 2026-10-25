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
  assert.equal(settings.EDITOR_THEME, "vs-dark");
  assert.equal(settings.editorOptions.lineNumbers, "on");
  assert.equal(settings.editorOptions.autoIndent, "full");
  assert.equal(settings.editorOptions.matchBrackets, "always");
  assert.equal(settings.editorOptions.suggestOnTriggerCharacters, true);
  assert.notEqual(settings.modelBase("student", "playground-welcome", "one"), settings.modelBase("learner", "playground-welcome", "one"));
  assert.notEqual(settings.modelBase("student", "playground-welcome", "one"), settings.modelBase("student", "playground-welcome", "two"));
  assert.equal(settings.clampSplit(-100), 30); assert.equal(settings.clampSplit(99), 70); assert.equal(settings.clampSplit(45.4), 45);
  assert.equal(settings.clampSplit(Number.NaN), 50);
});

test("all theory workspaces use blank starters and preserve isolated lesson drafts", () => {
  const context = loader(); const { allLessons } = context.load("courses"); const { lessonStarter, practiceLessonIds } = context.load("lesson-practice"); const logic = context.load("progress");
  assert.equal(practiceLessonIds.length, 25); assert.equal(practiceLessonIds.length, allLessons.length);
  const p = logic.emptyProgress();
  p.drafts["project-calculator"] = { html: "<h1>Existing project</h1>", css: "", javascript: "" };
  for (const id of practiceLessonIds) {
    const lesson = allLessons.find(l => l.id === id); assert.ok(lesson);
    const starter = lessonStarter(lesson); assert.ok(logic.isCode(starter));
    assert.deepEqual(plain(starter), { html: "<!-- Write your HTML code here -->", css: "/* Write your CSS code here */", javascript: "// Write your JavaScript code here" });
    assert.ok(!starter[lesson.language].includes(lesson.code));
    p.drafts[`lesson-${id}`] = starter;
  }
  assert.equal(lessonStarter(allLessons[0]).html, "<!-- Write your HTML code here -->");
  const restored = logic.normalizeProgress(JSON.parse(JSON.stringify(p)));
  assert.equal(Object.keys(restored.drafts).length, 26);
  assert.equal(restored.drafts["project-calculator"].html, "<h1>Existing project</h1>");
  assert.equal(restored.lessons.length, 0);
});

test("curriculum preserves every legacy reference, unique activity ID, route and display order", () => {
  const context = loader(); const curriculum = context.load("curriculum"); const { courses } = context.load("courses");
  const { challenges } = context.load("challenges"); const { projects } = context.load("projects");
  const repository = context.load("curriculum-repository");
  const projectIds = new Set(); const globalIds = [];
  const routeKinds = { lesson: "lessons", quiz: "quizzes", exercise: "challenges", project: "projects" };
  const types = { lesson: "theory", quiz: "quiz", exercise: "lab", project: "workshop" };
  for (const course of courses) {
    const entry = curriculum.curricula[course.id]; const items = curriculum.courseItems(course.id);
    assert.equal(entry.modules.length, 3); assert.equal(entry.objectives.length, 3);
    assert.deepEqual(plain(items.filter(i => i.type === "theory").map(i => i.reference.id)), plain(course.lessons.map(l => l.id)));
    assert.deepEqual(plain(items.filter(i => i.type === "lab").map(i => i.reference.id)), plain(challenges.filter(c => c.subject === course.id).map(c => c.id)));
    assert.equal(items.filter(i => i.type === "quiz").length, 1);
    for (const topic of entry.modules) assert.deepEqual(plain(topic.activities.map(a => a.order)), plain(topic.activities.map((_, i) => i + 1)));
    for (const item of items) {
      globalIds.push(item.id);
      assert.equal(item.id, repository.legacyActivityId(item.reference));
      assert.equal(item.type, types[item.reference.kind]);
      assert.equal(item.href, "/" + routeKinds[item.reference.kind] + "/" + item.reference.id);
      assert.equal(curriculum.activityForRoute(item.href).activity.id, item.id);
      assert.equal(curriculum.findCurriculumActivity(item.id).course.id, course.id);
      assert.ok(item.title && item.description && item.minutes > 0);
      assert.ok(fs.existsSync("app/(student)/" + routeKinds[item.reference.kind] + "/[id]/page.tsx"));
      if (item.type === "workshop") projectIds.add(item.reference.id);
    }
  }
  assert.equal(new Set(globalIds).size, globalIds.length);
  assert.deepEqual([...projectIds].sort(), plain(projects.map(p => p.id).sort()));
  assert.equal(curriculum.findCurriculumActivity("missing"), undefined);
  assert.equal(curriculum.activityForRoute("/lessons/missing"), undefined);
});

test("ordering uses explicit course, module and activity order without mutating repository data", () => {
  const curriculum = loader().load("curriculum");
  const path = plain(curriculum.learningPath); const expected = curriculum.activityLocations().map(e => e.activity.id);
  path.courses.reverse();
  for (const course of path.courses) { course.modules.reverse(); for (const topic of course.modules) topic.activities.reverse(); }
  const before = JSON.stringify(path);
  assert.deepEqual(plain(curriculum.activityLocations(path).map(e => e.activity.id)), plain(expected));
  assert.equal(JSON.stringify(path), before);
  path.courses.find(c => c.id === "javascript").order = 0;
  assert.equal(curriculum.activityLocations(path)[0].course.id, "javascript");
  const topic = path.courses.find(c => c.id === "html").modules.find(m => m.id === "html-first-page");
  topic.activities.find(a => a.id === "exercise:html-heading").order = 0;
  assert.equal(curriculum.activityLocations(path).find(e => e.course.id === "html").activity.id, "exercise:html-heading");
});

test("completion counts the actual curriculum including workshops, quiz best scores and safe empty states", () => {
  const context = loader(); const logic = context.load("progress"); const curriculum = context.load("curriculum");
  let progress = logic.emptyProgress();
  assert.equal(curriculum.curriculumStats("html", progress).total, 12);
  assert.equal(curriculum.curriculumStats("css", progress).total, 12);
  assert.equal(curriculum.curriculumStats("javascript", progress).total, 14);
  progress = logic.completePractice(progress, "projects", "portfolio", "now");
  assert.equal(curriculum.activityComplete(curriculum.findCurriculumActivity("project:portfolio").activity, progress), true);
  assert.equal(curriculum.curriculumStats("html", progress).percent, 8);
  progress = logic.saveQuiz(progress, "html", 69, "now");
  const quiz = curriculum.findCurriculumActivity("quiz:html").activity;
  assert.equal(curriculum.activityComplete(quiz, progress), false);
  assert.equal(curriculum.activityStatus(quiz, progress), "in-progress");
  progress = logic.saveQuiz(progress, "html", 70, "later");
  progress = logic.saveQuiz(progress, "html", 20, "later");
  assert.equal(curriculum.activityComplete(quiz, progress), true);
  assert.deepEqual(plain(curriculum.completionStats([], progress)), { completed: 0, total: 0, percent: 0, isComplete: false });
  const pending = { id: "upcoming-profile", title: "Profile workshop", type: "workshop", description: "Upcoming", order: 1, minutes: 20, availability: "upcoming", href: "/activities/upcoming-profile" };
  assert.equal(curriculum.activityComplete(pending, progress), false);
  assert.equal(curriculum.completionStats([pending], progress).percent, 0);
  assert.equal(curriculum.completionStats([quiz, quiz], progress).total, 1);
});

test("Continue Learning resumes the most recent valid visit of every activity type, including completed activities", () => {
  const context = loader(); const logic = context.load("progress"); const curriculum = context.load("curriculum");
  let progress = logic.emptyProgress();
  assert.equal(curriculum.learningSuggestion(progress).reason, "path");
  assert.equal(curriculum.learningSuggestion(progress).activity.reference.id, "html-introduction");
  progress.currentLesson = "css-flexbox";
  assert.equal(curriculum.learningSuggestion(progress).activity.id, "lesson:css-flexbox");
  for (const [index, id] of ["lesson:html-text", "quiz:css", "exercise:javascript-button", "project:portfolio"].entries()) {
    progress = curriculum.recordVisit(progress, id, "2026-10-25T12:0" + index + ":00Z");
    assert.equal(curriculum.learningSuggestion(progress).activity.id, id);
    assert.equal(curriculum.learningSuggestion(progress).reason, "resume");
    assert.equal(curriculum.learningSuggestion(progress).module.id, curriculum.findCurriculumActivity(id).module.id);
  }
  progress = logic.completePractice(progress, "projects", "portfolio", "now");
  assert.equal(curriculum.learningSuggestion(progress).activity.id, "project:portfolio");
  assert.equal(curriculum.activityStatus(curriculum.learningSuggestion(progress).activity, progress), "completed");
  assert.equal(curriculum.nextCourseItem("javascript", progress).id, "exercise:javascript-button");
  assert.equal(curriculum.nextCourseItem("css", progress).id, "quiz:css");
  progress.visits.reverse();
  progress.visits.push({ activityId: "missing", at: "2099-01-01T00:00:00Z" }, { activityId: "quiz:html", at: "invalid" });
  assert.equal(curriculum.mostRecentActivity(progress).activity.id, "project:portfolio");
  assert.equal(curriculum.recordVisit(progress, "missing", "2026-10-25T12:00:00Z"), progress);
  assert.equal(curriculum.recordVisit(progress, "quiz:html", "invalid"), progress);
  const legacy = logic.emptyProgress();
  legacy.activity = [{ id: "done", title: "Quiz result", href: "/quizzes/css", at: "2026-10-25T12:00:00Z" }];
  assert.equal(curriculum.learningSuggestion(legacy).reason, "path");
});

test("visits persist separately without completing activities or disturbing legacy progress and drafts", () => {
  const context = loader(); const logic = context.load("progress"); const curriculum = context.load("curriculum");
  const old = logic.emptyProgress(); delete old.visits;
  old.lessons = ["html-introduction"]; old.projects = ["portfolio"]; old.challenges = ["css-card"];
  old.quizzes = { css: { latest: 40, best: 80, attempts: 2, at: "2026-10-25T00:00:00Z" } };
  old.drafts["project-calculator"] = { html: "<h1>Saved</h1>", css: "", javascript: "console.log(1)" };
  old.currentLesson = "css-flexbox";
  const restored = logic.normalizeProgress(old);
  for (const key of ["lessons", "projects", "challenges", "quizzes", "drafts", "currentLesson"]) assert.deepEqual(plain(restored[key]), plain(old[key]));
  assert.equal(restored.visits.length, 0);
  restored.drafts["lesson-html-forms"] = { html: "Form draft", css: "", javascript: "" };
  assert.equal(curriculum.activityStatus(curriculum.findCurriculumActivity("lesson:html-forms").activity, restored), "in-progress");
  const before = curriculum.curriculumStats("javascript", restored).completed;
  let visited = curriculum.recordVisit(restored, "exercise:javascript-button", "2026-10-25T12:00:00Z");
  assert.equal(curriculum.curriculumStats("javascript", visited).completed, before);
  assert.equal(curriculum.activityStatus(curriculum.findCurriculumActivity("exercise:javascript-button").activity, visited), "in-progress");
  assert.equal(restored.visits.length, 0);
  visited = curriculum.recordVisit(visited, "exercise:javascript-button", "2026-10-25T13:00:00Z");
  assert.equal(visited.visits.length, 1);
  visited.visits.push({ activityId: "missing", at: "2026-10-25T14:00:00Z" }, { activityId: "quiz:html", at: "invalid" }, { activityId: "exercise:javascript-button", at: "2026-10-25T11:00:00Z" });
  const saved = logic.normalizeProgress(JSON.parse(JSON.stringify(visited)));
  assert.equal(saved.visits.length, 1);
  assert.equal(saved.visits[0].at, "2026-10-25T13:00:00Z");
  assert.equal(saved.drafts["project-calculator"].html, "<h1>Saved</h1>");
  assert.notEqual(logic.progressKey("student-a"), logic.progressKey("student-b"));
  assert.equal(curriculum.activityStatus(curriculum.findCurriculumActivity("lesson:html-document").activity, saved), "not-started");
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

test("all actual curriculum activities yield 100% and explicit completion stays idempotent", () => {
  const context = loader(); const logic = context.load("progress"); const curriculum = context.load("curriculum");
  let p = logic.emptyProgress();
  for (const course of curriculum.curriculumCourses) {
    for (const item of curriculum.courseItems(course.id)) {
      const { kind, id } = item.reference;
      if (kind === "lesson") p = logic.completeLesson(p, id, id);
      if (kind === "quiz") p = logic.saveQuiz(p, course.id, 100, "now");
      if (kind === "exercise") p = logic.completePractice(p, "challenges", id, id);
      if (kind === "project") p = logic.completePractice(p, "projects", id, id);
    }
    assert.equal(logic.courseProgress(p, course.id).percent, 100);
    assert.equal(curriculum.curriculumStats(course.id, p).isComplete, true);
  }
  assert.equal(p.activity.length, 20); assert.equal(p.projects.length, 4);
  assert.equal(logic.completePractice(p, "projects", "portfolio", "later"), p);
  assert.equal(logic.completePractice(p, "challenges", "unknown", "now"), p);
  p.currentLesson = null;
  assert.equal(curriculum.learningSuggestion(p), null);
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
  assert.deepEqual(plain(logic.courseProgress(done, "html", ["html-heading", "html-link"])), { completed: 1, total: 12, percent: 8, isComplete: false });
  assert.equal(logic.recommendedLesson(done).id, "html-document");
  assert.equal(logic.normalizeProgress({ version: 1, lessons: ["bad", "html-introduction", "html-introduction"] }).lessons.length, 1);
  assert.equal(logic.normalizeProgress("invalid").lessons.length, 0);
});

test("lesson drafts stay isolated from each other, other workspaces, completion and other students", () => {
  const context = loader(); const logic = context.load("progress"); const { allLessons } = context.load("courses");
  const { lessonStarter } = context.load("lesson-practice"); const curriculum = context.load("curriculum");
  const a = allLessons.find(l => l.id === "html-introduction"), b = allLessons.find(l => l.id === "css-introduction");
  const p = logic.emptyProgress();
  p.quizzes.html = { latest: 20, best: 60, attempts: 2, at: "2026-10-25T00:00:00Z" };
  p.drafts["lesson-" + a.id] = { ...lessonStarter(a), html: "<h1>Lesson A draft</h1>" };
  p.drafts["lesson-" + b.id] = { ...lessonStarter(b), css: "p { color: rebeccapurple; }" };
  p.drafts["playground-welcome"] = { html: "Playground", css: "", javascript: "" };
  context.load("storage").writeStorage(context.localStorage, logic.progressKey("student"), p);
  const restored = logic.normalizeProgress(context.load("storage").readStorage(context.localStorage, logic.progressKey("student"), null));
  assert.equal(restored.drafts["lesson-html-introduction"].html, "<h1>Lesson A draft</h1>");
  assert.equal(restored.drafts["lesson-css-introduction"].css, "p { color: rebeccapurple; }");
  assert.equal(restored.drafts["playground-welcome"].html, "Playground");
  assert.equal(lessonStarter(a).html, "<!-- Write your HTML code here -->");
  assert.equal(logic.normalizeProgress(context.load("storage").readStorage(context.localStorage, logic.progressKey("other"), null)).lessons.length, 0);
  assert.equal(curriculum.curriculumStats("html", restored).completed, 0);
  assert.equal(curriculum.activityLocations().length, 38);
  assert.deepEqual(plain(restored.quizzes), plain(p.quizzes));
});

test("local profile edits normalize safely and cannot change authentication or learning records", () => {
  const context = loader(); const profiles = context.load("student-profile"), logic = context.load("progress");
  const auth = context.load("mock-auth");
  assert.equal(profiles.profileAvatars.length, 14);
  assert.equal(profiles.readProfile(context.localStorage, "student").displayName, "Learner student");
  const learning = logic.emptyProgress(); learning.lessons = ["html-introduction"];
  learning.drafts["lesson-html-introduction"] = { html: "Keep my code", css: "", javascript: "" };
  context.load("storage").writeStorage(context.localStorage, logic.progressKey("student"), learning);
  const before = context.localStorage.getItem(logic.progressKey("student"));
  const saved = profiles.saveProfile(context.localStorage, "student", { version: 1, displayName: "  Demo   Builder  ", avatar: "fox", id: "admin" });
  assert.equal(saved.displayName, "Demo Builder"); assert.equal(saved.avatar, "fox");
  assert.equal(saved.id, undefined);
  assert.equal(profiles.readProfile(context.localStorage, "student").displayName, "Demo Builder");
  assert.equal(profiles.readProfile(context.localStorage, "other").displayName, "Learner other");
  assert.notEqual(profiles.profileKey("student"), logic.progressKey("student"));
  assert.equal(context.localStorage.getItem(logic.progressKey("student")), before);
  const identity = auth.authenticateDemo("student@example.test", auth.DEMO_PASSWORD, false, false);
  assert.equal(identity.id, "student"); assert.equal(identity.email, "student@example.test");
  auth.logoutDemo();
  assert.equal(profiles.readProfile(context.localStorage, "student").displayName, "Demo Builder");
  const normalized = profiles.normalizeProfile({ version: 1, displayName: "", avatar: "https://example.com/avatar", email: "bad" }, "student");
  assert.equal(normalized.displayName, "Learner student"); assert.equal(normalized.avatar, "owl"); assert.equal(normalized.email, undefined);
  for (const name of [" ", "x", "x".repeat(41), "demo\nname", "demo\u0000name"]) assert.throws(() => profiles.saveProfile(context.localStorage, "student", { version: 1, displayName: name, avatar: "owl" }));
  assert.equal(profiles.readProfile(context.localStorage, "student").displayName, "Demo Builder");
  assert.throws(() => profiles.saveProfile({ getItem: () => null, setItem: () => { throw new Error("quota"); } }, "student", saved), /quota/);
});
