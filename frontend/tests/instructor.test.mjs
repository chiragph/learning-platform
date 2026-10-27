import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

function loader(environment = "development", overrides = {}) {
  const cache = new Map();
  function load(filename) {
    filename = path.resolve(filename);
    if (cache.has(filename)) return cache.get(filename).exports;
    const compiled = { exports: {} }; cache.set(filename, compiled);
    const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    function require(specifier) {
      if (specifier === "../../lib/instructor/remote-repository") return { RemoteInstructorRepository: load("app/lib/instructor/repository.ts").LocalInstructorRepository };
      if (specifier in overrides) return overrides[specifier];
      if (specifier.endsWith(".css")) return {};
      const base = path.resolve(path.dirname(filename), specifier);
      return load([base + ".ts", base + ".tsx"].find(fs.existsSync));
    }
    vm.runInNewContext(source, { module: compiled, exports: compiled.exports, require, structuredClone, crypto: globalThis.crypto, console, process: { env: { NODE_ENV: environment } } }, { filename });
    return compiled.exports;
  }
  return { load, repository: () => load("app/lib/instructor/repository.ts") };
}
const plain = value => JSON.parse(JSON.stringify(value));
const data = { title: "Web accessibility", description: "Build inclusive interfaces.", category: "Web development", difficulty: "Beginner", duration: "4 hours", objectives: ["Build an accessible form"], color: "green", icon: "book" };
function setup() {
  const repo = loader().repository(); let state = repo.seedInstructorState(), counter = 0;
  return { repo, get state() { return state; }, run(command) { const result = repo.applyInstructorCommand(state, command, "2026-10-26T10:00:00.000Z", () => `test-${++counter}`); state = result.state; return result.id; } };
}
function storage() { const values = new Map(); return { values, getItem: key => values.get(key) ?? null, setItem: (key,value) => values.set(key,value) }; }
function draftFixture(app) {
  const courseId = app.run({ type:"course.create",id:"disposable-draft",fields:data });
  const moduleId = app.run({ type:"module.create",courseId,title:"Draft module",description:"Draft sequence" });
  const activityId = app.run({ type:"activity.create",courseId,moduleId,activityType:"theory",title:"Draft theory",description:"Draft explanation" });
  return { courseId,moduleId,activityId };
}

test("instructor seeding contains exactly the student catalog and retains every ID and reference", () => {
  const context = loader(), repo = context.repository(), seeded = repo.seedInstructorState(), original = context.load("app/lib/student/curriculum-repository.ts").curriculumRepository.getPath();
  assert.deepEqual(plain(seeded.courses.map(c => c.id)), ["html", "css", "javascript"]);
  assert.deepEqual(plain(seeded.courses.map(c => c.title)), ["HTML", "CSS", "JavaScript"]);
  for (const course of original.courses) {
    const copy = seeded.courses.find(c => c.id === course.id);
    assert.deepEqual(plain(copy.modules.map(m => m.id)), plain(course.modules.map(m => m.id)));
    for (const topic of course.modules) assert.deepEqual(plain(copy.modules.find(m => m.id === topic.id).activities.map(a => [a.id,a.type,a.reference])), plain(topic.activities.map(a => [a.id,a.type,a.reference])));
  }
  assert.equal(seeded.courses.reduce((n,c) => n + repo.courseCounts(c).activities, 0), 38);
  seeded.courses[0].modules[0].activities[0].reference.id = "changed";
  assert.equal(original.courses[0].modules[0].activities[0].reference.id, "html-introduction");
});

test("course creation validates required metadata, prevents duplicate/archived IDs, and is transactional", () => {
  const app = setup(), before = JSON.stringify(app.state);
  for (const id of ["html", "HTML", "-bad", "two--hyphens", "with space", "lesson:html-introduction"]) assert.throws(() => app.run({ type: "course.create", id, fields: data }));
  assert.throws(() => app.run({ type: "course.create", id: "valid", fields: { ...data, title: " " } }), /required/);
  assert.throws(() => app.run({ type: "course.create", id: "valid", fields: { ...data, objectives: [] } }), /objective/);
  assert.equal(JSON.stringify(app.state), before);
  app.run({ type: "course.archive", courseId: "html", archived: true });
  assert.throws(() => app.run({ type: "course.create", id: "html", fields: data }), /already in use/);
  app.run({ type: "course.create", id: "web-accessibility", fields: data });
  const created = app.state.courses.at(-1); assert.equal(created.status, "draft"); assert.equal(created.modules.length, 0); assert.equal(created.title, data.title);
});

test("course editing preserves IDs and publication checks never publish unfinished content", () => {
  const app = setup(), ids = JSON.stringify(app.state.courses[0].modules.map(m => [m.id,...m.activities.map(a => a.id)]));
  app.run({ type: "course.update", courseId: "html", fields: { ...data, title: "HTML updated" } });
  assert.equal(app.state.courses[0].id, "html"); assert.equal(app.state.courses[0].status, "draft");
  assert.equal(JSON.stringify(app.state.courses[0].modules.map(m => [m.id,...m.activities.map(a => a.id)])), ids);
  app.run({ type: "course.status", courseId: "html", status: "published" }); assert.equal(app.state.courses[0].status, "published");
  app.run({ type: "course.status", courseId: "html", status: "draft" }); assert.equal(app.state.courses[0].status, "draft");
  app.run({ type: "course.create", id: "empty", fields: data }); assert.throws(() => app.run({ type: "course.status", courseId: "empty", status: "published" }), /curriculum/);
  app.run({ type: "activity.create", courseId: "html", moduleId: "html-first-page", activityType: "lab", title: "New lab", description: "Practice" });
  assert.throws(() => app.run({ type: "course.status", courseId: "html", status: "published" }), /content/);
});

test("duplication allocates new IDs and archive/restore keeps the original curriculum intact", () => {
  const app = setup(), before = JSON.stringify(app.state.courses[0]), id = app.run({ type: "course.duplicate", courseId: "html" });
  const copy = app.state.courses.find(c => c.id === id); assert.equal(copy.status, "draft"); assert.equal(copy.modules.length, 3); assert.equal(copy.modules[0].activities[0].copiedFrom.reference.id, "html-introduction"); assert.equal(copy.modules[0].activities[0].reference,undefined);
  const ids = app.state.courses.flatMap(c => [c.id,...c.modules.flatMap(m => [m.id,...m.activities.map(a => a.id)])]); assert.equal(new Set(ids).size, ids.length);
  assert.equal(JSON.stringify(app.state.courses[0]), before);
  app.run({ type: "course.archive", courseId: "html", archived: true }); assert.equal(app.state.courses[0].modules.length, 3);
  assert.throws(() => app.run({ type: "module.create", courseId: "html", title: "Blocked", description: "Blocked" }), /Restore/);
  app.run({ type: "course.archive", courseId: "html", archived: false }); assert.equal(app.state.courses[0].status, "published");
});

test("module create, edit, reorder, archive and restore preserve all activity IDs", () => {
  const app = setup(), id = app.run({ type: "module.create", courseId: "html", title: "New module", description: "Next steps" });
  assert.equal(app.state.courses[0].status, "draft");
  app.run({ type: "module.update", courseId: "html", moduleId: id, title: "Renamed", description: "Updated description" });
  app.run({ type: "module.reorder", courseId: "html", moduleId: id, direction: -1 }); assert.equal(app.state.courses[0].modules[2].id, id);
  assert.throws(() => app.run({ type: "module.reorder", courseId: "html", moduleId: "html-first-page", direction: -1 }), /further/);
  app.run({ type: "module.archive", courseId: "html", moduleId: "html-content", archived: true });
  app.run({ type: "module.archive", courseId: "html", moduleId: "html-content", archived: false });
  assert.equal(app.state.courses[0].modules.flatMap(m => m.activities).length, 12);
  assert.equal(app.repo.decodeInstructorStorage(JSON.stringify(app.state)).recovery, "none");
});

test("all activity types create drafts; reorder, move, rename and restore keep stable IDs", () => {
  const app = setup();
  for (const type of ["theory", "quiz", "lab", "workshop"]) {
    const id = app.run({ type: "activity.create", courseId: "html", moduleId: "html-first-page", activityType: type, title: `New ${type}`, description: "Description" });
    const entry = app.state.courses[0].modules[0].activities.at(-1); assert.equal(entry.id,id); assert.equal(entry.status,"draft"); assert.equal(entry.reference,undefined);
    app.run({ type: "activity.reorder", courseId: "html", moduleId: "html-first-page", activityId: id, direction: -1 });
  }
  const activityId = "lesson:html-introduction";
  app.run({ type: "activity.move", courseId: "html", moduleId: "html-first-page", activityId, targetModuleId: "html-content" });
  app.run({ type: "activity.update", courseId: "html", moduleId: "html-content", activityId, title: "Renamed introduction", description: "New description" });
  app.run({ type: "activity.archive", courseId: "html", moduleId: "html-content", activityId, archived: true });
  app.run({ type: "activity.archive", courseId: "html", moduleId: "html-content", activityId, archived: false });
  const moved = app.state.courses[0].modules[1].activities.at(-1); assert.equal(moved.id,activityId); assert.equal(moved.reference.id,"html-introduction"); assert.equal(moved.title,"Renamed introduction");
  assert.equal(app.repo.decodeInstructorStorage(JSON.stringify(app.state)).recovery, "none");
});

test("browser repository persists after reload and never writes student keys", () => {
  const { LocalInstructorRepository, instructorStorageKey } = loader().repository(), memory = storage();
  memory.setItem("decode-student-progress", "existing-progress"); const repository = new LocalInstructorRepository(() => memory); let notifications = 0;
  const unsubscribe = repository.subscribe(() => notifications++); repository.initialize();
  repository.execute({ type: "course.create", id: "web-accessibility", fields: data }); unsubscribe();
  const refreshed = new LocalInstructorRepository(() => memory); refreshed.initialize();
  assert.equal(refreshed.getSnapshot().state.courses.length,4); assert.equal(refreshed.getSnapshot().state.courses.at(-1).id,"web-accessibility"); assert.equal(notifications,2);
  assert.deepEqual([...memory.values.keys()].sort(), [instructorStorageKey,"decode-student-progress"].sort()); assert.equal(memory.getItem("decode-student-progress"),"existing-progress");
});

test("malformed/truncated storage is backed up, future versions stay read-only", () => {
  const repo = loader().repository();
  for (const raw of ["{bad", "null", "[]", JSON.stringify({ version:1,courses:[],changes:[] }), JSON.stringify({ ...repo.seedInstructorState(), changes: [{ at: "bad" }] })]) {
    const memory = storage(); memory.setItem(repo.instructorStorageKey,raw); const store = new repo.LocalInstructorRepository(() => memory); store.initialize();
    assert.equal(store.getSnapshot().state.courses.length,3); assert.equal(store.getSnapshot().writable,true); assert.match(store.getSnapshot().warning,/recovered/); assert.equal(memory.getItem(repo.instructorRecoveryKey),raw);
    assert.equal(memory.getItem(repo.instructorStorageKey),raw);
  }
  const memory = storage(), future = '{"version":5,"courses":[]}'; memory.setItem(repo.instructorStorageKey,future);
  const store = new repo.LocalInstructorRepository(() => memory); store.initialize(); assert.equal(store.getSnapshot().writable,false);
  assert.throws(() => store.execute({ type:"course.create",id:"blocked",fields:data }),/not ready/); assert.equal(memory.getItem(repo.instructorStorageKey),future);
});

test("blocked/quota-limited storage and stale tabs never falsely save or overwrite", () => {
  const repo = loader().repository();
  const blocked = new repo.LocalInstructorRepository(() => { throw new Error("Denied"); }); blocked.initialize(); assert.equal(blocked.getSnapshot().writable,false);
  const memory = storage(), a = new repo.LocalInstructorRepository(() => memory), b = new repo.LocalInstructorRepository(() => memory); a.initialize(); b.initialize();
  a.execute({ type:"course.create",id:"first",fields:data }); assert.throws(() => b.execute({ type:"course.create",id:"second",fields:data }),/another tab/);
  assert.equal(b.getSnapshot().state.courses.length,4); b.execute({ type:"course.create",id:"second",fields:data });
  const full = new repo.LocalInstructorRepository(() => ({ getItem: () => null, setItem: () => { throw new Error("Quota"); } })); full.initialize();
  assert.throws(() => full.execute({ type:"course.create",id:"unsaved",fields:data }),/not saved/); assert.equal(full.getSnapshot().state.courses.length,3);
});

test("instructor access requires the designated authenticated identity in every environment", () => {
  for (const environment of ["development","production","test"]) {
    const { instructorAccessAllowed, accountHome } = loader(environment).load("app/lib/instructor/access.ts");
    const instructor = { email:"decode.instructor@gmail.com",role:"INSTRUCTOR" };
    assert.equal(instructorAccessAllowed(instructor),true);
    assert.equal(accountHome(instructor),"/instructor");
    for (const account of [null, { ...instructor,role:"STUDENT" }, { ...instructor,email:"other@example.test" }, { ...instructor,role:"ADMIN" }]) {
      assert.equal(instructorAccessAllowed(account),false);
      if (account) assert.equal(accountHome(account),account.role === "ADMIN" ? "/admin" : "/dashboard");
    }
  }
});

test("student routes and content stay independent of instructor commands", () => {
  const context = loader(), student = context.load("app/lib/student/curriculum-repository.ts"), before = JSON.stringify(student.curriculumRepository.getPath()), repo = context.repository();
  repo.applyInstructorCommand(repo.seedInstructorState(), { type:"module.archive",courseId:"html",moduleId:"html-first-page",archived:true });
  assert.equal(JSON.stringify(student.curriculumRepository.getPath()),before);
  for (const route of ["dashboard","courses","courses/[id]","lessons/[id]","quizzes/[id]","challenges/[id]","projects/[id]"]) assert.ok(fs.existsSync(`app/(student)/${route}/page.tsx`));
  assert.match(fs.readFileSync("app/(student)/layout.tsx","utf8"),/verifyStudentSession/);
  for (const file of ["curriculum-repository.ts","curriculum.ts","storage.ts"]) assert.doesNotMatch(fs.readFileSync(`app/lib/student/${file}`,"utf8"),/from ["'][^"']*instructor/);
});

test("deleting local drafts removes activities, modules and courses with complete cascading counts", () => {
  const app = setup(), original = JSON.stringify(app.state.courses), ids = draftFixture(app);
  const second = app.run({ type:"activity.create",courseId:ids.courseId,moduleId:ids.moduleId,activityType:"lab",title:"Draft lab",description:"Practice" });
  app.run({ type:"activity.delete",...ids });
  let course = app.state.courses.at(-1); assert.deepEqual(plain(app.repo.courseCounts(course)),{ modules:1,activities:1 }); assert.equal(course.modules[0].activities[0].id,second);
  app.run({ type:"module.delete",courseId:ids.courseId,moduleId:ids.moduleId });
  assert.deepEqual(plain(app.repo.courseCounts(app.state.courses.at(-1))),{ modules:0,activities:0 });
  const topic = app.run({ type:"module.create",courseId:ids.courseId,title:"Another draft module",description:"Will cascade" });
  app.run({ type:"activity.create",courseId:ids.courseId,moduleId:topic,activityType:"quiz",title:"Draft quiz",description:"Questions later" });
  app.run({ type:"module.archive",courseId:ids.courseId,moduleId:topic,archived:true });
  app.run({ type:"course.archive",courseId:ids.courseId,archived:true });
  app.run({ type:"course.delete",courseId:ids.courseId });
  assert.equal(app.state.courses.length,3); assert.equal(JSON.stringify(app.state.courses),original);
  assert.match(app.state.changes[0].title,/Deleted course/); assert.equal(app.repo.decodeInstructorStorage(JSON.stringify(app.state)).recovery,"none");
});

test("seeded course, module and activity IDs stay protected even after unpublishing or moving content", () => {
  const app = setup();
  for (const course of app.state.courses) {
    app.run({ type:"course.status",courseId:course.id,status:"draft" });
    const commands = [{ type:"course.delete",courseId:course.id }, ...course.modules.flatMap(m => [{ type:"module.delete",courseId:course.id,moduleId:m.id },...m.activities.map(a => ({ type:"activity.delete",courseId:course.id,moduleId:m.id,activityId:a.id }))])];
    for (const command of commands) { const before = JSON.stringify(app.state); assert.throws(() => app.run(command),/Archive instead/); assert.equal(JSON.stringify(app.state),before); }
  }
  const moduleId = app.run({ type:"module.create",courseId:"html",title:"Local container",description:"A local draft module" });
  app.run({ type:"activity.move",courseId:"html",moduleId:"html-first-page",activityId:"lesson:html-introduction",targetModuleId:moduleId });
  assert.throws(() => app.run({ type:"module.delete",courseId:"html",moduleId }),/Archive instead/);
  // ID-based protection also survives mislabeled local provenance/publication.
  const forged = plain(app.state), course = forged.courses[0], topic = course.modules[0];
  Object.assign(course,{ source:"local",status:"draft",hasBeenPublished:false }); Object.assign(topic,{ source:"local",status:"draft",hasBeenPublished:false });
  const activity = topic.activities[0]; Object.assign(activity,{ source:"local",status:"draft",hasBeenPublished:false }); delete activity.reference;
  for (const command of [{ type:"course.delete",courseId:course.id },{ type:"module.delete",courseId:course.id,moduleId:topic.id },{ type:"activity.delete",courseId:course.id,moduleId:topic.id,activityId:activity.id }]) assert.throws(() => app.repo.applyInstructorCommand(forged,command),/Archive instead/);
});

test("publication history and existing references block deletion at every cascade boundary", () => {
  const app = setup(), ids = draftFixture(app), commands = [{ type:"course.delete",courseId:ids.courseId },{ type:"module.delete",courseId:ids.courseId,moduleId:ids.moduleId },{ type:"activity.delete",...ids }];
  const variants = [
    state => { state.courses.at(-1).status = "published"; },
    state => { state.courses.at(-1).modules[0].status = "published"; },
    state => { state.courses.at(-1).modules[0].activities[0].status = "published"; },
    state => { state.courses.at(-1).modules[0].activities[0].hasBeenPublished = true; },
    state => { state.courses.at(-1).modules[0].activities[0].reference = { kind:"lesson",id:"external-content" }; },
  ];
  for (const mutate of variants) {
    const state = plain(app.state); mutate(state); const before = JSON.stringify(state);
    for (const command of commands) assert.throws(() => app.repo.applyInstructorCommand(state,command),/Archive instead/);
    assert.equal(JSON.stringify(state),before);
  }
  const published = plain(app.state); published.courses.at(-1).status = "published";
  const unpublished = app.repo.applyInstructorCommand(published,{ type:"course.status",courseId:ids.courseId,status:"draft" }).state;
  assert.equal(unpublished.courses.at(-1).hasBeenPublished,true);
  assert.throws(() => app.repo.applyInstructorCommand(unpublished,commands[0]),/previously published/);
  const modulePublished = plain(app.state); modulePublished.courses.at(-1).modules[0].status = "published";
  const edited = app.repo.applyInstructorCommand(modulePublished,{ type:"module.update",courseId:ids.courseId,moduleId:ids.moduleId,title:"Edited",description:"Changed" }).state;
  assert.equal(edited.courses.at(-1).modules[0].status,"draft");
  assert.equal(edited.courses.at(-1).modules[0].hasBeenPublished,true);
  assert.throws(() => app.repo.applyInstructorCommand(edited,commands[1]),/previously published/);
});

test("protected archived descendants prevent cascade deletion while safe draft additions stay deletable", () => {
  const app = setup(), copyId = app.run({ type:"course.duplicate",courseId:"html" });
  const copy = app.state.courses.find(c => c.id === copyId), moduleId = copy.modules[0].id;
  // A live reference is still a dependency, unlike read-only copy provenance.
  copy.modules[0].activities[0].reference = { ...copy.modules[0].activities[0].copiedFrom.reference };
  app.run({ type:"module.archive",courseId:copyId,moduleId,archived:true });
  assert.throws(() => app.run({ type:"course.delete",courseId:copyId }),/Archive instead/);
  assert.throws(() => app.run({ type:"module.delete",courseId:copyId,moduleId }),/Archive instead/);
  const localId = app.run({ type:"activity.create",courseId:"html",moduleId:"html-first-page",activityType:"workshop",title:"New draft",description:"Safe local addition" });
  app.run({ type:"activity.delete",courseId:"html",moduleId:"html-first-page",activityId:localId });
  assert.equal(app.state.courses[0].modules[0].activities.length,4);
  const safeModule = app.run({ type:"module.create",courseId:"html",title:"Local draft module",description:"No student dependencies" });
  const safeActivity = app.run({ type:"activity.create",courseId:"html",moduleId:safeModule,activityType:"lab",title:"Local draft",description:"Practice" });
  app.run({ type:"activity.archive",courseId:"html",moduleId:safeModule,activityId:safeActivity,archived:true });
  app.run({ type:"module.archive",courseId:"html",moduleId:safeModule,archived:true });
  app.run({ type:"module.delete",courseId:"html",moduleId:safeModule });
  assert.equal(app.state.courses[0].modules.length,3);
});

test("legacy browser snapshots accept additive metadata and retain safe draft deletion", () => {
  const app = setup(), ids = draftFixture(app), legacy = plain(app.state);
  for (const course of legacy.courses) { delete course.hasBeenPublished; for (const topic of course.modules) { delete topic.hasBeenPublished; delete topic.status; delete topic.source; topic.activities.forEach(a => delete a.hasBeenPublished); } }
  const decoded = app.repo.decodeInstructorStorage(JSON.stringify(legacy)); assert.equal(decoded.recovery,"none");
  const result = app.repo.applyInstructorCommand(decoded.state,{ type:"course.delete",courseId:ids.courseId }).state;
  assert.equal(result.courses.length,3); assert.equal(app.repo.decodeInstructorStorage(JSON.stringify(result)).recovery,"none");
  legacy.courses[0].hasBeenPublished = "false"; assert.equal(app.repo.decodeInstructorStorage(JSON.stringify(legacy)).recovery,"malformed");
});

test("confirmed deletions persist after reload at every level without touching student records", () => {
  const repo = loader().repository(), memory = storage(); memory.setItem("decode-student-progress","unchanged");
  let store = new repo.LocalInstructorRepository(() => memory); store.initialize();
  const reload = () => { store = new repo.LocalInstructorRepository(() => memory); store.initialize(); assert.equal(store.getSnapshot().warning,""); };
  const courseId = store.execute({ type:"course.create",id:"disposable",fields:data }), moduleId = store.execute({ type:"module.create",courseId,title:"Draft",description:"Module" });
  const activityId = store.execute({ type:"activity.create",courseId,moduleId,activityType:"theory",title:"Draft",description:"Activity" });
  store.execute({ type:"activity.delete",courseId,moduleId,activityId }); reload();
  assert.equal(store.getSnapshot().state.courses.at(-1).modules[0].activities.length,0);
  store.execute({ type:"activity.create",courseId,moduleId,activityType:"lab",title:"Cascaded",description:"Draft lab" });
  store.execute({ type:"module.delete",courseId,moduleId }); reload();
  assert.equal(store.getSnapshot().state.courses.at(-1).modules.length,0);
  const nested = store.execute({ type:"module.create",courseId,title:"Cascaded module",description:"Draft" });
  store.execute({ type:"activity.create",courseId,moduleId:nested,activityType:"quiz",title:"Cascaded activity",description:"Draft" });
  store.execute({ type:"course.delete",courseId }); reload();
  assert.equal(store.getSnapshot().state.courses.length,3); assert.equal(store.getSnapshot().state.courses.some(c => c.id === courseId),false);
  assert.equal(memory.getItem("decode-student-progress"),"unchanged");
});

test("failed or stale deletion transactions keep the saved content and protection intact", () => {
  const repo = loader().repository(), memory = storage(); const store = new repo.LocalInstructorRepository(() => memory); store.initialize();
  const courseId = store.execute({ type:"course.create",id:"keep-draft",fields:data }), before = memory.getItem(repo.instructorStorageKey), originalWrite = memory.setItem;
  memory.setItem = () => { throw new Error("Quota"); };
  assert.throws(() => store.execute({ type:"course.delete",courseId }),/not saved/); assert.equal(store.getSnapshot().state.courses.length,4); assert.equal(memory.getItem(repo.instructorStorageKey),before);
  memory.setItem = originalWrite;
  const external = new repo.LocalInstructorRepository(() => memory); external.initialize(); external.execute({ type:"course.archive",courseId,archived:true });
  assert.throws(() => store.execute({ type:"course.delete",courseId }),/another tab/); assert.equal(store.getSnapshot().state.courses.length,4);
});

function timedSetup() {
  const repo = loader().repository(); let state = repo.seedInstructorState(), counter = 0;
  return { repo, get state() { return state; }, run(command,at) { const result = repo.applyInstructorCommand(state,command,at,() => `clock-${++counter}`); state = result.state; return result.id; } };
}
const clock = ["2026-10-26T09:05:00.000Z","2026-10-26T09:10:00.000Z","2026-10-26T09:15:00.000Z","2026-10-26T09:20:00.000Z","2026-10-26T09:25:00.000Z","2026-10-26T09:30:00.000Z"];

test("seed and legacy timestamps remain unknown; loading never invents historical dates", () => {
  const repo = loader().repository(), seeded = repo.seedInstructorState();
  for (const course of seeded.courses) {
    assert.equal(course.createdAt,null); assert.equal(course.updatedAt,null); assert.equal(course.publishedAt,null);
    for (const topic of course.modules) { assert.equal(topic.createdAt,null); assert.equal(topic.updatedAt,null); for (const activity of topic.activities) { assert.equal(activity.createdAt,null); assert.equal(activity.updatedAt,null); assert.equal(activity.publishedAt,null); } }
  }
  const legacy = plain(seeded);
  for (const course of legacy.courses) { delete course.createdAt; delete course.updatedAt; delete course.publishedAt; for (const topic of course.modules) { delete topic.createdAt; delete topic.updatedAt; for (const a of topic.activities) { delete a.createdAt; delete a.updatedAt; delete a.publishedAt; } } }
  legacy.courses[0].updatedAt = clock[0];
  const memory = storage(), raw = JSON.stringify(legacy); memory.setItem(repo.instructorStorageKey,raw);
  const store = new repo.LocalInstructorRepository(() => memory); store.initialize();
  assert.equal(store.getSnapshot().warning,""); assert.equal(memory.getItem(repo.instructorStorageKey),raw);
  const restored = store.getSnapshot().state; assert.equal(restored.courses[0].updatedAt,clock[0]); assert.equal(restored.courses[0].createdAt,null); assert.equal(restored.courses[0].modules[0].activities[0].publishedAt,null);
  assert.deepEqual(plain(restored.courses.map(c => c.id)),["html","css","javascript"]);
});

test("new course, module and activity timestamps use one canonical ISO instant and preserve creation dates", () => {
  const app = timedSetup(), courseId = app.run({ type:"course.create",id:"timestamp-course",fields:data },"2026-10-26T14:35:00+05:30");
  assert.equal(app.state.courses.at(-1).createdAt,clock[0]); assert.equal(app.state.courses.at(-1).updatedAt,clock[0]); assert.equal(app.state.courses.at(-1).publishedAt,null);
  const moduleId = app.run({ type:"module.create",courseId,title:"Module",description:"Description" },clock[1]);
  const activityId = app.run({ type:"activity.create",courseId,moduleId,activityType:"theory",title:"Activity",description:"Description" },clock[2]);
  let course = app.state.courses.at(-1), topic = course.modules[0], activity = topic.activities[0];
  assert.equal(course.createdAt,clock[0]); assert.equal(course.updatedAt,clock[2]); assert.equal(topic.createdAt,clock[1]); assert.equal(topic.updatedAt,clock[2]); assert.equal(activity.createdAt,clock[2]); assert.equal(activity.updatedAt,clock[2]); assert.equal(activity.publishedAt,null);
  app.run({ type:"activity.update",courseId,moduleId,activityId,title:"Renamed activity",description:"Updated" },clock[3]);
  course = app.state.courses.at(-1); topic = course.modules[0]; activity = topic.activities[0];
  assert.equal(activity.createdAt,clock[2]); assert.equal(activity.updatedAt,clock[3]); assert.equal(topic.updatedAt,clock[3]); assert.equal(course.updatedAt,clock[3]);
  app.run({ type:"course.update",courseId,fields:{ ...data,createdAt:"2000-01-01T00:00:00.000Z",updatedAt:"2000-01-01T00:00:00.000Z",publishedAt:clock[0] } },clock[4]);
  assert.equal(app.state.courses.at(-1).createdAt,clock[0]); assert.equal(app.state.courses.at(-1).updatedAt,clock[4]); assert.equal(app.state.courses.at(-1).publishedAt,null);
  const event = app.state.changes.find(c => c.action === "activity.update"); assert.equal(event.at,clock[3]); assert.deepEqual(plain(event.content),{ kind:"activity",id:activityId,title:"Renamed activity" });
});

test("reorders timestamp both swapped records, moves touch both containers, and unrelated content stays unchanged", () => {
  const app = timedSetup(), courseId = app.run({ type:"course.create",id:"ordered",fields:data },clock[0]);
  const first = app.run({ type:"module.create",courseId,title:"First",description:"First" },clock[0]), second = app.run({ type:"module.create",courseId,title:"Second",description:"Second" },clock[0]), third = app.run({ type:"module.create",courseId,title:"Third",description:"Third" },clock[0]);
  const a = app.run({ type:"activity.create",courseId,moduleId:first,activityType:"theory",title:"A",description:"A" },clock[0]), b = app.run({ type:"activity.create",courseId,moduleId:first,activityType:"lab",title:"B",description:"B" },clock[0]), c = app.run({ type:"activity.create",courseId,moduleId:first,activityType:"quiz",title:"C",description:"C" },clock[0]);
  app.run({ type:"module.reorder",courseId,moduleId:second,direction:-1 },clock[1]);
  let course = app.state.courses.at(-1); assert.deepEqual(plain(course.modules.map(m => m.id)),[second,first,third]); assert.deepEqual(plain(course.modules.map(m => m.updatedAt)),[clock[1],clock[1],clock[0]]);
  app.run({ type:"activity.reorder",courseId,moduleId:first,activityId:b,direction:-1 },clock[2]);
  let topic = app.state.courses.at(-1).modules.find(m => m.id === first); assert.deepEqual(plain(topic.activities.map(a => a.id)),[b,a,c]); assert.deepEqual(plain(topic.activities.map(a => a.updatedAt)),[clock[2],clock[2],clock[0]]);
  app.run({ type:"activity.move",courseId,moduleId:first,activityId:b,targetModuleId:second },clock[3]);
  course = app.state.courses.at(-1); topic = course.modules.find(m => m.id === second); assert.equal(topic.updatedAt,clock[3]); assert.equal(topic.activities[0].updatedAt,clock[3]); assert.equal(topic.activities[0].createdAt,clock[0]); assert.equal(course.modules.find(m => m.id === first).updatedAt,clock[3]); assert.equal(course.modules.find(m => m.id === third).updatedAt,clock[0]);
  assert.equal(app.state.courses[0].updatedAt,null);
  assert.equal(app.state.changes[0].action,"activity.move"); assert.deepEqual(plain(app.state.changes[0].content),{ kind:"activity",id:b,title:"B" });
});

test("publication records real transitions, unpublishing retains last publication, and seed activity dates stay unknown", () => {
  const app = timedSetup(); app.run({ type:"course.status",courseId:"html",status:"draft" },clock[0]);
  assert.equal(app.state.courses[0].createdAt,null); assert.equal(app.state.courses[0].publishedAt,null); assert.equal(app.state.courses[0].updatedAt,clock[0]);
  app.run({ type:"course.status",courseId:"html",status:"published" },clock[1]);
  assert.equal(app.state.courses[0].publishedAt,clock[1]); assert.equal(app.state.courses[0].updatedAt,clock[1]);
  const before = JSON.stringify(app.state); app.run({ type:"course.status",courseId:"html",status:"published" },clock[2]); assert.equal(JSON.stringify(app.state),before);
  app.run({ type:"course.status",courseId:"html",status:"draft" },clock[3]); assert.equal(app.state.courses[0].publishedAt,clock[1]); assert.equal(app.state.courses[0].updatedAt,clock[3]);
  app.run({ type:"course.status",courseId:"html",status:"published" },clock[4]); assert.equal(app.state.courses[0].publishedAt,clock[4]);
  for (const a of app.state.courses[0].modules.flatMap(m => m.activities)) { assert.equal(a.createdAt,null); assert.equal(a.updatedAt,null); assert.equal(a.publishedAt,null); }
  assert.equal(app.state.courses[0].createdAt,null); assert.equal(app.state.courses[1].publishedAt,null);
});

test("duplication gives each new record fresh dates without copying publication timestamps or changing originals", () => {
  const app = timedSetup(); app.run({ type:"course.status",courseId:"html",status:"draft" },clock[0]); app.run({ type:"course.status",courseId:"html",status:"published" },clock[1]);
  const before = JSON.stringify(app.state.courses[0]); app.run({ type:"course.duplicate",courseId:"html" },clock[2]); const copy = app.state.courses.at(-1);
  assert.equal(JSON.stringify(app.state.courses[0]),before); assert.equal(copy.createdAt,clock[2]); assert.equal(copy.updatedAt,clock[2]); assert.equal(copy.publishedAt,null);
  for (const topic of copy.modules) { assert.equal(topic.createdAt,clock[2]); assert.equal(topic.updatedAt,clock[2]); for (const a of topic.activities) { assert.equal(a.createdAt,clock[2]); assert.equal(a.updatedAt,clock[2]); assert.equal(a.publishedAt,null); } }
  assert.notEqual(copy.modules[0].activities[0].id,app.state.courses[0].modules[0].activities[0].id);
});

test("archive and restore update dates without rewriting creation/publication history", () => {
  const app = timedSetup(), courseId = app.run({ type:"course.create",id:"archive-dates",fields:data },clock[0]), moduleId = app.run({ type:"module.create",courseId,title:"Module",description:"Description" },clock[0]), activityId = app.run({ type:"activity.create",courseId,moduleId,activityType:"lab",title:"Lab",description:"Practice" },clock[0]);
  app.run({ type:"activity.archive",courseId,moduleId,activityId,archived:true },clock[1]); app.run({ type:"activity.archive",courseId,moduleId,activityId,archived:false },clock[2]);
  assert.equal(app.state.courses.at(-1).modules[0].activities[0].createdAt,clock[0]); assert.equal(app.state.courses.at(-1).modules[0].activities[0].updatedAt,clock[2]);
  app.run({ type:"module.archive",courseId,moduleId,archived:true },clock[3]); app.run({ type:"module.archive",courseId,moduleId,archived:false },clock[4]);
  assert.equal(app.state.courses.at(-1).modules[0].createdAt,clock[0]); assert.equal(app.state.courses.at(-1).modules[0].updatedAt,clock[4]);
  app.run({ type:"course.archive",courseId,archived:true },clock[5]); assert.equal(app.state.courses.at(-1).createdAt,clock[0]); assert.equal(app.state.courses.at(-1).updatedAt,clock[5]); assert.equal(app.state.courses.at(-1).publishedAt,null);
});

test("ISO timestamps, publication metadata and structured changes persist across repository reloads", () => {
  const app = timedSetup(), courseId = app.run({ type:"course.create",id:"persistent-dates",fields:data },clock[0]), moduleId = app.run({ type:"module.create",courseId,title:"Module",description:"Description" },clock[1]), activityId = app.run({ type:"activity.create",courseId,moduleId,activityType:"lab",title:"Lab",description:"Practice" },clock[2]);
  const state = plain(app.state); state.courses[0].publishedAt = clock[0]; state.courses[0].modules[0].activities[0].publishedAt = clock[0];
  const memory = storage(); memory.setItem(app.repo.instructorStorageKey,JSON.stringify(state)); const store = new app.repo.LocalInstructorRepository(() => memory); store.initialize();
  assert.deepEqual(plain(store.getSnapshot().state),state); assert.equal(store.getSnapshot().state.courses.at(-1).modules[0].activities[0].id,activityId);
  assert.equal(store.getSnapshot().state.courses[0].modules[0].activities[0].publishedAt,clock[0]);
  const malformed = plain(state); malformed.courses.at(-1).createdAt = "yesterday"; assert.equal(app.repo.decodeInstructorStorage(JSON.stringify(malformed)).recovery,"malformed");
  assert.throws(() => app.repo.applyInstructorCommand(state,{ type:"course.archive",courseId,archived:true },"invalid"),/ISO timestamp/);
});

test("course date sorting handles ties, unknowns, offsets and all directions without mutating records", () => {
  const context = loader(), dates = context.load("app/lib/instructor/dates.ts"), courses = plain(context.repository().seedInstructorState().courses);
  courses[0].createdAt = clock[0]; courses[0].updatedAt = clock[4]; courses[1].createdAt = clock[2]; courses[1].updatedAt = clock[1]; const before = JSON.stringify(courses);
  assert.deepEqual(plain(dates.sortInstructorCourses(courses,"newest-created").map(c => c.id)),["css","html","javascript"]);
  assert.deepEqual(plain(dates.sortInstructorCourses(courses,"oldest-created").map(c => c.id)),["html","css","javascript"]);
  assert.deepEqual(plain(dates.sortInstructorCourses(courses,"recently-updated").map(c => c.id)),["html","css","javascript"]); assert.equal(JSON.stringify(courses),before);
  courses[1].createdAt = "2026-10-26T14:35:00+05:30";
  assert.deepEqual(plain(dates.sortInstructorCourses(courses,"newest-created").map(c => c.id)),["html","css","javascript"]);
  assert.deepEqual(plain(dates.sortInstructorCourses(courses,"catalog").map(c => c.id)),["html","css","javascript"]);
});

test("date formatting uses clear local times and converts timezone/day boundaries correctly", () => {
  const { formatInstructorTimestamp:format } = loader().load("app/lib/instructor/dates.ts");
  assert.equal(format(clock[0],"Asia/Kolkata"),"26 Oct 2026, 2:35 PM"); assert.equal(format(clock[0],"UTC"),"26 Oct 2026, 9:05 AM");
  assert.equal(format("2026-10-26T23:30:00.000Z","Asia/Kolkata"),"27 Oct 2026, 5:00 AM"); assert.equal(format("2026-10-26T00:00:00.000Z","UTC"),"26 Oct 2026, 12:00 AM");
  assert.equal(format(clock[0]),format(clock[0],Intl.DateTimeFormat().resolvedOptions().timeZone));
  for (const missing of [undefined,null,"invalid",""]) assert.equal(format(missing),null);
});

test("published course duplication resets the entire hierarchy and preserves copied content/order as draft provenance", () => {
  const app = timedSetup();
  app.run({ type:"module.reorder",courseId:"html",moduleId:"html-content",direction:-1 },clock[0]);
  app.run({ type:"course.status",courseId:"html",status:"published" },clock[1]);
  const source = plain(app.state.courses[0]), before = JSON.stringify(app.state.courses);
  const id = app.run({ type:"course.duplicate",courseId:"html" },clock[2]), copy = app.state.courses.find(c => c.id === id);
  assert.equal(JSON.stringify(app.state.courses.slice(0,3)),before);
  assert.equal(copy.status,"draft"); assert.equal(copy.hasBeenPublished,false); assert.equal(copy.publishedAt,null); assert.equal(copy.source,"local"); assert.equal(copy.duplication.courseId,"html"); assert.equal(app.repo.courseDeletionIssue(copy),null);
  assert.deepEqual(plain(copy.objectives),source.objectives); assert.equal(copy.description,source.description);
  copy.modules.forEach((topic,index) => {
    const original = source.modules[index]; assert.notEqual(topic.id,original.id); assert.equal(topic.title,original.title); assert.equal(topic.description,original.description); assert.equal(topic.archived,original.archived); assert.equal(topic.status,"draft"); assert.equal(topic.hasBeenPublished,false);
    topic.activities.forEach((activity,at) => {
      const originalActivity = original.activities[at]; assert.notEqual(activity.id,originalActivity.id); assert.equal(activity.status,"draft"); assert.equal(activity.hasBeenPublished,false); assert.equal(activity.publishedAt,null); assert.equal(activity.reference,undefined);
      for (const key of ["title","description","type","minutes","archived"]) assert.equal(activity[key],originalActivity[key]);
      assert.deepEqual(plain(activity.copiedFrom),{ activityId:originalActivity.id,reference:originalActivity.reference });
      assert.equal(app.repo.activityDeletionIssue(copy,topic,activity),null);
    });
    assert.equal(app.repo.moduleDeletionIssue(copy,topic),null);
  });
  assert.throws(() => app.run({ type:"course.status",courseId:id,status:"published" },clock[3]),/content/);
  app.run({ type:"course.delete",courseId:id },clock[4]); assert.equal(app.state.courses.length,3); assert.equal(JSON.stringify(app.state.courses),before);
});

test("duplicate IDs and draft deletion survive reload without affecting seeded records or student storage", () => {
  const repo = loader().repository(), memory = storage(); memory.setItem("decode-student-progress","student-progress-and-drafts");
  let store = new repo.LocalInstructorRepository(() => memory); store.initialize(); const original = JSON.stringify(store.getSnapshot().state.courses);
  const id = store.execute({ type:"course.duplicate",courseId:"javascript" }), copyBefore = plain(store.getSnapshot().state.courses.at(-1));
  store = new repo.LocalInstructorRepository(() => memory); store.initialize(); const copy = store.getSnapshot().state.courses.find(c => c.id === id);
  assert.deepEqual(plain(copy),copyBefore); assert.equal(repo.courseDeletionIssue(copy),null); assert.equal(copy.modules.flatMap(m => m.activities).length,14);
  store.execute({ type:"course.archive",courseId:id,archived:true }); assert.equal(store.getSnapshot().state.courses.at(-1).archived,true);
  store.execute({ type:"course.archive",courseId:id,archived:false }); assert.equal(store.getSnapshot().state.courses.at(-1).status,"draft");
  store.execute({ type:"course.delete",courseId:id }); store = new repo.LocalInstructorRepository(() => memory); store.initialize();
  assert.equal(store.getSnapshot().state.courses.some(c => c.id === id),false); assert.equal(JSON.stringify(store.getSnapshot().state.courses),original); assert.equal(memory.getItem("decode-student-progress"),"student-progress-and-drafts");
});

test("copies of copies preserve source content without inheriting publication flags or sharing record identities", () => {
  const app = setup(), firstId = app.run({ type:"course.duplicate",courseId:"css" }), first = app.state.courses.at(-1);
  app.run({ type:"module.archive",courseId:firstId,moduleId:first.modules[0].id,archived:true });
  const secondId = app.run({ type:"course.duplicate",courseId:firstId }), second = app.state.courses.at(-1);
  assert.equal(second.modules[0].archived,true); assert.equal(second.modules[0].activities[0].copiedFrom.reference.id,"css-introduction"); assert.equal(second.modules[0].activities[0].copiedFrom.activityId,first.modules[0].activities[0].id);
  const ids = app.state.courses.flatMap(c => [c.id,...c.modules.flatMap(m => [m.id,...m.activities.map(a => a.id)])]); assert.equal(new Set(ids).size,ids.length);
  assert.equal(app.repo.courseDeletionIssue(second),null); app.run({ type:"course.delete",courseId:secondId }); assert.ok(app.state.courses.some(c => c.id === firstId));
});

function legacyDuplicationState(repo, genuineHistory = false) {
  const state = repo.seedInstructorState(), copy = plain(state.courses[0]); copy.id = "legacy-copy"; copy.title = "HTML (copy)"; copy.source = "local"; copy.status = "draft"; copy.hasBeenPublished = genuineHistory; copy.publishedAt = genuineHistory ? clock[1] : null;
  copy.modules.forEach((m,index) => { m.id = `legacy-module-${index}`; m.source = "local"; m.activities.forEach((a,at) => { a.id = `legacy-activity-${index}-${at}`; a.source = "local"; }); });
  state.courses.push(copy); state.changes = []; return state;
}

test("legacy copies never lose publication evidence on load; recovery creates a separately deletable draft", () => {
  const repo = loader().repository();
  for (const status of ["draft","published"]) for (const genuineHistory of [false,true]) {
    const state = legacyDuplicationState(repo,genuineHistory); state.courses.at(-1).status = status;
    const before = plain(state.courses.at(-1)), memory = storage(), raw = JSON.stringify(state); memory.setItem(repo.instructorStorageKey,raw);
    let store = new repo.LocalInstructorRepository(() => memory); store.initialize(); const legacy = store.getSnapshot().state.courses.at(-1);
    assert.equal(memory.getItem(repo.instructorStorageKey),raw); assert.deepEqual(plain(legacy),before); assert.equal(repo.needsDraftCopyRecovery(legacy),true); assert.ok(repo.courseDeletionIssue(legacy));
    assert.throws(() => store.execute({ type:"course.delete",courseId:legacy.id }),/Archive instead/);
    const freshId = store.execute({ type:"course.duplicate",courseId:legacy.id }); assert.deepEqual(plain(store.getSnapshot().state.courses.find(c => c.id === legacy.id)),before);
    store = new repo.LocalInstructorRepository(() => memory); store.initialize(); const fresh = store.getSnapshot().state.courses.find(c => c.id === freshId);
    assert.equal(fresh.status,"draft"); assert.equal(fresh.publishedAt,null); assert.equal(fresh.hasBeenPublished,false); assert.equal(repo.courseDeletionIssue(fresh),null); assert.equal(repo.needsDraftCopyRecovery(fresh),false);
    store.execute({ type:"course.delete",courseId:freshId }); assert.deepEqual(plain(store.getSnapshot().state.courses.find(c => c.id === legacy.id)),before);
  }
});

test("duplication provenance never bypasses real publication, live references or seeded-ID deletion protection", () => {
  const app = setup(), id = app.run({ type:"course.duplicate",courseId:"html" }), snapshot = plain(app.state);
  for (const mutate of [c => { c.hasBeenPublished = true; },c => { c.publishedAt = clock[1]; },c => { c.status = "published"; },c => { c.modules[0].activities[0].hasBeenPublished = true; },c => { c.modules[0].activities[0].reference = { kind:"lesson",id:"html-introduction" }; }]) {
    const state = plain(snapshot), copy = state.courses.find(c => c.id === id); mutate(copy); assert.throws(() => app.repo.applyInstructorCommand(state,{ type:"course.delete",courseId:id }),/Archive instead/);
  }
  for (const courseId of ["html","css","javascript"]) assert.throws(() => app.run({ type:"course.delete",courseId }),/Archive instead/);
});
