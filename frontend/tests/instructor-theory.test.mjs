import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

function application() {
  const cache = new Map();
  function load(file) {
    file = path.resolve(file); if (cache.has(file)) return cache.get(file).exports;
    const compiled = { exports: {} }; cache.set(file, compiled);
    const source = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const require = specifier => { const base = path.resolve(path.dirname(file), specifier); return load(base + ".ts"); };
    vm.runInNewContext(source, { module: compiled, exports: compiled.exports, require, structuredClone, crypto: globalThis.crypto, URL, console, Error }, { filename: file });
    return compiled.exports;
  }
  return { load, ...load("app/lib/instructor/repository.ts"), theory: load("app/lib/instructor/theory.ts") };
}
const plain = v => JSON.parse(JSON.stringify(v));
const firstId = "lesson:html-introduction";
const paragraph = (text = "Learn semantic structure.") => ({ id: "block-a", type: "paragraph", text });
function fixture() {
  const app = application(); let state = app.seedInstructorState(), serial = 0, now = "2026-10-26T10:00:00.000Z";
  function run(command) { const result = app.applyInstructorCommand(state, command, now, () => `theory-test-${++serial}`); state = result.state; return result.id; }
  function save(activityId, content) { const owner = app.theory.theoryLocation(state, activityId); return run({ type: "theory.save", courseId: owner.course.id, moduleId: owner.module.id, activityId, content, expectedUpdatedAt: state.theory?.drafts[activityId]?.updatedAt ?? null, expectedRevision: state.theory?.drafts[activityId]?.revision ?? null }); }
  return { app, run, save, get state() { return state; }, set now(value) { now = value; } };
}
function localActivity(f) {
  const courseId = f.run({ type: "course.duplicate", courseId: "html" }), course = f.state.courses.find(c => c.id === courseId);
  return { courseId, moduleId: course.modules[0].id, activityId: course.modules[0].activities[0].id };
}
const storage = () => { const values = new Map(); return { values, getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k,v) }; };

test("route segments decode once while repository lookup preserves exact seeded and local identifiers", () => {
  const f = fixture(), { theory } = f.app, before = JSON.stringify(f.state);
  const seededTheory = f.state.courses.flatMap(c => c.modules).flatMap(topic => topic.activities).filter(a => a.type === "theory");
  for (const activity of seededTheory) {
    const segment = encodeURIComponent(activity.id);
    assert.equal(theory.theoryLocation(f.state, segment), null);
    assert.equal(theory.decodeTheoryActivityParam(segment), activity.id);
    assert.equal(theory.theoryLocation(f.state, theory.decodeTheoryActivityParam(segment)).activity.id, activity.id);
  }
  assert.equal(theory.decodeTheoryActivityParam(firstId), firstId);
  assert.equal(theory.decodeTheoryActivityParam("lesson%253Ahtml-introduction"), "lesson%3Ahtml-introduction");
  assert.equal(theory.theoryLocation(f.state, theory.decodeTheoryActivityParam("lesson%253Ahtml-introduction")), null);
  assert.equal(theory.decodeTheoryActivityParam("broken%E0%A4%A"), "broken%E0%A4%A");
  assert.equal(JSON.stringify(f.state), before);
  const local = localActivity(f); assert.equal(theory.theoryLocation(f.state, theory.decodeTheoryActivityParam(encodeURIComponent(local.activityId))).activity.id, local.activityId);
});

test("all 25 seeded theory activities import existing student content without duplicating or changing IDs", () => {
  const f = fixture(), studentBefore = JSON.stringify(f.app.load("app/lib/student/courses.ts").courses);
  const lessons = f.state.courses.flatMap(c => c.modules.flatMap(m => m.activities.filter(a => a.type === "theory")));
  assert.equal(lessons.length, 25); assert.equal(new Set(lessons.map(a => a.id)).size, 25);
  for (const activity of lessons) {
    const initial = f.app.theory.initialTheoryContent(activity), source = f.app.load("app/lib/student/courses.ts").findLesson(activity.reference.id);
    assert.equal(initial.source, "student"); assert.equal(initial.content.title, activity.title);
    assert.deepEqual(plain(initial.content.blocks.filter(b => b.type === "paragraph").map(b => b.text)), plain(source.explanation));
    assert.equal(initial.content.blocks.find(b => b.type === "code").code, source.code);
    assert.equal(initial.content.blocks.at(-1).text, source.practice);
    assert.equal(f.app.theory.theoryReadiness(initial.content).ready, true);
  }
  assert.equal(f.state.theory, undefined);
  assert.equal(JSON.stringify(f.app.load("app/lib/student/courses.ts").courses), studentBefore);
});

test("saving published theory creates an independent keyed working draft and preserves the entire published hierarchy", () => {
  const f = fixture(), catalog = JSON.stringify(f.state.courses), original = f.app.theory.initialTheoryContent(f.app.theory.theoryLocation(f.state, firstId).activity).content;
  f.save(firstId, { title: "A clearer introduction", blocks: [...original.blocks, paragraph()] });
  const draft = f.state.theory.drafts[firstId];
  assert.equal(draft.activityId, firstId); assert.equal(draft.version, 1); assert.equal(draft.updatedAt, "2026-10-26T10:00:00.000Z");
  assert.equal(draft.createdAt, draft.updatedAt); assert.equal(JSON.stringify(f.state.courses), catalog);
  assert.equal(f.state.changes[0].action, "theory.save"); assert.equal(f.state.changes[0].content.id, firstId);
  draft.blocks[0].text = "Local edit";
  assert.notEqual(f.app.theory.initialTheoryContent(f.app.theory.theoryLocation(f.state, firstId).activity).content.blocks[0].text, "Local edit");
});

test("incomplete drafts are savable, local activity titles sync, and publication stays deferred", () => {
  const f = fixture(), ids = localActivity(f), beforeCreated = f.app.theory.theoryLocation(f.state, ids.activityId).activity.createdAt;
  f.now = "2026-10-26T11:00:00.000Z";
  f.save(ids.activityId, { title: "", blocks: [paragraph("")] });
  assert.equal(f.app.theory.theoryReadiness(f.state.theory.drafts[ids.activityId]).ready, false);
  f.save(ids.activityId, { title: "Local lesson", blocks: [paragraph()] });
  const location = f.app.theory.theoryLocation(f.state, ids.activityId);
  assert.equal(location.activity.title, "Local lesson"); assert.equal(location.activity.status, "draft"); assert.equal(location.activity.publishedAt, null);
  assert.equal(location.activity.createdAt, beforeCreated); assert.equal(location.activity.updatedAt, "2026-10-26T11:00:00.000Z");
  assert.throws(() => f.run({ type: "course.status", courseId: ids.courseId, status: "published" }), /content/);
});

test("renaming an unpublished local activity in Curriculum keeps its saved lesson title and revision consistent", () => {
  const f = fixture(), ids = localActivity(f); f.save(ids.activityId, { title: "Local theory draft", blocks: [paragraph()] });
  f.now = "2026-10-27T12:00:00.000Z";
  f.run({ type: "activity.update", ...ids, title: "Renamed theory draft", description: "Updated details" });
  const draft = f.state.theory.drafts[ids.activityId]; assert.equal(draft.title, "Renamed theory draft"); assert.equal(draft.revision, 2); assert.equal(draft.updatedAt, "2026-10-27T12:00:00.000Z");
  assert.equal(draft.blocks[0].text, paragraph().text);
});

test("unchanged saves do not write timestamps, history, or storage; real title, edit and reorder saves do", () => {
  const f = fixture(), initial = f.app.theory.initialTheoryContent(f.app.theory.theoryLocation(f.state, firstId).activity).content, baseline = f.state;
  f.save(firstId, initial); assert.equal(f.state, baseline);
  f.save(firstId, { ...initial, title: "Updated introduction" });
  const created = f.state.theory.drafts[firstId].createdAt, saved = f.state;
  f.now = "2026-10-27T12:00:00.000Z";
  f.save(firstId, { title: saved.theory.drafts[firstId].title, blocks: saved.theory.drafts[firstId].blocks }); assert.equal(f.state, saved);
  const blocks = f.app.theory.editTheoryBlocks(saved.theory.drafts[firstId].blocks, { type: "move", id: initial.blocks[0].id, direction: 1 });
  f.save(firstId, { title: "Updated introduction", blocks });
  assert.equal(f.state.theory.drafts[firstId].createdAt, created); assert.equal(f.state.theory.drafts[firstId].updatedAt, f.state.changes[0].at);
  assert.equal(f.state.theory.drafts[firstId].updatedAt, "2026-10-27T12:00:00.000Z");
});

test("block creation, update, duplication, reorder and deletion preserve content order and leave input immutable", () => {
  const { theory } = application(); let blocks = [], serial = 0;
  for (const type of ["heading", "paragraph", "list", "code", "callout", "resource"]) blocks = theory.editTheoryBlocks(blocks, { type: "add", block: theory.newTheoryBlock(type, `b-${++serial}`) });
  const before = JSON.stringify(blocks);
  const updated = theory.editTheoryBlocks(blocks, { type: "update", block: { ...blocks[1], text: "**Bold** and *italic* and `code`" } });
  assert.equal(JSON.stringify(blocks), before);
  blocks = theory.editTheoryBlocks(updated, { type: "duplicate", id: "b-2", newId: "new-copy" });
  assert.equal(blocks[2].text, updated[1].text); assert.notEqual(blocks[2].id, blocks[1].id);
  blocks = theory.editTheoryBlocks(blocks, { type: "move", id: "new-copy", direction: -1 }); assert.equal(blocks[1].id, "new-copy");
  blocks = theory.editTheoryBlocks(blocks, { type: "delete", id: "b-2" }); assert.equal(blocks.length, 6);
  assert.equal(theory.editTheoryBlocks(blocks, { type: "move", id: blocks[0].id, direction: -1 }), blocks);
  assert.equal(theory.editTheoryBlocks(blocks, { type: "duplicate", id: blocks[0].id, newId: blocks[1].id }), blocks);
  assert.equal(theory.editTheoryBlocks(blocks, { type: "add", block: blocks[0] }), blocks);
});

test("readiness requires a meaningful title, substantive content and complete valid blocks", () => {
  const { theory } = application();
  assert.equal(theory.theoryReadiness({ title: "  ", blocks: [] }).ready, false);
  assert.equal(theory.theoryReadiness({ title: "One", blocks: [{ id: "h", type: "heading", level: 2, text: "Heading only" }] }).ready, false);
  for (const type of ["heading", "paragraph", "list", "code", "callout", "resource"]) {
    const content = { title: "Lesson", blocks: [paragraph(), theory.newTheoryBlock(type, "incomplete")] };
    assert.equal(theory.theoryReadiness(content).ready, false, type); assert.equal(theory.theoryReadiness(content).errors.length, 1);
  }
  assert.equal(theory.theoryReadiness({ title: "Lesson", blocks: [paragraph("** **")] }).ready, false);
  assert.equal(theory.theoryReadiness({ title: "Lesson", blocks: [paragraph(), { id: "link", type: "resource", title: "Docs", url: "https://example.com/docs", description: "" }] }).ready, true);
});

test("unsafe links, malformed languages and duplicate block identifiers never bypass validation", () => {
  const f = fixture(), { theory } = f.app;
  for (const url of ["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "file:///C:/secret", "//example.com", "https://user:pass@example.com", "https://exa\nmple.com", "not a link"]) assert.equal(theory.safeResourceUrl(url), null, url);
  assert.equal(theory.safeResourceUrl(" https://example.com/learn?q=a#b "), "https://example.com/learn?q=a#b");
  for (const content of [{ title: "Lesson", blocks: [paragraph(), paragraph()] }, { title: "Lesson", blocks: [{ id: "code", type: "code", language: "python", code: "x", title: "", explanation: "" }] }, { title: "Lesson", blocks: [{ id: "h", type: "heading", level: "2", text: "x" }] }, { title: "Lesson", blocks: [{ id: "x", type: "html", html: "<script>" }] }]) {
    assert.equal(theory.validTheoryContent(content), false); assert.throws(() => f.save(firstId, content), /format is invalid/);
  }
});

test("repository saves persist and reopen by existing ID, while failed and unchanged writes remain atomic", () => {
  const app = application(), port = storage(); port.setItem("student-progress", "unchanged");
  const repository = new app.LocalInstructorRepository(() => port); repository.initialize();
  const owner = app.theory.theoryLocation(repository.getSnapshot().state, firstId), command = { type: "theory.save", courseId: owner.course.id, moduleId: owner.module.id, activityId: firstId, content: { title: "Saved lesson", blocks: [paragraph()] }, expectedUpdatedAt: null, expectedRevision: null };
  repository.execute(command);
  const saved = port.getItem(app.instructorStorageKey), reload = new app.LocalInstructorRepository(() => port); reload.initialize();
  assert.equal(JSON.stringify(reload.getSnapshot().state), saved);
  assert.equal(reload.getSnapshot().state.theory.drafts[firstId].title, "Saved lesson"); assert.equal(port.getItem("student-progress"), "unchanged");
  let writes = 0; const originalSet = port.setItem; port.setItem = (...args) => { writes++; originalSet(...args); };
  reload.execute({ ...command, expectedUpdatedAt: reload.getSnapshot().state.theory.drafts[firstId].updatedAt, expectedRevision: 1 }); assert.equal(writes, 0);
  port.setItem = () => { throw new Error("quota"); };
  assert.throws(() => reload.execute({ ...command, content: { ...command.content, title: "Unsaved" }, expectedUpdatedAt: reload.getSnapshot().state.theory.drafts[firstId].updatedAt, expectedRevision: 1 }), /not saved/);
  assert.equal(port.getItem(app.instructorStorageKey), saved); assert.equal(reload.getSnapshot().state.theory.drafts[firstId].title, "Saved lesson");
});

test("stale working-draft revisions and other-tab writes cannot silently overwrite local edits", () => {
  const f = fixture(); f.save(firstId, { title: "First edit", blocks: [paragraph()] });
  assert.throws(() => f.run({ type: "theory.save", courseId: "html", moduleId: "html-first-page", activityId: firstId, content: { title: "Stale edit", blocks: [] }, expectedUpdatedAt: null }), /changed elsewhere/);
  const firstRevision = f.state.theory.drafts[firstId].revision, sameInstant = f.state.theory.drafts[firstId].updatedAt;
  f.save(firstId, { title: "Second edit in the same millisecond", blocks: [paragraph()] });
  assert.equal(f.state.theory.drafts[firstId].updatedAt, sameInstant);
  assert.throws(() => f.run({ type: "theory.save", courseId: "html", moduleId: "html-first-page", activityId: firstId, content: { title: "Stale edit", blocks: [] }, expectedUpdatedAt: sameInstant, expectedRevision: firstRevision }), /changed elsewhere/);
  const port = storage(); port.setItem(f.app.instructorStorageKey, JSON.stringify(f.state));
  const repo = new f.app.LocalInstructorRepository(() => port); repo.initialize(); port.setItem(f.app.instructorStorageKey, JSON.stringify({ ...f.state, changes: [] }));
  assert.throws(() => repo.execute({ type: "course.duplicate", courseId: "html" }), /another tab/);
});

test("course copies include independent theory drafts with new activity and block IDs and remain deletable after refresh", () => {
  const f = fixture(); f.save(firstId, { title: "Custom explanation", blocks: [paragraph()] });
  const original = JSON.stringify(f.state.theory.drafts[firstId]), ids = localActivity(f), copy = f.state.theory.drafts[ids.activityId];
  assert.equal(copy.title, "Custom explanation"); assert.equal(copy.activityId, ids.activityId); assert.notEqual(copy.blocks[0].id, "block-a"); assert.equal(copy.blocks[0].text, paragraph().text);
  assert.equal(f.app.courseDeletionIssue(f.state.courses.find(c => c.id === ids.courseId)), null);
  assert.equal(f.app.decodeInstructorStorage(JSON.stringify(f.state)).recovery, "none");
  f.run({ type: "course.delete", courseId: ids.courseId }); assert.equal(f.state.theory.drafts[ids.activityId], undefined);
  assert.equal(JSON.stringify(f.state.theory.drafts[firstId]), original);
  assert.equal(f.app.decodeInstructorStorage(JSON.stringify(f.state)).state.theory.drafts[ids.activityId], undefined);
});

test("activity and module deletions cascade working drafts; moving and archiving retain them", () => {
  for (const deletion of ["activity.delete", "module.delete"]) {
    const f = fixture(), ids = localActivity(f); f.save(ids.activityId, { title: "Draft content", blocks: [paragraph()] });
    f.run({ type: "activity.archive", ...ids, archived: true }); assert.ok(f.state.theory.drafts[ids.activityId]);
    f.run({ type: "activity.archive", ...ids, archived: false });
    const target = f.state.courses.find(c => c.id === ids.courseId).modules[1].id;
    f.run({ type: "activity.move", ...ids, targetModuleId: target }); assert.ok(f.state.theory.drafts[ids.activityId]);
    f.run({ type: deletion, ...ids, moduleId: target }); assert.equal(f.state.theory.drafts[ids.activityId], undefined);
    assert.equal(f.app.decodeInstructorStorage(JSON.stringify(f.state)).state.theory.drafts[ids.activityId], undefined);
  }
});

test("Stage 5A storage migrates additively and malformed lesson extensions preserve the catalog and valid drafts", () => {
  const f = fixture(), ids = localActivity(f), baseline = JSON.stringify(f.state.courses);
  assert.equal(f.app.decodeInstructorStorage(JSON.stringify(f.state)).state.theory, undefined);
  f.save(firstId, { title: "Good draft", blocks: [paragraph()] }); f.save(ids.activityId, { title: "Another draft", blocks: [paragraph()] });
  const broken = plain(f.state); broken.theory.drafts[ids.activityId].blocks = [{ type: "unknown" }];
  const raw = JSON.stringify(broken), port = storage(); port.setItem(f.app.instructorStorageKey, raw);
  const repo = new f.app.LocalInstructorRepository(() => port); repo.initialize();
  assert.equal(repo.getSnapshot().writable, true); assert.match(repo.getSnapshot().warning, /catalog and valid drafts are preserved/);
  assert.equal(port.getItem(f.app.instructorRecoveryKey), raw); assert.ok(repo.getSnapshot().state.theory.drafts[firstId]); assert.equal(repo.getSnapshot().state.theory.drafts[ids.activityId], undefined);
  assert.equal(JSON.stringify(repo.getSnapshot().state.courses.map(c => c.id)), JSON.stringify(JSON.parse(baseline).map(c => c.id)));
  assert.deepEqual(plain(repo.getSnapshot().state.courses), plain(f.state.courses));
  repo.execute({ type: "course.archive", courseId: ids.courseId, archived: true });
  const reload = new f.app.LocalInstructorRepository(() => port); reload.initialize(); assert.ok(reload.getSnapshot().state.theory.drafts[firstId]);
  for (const extension of [null, "bad", { version: 1, drafts: [] }]) assert.equal(f.app.decodeInstructorStorage(JSON.stringify({ ...f.state, theory: extension })).recovery, "theory");
  port.setItem(f.app.instructorStorageKey, raw); port.setItem = () => { throw new Error("Cannot back up storage"); };
  const failedBackup = new f.app.LocalInstructorRepository(() => port); failedBackup.initialize();
  assert.equal(failedBackup.getSnapshot().writable, false); assert.deepEqual(plain(failedBackup.getSnapshot().state.courses), plain(f.state.courses)); assert.equal(port.getItem(f.app.instructorStorageKey), raw);
});

test("unknown lesson versions are read-only without losing Stage 5A catalog or overwriting raw data", () => {
  const f = fixture(); f.save(firstId, { title: "Future content", blocks: [paragraph()] });
  for (const future of [state => { state.theory.version = 2; }, state => { state.theory.drafts[firstId].version = 2; }]) {
    const value = plain(f.state); future(value); const raw = JSON.stringify(value), port = storage(); port.setItem(f.app.instructorStorageKey, raw);
    const repo = new f.app.LocalInstructorRepository(() => port); repo.initialize();
    assert.equal(repo.getSnapshot().writable, false); assert.deepEqual(plain(repo.getSnapshot().state.courses), plain(f.state.courses));
    assert.throws(() => repo.execute({ type: "course.duplicate", courseId: "html" }), /not ready/); assert.equal(port.getItem(f.app.instructorStorageKey), raw);
  }
});

test("unsupported legacy content, archived curriculum and non-theory activities cannot be replaced with blank drafts", () => {
  const f = fixture(), activity = f.app.theory.theoryLocation(f.state, firstId).activity;
  activity.reference = { kind: "lesson", id: "unavailable-legacy" };
  assert.equal(f.app.theory.initialTheoryContent(activity).source, "unsupported");
  assert.throws(() => f.save(firstId, { title: "Replacement", blocks: [paragraph()] }), /cannot be imported safely/);
  const ids = localActivity(f); f.run({ type: "course.archive", courseId: ids.courseId, archived: true });
  assert.throws(() => f.save(ids.activityId, { title: "Archived edit", blocks: [paragraph()] }), /Restore/);
  assert.throws(() => f.run({ type: "theory.save", courseId: "html", moduleId: "html-first-page", activityId: "not-a-theory", content: { title: "x", blocks: [] }, expectedUpdatedAt: null }), /not found/);
});
