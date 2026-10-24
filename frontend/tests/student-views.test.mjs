import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const requireDependency = createRequire(import.meta.url);
const empty = () => ({ version: 1, lessons: [], quizzes: {}, challenges: [], projects: [], currentLesson: null, activity: [], drafts: {} });

// Render the real views with injected demo state. This catches component/data
// integration errors; it does not substitute for interactive browser testing.
function render(name, exportName, { progress = empty(), pathname = "/dashboard", props = {} } = {}) {
  const cache = new Map();
  const student = { id: "student", label: "Learner student", email: "student@example.test" };
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const compiled = { exports: {} }; cache.set(filename, compiled);
    const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
    function resolve(specifier) {
      if (specifier.endsWith(".css")) return {};
      if (specifier.endsWith("/progress-provider")) return { useProgress: () => ({ progress, update: () => true }), ProgressProvider: ({ children }) => children };
      if (specifier.endsWith("/student-provider")) return { useStudent: () => student, LogoutButton: () => React.createElement("button", null, "Log out") };
      if (specifier === "next/link") return { __esModule: true, default: ({ children, href, ...rest }) => React.createElement("a", { ...rest, href }, children) };
      if (specifier === "next/navigation") return { usePathname: () => pathname };
      if (specifier === "next/dynamic") return { __esModule: true, default: (_load, options) => (props) => React.createElement("div", { "data-client-only": String(options.ssr === false), "data-language": props.language, "data-source": props.value }, "Monaco loads on the client") };
      if (!specifier.startsWith(".") && !specifier.startsWith("@/")) return requireDependency(specifier);
      const base = specifier.startsWith("@/") ? path.resolve(specifier.slice(2)) : path.resolve(path.dirname(filename), specifier);
      const target = [base + ".ts", base + ".tsx"].find((candidate) => fs.existsSync(candidate));
      if (!target) throw new Error(`Cannot resolve ${specifier}`);
      return load(target);
    }
    vm.runInNewContext(source, { module: compiled, exports: compiled.exports, require: resolve, console, process: { env: { NODE_ENV: "development" } } }, { filename });
    return compiled.exports;
  }
  const view = load(path.resolve(`app/components/student/${name}.tsx`))[exportName];
  return { html: renderToStaticMarkup(React.createElement(view, props)), load: (file) => load(path.resolve(`app/lib/student/${file}.ts`)) };
}

test("dashboard renders a meaningful new-learner state and functional destinations", () => {
  const { html } = render("dashboard-view", "DashboardView");
  assert.match(html, /Welcome to your workspace/);
  assert.match(html, /SUGGESTED STARTING POINT/);
  assert.match(html, /no attempts yet/);
  assert.match(html, /Your journey starts with one step/);
  for (const destination of ["/lessons/html-introduction", "/courses/html", "/courses/css", "/courses/javascript", "/playground", "/challenges", "/progress"]) assert.ok(html.includes(`href="${destination}"`));
  assert.doesNotMatch(html, /CONTINUE LEARNING/);
});

test("dashboard resumes the actual last-viewed course and displays recorded activity", () => {
  const progress = empty(); progress.currentLesson = "css-flexbox"; progress.lessons = ["css-introduction"];
  progress.activity = [{ id: "done", title: "Completed Introduction to CSS", at: "2026-10-24T12:00:00Z", href: "/lessons/css-introduction" }];
  const { html } = render("dashboard-view", "DashboardView", { progress });
  assert.match(html, /CONTINUE LEARNING/);
  assert.match(html, /href="\/lessons\/css-flexbox"/);
  assert.match(html, /Completed Introduction to CSS/);
  assert.doesNotMatch(html, /Your journey starts with one step/);
});

test("course syllabus exposes all four activity types with accessible module controls", () => {
  const context = render("curriculum-view", "CoursesView");
  const { courses } = context.load("courses");
  for (const course of courses) {
    const { html } = render("curriculum-view", "CourseView", { pathname: `/courses/${course.id}`, props: { course } });
    assert.equal((html.match(/aria-expanded="true"/g) ?? []).length, 1);
    assert.equal((html.match(/aria-expanded="false"/g) ?? []).length, 2);
    assert.match(html, /Expand all/); assert.match(html, /Collapse all/);
    assert.match(html, /What you will learn/);
    for (const type of ["lessons", "quizzes", "challenges", "projects"]) assert.ok(html.includes(`href="/${type}/`));
    assert.match(html, /Guided project · optional/);
    assert.doesNotMatch(html, /disabled=""/);
  }
  const progress = empty(); progress.currentLesson = "css-flexbox";
  const returning = render("curriculum-view", "CourseView", { progress, props: { course: courses.find(c => c.id === "css") } });
  const moduleButton = returning.html.match(/<button\b[^>]*id="css-layout-title"[^>]*>/)?.[0];
  assert.ok(moduleButton?.includes('aria-expanded="true"'));
  assert.match(returning.html, /Last viewed/);
});

test("shared shell retains navigation destinations and highlights nested course routes", () => {
  const { html } = render("student-shell", "StudentShell", { pathname: "/courses/css" });
  assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1);
  const activeAnchor = html.match(/<a\b[^>]*aria-current="page"[^>]*>/)?.[0];
  assert.ok(activeAnchor?.includes('href="/courses"'));
  assert.match(html, /aria-controls="student-navigation"/);
  assert.match(html, /Skip to learning content/);
  for (const destination of ["/dashboard", "/courses", "/lessons", "/quizzes", "/playground", "/challenges", "/projects", "/progress", "/profile"]) assert.ok(html.includes(`href="${destination}"`));
});

test("coding workspace keeps saved source, language tabs, resize controls and Run/Save actions", () => {
  const progress = empty();
  progress.drafts["playground-welcome"] = { html: "<h1>Saved source</h1>", css: "h1 { color: blue; }", javascript: "console.log(42);" };
  const { html } = render("code-workspace", "CodeWorkspace", { progress, props: { workspaceId: "playground-welcome", starter: { html: "Starter", css: "", javascript: "" } } });
  assert.match(html, /data-client-only="true"/);
  assert.match(html, /data-source="&lt;h1&gt;Saved source&lt;\/h1&gt;"/);
  assert.equal((html.match(/role="tab"/g) ?? []).length, 3);
  assert.match(html, /role="separator"/); assert.match(html, /aria-valuemin="30"/);
  for (const text of ["Run Code", "Save Draft", "Reset", "Accessible editor", "Preview not running"]) assert.ok(html.includes(text));
  assert.doesNotMatch(html, /<iframe/);
});

test("lesson reading view preserves examples, navigation and completion without mounting Monaco", () => {
  const context = render("lesson-view", "LessonsIndex"); const { allLessons } = context.load("courses");
  for (const id of ["html-introduction", "html-forms", "javascript-events"]) {
    const lesson = allLessons.find(l => l.id === id);
    const { html } = render("lesson-view", "LessonView", { props: { lesson } });
    for (const title of ["The concept", "Syntax &amp; example", "Try it yourself", "Mark as complete", "Copy code"]) assert.ok(html.includes(title));
    assert.match(html, /aria-label="Lesson navigation"/);
    assert.match(html, /aria-label="Course theory lessons"/);
    assert.doesNotMatch(html, /Monaco loads on the client/);
    if (id !== "html-introduction") assert.match(html, /Read &amp; practice/);
  }
  const lesson = allLessons.find(l => l.id === "html-forms"); const progress = empty(); progress.lessons = [lesson.id];
  const completed = render("lesson-view", "LessonView", { progress, props: { lesson } });
  assert.match(completed.html, /Lesson completed/); assert.match(completed.html, /disabled=""/);
});
