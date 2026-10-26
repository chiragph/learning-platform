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
    const require = specifier => load(path.resolve(path.dirname(file), specifier) + ".ts");
    vm.runInNewContext(source, { module: compiled, exports: compiled.exports, require, structuredClone, crypto: globalThis.crypto, URL, console, Error }, { filename: file });
    return compiled.exports;
  }
  return { load, ...load("app/lib/instructor/repository.ts"), quiz: load("app/lib/instructor/quiz.ts"), routing: load("app/lib/instructor/activity.ts") };
}
const plain = value => JSON.parse(JSON.stringify(value));
const firstId = "quiz:html";
const question = (id = "q", points = 1) => ({ id, topic: "Structure", prompt: "Which option is correct?", options: [{ id: `${id}-a`, text: "Correct choice" }, { id: `${id}-b`, text: "Another choice" }], correctOptionId: `${id}-a`, explanation: "The first option matches the question.", points });
const content = () => ({ title: "Knowledge check", instructions: "Choose one answer for each question.", questions: [question()] });
function fixture() {
  const app = application(); let state = app.seedInstructorState(), serial = 0, now = "2026-10-26T10:00:00.000Z";
  function run(command) { const result = app.applyInstructorCommand(state, command, now, () => `quiz-test-${++serial}`); state = result.state; return result.id; }
  function save(activityId, quiz) { const location = app.quiz.quizLocation(state, activityId), draft = state.quiz?.drafts[activityId]; return run({ type: "quiz.save", courseId: location.course.id, moduleId: location.module.id, activityId, content: quiz, expectedUpdatedAt: draft?.updatedAt ?? null, expectedRevision: draft?.revision ?? null }); }
  return { app, run, save, get state() { return state; }, set now(value) { now = value; } };
}
function localQuiz(f) {
  const courseId = f.run({ type: "course.create", id: "quiz-course", fields: { title: "Local quiz course", description: "Learn through questions.", category: "Web development", difficulty: "Beginner", duration: "1 hour", objectives: ["Check understanding"], color: "green", icon: "book" } });
  const moduleId = f.run({ type: "module.create", courseId, title: "Knowledge checks", description: "Practice the concepts" });
  const activityId = f.run({ type: "activity.create", courseId, moduleId, activityType: "quiz", title: "New local quiz", description: "A new assessment" });
  return { courseId, moduleId, activityId };
}
const storage = () => { const values = new Map(); return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }; };

test("three seeded quizzes import every original question, correct answer and explanation without changing curriculum IDs", () => {
  const f = fixture(), source = f.app.load("app/lib/student/quizzes.ts").quizzes, before = JSON.stringify(source), activities = f.state.courses.flatMap(c => c.modules).flatMap(m => m.activities).filter(a => a.type === "quiz");
  assert.equal(activities.length, 3); assert.deepEqual(plain(activities.map(a => a.id)), ["quiz:html", "quiz:css", "quiz:javascript"]);
  for (const activity of activities) {
    const imported = f.app.quiz.initialQuizContent(activity); assert.equal(imported.source, "student"); assert.equal(imported.content.questions.length, source[activity.reference.id].length);
    for (const [i, q] of imported.content.questions.entries()) {
      const original = source[activity.reference.id][i]; assert.equal(q.id, original.id); assert.equal(q.prompt, original.prompt); assert.equal(q.topic, original.topic); assert.equal(q.explanation, original.explanation);
      assert.deepEqual(plain(q.options.map(o => o.text)), plain(original.options)); assert.equal(q.options.find(o => o.id === q.correctOptionId).text, original.options[original.correct]); assert.equal(q.points, 1);
    }
    assert.equal(f.app.quiz.quizReadiness(imported.content).ready, true);
  }
  assert.equal(JSON.stringify(source), before); assert.equal(f.state.quiz, undefined);
});

test("editing a published quiz saves an independent working draft, preserving the complete original hierarchy and student content", () => {
  const f = fixture(), before = JSON.stringify(f.state.courses), source = JSON.stringify(f.app.load("app/lib/student/quizzes.ts").quizzes);
  f.save(firstId, content()); const draft = f.state.quiz.drafts[firstId];
  assert.equal(draft.activityId, firstId); assert.equal(draft.createdAt, "2026-10-26T10:00:00.000Z"); assert.equal(draft.updatedAt, draft.createdAt); assert.equal(draft.revision, 1);
  assert.equal(JSON.stringify(f.state.courses), before); assert.equal(JSON.stringify(f.app.load("app/lib/student/quizzes.ts").quizzes), source);
  assert.equal(f.state.changes[0].action, "quiz.save"); assert.equal(f.state.changes[0].content.id, firstId);
});

test("new quizzes save incomplete drafts and synchronize metadata without publication or ID changes", () => {
  const f = fixture(), ids = localQuiz(f), beforeIds = JSON.stringify(f.state.courses.map(c => [c.id, ...c.modules.flatMap(m => [m.id, ...m.activities.map(a => a.id)])]));
  f.save(ids.activityId, { title: "", instructions: "", questions: [f.app.quiz.newQuizQuestion()] });
  assert.equal(f.app.quiz.quizReadiness(f.state.quiz.drafts[ids.activityId]).ready, false);
  f.now = "2026-10-27T11:00:00.000Z"; f.save(ids.activityId, content());
  const location = f.app.quiz.quizLocation(f.state, ids.activityId); assert.equal(location.activity.title, content().title); assert.equal(location.activity.updatedAt, "2026-10-27T11:00:00.000Z"); assert.equal(location.module.updatedAt, location.activity.updatedAt); assert.equal(location.course.updatedAt, location.activity.updatedAt);
  assert.equal(location.activity.status, "draft"); assert.equal(location.activity.publishedAt, null); assert.equal(location.activity.hasBeenPublished, false);
  assert.equal(JSON.stringify(f.state.courses.map(c => [c.id, ...c.modules.flatMap(m => [m.id, ...m.activities.map(a => a.id)])])), beforeIds);
  assert.throws(() => f.run({ type: "course.status", courseId: ids.courseId, status: "published" }), /Stage 5E/);
});

test("question edits, additions, duplication, deletion and ordering are immutable and retain correct-answer identity", () => {
  const { quiz } = application(); let serial = 0; const fresh = prefix => `${prefix}-${++serial}`, original = [question("one"), question("two", 4)], before = JSON.stringify(original);
  let questions = quiz.editQuizQuestions(original, { type: "update", question: { ...original[0], prompt: "Updated question", points: 3 } });
  questions = quiz.editQuizQuestions(questions, { type: "duplicate", id: "one" }, fresh);
  const copy = questions[1]; assert.notEqual(copy.id, "one"); assert.notEqual(copy.options[0].id, original[0].options[0].id); assert.equal(copy.options.find(o => o.id === copy.correctOptionId).text, "Correct choice"); assert.equal(copy.points, 3);
  questions = quiz.editQuizQuestions(questions, { type: "move", id: copy.id, direction: 1 }); assert.equal(questions[2].id, copy.id);
  questions = quiz.editQuizQuestions(questions, { type: "delete", id: "two" }); assert.equal(questions.length, 2);
  questions = quiz.editQuizQuestions(questions, { type: "add", question: quiz.newQuizQuestion(fresh) }); assert.equal(questions.length, 3); assert.equal(questions[2].options.length, 2); assert.equal(questions[2].correctOptionId, null);
  assert.equal(JSON.stringify(original), before);
  assert.equal(quiz.editQuizQuestions(questions, { type: "move", id: "one", direction: -1 }), questions);
  assert.equal(quiz.editQuizQuestions(questions, { type: "add", question: questions[0] }), questions);
});

test("readiness requires instructions, substantive questions, two to six distinct nonempty options and one existing correct answer", () => {
  const { quiz } = application(); assert.equal(quiz.quizReadiness(content()).ready, true);
  for (const value of [{ ...content(), title: " " }, { ...content(), instructions: "" }, { ...content(), questions: [] }]) assert.equal(quiz.quizReadiness(value).ready, false);
  for (const patch of [{ prompt: "" }, { options: [question().options[0]] }, { options: [...question().options, { id: "c", text: "Correct choice" }] }, { options: [...question().options, { id: "c", text: " " }] }, { correctOptionId: null }, { correctOptionId: "removed-option" }, { points: null }, { points: 0 }, { points: -1 }, { points: 1.5 }, { points: 1001 }]) {
    const value = { ...content(), questions: [{ ...question(), ...patch }] }; assert.equal(quiz.validQuizContent(value), true); assert.equal(quiz.quizReadiness(value).ready, false, JSON.stringify(patch));
  }
  const six = { ...question(), options: Array.from({ length: 6 }, (_, i) => ({ id: `o-${i}`, text: `Option ${i}` })), correctOptionId: "o-5", points: 1000 };
  assert.equal(quiz.quizReadiness({ ...content(), questions: [six] }).ready, true);
});

test("runtime validation rejects malformed payloads, nonfinite points, duplicate IDs, oversized arrays and multiple correct-answer values", () => {
  const f = fixture(), { quiz } = f.app, before = JSON.stringify(f.state);
  const invalid = [{ ...content(), questions: [question(), question()] }, { ...content(), questions: [{ ...question(), correctOptionId: ["q-a", "q-b"] }] }, { ...content(), questions: [{ ...question(), points: NaN }] }, { ...content(), questions: [{ ...question(), points: Infinity }] }, { ...content(), questions: [{ ...question(), options: Array.from({ length: 7 }, (_, i) => ({ id: `o-${i}`, text: "Option" })) }] }, { ...content(), questions: [{ ...question(), options: [{ id: "same", text: "A" }, { id: "same", text: "B" }] }] }, { ...content(), title: "x".repeat(201) }];
  for (const value of invalid) { assert.equal(quiz.validQuizContent(value), false); assert.throws(() => f.save(firstId, value), /format is invalid/); }
  assert.equal(quiz.validQuizContent({ ...content(), questions: Array.from({ length: 101 }, (_, i) => question(`q-${i}`)) }), false);
  assert.equal(JSON.stringify(f.state), before);
});

test("preview scoring uses configured points, handles unanswered/forged selections, and does not mutate content or answers", () => {
  const { quiz } = application(), value = { ...content(), questions: [question("heavy", 3), question("light", 1)] }, before = JSON.stringify(value), answers = { heavy: "heavy-b", light: "light-a" }, beforeAnswers = JSON.stringify(answers);
  const score = quiz.scoreQuizPreview(value, answers); assert.equal(score.percent, 25); assert.equal(score.earnedPoints, 1); assert.equal(score.totalPoints, 4); assert.equal(score.correct, 1); assert.equal(score.total, 2);
  assert.equal(quiz.scoreQuizPreview(value, { heavy: "heavy-a", light: "light-a" }).percent, 100);
  assert.equal(quiz.scoreQuizPreview(value, {}).percent, 0); assert.equal(quiz.scoreQuizPreview(value, { heavy: "not-an-option" }).questions[0].selectedOptionId, null);
  assert.equal(JSON.stringify(value), before); assert.equal(JSON.stringify(answers), beforeAnswers);
  assert.throws(() => quiz.scoreQuizPreview({ ...value, questions: [{ ...question(), correctOptionId: null }] }, {}), /readiness/);
});

test("quiz timestamps and revisions change only for real saves, preserving creation dates and no-op storage", () => {
  const f = fixture(), initial = f.app.quiz.initialQuizContent(f.app.quiz.quizLocation(f.state, firstId).activity).content, before = f.state;
  f.save(firstId, initial); assert.equal(f.state, before);
  f.save(firstId, content()); const saved = f.state, created = f.state.quiz.drafts[firstId].createdAt;
  f.now = "2026-10-27T10:00:00.000Z"; f.save(firstId, content()); assert.equal(f.state, saved);
  f.save(firstId, { ...content(), instructions: "Updated instructions." }); assert.equal(f.state.quiz.drafts[firstId].createdAt, created); assert.equal(f.state.quiz.drafts[firstId].updatedAt, "2026-10-27T10:00:00.000Z"); assert.equal(f.state.quiz.drafts[firstId].revision, 2);
  const ids = localQuiz(f); f.save(ids.activityId, content()); f.run({ type: "activity.update", ...ids, title: "Renamed local quiz", description: "Updated description" }); assert.equal(f.state.quiz.drafts[ids.activityId].title, "Renamed local quiz"); assert.equal(f.state.quiz.drafts[ids.activityId].revision, 2);
});

test("quiz persistence survives refresh and never writes any student storage key", () => {
  const app = application(), port = storage(); port.setItem("student-progress", "untouched"); port.setItem("student-quiz-session", "untouched");
  const repo = new app.LocalInstructorRepository(() => port); repo.initialize(); const location = app.quiz.quizLocation(repo.getSnapshot().state, firstId);
  const command = { type: "quiz.save", courseId: location.course.id, moduleId: location.module.id, activityId: firstId, content: content(), expectedUpdatedAt: null, expectedRevision: null };
  repo.execute(command); const raw = port.getItem(app.instructorStorageKey), reload = new app.LocalInstructorRepository(() => port); reload.initialize();
  assert.equal(JSON.stringify(reload.getSnapshot().state), raw); assert.equal(reload.getSnapshot().state.quiz.drafts[firstId].questions[0].correctOptionId, "q-a");
  let writes = 0; const original = port.setItem; port.setItem = (...args) => { writes++; original(...args); };
  reload.execute({ ...command, expectedUpdatedAt: reload.getSnapshot().state.quiz.drafts[firstId].updatedAt, expectedRevision: 1 }); assert.equal(writes, 0);
  assert.equal(port.getItem("student-progress"), "untouched"); assert.equal(port.getItem("student-quiz-session"), "untouched"); assert.equal(port.values.size, 3);
});

test("quiz-bearing snapshots cross a version boundary while legacy snapshots and their Theory drafts remain intact", () => {
  const f = fixture(), theoryId = "lesson:html-introduction", location = f.app.load("app/lib/instructor/theory.ts").theoryLocation(f.state, theoryId);
  f.run({ type: "theory.save", courseId: location.course.id, moduleId: location.module.id, activityId: theoryId, content: { title: "Existing Theory draft", blocks: [{ id: "legacy-theory-block", type: "paragraph", text: "Keep the legacy document." }] }, expectedUpdatedAt: null, expectedRevision: null });
  assert.equal(f.state.version, 1); const legacy = JSON.stringify(f.state), catalog = JSON.stringify(f.state.courses), theory = JSON.stringify(f.state.theory);
  const oldPort = storage(); oldPort.setItem(f.app.instructorStorageKey, legacy); const old = new f.app.LocalInstructorRepository(() => oldPort); old.initialize();
  assert.equal(old.getSnapshot().writable, true); assert.equal(oldPort.getItem(f.app.instructorStorageKey), legacy);
  f.save(firstId, content()); assert.equal(f.state.version, 2); assert.equal(JSON.stringify(f.state.courses), catalog); assert.equal(JSON.stringify(f.state.theory), theory);
  const raw = JSON.stringify(f.state), port = storage(); port.setItem(f.app.instructorStorageKey, raw); const reload = new f.app.LocalInstructorRepository(() => port); reload.initialize();
  assert.equal(reload.getSnapshot().state.version, 2); assert.equal(reload.getSnapshot().writable, true); assert.equal(JSON.stringify(reload.getSnapshot().state), raw);
  const future = JSON.stringify({ ...f.state, version: 5 }); port.setItem(f.app.instructorStorageKey, future); reload.initialize(); assert.equal(reload.getSnapshot().writable, false); assert.equal(port.getItem(f.app.instructorStorageKey), future);
});

test("quota failures and stale tabs do not falsely save or overwrite quiz edits", () => {
  const f = fixture(); f.save(firstId, content()); const raw = JSON.stringify(f.state), port = storage(); port.setItem(f.app.instructorStorageKey, raw);
  const repo = new f.app.LocalInstructorRepository(() => port); repo.initialize();
  const location = f.app.quiz.quizLocation(f.state, firstId), command = { type: "quiz.save", courseId: location.course.id, moduleId: location.module.id, activityId: firstId, content: { ...content(), title: "New title" }, expectedUpdatedAt: f.state.quiz.drafts[firstId].updatedAt, expectedRevision: 1 };
  port.setItem = () => { throw new Error("quota"); }; assert.throws(() => repo.execute(command), /not saved/); assert.equal(port.getItem(f.app.instructorStorageKey), raw); assert.equal(repo.getSnapshot().state.quiz.drafts[firstId].title, content().title);
  port.values.set(f.app.instructorStorageKey, JSON.stringify({ ...f.state, changes: [] })); assert.throws(() => repo.execute(command), /another tab/);
});

test("revision checks reject stale quiz saves even when two edits have the same timestamp", () => {
  const f = fixture(); f.save(firstId, content()); const location = f.app.quiz.quizLocation(f.state, firstId), at = f.state.quiz.drafts[firstId].updatedAt;
  f.save(firstId, { ...content(), title: "Second edit" }); assert.equal(f.state.quiz.drafts[firstId].updatedAt, at);
  assert.throws(() => f.run({ type: "quiz.save", courseId: location.course.id, moduleId: location.module.id, activityId: firstId, content: content(), expectedUpdatedAt: at, expectedRevision: 1 }), /changed elsewhere/);
});

test("course duplication copies working quiz content with fresh question/option IDs and remains a deletable draft", () => {
  const f = fixture(); f.save(firstId, content()); const original = JSON.stringify(f.state.courses[0]), draftBefore = JSON.stringify(f.state.quiz.drafts[firstId]);
  const copyId = f.run({ type: "course.duplicate", courseId: "html" }), copy = f.state.courses.find(c => c.id === copyId), activity = copy.modules.flatMap(m => m.activities).find(a => a.type === "quiz"), draft = f.state.quiz.drafts[activity.id];
  assert.equal(copy.status, "draft"); assert.equal(copy.hasBeenPublished, false); assert.equal(f.app.courseDeletionIssue(copy), null); assert.equal(activity.reference, undefined); assert.equal(activity.copiedFrom.reference.id, "html");
  assert.equal(draft.questions[0].prompt, content().questions[0].prompt); assert.notEqual(draft.questions[0].id, "q"); assert.notEqual(draft.questions[0].options[0].id, "q-a"); assert.equal(draft.questions[0].options.find(o => o.id === draft.questions[0].correctOptionId).text, "Correct choice"); assert.equal(draft.revision, 1);
  assert.equal(JSON.stringify(f.state.courses[0]), original); assert.equal(JSON.stringify(f.state.quiz.drafts[firstId]), draftBefore);
  f.run({ type: "course.delete", courseId: copyId }); assert.equal(f.state.quiz.drafts[activity.id], undefined); assert.equal(f.app.decodeInstructorStorage(JSON.stringify(f.state)).state.quiz.drafts[activity.id], undefined); assert.ok(f.state.quiz.drafts[firstId]);
});

test("quiz moves and archive/restore preserve drafts while activity/module/course deletion cascades them after refresh", () => {
  for (const type of ["activity.delete", "module.delete", "course.delete"]) {
    const f = fixture(), ids = localQuiz(f); f.save(ids.activityId, content());
    f.run({ type: "activity.archive", ...ids, archived: true }); assert.ok(f.state.quiz.drafts[ids.activityId]); f.run({ type: "activity.archive", ...ids, archived: false });
    const targetModuleId = f.run({ type: "module.create", courseId: ids.courseId, title: "Target module", description: "Move the quiz" });
    f.run({ type: "activity.move", ...ids, targetModuleId }); assert.equal(f.app.quiz.quizLocation(f.state, ids.activityId).module.id, targetModuleId); assert.ok(f.state.quiz.drafts[ids.activityId]);
    f.run({ type, ...ids, moduleId: targetModuleId }); assert.equal(f.state.quiz.drafts[ids.activityId], undefined); assert.equal(f.app.decodeInstructorStorage(JSON.stringify(f.state)).state.quiz.drafts[ids.activityId], undefined);
  }
});

test("original quizzes remain protected from deletion after a working save or unpublishing", () => {
  const f = fixture(); f.save(firstId, content()); const location = f.app.quiz.quizLocation(f.state, firstId);
  f.run({ type: "course.status", courseId: "html", status: "draft" }); assert.throws(() => f.run({ type: "activity.delete", courseId: "html", moduleId: location.module.id, activityId: firstId }), /protected/); assert.ok(f.state.quiz.drafts[firstId]);
});

test("Stage 5A/5B snapshots migrate without rewriting data; corrupted quiz drafts never discard valid Theory or catalog records", () => {
  const f = fixture(), theoryId = "lesson:html-introduction", theory = f.app.load("app/lib/instructor/theory.ts").theoryLocation(f.state, theoryId);
  f.run({ type: "theory.save", courseId: theory.course.id, moduleId: theory.module.id, activityId: theoryId, content: { title: "Preserved Theory", blocks: [{ id: "theory-block", type: "paragraph", text: "Keep this content." }] }, expectedUpdatedAt: null, expectedRevision: null });
  const old = JSON.stringify(f.state), decoded = f.app.decodeInstructorStorage(old); assert.equal(decoded.recovery, "none"); assert.equal(decoded.state.quiz, undefined); assert.deepEqual(plain(decoded.state), plain(f.state));
  f.save(firstId, content()); const good = plain(f.state), broken = plain(f.state); broken.quiz.drafts[firstId].questions[0].options = "broken";
  const raw = JSON.stringify(broken), port = storage(); port.setItem(f.app.instructorStorageKey, raw); const repo = new f.app.LocalInstructorRepository(() => port); repo.initialize();
  assert.equal(repo.getSnapshot().writable, true); assert.equal(port.getItem(f.app.instructorRecoveryKey), raw); assert.equal(port.getItem(f.app.instructorStorageKey), raw);
  assert.deepEqual(plain(repo.getSnapshot().state.courses), good.courses); assert.deepEqual(plain(repo.getSnapshot().state.theory), good.theory); assert.equal(repo.getSnapshot().state.quiz.drafts[firstId], undefined);
  assert.match(repo.getSnapshot().warning, /catalog and valid drafts are preserved/);
  const brokenTheory = plain(good); brokenTheory.theory.drafts[theoryId].blocks = "invalid";
  const theoryRecovery = f.app.decodeInstructorStorage(JSON.stringify(brokenTheory)); assert.equal(theoryRecovery.recovery, "theory"); assert.deepEqual(plain(theoryRecovery.state.quiz), good.quiz); assert.deepEqual(plain(theoryRecovery.state.courses), good.courses);
  for (const bad of [null, [], { version: 1, drafts: [] }]) assert.equal(f.app.decodeInstructorStorage(JSON.stringify({ ...good, quiz: bad })).recovery, "quiz");
  port.setItem = () => { throw new Error("backup quota"); }; const failure = new f.app.LocalInstructorRepository(() => port); failure.initialize(); assert.equal(failure.getSnapshot().writable, false); assert.deepEqual(plain(failure.getSnapshot().state.courses), good.courses);
});

test("future quiz formats remain read-only without overwriting raw content or valid Theory drafts", () => {
  const f = fixture(); f.save(firstId, content());
  const theoryId = "lesson:html-introduction", location = f.app.load("app/lib/instructor/theory.ts").theoryLocation(f.state, theoryId);
  f.run({ type: "theory.save", courseId: location.course.id, moduleId: location.module.id, activityId: theoryId, content: { title: "Preserved Theory", blocks: [{ id: "future-test-block", type: "paragraph", text: "Preserve this draft." }] }, expectedUpdatedAt: null, expectedRevision: null });
  for (const future of [state => { state.quiz.version = 2; }, state => { state.quiz.drafts[firstId].version = 2; }]) {
    const value = plain(f.state); future(value); const raw = JSON.stringify(value), port = storage(); port.setItem(f.app.instructorStorageKey, raw);
    const repo = new f.app.LocalInstructorRepository(() => port); repo.initialize(); assert.equal(repo.getSnapshot().writable, false); assert.deepEqual(plain(repo.getSnapshot().state.courses), plain(f.state.courses)); assert.deepEqual(plain(repo.getSnapshot().state.theory), plain(f.state.theory));
    assert.throws(() => repo.execute({ type: "course.duplicate", courseId: "html" }), /not ready/); assert.equal(port.getItem(f.app.instructorStorageKey), raw);
  }
});

test("unknown quiz content, archived curriculum, wrong activity types and deleted IDs cannot be silently replaced", () => {
  const f = fixture(), ids = localQuiz(f), owner = f.app.quiz.quizLocation(f.state, firstId);
  owner.activity.reference = { kind: "quiz", id: "unsupported-course" }; assert.equal(f.app.quiz.initialQuizContent(owner.activity).source, "unsupported"); assert.throws(() => f.save(firstId, content()), /cannot be imported safely/);
  f.run({ type: "activity.archive", ...ids, archived: true }); assert.throws(() => f.save(ids.activityId, content()), /Restore/);
  for (const activityId of ["lesson:html-introduction", "missing", ""]) assert.throws(() => f.run({ type: "quiz.save", courseId: "html", moduleId: "html-first-page", activityId, content: content(), expectedUpdatedAt: null, expectedRevision: null }), /not found/);
});

test("shared route decoding handles encoded quiz IDs once and never changes stable catalog or draft keys", () => {
  const f = fixture(), before = JSON.stringify(f.state);
  assert.equal(f.app.routing.decodeInstructorActivityParam("quiz%3Ahtml"), firstId); assert.equal(f.app.quiz.quizLocation(f.state, f.app.routing.decodeInstructorActivityParam("quiz%3Ahtml")).activity.id, firstId);
  assert.equal(f.app.quiz.quizLocation(f.state, f.app.routing.decodeInstructorActivityParam("quiz%253Ahtml")), null); assert.equal(f.app.quiz.quizLocation(f.state, "lesson:html-introduction"), null); assert.equal(f.app.quiz.quizEditorHref(firstId, true), "/instructor/quizzes/quiz%3Ahtml?preview=1");
  assert.equal(JSON.stringify(f.state), before);
});
