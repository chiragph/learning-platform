import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { JSDOM, VirtualConsole } from "jsdom";
import { build } from "esbuild";

function application() {
  const cache = new Map();
  function load(file) {
    file = path.resolve(file); if (cache.has(file)) return cache.get(file).exports;
    const compiled = { exports: {} }; cache.set(file, compiled);
    const source = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const require = specifier => load(path.resolve(path.dirname(file), specifier) + ".ts");
    vm.runInNewContext(source, { module: compiled, exports: compiled.exports, require, structuredClone, crypto: globalThis.crypto, URL, console, Error }, { filename: file });
    return compiled.exports;
  }
  return { load, ...load("app/lib/instructor/repository.ts"), lab: load("app/lib/instructor/lab.ts"), preview: load("app/lib/instructor/lab-preview.ts"), routing: load("app/lib/instructor/activity.ts") };
}
const plain = value => JSON.parse(JSON.stringify(value));
const content = () => ({ title: "Build a heading", objective: "Use semantic headings", instructions: "Add one h1 saying Hello.", hints: "Try an h1 tag", starter: { html: "<!-- Start here -->\n", css: "body {\n  padding: 16px;\n}\n", javascript: "// Keep indentation\n  // and blank lines\n\n" }, widths: [320, 800], solution: "<h1>Hello</h1>", checks: [{ id: "heading-count", description: "One heading", type: "element", selector: "h1", min: 1, max: 1 }, { id: "heading-text", description: "Heading text", type: "text", selector: "h1", expected: "Hello", match: "exact" }, { id: "runtime", description: "No script errors", type: "runtime" }] });
const port = () => { const values = new Map(); return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }; };
function fixture() {
  const app = application(); let state = app.seedInstructorState(), serial = 0, now = "2026-10-26T10:00:00.000Z";
  function run(command) { const result = app.applyInstructorCommand(state, command, now, () => `lab-test-${++serial}`); state = result.state; return result.id; }
  function save(activityId, content) { const location = app.lab.labLocation(state, activityId), draft = state.lab?.drafts[activityId]; return run({ type: "lab.save", courseId: location.course.id, moduleId: location.module.id, activityId, content, expectedUpdatedAt: draft?.updatedAt ?? null, expectedRevision: draft?.revision ?? null }); }
  function local() {
    const courseId = run({ type: "course.create", id: "lab-course", fields: { title: "Local labs", description: "Practical exercises", category: "Web development", difficulty: "Beginner", duration: "1 hour", objectives: ["Build things"], color: "green", icon: "code" } });
    const moduleId = run({ type: "module.create", courseId, title: "Practice", description: "Try the concepts" });
    const activityId = run({ type: "activity.create", courseId, moduleId, activityType: "lab", title: "New local lab", description: "A practical task" });
    return { courseId, moduleId, activityId };
  }
  return { app, run, save, local, get state() { return state; }, set now(value) { now = value; } };
}

test("six seeded labs import original code, objective, instructions and deterministic requirements without writing or changing IDs", () => {
  const f = fixture(), challenges = f.app.load("app/lib/student/challenges.ts").challenges, labs = f.app.load("app/lib/student/labs.ts").labs;
  const before = JSON.stringify(f.state), activities = f.state.courses.flatMap(c => c.modules).flatMap(m => m.activities).filter(a => a.type === "lab");
  assert.equal(activities.length, 6);
  for (const a of activities) {
    const imported = f.app.lab.initialLabContent(a), challenge = challenges.find(c => c.id === a.reference.id), lab = labs[challenge.id];
    assert.equal(imported.source, "student"); assert.deepEqual(plain(imported.content.starter), plain(challenge.starter)); assert.equal(imported.content.instructions, challenge.instructions); assert.equal(imported.content.objective, lab.objective); assert.equal(imported.content.hints, challenge.hint);
    assert.deepEqual(plain(imported.content.checks.map(c => c.description)), plain(lab.requirements.map(r => r.title))); assert.deepEqual(plain(imported.content.widths), plain(lab.widths)); assert.equal(f.app.lab.labReadiness(imported.content).ready, true);
  }
  assert.equal(JSON.stringify(f.state), before);
});

test("published lab saves preserve the entire original catalog and create only an independent working draft", () => {
  const f = fixture(), before = JSON.stringify(f.state.courses), student = JSON.stringify(f.app.load("app/lib/student/challenges.ts").challenges);
  f.save("exercise:html-heading", content());
  assert.equal(JSON.stringify(f.state.courses), before); assert.equal(JSON.stringify(f.app.load("app/lib/student/challenges.ts").challenges), student);
  assert.equal(f.state.lab.drafts["exercise:html-heading"].activityId, "exercise:html-heading"); assert.equal(f.state.changes[0].action, "lab.save"); assert.equal(f.state.version, 3);
  assert.throws(() => f.run({ type: "activity.delete", courseId: "html", moduleId: f.app.lab.labLocation(f.state, "exercise:html-heading").module.id, activityId: "exercise:html-heading" }), /protected/);
});

test("new lab creation, incomplete saving and editing retain stable relationships, code whitespace and draft state", () => {
  const f = fixture(), local = f.local(), baseline = f.app.lab.initialLabContent(f.app.lab.labLocation(f.state, local.activityId).activity);
  assert.equal(baseline.source, "new"); assert.equal(f.app.lab.labReadiness(baseline.content).ready, false);
  const incomplete = { ...content(), title: "Edited local lab", objective: "", checks: [] }; f.save(local.activityId, incomplete);
  assert.deepEqual(plain(f.state.lab.drafts[local.activityId].starter), incomplete.starter);
  assert.equal(f.app.lab.labLocation(f.state, local.activityId).activity.title, "Edited local lab"); assert.equal(f.app.lab.labLocation(f.state, local.activityId).activity.status, "draft"); assert.equal(f.app.courseCounts(f.state.courses.at(-1)).activities, 1);
  f.save(local.activityId, content()); assert.equal(f.state.lab.drafts[local.activityId].revision, 2); assert.equal(f.app.lab.labLocation(f.state, local.activityId).module.id, local.moduleId);
});

test("check CRUD and ordering are immutable, bounded, and preserve IDs and configuration", () => {
  const f = fixture(), checks = content().checks, before = JSON.stringify(checks), extra = f.app.lab.newLabCheck("click-text", "new-check");
  let next = f.app.lab.editLabChecks(checks, { type: "add", check: extra }); next = f.app.lab.editLabChecks(next, { type: "update", check: { ...extra, selector: "button", target: "#message", expected: "Done", description: "Click works" } });
  next = f.app.lab.editLabChecks(next, { type: "move", id: extra.id, direction: -1 }); assert.equal(next[2].id, extra.id); assert.equal(next[2].expected, "Done");
  next = f.app.lab.editLabChecks(next, { type: "delete", id: "runtime" }); assert.equal(next.some(c => c.id === "runtime"), false); assert.equal(JSON.stringify(checks), before);
  assert.equal(f.app.lab.editLabChecks(checks, { type: "add", check: checks[0] }), checks); assert.equal(f.app.lab.editLabChecks(checks, { type: "move", id: checks[0].id, direction: -1 }), checks);
});

test("readiness requires title, objective, instructions, viewports and valid checks while incomplete content remains saveable", () => {
  const f = fixture(); assert.equal(f.app.lab.labReadiness(content()).ready, true);
  for (const patch of [{ title: "a" }, { objective: " " }, { instructions: "" }, { widths: [] }, { checks: [] }, { checks: [{ ...content().checks[0], min: null }] }, { checks: [{ ...content().checks[0], min: 2, max: 1 }] }, { checks: [{ ...content().checks[1], expected: "" }] }, { checks: [{ ...content().checks[0], selector: "p::broken(" }] }]) {
    const draft = { ...content(), ...patch }; assert.equal(f.app.lab.validLabContent(draft), true); assert.equal(f.app.lab.labReadiness(draft).ready, false);
    f.save("exercise:html-heading", draft);
  }
  for (const selector of ["h1", "main > p", ".card", "#message", 'nav a[href="#learning"]', "article.card h1", '[data-test="yes"]']) assert.equal(f.app.lab.validLabSelector(selector), true, selector);
  for (const selector of ["", ">", "p >", "#", "p >> a", "p, a", "a:hover", "a[", "p; alert(1)"]) assert.equal(f.app.lab.validLabSelector(selector), false, selector);
  assert.equal(f.app.lab.labReadiness({ ...content(), checks: [{ id: "bad", description: "Unknown", type: "student", labId: "html-heading", requirementId: "missing" }] }).ready, false);
});

test("malformed lab payloads, unsupported types, duplicate IDs, excessive code or checks fail before storage writes", () => {
  const f = fixture(), local = f.local();
  for (const patch of [{ starter: { html: 1, css: "", javascript: "" } }, { starter: { ...content().starter, javascript: "x".repeat(100001) } }, { checks: [...content().checks, content().checks[0]] }, { checks: [{ id: "bad", description: "Unsafe", type: "javascript", code: "alert(1)" }] }, { widths: [320, 320] }, { widths: [1000] }, { checks: Array.from({ length: 51 }, (_, i) => ({ id: `c${i}`, description: "Check", type: "runtime" })) }]) assert.throws(() => f.save(local.activityId, { ...content(), ...patch }), /format is invalid/);
  assert.equal(f.state.lab, undefined);
});

test("lab timestamps/revisions update only after meaningful saves and reject same-millisecond stale saves", () => {
  const f = fixture(), local = f.local(); f.save(local.activityId, content()); const first = f.state.lab.drafts[local.activityId], before = f.state;
  f.now = "2026-10-26T11:00:00.000Z"; f.save(local.activityId, content()); assert.equal(f.state, before);
  f.save(local.activityId, { ...content(), hints: "New hint" }); const next = f.state.lab.drafts[local.activityId]; assert.equal(next.createdAt, first.createdAt); assert.equal(next.updatedAt, "2026-10-26T11:00:00.000Z"); assert.equal(next.revision, 2);
  f.save(local.activityId, { ...content(), hints: "Another hint" });
  assert.throws(() => f.run({ type: "lab.save", ...local, content: content(), expectedUpdatedAt: next.updatedAt, expectedRevision: 2 }), /changed elsewhere/);
});

test("lab persistence survives refresh without changing starter code or touching any student key", () => {
  const f = fixture(), local = f.local(), storage = port(); storage.setItem("student-progress", "untouched"); storage.setItem(f.app.instructorStorageKey, JSON.stringify(f.state));
  const repo = new f.app.LocalInstructorRepository(() => storage); repo.initialize(); repo.execute({ type: "lab.save", ...local, content: content(), expectedUpdatedAt: null, expectedRevision: null }); const raw = storage.getItem(f.app.instructorStorageKey);
  const refreshed = new f.app.LocalInstructorRepository(() => storage); refreshed.initialize(); assert.equal(refreshed.getSnapshot().writable, true); assert.deepEqual(plain(refreshed.getSnapshot().state.lab.drafts[local.activityId].starter), content().starter); assert.equal(storage.getItem(f.app.instructorStorageKey), raw); assert.equal(storage.getItem("student-progress"), "untouched");
});

test("version migration preserves Theory and Quiz drafts and never downgrades lab-bearing snapshots", () => {
  const f = fixture(), local = f.local(), theoryId = "lesson:html-introduction", quizId = "quiz:html", theory = f.app.load("app/lib/instructor/theory.ts"), quiz = f.app.load("app/lib/instructor/quiz.ts");
  const t = theory.theoryLocation(f.state, theoryId), q = quiz.quizLocation(f.state, quizId);
  f.run({ type: "theory.save", courseId: t.course.id, moduleId: t.module.id, activityId: theoryId, content: { title: "Theory draft", blocks: [] }, expectedUpdatedAt: null, expectedRevision: null });
  f.run({ type: "quiz.save", courseId: q.course.id, moduleId: q.module.id, activityId: quizId, content: { title: "Quiz draft", instructions: "Choose", questions: [] }, expectedUpdatedAt: null, expectedRevision: null });
  const old = JSON.stringify(f.state), decoded = f.app.decodeInstructorStorage(old); assert.equal(decoded.state.version, 2); assert.equal(decoded.recovery, "none");
  const original = JSON.stringify([f.state.theory, f.state.quiz]); f.save(local.activityId, content()); assert.equal(f.state.version, 3); assert.equal(JSON.stringify([f.state.theory, f.state.quiz]), original);
  f.run({ type: "quiz.save", courseId: q.course.id, moduleId: q.module.id, activityId: quizId, content: { title: "Quiz revision", instructions: "Choose", questions: [] }, expectedUpdatedAt: f.state.quiz.drafts[quizId].updatedAt, expectedRevision: 1 }); assert.equal(f.state.version, 3);
});

test("corrupt lab drafts recover independently, future formats stay read-only, and recovery never overwrites raw data", () => {
  const f = fixture(), local = f.local(); f.save(local.activityId, content()); const state = plain(f.state), saved = state.lab.drafts[local.activityId];
  state.lab.drafts[local.activityId].starter.css = 123; const raw = JSON.stringify(state), storage = port(); storage.setItem(f.app.instructorStorageKey, raw);
  const repo = new f.app.LocalInstructorRepository(() => storage); repo.initialize(); assert.equal(repo.getSnapshot().writable, true); assert.equal(repo.getSnapshot().state.courses.length, 4); assert.equal(storage.getItem(f.app.instructorRecoveryKey), raw); assert.equal(storage.getItem(f.app.instructorStorageKey), raw);
  for (const future of [{ ...plain(f.state), version: 5 }, { ...plain(f.state), lab: { version: 2, drafts: {} } }, { ...plain(f.state), lab: { version: 1, drafts: { [local.activityId]: { ...saved, version: 2 } } } }]) {
    const raw = JSON.stringify(future); storage.setItem(f.app.instructorStorageKey, raw); repo.initialize(); assert.equal(repo.getSnapshot().writable, false); assert.equal(storage.getItem(f.app.instructorStorageKey), raw);
  }
});

test("quota failures and external tab changes preserve the previous lab draft", () => {
  const f = fixture(), local = f.local(), storage = port(); storage.setItem(f.app.instructorStorageKey, JSON.stringify(f.state)); const repo = new f.app.LocalInstructorRepository(() => storage); repo.initialize();
  const command = { type: "lab.save", ...local, content: content(), expectedUpdatedAt: null, expectedRevision: null }, before = repo.getSnapshot();
  const set = storage.setItem; storage.setItem = () => { throw Error("Quota"); }; assert.throws(() => repo.execute(command), /not saved/); assert.equal(repo.getSnapshot(), before); storage.setItem = set;
  f.save(local.activityId, { ...content(), title: "Other tab" }); storage.setItem(f.app.instructorStorageKey, JSON.stringify(f.state)); assert.throws(() => repo.execute(command), /another tab/); assert.equal(repo.getSnapshot().state.lab.drafts[local.activityId].title, "Other tab");
});

test("duplicate lab courses copy code/check ordering with fresh IDs and remain eligible for cascading deletion", () => {
  const f = fixture(); f.save("exercise:html-heading", content()); const copyId = f.run({ type: "course.duplicate", courseId: "html" }), copy = f.state.courses.find(c => c.id === copyId), a = copy.modules.flatMap(m => m.activities).find(a => a.copiedFrom.activityId === "exercise:html-heading"), draft = f.state.lab.drafts[a.id];
  assert.equal(copy.status, "draft"); assert.equal(copy.hasBeenPublished, false); assert.equal(f.app.courseDeletionIssue(copy), null); assert.notEqual(a.id, "exercise:html-heading"); assert.deepEqual(plain(draft.starter), content().starter); assert.deepEqual(plain(draft.checks.map(c => c.description)), content().checks.map(c => c.description)); assert.equal(draft.checks.some(c => content().checks.some(original => original.id === c.id)), false);
  f.run({ type: "course.delete", courseId: copyId }); const refreshed = f.app.decodeInstructorStorage(JSON.stringify(f.state)).state; assert.equal(refreshed.lab.drafts[a.id], undefined); assert.ok(refreshed.lab.drafts["exercise:html-heading"]);
});

test("moving and archiving preserves lab association while eligible activity and module deletion cascades drafts", () => {
  for (const kind of ["activity", "module"]) {
    const f = fixture(), local = f.local(); f.save(local.activityId, content()); const target = f.run({ type: "module.create", courseId: local.courseId, title: "Next", description: "Next module" });
    f.run({ type: "activity.move", ...local, targetModuleId: target }); assert.equal(f.app.lab.labLocation(f.state, local.activityId).module.id, target);
    f.run({ type: "activity.archive", courseId: local.courseId, moduleId: target, activityId: local.activityId, archived: true }); assert.ok(f.state.lab.drafts[local.activityId]);
    f.run({ type: `${kind}.delete`, courseId: local.courseId, moduleId: target, activityId: local.activityId }); const decoded = f.app.decodeInstructorStorage(JSON.stringify(f.state)); assert.equal(decoded.recovery, "none"); assert.equal(decoded.state.lab.drafts[local.activityId], undefined);
  }
});

test("encoded lab routes decode once and missing/deleted/wrong-type or unsupported references never create blank replacement drafts", () => {
  const f = fixture(); assert.equal(f.app.routing.decodeInstructorActivityParam("exercise%3Ahtml-heading"), "exercise:html-heading"); assert.equal(f.app.lab.labEditorHref("exercise:html-heading", true), "/instructor/labs/exercise%3Ahtml-heading?preview=1"); assert.equal(f.app.lab.labLocation(f.state, "quiz:html"), null); assert.equal(f.app.lab.labLocation(f.state, "missing"), null);
  const local = f.local(); const a = f.app.lab.labLocation(f.state, local.activityId).activity; a.reference = { kind: "exercise", id: "unknown-legacy" }; assert.equal(f.app.lab.initialLabContent(a).source, "unsupported"); assert.throws(() => f.save(a.id, content()), /cannot be imported safely/); delete a.reference;
  f.run({ type: "activity.archive", ...local, archived: true }); assert.throws(() => f.save(a.id, content()), /Restore/); f.run({ type: "activity.delete", ...local }); assert.equal(f.app.lab.labLocation(f.state, a.id), null);
});

function sandbox(preview, code, lab, setup = () => {}) {
  const messages = [], tasks = [], quiet = new VirtualConsole();
  const dom = new JSDOM(preview.buildInstructorLabPreview(code, "token", lab), { runScripts: "dangerously", virtualConsole: quiet, beforeParse(view) { view.setTimeout = callback => { tasks.push(callback); return tasks.length; }; view.postMessage = message => messages.push(message); setup(view); } });
  dom.window.document.dispatchEvent(new dom.window.Event("DOMContentLoaded")); for (let i = 0; i < tasks.length && i < 30; i++) tasks[i]();
  return { dom, messages, results: messages.find(m => m.channel === "decode-instructor-lab")?.results, close: () => dom.window.close() };
}

test("sandbox runs structured DOM/text/attribute/style/click checks and captures runtime errors without mutating author content", () => {
  const f = fixture(), lab = content(); lab.checks.push({ id: "attr", type: "attribute", description: "A label", selector: "h1", attribute: "id", expected: "title" }, { id: "style", type: "style", description: "Grid", selector: "main", property: "display", expected: "grid" }, { id: "click", type: "click-text", description: "Click", selector: "button", target: "p", expected: "Done" });
  const code = { html: '<h1 id="title">Hello</h1><main></main><button>Try</button><p>Waiting</p>', css: "main{display:grid}", javascript: 'document.querySelector("button").onclick=()=>document.querySelector("p").textContent="Done";' }, before = JSON.stringify(lab);
  const good = sandbox(f.app.preview, code, lab), bad = sandbox(f.app.preview, { ...code, javascript: code.javascript + '\nthrow Error("failed");' }, lab);
  try { assert.ok(good.results.every(r => r.passed)); assert.equal(bad.results.find(r => r.id === "runtime").passed, false); assert.equal(JSON.stringify(lab), before); assert.deepEqual(lab.starter, content().starter); }
  finally { good.close(); bad.close(); }
});

test("imported JavaScript task checks reuse the original repeated-click validation and fail hardcoded outcomes", () => {
  const f = fixture(), a = f.app.lab.labLocation(f.state, "exercise:javascript-button").activity, lab = f.app.lab.initialLabContent(a).content, code = { ...lab.starter, javascript: 'document.querySelector("#greet").onclick=()=>document.querySelector("#message").textContent="Hello, developer!";' };
  const good = sandbox(f.app.preview, code, lab), bad = sandbox(f.app.preview, { ...code, javascript: 'document.querySelector("#message").textContent="Hello, developer!";' }, lab);
  try { assert.ok(good.results.every(r => r.passed)); assert.equal(bad.results.some(r => !r.passed), true); } finally { good.close(); bad.close(); }
});

test("preview uses shared CSP/HTML filtering, safely serializes script closers, and refuses incomplete scoring", () => {
  const f = fixture(), lab = content(); lab.checks[0].description = '</script><script>parent.hacked=true</script>';
  const doc = f.app.preview.buildInstructorLabPreview({ html: '<h1>Hello</h1><iframe src="https://evil.test"></iframe><script>parent.hacked=true</script>', css: "", javascript: "" }, "token", lab);
  assert.match(doc, /connect-src 'none'/); assert.match(doc, /frame-src 'none'/); assert.doesNotMatch(doc, /<script>parent.hacked/); assert.equal((doc.match(/<script>/g) ?? []).length, 2); assert.doesNotMatch(doc, /allow-same-origin/);
  assert.throws(() => f.app.preview.buildInstructorLabPreview(content().starter, "token", { ...lab, objective: "" }), /readiness/);
  const run = sandbox(f.app.preview, { html: '<h1>Hello</h1><iframe></iframe><script>window.hacked=1</script>', css: "", javascript: "" }, lab);
  try { assert.equal(run.dom.window.hacked, undefined); assert.equal(run.dom.window.document.querySelector('iframe'), null); } finally { run.close(); }
});

test("result protocol rejects wrong tokens, unknown channels, reordered/forged IDs and malformed result shapes", () => {
  const f = fixture(), checks = content().checks, message = { channel: "decode-instructor-lab", token: "token", type: "result", runtimePassed: true, results: checks.map(c => ({ id: c.id, passed: true })) };
  assert.equal(f.app.preview.isInstructorLabResult(message, "token", checks), true);
  for (const patch of [{ token: "old" }, { channel: "other" }, { results: message.results.slice(1) }, { results: [...message.results].reverse() }, { results: message.results.map(r => ({ ...r, passed: "true" })) }]) assert.equal(f.app.preview.isInstructorLabResult({ ...message, ...patch }, "token", checks), false);
});

test("runtime checks include errors raised by later interaction checks regardless of check order", () => {
  const f = fixture(), lab = content(); lab.checks = [{ id: "runtime", type: "runtime", description: "No errors" }, { id: "click", type: "click-text", description: "Changes text", selector: "button", target: "p", expected: "Done" }];
  const run = sandbox(f.app.preview, { html: "<button>Try</button><p>Done</p>", css: "", javascript: 'document.querySelector("button").onclick=()=>{throw Error("Click failed")};' }, lab);
  try { assert.equal(run.results.find(r => r.id === "runtime").passed, false); assert.equal(run.messages.find(m => m.channel === "decode-instructor-lab").runtimePassed, false); }
  finally { run.close(); }
});

test("sandbox runner remains self-contained after production minification", async () => {
  const bundled = await build({ entryPoints: ["app/lib/instructor/lab-preview.ts"], bundle: true, write: false, platform: "node", format: "cjs", target: "es2017", minify: true });
  const compiledModule = { exports: {} }; vm.runInNewContext(bundled.outputFiles[0].text, { module: compiledModule, exports: compiledModule.exports, URL, console }); const run = sandbox(compiledModule.exports, { html: "<h1>Hello</h1>", css: "", javascript: "" }, content());
  try { assert.ok(run.results); assert.equal(run.results.every(r => r.passed), true); } finally { run.close(); }
});
