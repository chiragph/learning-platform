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
function render(name, exportName, { progress = empty(), pathname = "/dashboard", routeState = { pathname }, onUpdate, props = {} } = {}) {
  const cache = new Map();
  const student = { id: "student", label: "Learner student", email: "student@example.test" };
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const compiled = { exports: {} }; cache.set(filename, compiled);
    const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
    function resolve(specifier) {
      if (specifier.endsWith(".css")) return {};
      if (specifier.endsWith("/progress-provider")) return { useProgress: () => ({ progress, ready: true, update: (change) => { progress = change(progress); onUpdate?.(progress); return true; } }), ProgressProvider: ({ children }) => children };
      if (specifier.endsWith("/student-provider")) return { useStudent: () => student, LogoutButton: () => React.createElement("button", null, "Log out") };
      if (specifier === "next/link") return { __esModule: true, default: ({ children, href, ...rest }) => React.createElement("a", { ...rest, href }, children) };
      if (specifier === "next/navigation") return { usePathname: () => routeState.pathname };
      if (specifier === "next/dynamic") return { __esModule: true, default: (_load, options) => (props) => React.createElement("div", { "data-client-only": String(options.ssr === false), "data-language": props.language, "data-source": props.value }, "Monaco loads on the client") };
      if (!specifier.startsWith(".") && !specifier.startsWith("@/")) return requireDependency(specifier);
      const base = specifier.startsWith("@/") ? path.resolve(specifier.slice(2)) : path.resolve(path.dirname(filename), specifier);
      const target = [base + ".ts", base + ".tsx"].find((candidate) => fs.existsSync(candidate));
      if (!target) throw new Error(`Cannot resolve ${specifier}`);
      return load(target);
    }
    vm.runInNewContext(source, { module: compiled, exports: compiled.exports, require: resolve, console, window: globalThis.window, document: globalThis.document, Element: globalThis.window?.Element, URL: globalThis.window?.URL, requestAnimationFrame: (cb) => setTimeout(cb, 0), cancelAnimationFrame: clearTimeout, process: { env: { NODE_ENV: "development" } } }, { filename });
    return compiled.exports;
  }
  const view = load(path.resolve(`app/components/student/${name}.tsx`))[exportName];
  return { view, getProgress: () => progress, html: renderToStaticMarkup(React.createElement(view, props)), load: (file) => load(path.resolve(`app/lib/student/${file}.ts`)) };
}

test("dashboard renders a compact personalized overview and real curriculum destinations", () => {
  const { html } = render("dashboard-view", "DashboardView");
  assert.match(html, /Welcome, Learner student/);
  assert.match(html, /Suggested first activity/);
  assert.match(html, /Your journey starts with one step/);
  assert.match(html, /Activities completed/);
  for (const destination of ["/lessons/html-introduction", "/courses", "/courses/html", "/courses/css", "/courses/javascript", "/playground", "/progress"]) assert.ok(html.includes('href="' + destination + '"'));
  assert.doesNotMatch(html, /student-welcome|student-course-card/);
});

test("dashboard resumes the last opened curriculum activity and displays visit and completion records", () => {
  const progress = empty(); progress.currentLesson = "css-flexbox"; progress.lessons = ["css-introduction"];
  progress.visits = [{ activityId: "quiz:javascript", at: "2026-10-25T12:00:00Z" }];
  progress.activity = [{ id: "done", title: "Completed Introduction to CSS", at: "2026-10-24T12:00:00Z", href: "/lessons/css-introduction" }];
  const { html } = render("dashboard-view", "DashboardView", { progress });
  assert.match(html, /Last opened/);
  assert.match(html, /href="\/quizzes\/javascript"/);
  assert.match(html, /Make it interactive/);
  assert.match(html, /Completed Introduction to CSS/);
  assert.match(html, /Opened JavaScript knowledge check/);
});

test("course curriculum exposes every activity type and accessible expansion controls", () => {
  const context = render("curriculum-view", "CoursesView");
  const { courses } = context.load("courses");
  for (const course of courses) {
    const { html } = render("curriculum-view", "CourseView", { pathname: "/courses/" + course.id, props: { course } });
    assert.equal((html.match(/aria-expanded="true"/g) ?? []).length, 2);
    assert.equal((html.match(/aria-expanded="false"/g) ?? []).length, 2);
    assert.match(html, /Expand all/); assert.match(html, /Collapse all/);
    assert.match(html, /What you will learn/);
    for (const type of ["lessons", "quizzes", "challenges", "projects"]) assert.ok(html.includes('href="/' + type + '/'));
    for (const label of ["Theory", "Quiz", "Lab", "Workshop", "Not Started", "Task-specific checks", "Guided workshop"]) assert.ok(html.includes(label));
    assert.doesNotMatch(html, /disabled=""/);
  }
  const progress = empty(); progress.currentLesson = "css-flexbox";
  const returning = render("curriculum-view", "CourseView", { progress, props: { course: courses.find(c => c.id === "css") } });
  const moduleButton = returning.html.match(/<button\b[^>]*id="css-layout-title"[^>]*>/)?.[0];
  assert.ok(moduleButton?.includes('aria-expanded="true"'));
  assert.match(returning.html, /Last opened/);
});

test("My Learning renders nested course/module controls, status, percentages and both tabs", () => {
  const progress = empty(); progress.currentLesson = "html-text"; progress.lessons = ["html-introduction"];
  const { html } = render("curriculum-view", "CoursesView", { progress });
  assert.match(html, /<h1>My Learning<\/h1>/);
  assert.match(html, /role="tablist"/); assert.match(html, /role="tabpanel"/);
  assert.equal((html.match(/role="tab"/g) ?? []).length, 2);
  for (const id of ["html", "css", "javascript"]) assert.ok(html.includes('aria-controls="' + id + '-modules"'));
  for (const label of ["Not Started", "In Progress", "Completed", "Last opened"]) assert.ok(html.includes(label));
  assert.match(html, /value="8" max="100" aria-label="HTML completion"/);
  assert.doesNotMatch(html, /student-catalog-course|student-course-hero/);
});

test("completed curriculum has a meaningful empty active state and a review destination", () => {
  const context = render("curriculum-view", "CoursesView"); const { activityLocations } = context.load("curriculum");
  const progress = empty();
  for (const { activity } of activityLocations()) {
    const { kind, id } = activity.reference;
    if (kind === "lesson") progress.lessons.push(id);
    if (kind === "quiz") progress.quizzes[id] = { best: 100, latest: 100, attempts: 1, at: "2026-10-25T00:00:00Z" };
    if (kind === "exercise") progress.challenges.push(id);
    if (kind === "project") progress.projects.push(id);
  }
  const { html } = render("curriculum-view", "CoursesView", { progress });
  assert.match(html, /All courses completed/);
  assert.match(html, /Review completed courses/);
  assert.match(html, /Curriculum complete/);
});

test("student navigation is simplified and highlights My Learning for all activity routes", () => {
  for (const pathname of ["/courses/css", "/lessons/html-text", "/quizzes/css", "/challenges/css-grid", "/projects/portfolio"]) {
    const { html } = render("student-shell", "StudentShell", { pathname });
    assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1);
    const activeAnchor = html.match(/<a\b[^>]*aria-current="page"[^>]*>/)?.[0];
    assert.ok(activeAnchor?.includes('href="/courses"'));
    assert.match(html, /aria-controls="student-navigation"/);
    assert.match(html, /Skip to learning content/);
    for (const destination of ["/dashboard", "/courses", "/playground", "/progress", "/profile"]) assert.ok(html.includes('href="' + destination + '"'));
    for (const destination of ["/lessons", "/quizzes", "/challenges", "/projects"]) assert.ok(!html.includes('href="' + destination + '"'));
  }
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

test("every theory lesson embeds a contextual workspace and preserves theory and navigation", () => {
  const context = render("lesson-view", "LessonsIndex"); const { allLessons } = context.load("courses");
  for (const id of allLessons.map(lesson => lesson.id)) {
    const lesson = allLessons.find(l => l.id === id);
    const { html } = render("lesson-view", "LessonView", { props: { lesson } });
    for (const title of ["The concept", "Syntax &amp; example", "Try it yourself", "Mark as complete", "Copy code"]) assert.ok(html.includes(title));
    assert.match(html, /aria-label="Lesson navigation"/);
    assert.match(html, /aria-label="Course activities"/);
    assert.match(html, /Monaco loads on the client/);
    assert.match(html, /Run Code/); assert.match(html, /Save Draft/);
    assert.doesNotMatch(html, /href="\/playground"/);
    assert.match(html, /Read &amp; practice/);
  }
  const lesson = allLessons.find(l => l.id === "html-forms"); const progress = empty(); progress.lessons = [lesson.id];
  const completed = render("lesson-view", "LessonView", { progress, props: { lesson } });
  assert.match(completed.html, /Lesson completed/); assert.match(completed.html, /disabled=""/);
});

test("upcoming activities provide an honest preview without a completion action", () => {
  const activity = { id: "future-workshop", type: "workshop", title: "Future workshop", description: "Build a profile.", order: 1, minutes: 30, availability: "upcoming", href: "/activities/future-workshop" };
  const context = render("curriculum-view", "CoursesView"); const course = context.load("curriculum").curriculumCourses[0];
  const { html } = render("upcoming-activity-view", "UpcomingActivityView", { props: { activity, course, module: course.modules[0] } });
  assert.match(html, /Upcoming workshop/); assert.match(html, /not available to complete yet/);
  assert.doesNotMatch(html, /<button|Mark as complete|Completed/);
});

test("curriculum tabs and expansions work with keyboard and do not change student progress", async () => {
  const { JSDOM } = await import("jsdom");
  const { createRoot } = await import("react-dom/client");
  const { act } = React;
  const dom = new JSDOM("<!doctype html><div id='root'></div>", { url: "http://localhost/courses" });
  const previous = { window: globalThis.window, document: globalThis.document, IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT };
  globalThis.window = dom.window; globalThis.document = dom.window.document; globalThis.IS_REACT_ACT_ENVIRONMENT = true; dom.window.scrollTo = () => {};
  const progress = empty(); const before = JSON.stringify(progress);
  const context = render("curriculum-view", "CoursesView", { progress }); const root = createRoot(document.getElementById("root"));
  try {
    await act(async () => root.render(React.createElement(context.view)));
    const active = document.getElementById("learning-tab-active"); const completed = document.getElementById("learning-tab-completed");
    for (const control of document.querySelectorAll("[aria-controls]")) assert.ok(document.getElementById(control.getAttribute("aria-controls")));
    assert.equal(document.getElementById("learning-panel-completed").hidden, true);
    active.focus();
    await act(async () => active.dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })));
    assert.equal(document.activeElement, completed);
    assert.equal(completed.getAttribute("aria-selected"), "true");
    assert.match(document.body.textContent, /No completed courses yet/);
    await act(async () => completed.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Home", bubbles: true })));
    assert.equal(document.activeElement, active);
    const course = document.getElementById("html-title");
    await act(async () => course.click());
    assert.equal(course.getAttribute("aria-expanded"), "false");
    assert.equal(document.getElementById("html-modules").getAttribute("aria-hidden"), "true");
    assert.ok(document.getElementById("html-modules").hasAttribute("inert"));
    await act(async () => course.click());
    const moduleButton = document.getElementById("html-first-page-title");
    await act(async () => moduleButton.click());
    assert.equal(document.getElementById("html-first-page-activities").getAttribute("aria-hidden"), "true");
    const expand = [...document.querySelectorAll("#html-modules button")].find(b => b.textContent.startsWith("Expand all"));
    await act(async () => expand.click());
    for (const panel of document.querySelectorAll("#html-modules [id$='-activities']")) assert.equal(panel.getAttribute("aria-hidden"), "false");
    const collapse = [...document.querySelectorAll("#html-modules button")].find(b => b.textContent.startsWith("Collapse all"));
    await act(async () => collapse.click());
    for (const panel of document.querySelectorAll("#html-modules [id$='-activities']")) assert.equal(panel.getAttribute("aria-hidden"), "true");
    assert.equal(JSON.stringify(progress), before);
    assert.equal(document.querySelectorAll("a[aria-disabled='true']").length, 0);
  } finally {
    await act(async () => root.unmount()); dom.window.close(); Object.assign(globalThis, previous);
  }
});

test("route tracking records actual activity visits once and preserves completion and drafts", async () => {
  const { JSDOM } = await import("jsdom"); const { createRoot } = await import("react-dom/client"); const { act } = React;
  const dom = new JSDOM("<!doctype html><div id='root'></div>", { url: "http://localhost/quizzes/css" });
  const previous = { window: globalThis.window, document: globalThis.document, IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT };
  globalThis.window = dom.window; globalThis.document = dom.window.document; globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const progress = empty(); progress.drafts["project-calculator"] = { html: "Saved", css: "", javascript: "" };
  const routeState = { pathname: "/quizzes/css" }; let updates = 0;
  const context = render("activity-visit-tracker", "ActivityVisitTracker", { progress, routeState, onUpdate: () => { updates += 1; } });
  const root = createRoot(document.getElementById("root"));
  try {
    await act(async () => root.render(React.createElement(React.StrictMode, null, React.createElement(context.view))));
    assert.equal(updates, 1); assert.equal(context.getProgress().visits[0].activityId, "quiz:css");
    assert.equal(Object.keys(context.getProgress().quizzes).length, 0);
    routeState.pathname = "/courses";
    await act(async () => root.render(React.createElement(React.StrictMode, null, React.createElement(context.view))));
    assert.equal(updates, 1);
    routeState.pathname = "/projects/portfolio";
    await act(async () => root.render(React.createElement(React.StrictMode, null, React.createElement(context.view))));
    assert.equal(updates, 2); assert.equal(context.getProgress().visits[0].activityId, "project:portfolio");
    routeState.pathname = "/quizzes/css";
    await act(async () => root.render(React.createElement(React.StrictMode, null, React.createElement(context.view))));
    assert.equal(updates, 3); assert.equal(context.getProgress().visits[0].activityId, "quiz:css");
    assert.equal(context.getProgress().visits.length, 2);
    assert.equal(context.getProgress().projects.length + context.getProgress().lessons.length, 0);
    assert.equal(context.getProgress().drafts["project-calculator"].html, "Saved");
  } finally {
    await act(async () => root.unmount()); dom.window.close(); Object.assign(globalThis, previous);
  }
});

test("empty courses and modules render zero progress without NaN or false completion", () => {
  const context = render("curriculum-view", "CoursesView");
  const curriculum = context.load("curriculum");
  curriculum.curricula.html.modules = [];
  let html = renderToStaticMarkup(React.createElement(context.view));
  assert.match(html, /No modules have been published yet/);
  assert.match(html, /value="0" max="100" aria-label="HTML completion"/);
  assert.doesNotMatch(html, /NaN|Infinity/);
  curriculum.curricula.html.modules = [{ id: "empty-module", title: "Empty module", description: "Awaiting activities.", order: 1, activities: [] }];
  html = renderToStaticMarkup(React.createElement(context.view));
  assert.match(html, /No activities have been published in this module yet/);
  assert.doesNotMatch(html, /NaN|Infinity/);
});

test("lesson next navigation includes intervening practice activities in curriculum order", () => {
  const context = render("lesson-view", "LessonsIndex"); const { allLessons } = context.load("courses");
  for (const [id, next] of [["html-text", "/challenges/html-heading"], ["html-semantic", "/challenges/html-link"], ["javascript-events", "/challenges/javascript-button"]]) {
    const lesson = allLessons.find(l => l.id === id);
    const { html } = render("lesson-view", "LessonView", { props: { lesson } });
    const nav = html.match(/<nav aria-label="Lesson navigation"[\s\S]*?<\/nav>/)?.[0];
    assert.ok(nav?.includes('href="' + next + '"'));
    assert.match(nav, /NEXT ACTIVITY/);
  }
});

test("sidebar collapse persists, exposes labeled icons and tooltips, and retains the mobile navigation dialog", async () => {
  const { JSDOM } = await import("jsdom"), { createRoot } = await import("react-dom/client"), { act } = React;
  const dom = new JSDOM("<!doctype html><div id='root'></div>", { url: "http://localhost/dashboard" });
  const previous = { window: globalThis.window, document: globalThis.document, IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT };
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  let desktop = true;
  window.matchMedia = () => ({ get matches() { return desktop; }, addEventListener() {}, removeEventListener() {} }); window.scrollTo = () => {};
  const context = render("student-shell", "StudentShell", { pathname: "/lessons/html-introduction" });
  const root = createRoot(document.getElementById("root"));
  const show = () => act(async () => root.render(React.createElement(React.StrictMode, null, React.createElement(context.view))));
  try {
    await show();
    assert.equal(document.querySelector(".student-app").dataset.sidebarCollapsed, "false");
    const toggle = document.querySelector(".student-sidebar-toggle"); toggle.focus();
    await act(() => toggle.click());
    assert.equal(document.activeElement, toggle); assert.equal(toggle.getAttribute("aria-expanded"), "false");
    assert.equal(toggle.getAttribute("aria-label"), "Expand sidebar");
    assert.equal(window.localStorage.getItem("decode-sidebar-collapsed"), "true");
    const learning = document.querySelector('.student-nav-link[href="/courses"]');
    assert.equal(learning.getAttribute("aria-current"), "page"); assert.equal(learning.getAttribute("aria-label"), "My Learning");
    await act(() => learning.focus());
    assert.equal(document.querySelector('[role="tooltip"]').textContent, "My Learning");
    assert.equal(learning.getAttribute("aria-describedby"), "student-nav-tooltip");
    await act(() => toggle.focus()); assert.equal(document.querySelector('[role="tooltip"]'), null);
    await act(async () => root.render(null)); await show();
    assert.equal(document.querySelector(".student-app").dataset.sidebarCollapsed, "true", "a remount restores the saved preference");
    desktop = false;
    const menu = document.querySelector(".student-menu-toggle");
    await act(() => menu.click());
    const sidebar = document.querySelector(".student-sidebar");
    assert.equal(sidebar.getAttribute("role"), "dialog"); assert.equal(sidebar.getAttribute("aria-modal"), "true");
    assert.ok(document.querySelector(".student-main").hasAttribute("inert")); assert.equal(document.body.style.overflow, "hidden");
    await act(async () => { window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })); await new Promise(resolve => setTimeout(resolve, 10)); });
    assert.equal(sidebar.getAttribute("role"), null); assert.equal(document.body.style.overflow, ""); assert.equal(document.activeElement, menu);
    assert.equal(window.localStorage.getItem("decode-sidebar-collapsed"), "true", "mobile open/close keeps the desktop preference");
    const css = fs.readFileSync("app/components/student/sidebar.css", "utf8");
    assert.match(css, /@media\(min-width:761px\)/); assert.match(css, /grid-template-columns:76px minmax\(0,1fr\)/); assert.match(css, /prefers-reduced-motion:reduce/);
  } finally { await act(() => root.unmount()); dom.window.close(); Object.assign(globalThis, previous); }
});
