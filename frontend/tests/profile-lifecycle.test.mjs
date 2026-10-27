import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import React, { act, StrictMode } from "react";
import { JSDOM } from "jsdom";
import ts from "typescript";

const dom = new JSDOM("<!doctype html><html data-theme='light'><body></body></html>", { url: "http://localhost/profile", pretendToBeVisual: true });
const { window } = dom;
Object.assign(globalThis, { window, document: window.document, IS_REACT_ACT_ENVIRONMENT: true });
window.scrollTo = () => {};
const { createRoot, hydrateRoot } = await import("react-dom/client");
const { renderToString } = await import("react-dom/server");
const dependency = createRequire(import.meta.url);

// Actual session, profile and progress providers with a backend HTTP double.
// All learning persistence happens in this disposable JSDOM origin.
function application(includeShell = false) {
  const cache = new Map(), redirects = [], requests = [];
  let user = { id: "student", name: "Learner student", email: "student@example.test", role: "STUDENT" };
  const initialUser = { ...user };
  async function fetch(url, options = {}) {
    requests.push({ url, options });
    if (url === "/api/auth/logout?scope=student") { user = null; return Response.json({ message: "Signed out successfully." }); }
    assert.equal(url, "/api/auth/me?scope=student");
    return user ? Response.json({ user }) : Response.json({ message: "Please sign in." }, { status: 401 });
  }
  const router = { replace: href => redirects.push(href), refresh() {} };
  function load(filename) {
    filename = path.resolve(filename);
    if (cache.has(filename)) return cache.get(filename).exports;
    const compiled = { exports: {} }; cache.set(filename, compiled);
    const source = ts.transpileModule(fs.readFileSync(filename.endsWith("progress-provider.tsx") ? path.resolve("tests/fixtures/local-progress-provider.txt") : filename, "utf8"), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
    function require(specifier) {
      if (specifier === "../../lib/instructor/remote-repository") return { RemoteInstructorRepository: load("app/lib/instructor/repository.ts").LocalInstructorRepository };
      if (specifier.endsWith(".css")) return {};
      if (specifier === "next/link") return { __esModule: true, default: ({ href, children, ...props }) => React.createElement("a", { ...props, href }, children) };
      if (specifier === "next/navigation") return { usePathname: () => window.location.pathname, useRouter: () => router };
      if (!specifier.startsWith(".") && !specifier.startsWith("@/")) return dependency(specifier);
      const base = specifier.startsWith("@/") ? path.resolve(specifier.slice(2)) : path.resolve(path.dirname(filename), specifier);
      return load([base + ".ts", base + ".tsx"].find(fs.existsSync));
    }
    vm.runInNewContext(source, { module: compiled, exports: compiled.exports, require, console, window, document: window.document, Element: window.Element, URL: window.URL, localStorage: window.localStorage, sessionStorage: window.sessionStorage, requestAnimationFrame: callback => setTimeout(callback, 0), fetch, AbortController, AbortSignal, crypto: globalThis.crypto, process: { env: { NODE_ENV: "development" } } }, { filename });
    return compiled.exports;
  }
  const profiles = load("app/lib/student/student-profile.ts"), logic = load("app/lib/student/progress.ts");
  const { StudentProvider, useStudent } = load("app/components/student/student-provider.tsx");
  const { ProgressProvider, useProgress } = load("app/components/student/progress-provider.tsx");
  const { ProfileView } = load("app/components/student/profile-view.tsx");
  const Container = includeShell ? load("app/components/student/student-shell.tsx").StudentShell : ProgressProvider;
  let snapshot, identity;
  function Probe() { identity = useStudent(); snapshot = useProgress().progress; return React.createElement("output", { id: "identity" }, identity.label); }
  const tree = () => React.createElement(StrictMode, null, React.createElement(StudentProvider, { user: initialUser }, React.createElement(Container, null, React.createElement(Probe), React.createElement(ProfileView))));
  return { tree, profiles, logic, redirects, requests, setUser: next => { user = next; }, get progress() { return snapshot; }, get student() { return identity; } };
}
function seed(app) {
  window.localStorage.clear(); window.sessionStorage.clear();
  const progress = app.logic.emptyProgress();
  progress.lessons = ["html-introduction"];
  progress.projects = ["portfolio"];
  progress.quizzes.css = { latest: 80, best: 80, attempts: 2, at: "2026-10-25T00:00:00Z" };
  progress.drafts["lesson-html-introduction"] = { html: "<h1>Keep my draft</h1>", css: "", javascript: "" };
  window.localStorage.setItem(app.logic.progressKey("student"), JSON.stringify(progress));
  return progress;
}
async function mount(app, hydrate = false) {
  const container = document.createElement("div"); document.body.append(container);
  const errors = [];
  let root;
  if (hydrate) {
    container.innerHTML = renderToString(app.tree());
    await act(async () => { root = hydrateRoot(container, app.tree(), { onRecoverableError: error => errors.push(error), onUncaughtError: error => errors.push(error) }); });
  } else {
    root = createRoot(container, { onUncaughtError: error => errors.push(error) });
    await act(async () => root.render(app.tree()));
  }
  return { container, errors, async dispose() { await act(async () => root.unmount()); container.remove(); } };
}
async function name(target, value) {
  const input = target.container.querySelector("#profile-name");
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  await act(async () => { setter.call(input, value); input.dispatchEvent(new window.Event("input", { bubbles: true })); });
}
async function click(target, label) {
  const button = [...target.container.querySelectorAll("button")].find(node => node.textContent.trim() === label);
  assert.ok(button, "Missing button " + label);
  await act(async () => { button.click(); });
}
async function save(target) { await act(async () => target.container.querySelector("form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }))); }

test("profile edits persist across remounts and update display identity without changing learning data", async () => {
  const app = application(true); seed(app);
  const learningBefore = window.localStorage.getItem(app.logic.progressKey("student"));
  let target = await mount(app);
  try {
    assert.match(target.container.textContent, /8% of your curriculum complete/);
    assert.match(target.container.textContent, /3 of 38 activities/);
    assert.equal(target.container.querySelector('progress[aria-label="HTML completion"]').value, 17);
    assert.equal(target.container.querySelectorAll(".student-avatar-picker input").length, 14);
    await name(target, "Demo Builder");
    await act(() => target.container.querySelector('input[value="astronaut"]').click());
    await save(target);
    assert.equal(app.student.id, "student"); assert.equal(app.student.email, "student@example.test");
    assert.equal(app.student.label, "Demo Builder");
    assert.equal(target.container.querySelector("h1").textContent, "Demo Builder");
    assert.equal(target.container.querySelector(".student-profile-hero-avatar").dataset.avatar, "astronaut");
    assert.equal(target.container.querySelector(".student-header-avatar").dataset.avatar, "astronaut");
    assert.equal(app.profiles.readProfile(window.localStorage, "student").avatar, "astronaut");
    assert.equal(window.localStorage.getItem(app.logic.progressKey("student")), learningBefore);
    assert.match(target.container.textContent, /Profile saved in this browser/);
    await target.dispose(); target = await mount(app);
    assert.equal(target.container.querySelector("#profile-name").value, "Demo Builder");
    assert.equal(target.container.querySelector('input[value="astronaut"]').checked, true);
    assert.equal(window.localStorage.getItem(app.logic.progressKey("student")), learningBefore);
    assert.equal(target.errors.length, 0);
  } finally { await target.dispose(); }
});

test("invalid names and storage failures keep the previously saved profile and progress", async () => {
  const app = application(); seed(app); const target = await mount(app);
  const originalSet = window.Storage.prototype.setItem;
  const learningBefore = window.localStorage.getItem(app.logic.progressKey("student"));
  try {
    await name(target, " "); await save(target);
    assert.match(target.container.querySelector('[role="alert"]').textContent, /2–40/);
    assert.equal(app.student.label, "Learner student");
    await name(target, "Unsaved Builder");
    window.Storage.prototype.setItem = function(key, value) { if (key === app.profiles.profileKey("student")) throw new Error("Storage full"); return originalSet.call(this, key, value); };
    await save(target);
    assert.match(target.container.querySelector('[role="alert"]').textContent, /could not be saved|Storage full/);
    assert.equal(app.student.label, "Learner student");
    assert.equal(window.localStorage.getItem(app.logic.progressKey("student")), learningBefore);
  } finally { window.Storage.prototype.setItem = originalSet; await target.dispose(); }
});

test("learning reset requires confirmation and preserves profile, theme, other students and logout behavior", async () => {
  const app = application(); seed(app);
  app.profiles.saveProfile(window.localStorage, "student", { version: 1, displayName: "Local Builder", avatar: "bot" });
  window.localStorage.setItem("decode-theme", "dark");
  window.localStorage.setItem(app.logic.progressKey("other"), JSON.stringify({ ...app.logic.emptyProgress(), lessons: ["css-grid"] }));
  const profileBefore = window.localStorage.getItem(app.profiles.profileKey("student"));
  const learningBefore = window.localStorage.getItem(app.logic.progressKey("student"));
  const otherBefore = window.localStorage.getItem(app.logic.progressKey("other"));
  const target = await mount(app);
  try {
    await click(target, "Reset progress and drafts");
    assert.equal(window.localStorage.getItem(app.logic.progressKey("student")), learningBefore);
    await click(target, "Keep my data");
    assert.equal(window.localStorage.getItem(app.logic.progressKey("student")), learningBefore);
    await click(target, "Reset progress and drafts"); await click(target, "Yes, reset my learning data");
    assert.equal(app.progress.lessons.length, 0); assert.equal(Object.keys(app.progress.drafts).length, 0);
    assert.match(target.container.textContent, /0% of your curriculum complete/);
    assert.equal(window.localStorage.getItem(app.profiles.profileKey("student")), profileBefore);
    assert.equal(window.localStorage.getItem(app.logic.progressKey("other")), otherBefore);
    assert.equal(window.localStorage.getItem("decode-theme"), "dark");
    await click(target, "Log out"); assert.ok(app.requests.some(request => request.url === "/api/auth/logout?scope=student" && request.options.method === "POST")); assert.ok(app.redirects.includes("/login"));
    assert.equal(window.localStorage.getItem(app.profiles.profileKey("student")), profileBefore);
    assert.equal(target.errors.length, 0);
  } finally { await target.dispose(); document.documentElement.dataset.theme = "light"; }
});

test("profile values stay isolated by account and unauthenticated sessions cannot render the profile", async () => {
  const app = application(); seed(app);
  app.profiles.saveProfile(window.localStorage, "student", { version: 1, displayName: "Original Builder", avatar: "astronaut" });
  app.setUser({ id: "other", name: "Learner other", email: "other@example.test", role: "STUDENT" });
  const target = await mount(app);
  try {
    assert.equal(app.student.id, "other"); assert.equal(app.student.label, "Learner other");
    assert.equal(target.container.querySelector("#profile-name").value, "Learner other");
    assert.equal(app.progress.lessons.length, 0);
    assert.equal(app.profiles.readProfile(window.localStorage, "student").displayName, "Original Builder");
  } finally { await target.dispose(); }
  app.setUser(null); const loggedOut = await mount(app);
  try { assert.equal(loggedOut.container.querySelector("#profile-name"), null); assert.ok(app.redirects.includes("/login")); }
  finally { await loggedOut.dispose(); }
});

test("protected profile server markup hydrates and restores local state without recoverable errors", async () => {
  const app = application(); seed(app); const target = await mount(app, true);
  try { assert.ok(target.container.querySelector("#profile-name")); assert.equal(target.errors.length, 0); }
  finally { await target.dispose(); }
});
