import test from "node:test";
import assert from "node:assert/strict";
import { buildSync } from "esbuild";
import vm from "node:vm";
import { createRequire } from "node:module";

function domain() {
  const built = buildSync({
    stdin: {
      contents: `
    export * from './app/lib/learning/domain';
    export * from './app/lib/learning/catalog';
    export {courses,allLessons} from './app/lib/student/courses';
    export {quizzes} from './app/lib/student/quizzes';
    export {lessonStarter} from './app/lib/student/lesson-practice';
    export {curriculumCourses,activityLocations,completionStats} from './app/lib/student/curriculum';
    export {completeLesson} from './app/lib/student/progress';
    export {RemoteInstructorRepository} from './app/lib/instructor/remote-repository';
  `,
      resolveDir: process.cwd(),
    },
    bundle: true,
    format: "cjs",
    platform: "node",
    write: false,
  });
  const compiledModule = { exports: {} };
  const runtime = {
    module: compiledModule,
    exports: compiledModule.exports,
    require: createRequire(import.meta.url),
    structuredClone,
    crypto: globalThis.crypto,
    console,
  };
  vm.runInNewContext(built.outputFiles[0].text, runtime);
  return { ...compiledModule.exports, runtime };
}

test("published custom course and lesson IDs feed existing curriculum, workspace and completion calculations", () => {
  const app = domain();
  let state = app.seedInstructorState();
  const run = (command) => {
    const r = app.applyInstructorCommand(state, command);
    state = r.state;
    return r.id;
  };
  const courseId = run({
    type: "course.create",
    id: "accessible-web",
    fields: {
      title: "Accessible web",
      description: "Build accessible interfaces",
      category: "Web",
      difficulty: "Beginner",
      duration: "30 minutes",
      objectives: ["Use semantic headings"],
      color: "green",
      icon: "book",
    },
  });
  const moduleId = run({
    type: "module.create",
    courseId,
    title: "Meaningful pages",
    description: "Structure and semantics",
  });
  const activityId = run({
    type: "activity.create",
    courseId,
    moduleId,
    activityType: "theory",
    title: "Headings",
    description: "Use a heading",
  });
  run({
    type: "theory.save",
    courseId,
    moduleId,
    activityId,
    expectedRevision: null,
    expectedUpdatedAt: null,
    content: {
      title: "Accessible headings",
      blocks: [
        {
          id: "paragraph",
          type: "paragraph",
          text: "Every page needs a descriptive heading.",
        },
        {
          id: "example",
          type: "code",
          language: "html",
          code: "<h1>Hello</h1>",
          title: "Example",
          explanation: "One main heading.",
        },
      ],
    },
  });
  run({ type: "course.status", courseId, status: "published" });
  const published = app.publishCourse(
    state,
    state.courses.find((c) => c.id === courseId),
  );
  app.installCatalog([
    { ...app.studentCourse(published), publicationId: "version-one" },
  ]);
  assert.equal(app.courses.length, 1);
  assert.equal(app.allLessons[0].id, activityId);
  assert.equal(app.curriculumCourses[0].id, courseId);
  assert.ok(app.lessonStarter(app.allLessons[0]).html);
  const progress = app.completeLesson(
    app.emptyProgress(),
    activityId,
    new Date().toISOString(),
  );
  assert.equal(
    app.completionStats(
      app.activityLocations().map((a) => a.activity),
      progress,
    ).percent,
    100,
  );
  assert.equal(
    app.publishedActivities.get("lesson:" + activityId).publicationId,
    "version-one",
  );
  app.installCatalog([]);
  assert.equal(app.courses.length, 0);
  assert.equal(app.allLessons.length, 0);
  assert.equal(app.curriculumCourses.length, 0);
  assert.equal(app.publishedActivities.size, 0);
});

test("student projection never exposes answers, private lab solutions or review guidance", () => {
  const app = domain(),
    state = app.seedInstructorState();
  const publications = state.courses.map((c) =>
    app.publishCourse(state, c, true),
  );
  const before = JSON.stringify(publications);
  const catalog = publications.map((c, i) => ({
    ...app.studentCourse(c),
    publicationId: "version-" + i,
  }));
  for (const a of catalog.flatMap((c) =>
    c.modules.flatMap((m) => m.activities),
  )) {
    if (a.type === "quiz")
      assert.ok(
        a.content.questions.every(
          (q) => q.correctOptionId === null && q.explanation === "",
        ),
      );
    if (a.type === "lab") assert.equal(a.content.solution, "");
    if (a.type === "workshop") assert.equal(a.content.feedbackGuidance, "");
  }
  assert.equal(JSON.stringify(publications), before);
  app.installCatalog(catalog);
  assert.ok(
    Object.values(app.quizzes).every((qs) => qs.every((q) => q.correct === -1)),
  );
});

test("remote editor waits for acknowledgement, keeps failed edits out of saved state and refreshes conflicts", async () => {
  const app = domain();
  let state = app.seedInstructorState(),
    revision = 0,
    fail = false;
  app.runtime.fetch = async (url, options) => {
    if (!options.body)
      return {
        ok: true,
        json: async () => ({ state: structuredClone(state), revision }),
      };
    if (fail)
      return {
        ok: false,
        status: 503,
        json: async () => ({ message: "Database unavailable" }),
      };
    const body = JSON.parse(options.body);
    if (body.expectedRevision !== revision)
      return {
        ok: false,
        status: 409,
        json: async () => ({ message: "Content changed" }),
      };
    const r = app.applyInstructorCommand(state, body.command);
    state = r.state;
    revision++;
    return {
      ok: true,
      json: async () => ({ state: structuredClone(state), revision, id: r.id }),
    };
  };
  const repo = new app.RemoteInstructorRepository();
  await repo.initialize();
  await repo.execute({
    type: "course.archive",
    courseId: "html",
    archived: true,
  });
  assert.equal(repo.getSnapshot().state.courses[0].archived, true);
  fail = true;
  await assert.rejects(
    repo.execute({ type: "course.archive", courseId: "html", archived: false }),
    /Database unavailable/,
  );
  assert.equal(repo.getSnapshot().state.courses[0].archived, true);
  fail = false;
  revision++;
  await assert.rejects(
    repo.execute({ type: "course.archive", courseId: "html", archived: false }),
    /Content changed/,
  );
  await repo.execute({
    type: "course.archive",
    courseId: "html",
    archived: false,
  });
  assert.equal(repo.getSnapshot().state.courses[0].archived, false);
});
