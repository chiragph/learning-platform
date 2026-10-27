import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import React, { Activity, StrictMode, act, useState } from "react";
import { JSDOM } from "jsdom";
import ts from "typescript";

const dom = new JSDOM("<!doctype html><body></body>", { url: "http://localhost/dashboard", pretendToBeVisual: true });
const { window } = dom;
Object.assign(globalThis, { window, document: window.document, IS_REACT_ACT_ENVIRONMENT: true });
const { createRoot } = await import("react-dom/client");
const dependency = createRequire(import.meta.url);
const alice = { id: "172f722e-95ca-40f4-ad73-08008c00d63f", name: "Alice Learner", email: "alice@example.test", role: "STUDENT" };
const bob = { id: "9738d735-d020-44e9-92db-53ce1b56c120", name: "Bob Learner", email: "bob@example.test", role: "STUDENT" };
const instructor = { id: "7bf5c7e7-0741-44e0-a658-cd18211b7e58", name: "DECODE Instructor", email: "decode.instructor@gmail.com", role: "INSTRUCTOR" };
const plain = value => JSON.parse(JSON.stringify(value));

// Exercise the real frontend transport, guard, providers and repositories.
// Only the backend HTTP boundary and Next router/cookies are substituted.
function application(withLab = false) {
  const calls = [], redirects = [], cache = new Map(), labResults = [];
  const scopedCookies = {};
  let backendUser = alice, cookie = "a".repeat(64), refreshes = 0, snapshot, identity;
  let transport = async url => url.includes("/logout") ? Response.json({ message: "Signed out successfully." }) : Response.json({ user: backendUser });
  const router = { replace: href => redirects.push(href), refresh: () => refreshes++ };
  async function fetch(url, options = {}) { calls.push({ url, options }); return transport(url, options); }
  function load(file) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file).exports;
    const compiled = { exports: {} }; cache.set(file, compiled);
    const source = ts.transpileModule(fs.readFileSync(file.endsWith("/progress-provider.tsx") || file.endsWith("\\progress-provider.tsx") ? path.resolve("tests/fixtures/local-progress-provider.txt") : file, "utf8"), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
    function require(specifier) {
      if (specifier === "../../lib/instructor/remote-repository") return { RemoteInstructorRepository: load("app/lib/instructor/repository.ts").LocalInstructorRepository };
      if (specifier === "server-only" || specifier.endsWith(".css")) return {};
      if (specifier === "./animated-owl") return { AnimatedOwl: () => null };
      if (specifier === "next/link") return { __esModule: true, default: ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children) };
      if (specifier === "next/headers") return { cookies: async () => ({ get: key => { const value = key === "decode_session" ? cookie : scopedCookies[key]; return value === undefined ? undefined : { value }; } }) };
      if (specifier === "next/navigation") return { useRouter: () => router, usePathname: () => window.location.pathname, redirect: href => { throw Object.assign(new Error("Redirect " + href), { redirect: href }); } };
      if (!specifier.startsWith(".") && !specifier.startsWith("@/")) return dependency(specifier);
      const base = specifier.startsWith("@/") ? path.resolve(specifier.slice(2)) : path.resolve(path.dirname(file), specifier);
      return load([base + ".ts", base + ".tsx"].find(fs.existsSync));
    }
    vm.runInNewContext(source, { module: compiled, exports: compiled.exports, require, console, window, document, Error, Element: window.Element, URL: window.URL, localStorage: window.localStorage, sessionStorage: window.sessionStorage, fetch, AbortController, AbortSignal, crypto: globalThis.crypto, requestAnimationFrame: callback => setTimeout(callback, 0), cancelAnimationFrame: clearTimeout, process: { env: { NODE_ENV: "production", API_URL: "http://auth-backend.test:4000" } } }, { filename: file });
    return compiled.exports;
  }
  const providers = load("app/components/student/student-provider.tsx"), progress = load("app/lib/student/progress.ts");
  const { ProgressProvider, useProgress } = load("app/components/student/progress-provider.tsx");
  const labProps = withLab ? { lab: load("app/lib/student/labs.ts").labs["html-heading"], code: { html: "<h1>Hello, DECODE!</h1><p>Practice.</p>", css: "", javascript: "" }, images: [], onChecked: results => labResults.push(results) } : null;
  function Workspace() {
    identity = providers.useStudent(); snapshot = useProgress();
    const [code, setCode] = useState("Unsaved local code");
    return React.createElement("section", { "data-testid": "workspace", "data-user": identity.id },
      React.createElement("strong", null, identity.label),
      React.createElement("input", { "aria-label": "Code draft", value: code, onChange: event => setCode(event.target.value) }),
      React.createElement("button", { onClick: () => snapshot.update(p => ({ ...p, drafts: { ...p.drafts, "lesson-html-introduction": { html: code, css: "", javascript: "" } } })) }, "Save local code"),
      React.createElement(providers.LogoutButton), React.createElement(providers.LogoutButton),
      withLab ? React.createElement(load("app/components/student/lab-check-runner.tsx").LabCheckRunner, labProps) : null);
  }
  function Scope() { const user = providers.useStudent(); return React.createElement(ProgressProvider, { key: user.id }, React.createElement(Workspace)); }
  return {
    load, calls, redirects, progress, providers, labResults,
    get refreshes() { return refreshes; }, get snapshot() { return snapshot; }, get identity() { return identity; },
    setCookie: next => { cookie = next; }, setRoleCookie: (role, value) => { scopedCookies["decode_" + role + "_session"] = value; }, setUser: next => { backendUser = next; }, setTransport: next => { transport = next; },
    tree: (mode = "visible") => React.createElement(StrictMode, null, React.createElement(Activity, { mode }, React.createElement(providers.StudentProvider, { user: alice }, React.createElement(Scope)))),
  };
}
async function mount(tree) {
  const container = document.createElement("div"); document.body.append(container); const errors = [];
  const root = createRoot(container, { onUncaughtError: error => errors.push(error), onRecoverableError: error => errors.push(error) });
  await act(async () => root.render(tree()));
  return { container, errors, async render(next = tree) { await act(async () => root.render(next())); }, async dispose() { await act(() => root.unmount()); container.remove(); } };
}
async function click(target, text) {
  const button = [...target.container.querySelectorAll("button")].find(item => item.textContent === text);
  assert.ok(button, "Missing button " + text); await act(async () => button.click());
}
async function input(target, selector, value) {
  const field = target.container.querySelector(selector); assert.ok(field, "Missing input " + selector);
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  await act(() => { setter.call(field, value); field.dispatchEvent(new window.Event("input", { bubbles: true })); });
}
async function submit(target) { await act(() => target.container.querySelector("form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }))); }
async function fill(target, mode) {
  if (mode === "register") await input(target, '[name="name"]', "  Alice Learner  ");
  await input(target, '[name="email"]', "alice@example.test");
  await input(target, '[name="password"]', " Secure password! ");
  if (mode === "register") await input(target, '[name="confirmPassword"]', " Secure password! ");
}
const workspace = target => target.container.querySelector('[data-testid="workspace"]');

test("server guards prefer independent role cookies over the last login alias", async () => {
  const app = application();
  app.setCookie('c'.repeat(64));
  app.setRoleCookie('student', 'a'.repeat(64));
  app.setRoleCookie('instructor', 'b'.repeat(64));
  app.setTransport(async (url, options) => {
    const student = url.endsWith('scope=student');
    assert.equal(options.headers.Cookie, student ? 'decode_student_session=' + 'a'.repeat(64) : 'decode_instructor_session=' + 'b'.repeat(64));
    return Response.json({ user: student ? alice : instructor });
  });
  const { verifyStudentSession } = app.load('app/components/auth/server-student-session.ts');
  const { verifyInstructorSession } = app.load('app/components/auth/server-instructor-session.ts');
  assert.equal((await verifyStudentSession()).user.id, alice.id);
  assert.equal((await verifyInstructorSession()).user.id, instructor.id);
  app.setRoleCookie('student', 'invalid');
  assert.equal((await verifyStudentSession()).status, 'anonymous');
  assert.equal((await verifyInstructorSession()).user.id, instructor.id);
});

test("both client workspaces survive cross-tab sign-in notifications", async () => {
  const app = application();
  app.setTransport(async url => Response.json({ user: url.endsWith('scope=instructor') ? instructor : alice }));
  const { InstructorSessionProvider } = app.load('app/components/instructor/instructor-session-provider.tsx');
  const target = await mount(() => React.createElement(React.Fragment, null, app.tree(), React.createElement(InstructorSessionProvider, { user: instructor }, React.createElement('p', { id: 'instructor-work' }, 'Instructor work'))));
  try {
    for (const event of [new window.StorageEvent('storage', { key: 'decode-auth-change-v1' }), new window.Event('focus')]) {
      await act(async () => window.dispatchEvent(event));
      assert.equal(workspace(target).dataset.user, alice.id);
      assert.equal(target.container.querySelector('[data-instructor-session-workspace]').hidden, false);
      assert.ok(target.container.querySelector('#instructor-work'));
      assert.deepEqual(app.redirects, []);
    }
  } finally { await target.dispose(); }
});

test("server verification forwards only the real session cookie, returns public identity, and never caches users", async () => {
  const app = application(), { verifyStudentSession } = app.load("app/components/auth/server-student-session.ts");
  app.setTransport(async () => Response.json({ user: { ...alice, passwordHash: "must not reach client", token: "must not reach client" } }));
  const session = await verifyStudentSession();
  assert.deepEqual(plain(session), { status: "authenticated", user: alice });
  assert.equal(app.calls[0].url, "http://auth-backend.test:4000/api/auth/me?scope=student");
  assert.deepEqual(plain(app.calls[0].options.headers), { Cookie: "decode_session=" + "a".repeat(64) });
  assert.equal(app.calls[0].options.cache, "no-store"); assert.ok(app.calls[0].options.signal);
  app.setUser(bob); app.setTransport(async () => Response.json({ user: bob }));
  assert.equal((await verifyStudentSession()).user.id, bob.id); assert.equal(app.calls.length, 2);
});

test("missing, invalid, expired, forbidden, malformed and unreachable server sessions fail closed", async () => {
  const app = application(), { verifyStudentSession } = app.load("app/components/auth/server-student-session.ts");
  for (const cookie of [undefined, "", "bad-token", "a".repeat(64) + "; other=value"]) {
    app.setCookie(cookie); assert.equal((await verifyStudentSession()).status, "anonymous");
  }
  assert.equal(app.calls.length, 0); app.setCookie("b".repeat(64));
  for (const [response, status] of [
    [() => Response.json({ message: "Expired" }, { status: 401 }), "anonymous"],
    [() => Response.json({}, { status: 503 }), "unavailable"],
    [() => new Response("not JSON"), "unavailable"],
    [() => Response.json({ user: { ...alice, id: null } }), "unavailable"],
    [() => Response.json({ user: { ...alice, role: "ROOT" } }), "unavailable"],
    [() => Response.json({ user: { ...alice, role: "ADMIN" } }), "forbidden"],
    [() => Response.json({ user: { ...alice, role: "INSTRUCTOR" } }), "forbidden"],
    [() => { throw new Error("Offline"); }, "unavailable"],
  ]) { app.setTransport(async () => response()); assert.equal((await verifyStudentSession()).status, status); }
});

test("student layout verifies the server session behind Suspense before passing identity or rendering the workspace", async () => {
  const app = application(), Layout = app.load("app/(student)/layout.tsx").default;
  const shell = Layout({ children: React.createElement("p", null, "Protected content") });
  assert.equal(shell.type, React.Suspense);
  const boundary = shell.props.children;
  const result = await boundary.type(boundary.props);
  assert.deepEqual(plain(result.props.user), alice); assert.equal(result.type, app.providers.StudentProvider);
  assert.ok(!JSON.stringify(result.props.user).includes("decode_session"));
  app.setCookie(undefined); await assert.rejects(() => boundary.type(boundary.props), error => error.redirect === "/login");
  app.setCookie("c".repeat(64)); app.setTransport(async () => Response.json({ user: { ...alice, role: "INSTRUCTOR" } }));
  assert.equal((await boundary.type(boundary.props)).props.status, "forbidden");
  app.setTransport(async () => { throw new Error("Offline"); });
  assert.equal((await boundary.type(boundary.props)).props.status, "unavailable");
});

test("main's login and registration requests, pending guard and Remember me survive the conflict resolution", async () => {
  for (const mode of ["login", "register"]) {
    window.localStorage.clear(); const app = application(), { AuthForm } = app.load("app/components/auth/auth-form.tsx");
    let resolve; app.setTransport(() => new Promise(done => { resolve = done; }));
    const target = await mount(() => React.createElement(AuthForm, { mode }));
    try {
      await fill(target, mode);
      if (mode === "login") await act(() => target.container.querySelector('[name="remember"]').click());
      await submit(target); await submit(target);
      assert.equal(app.calls.length, 1); assert.equal(target.container.querySelector("fieldset").disabled, true);
      assert.deepEqual(app.redirects, []);
      const call = app.calls[0]; assert.equal(call.url, "/api/auth/" + mode); assert.equal(call.options.method, "POST");
      assert.equal(call.options.credentials, "same-origin"); assert.equal(call.options.cache, "no-store");
      assert.deepEqual(JSON.parse(call.options.body), { email: alice.email, password: " Secure password! ", ...(mode === "register" ? { name: alice.name } : { remember: true }) });
      await act(async () => resolve(Response.json({ user: alice })));
      assert.deepEqual(app.redirects, ["/dashboard"]); assert.equal(app.refreshes, 1);
      assert.equal(target.container.querySelector('[name="password"]').value, "");
      assert.deepEqual(Object.keys(window.localStorage), ["decode-auth-change-v1"]);
      assert.ok(!window.localStorage.getItem("decode-auth-change-v1").includes(alice.id));
      assert.equal(target.errors.length, 0);
    } finally { await target.dispose(); }
  }
});

test("real auth errors do not navigate and only the designated instructor opens the instructor dashboard", async () => {
  const app = application(), { AuthForm } = app.load("app/components/auth/auth-form.tsx");
  const target = await mount(() => React.createElement(AuthForm, { mode: "login" }));
  try {
    await submit(target); assert.equal(app.calls.length, 0); assert.match(target.container.textContent, /highlighted fields/);
    await fill(target, "login"); app.setTransport(async () => Response.json({ message: "Invalid email or password." }, { status: 401 }));
    await submit(target); assert.match(target.container.textContent, /Invalid email or password/); assert.deepEqual(app.redirects, []);
    assert.equal(target.container.querySelector("fieldset").disabled, false);
    app.setTransport(async () => Response.json({ user: { ...alice, role: "INSTRUCTOR" } }));
    await submit(target); assert.deepEqual(app.redirects, ["/dashboard"]);
    assert.equal(target.errors.length, 0);
  } finally { await target.dispose(); }
  const instructorApp = application(), InstructorForm = instructorApp.load("app/components/auth/auth-form.tsx").AuthForm;
  instructorApp.setTransport(async () => Response.json({ user: instructor }));
  const instructorTarget = await mount(() => React.createElement(InstructorForm, { mode: "login" }));
  try {
    await fill(instructorTarget, "login");
    await input(instructorTarget, '[name="email"]', instructor.email);
    await submit(instructorTarget);
    assert.deepEqual(instructorApp.redirects, ["/instructor"]);
    assert.equal(instructorApp.refreshes, 1);
    assert.equal(instructorTarget.container.querySelector('[name="password"]').value, "");
  } finally { await instructorTarget.dispose(); }
});

test("instructor server guard allows only a verified designated account, in production as well as development", async () => {
  const app = application(), { verifyInstructorSession } = app.load("app/components/auth/server-instructor-session.ts");
  app.setTransport(async () => Response.json({ user: { ...instructor, passwordHash: "private", token: "private" } }));
  assert.deepEqual(plain(await verifyInstructorSession()), { status: "authenticated", user: instructor });
  assert.equal(app.calls[0].options.cache, "no-store");
  assert.deepEqual(plain(app.calls[0].options.headers), { Cookie: "decode_session=" + "a".repeat(64) });
  for (const user of [alice, { ...instructor, role: "STUDENT" }, { ...instructor, email: "someone-else@example.test" }, { ...instructor, role: "ADMIN" }]) {
    app.setTransport(async () => Response.json({ user }));
    assert.equal((await verifyInstructorSession()).status, "forbidden");
  }
  app.setTransport(async () => Response.json({ message: "expired" }, { status: 401 }));
  assert.equal((await verifyInstructorSession()).status, "anonymous");
  app.setTransport(async () => Response.json({ user: { ...instructor, id: null } }));
  assert.equal((await verifyInstructorSession()).status, "unavailable");
  app.setTransport(async () => { throw new Error("Offline"); });
  assert.equal((await verifyInstructorSession()).status, "unavailable");
  app.setCookie("invalid; other=cookie");
  assert.equal((await verifyInstructorSession()).status, "anonymous");
});

test("instructor layout redirects anonymous and student sessions before rendering its unchanged shell", async () => {
  const app = application(), Layout = app.load("app/instructor/layout.tsx").default;
  const shell = Layout({ children: React.createElement("p", null, "Protected instructor content") });
  assert.equal(shell.type, React.Suspense);
  const boundary = shell.props.children;
  app.setTransport(async () => Response.json({ user: instructor }));
  assert.deepEqual(plain((await boundary.type(boundary.props)).props.user), instructor);
  app.setTransport(async () => Response.json({ user: alice }));
  await assert.rejects(() => boundary.type(boundary.props), error => error.redirect === "/dashboard");
  app.setCookie(undefined);
  await assert.rejects(() => boundary.type(boundary.props), error => error.redirect === "/login");
});

test("legacy login success URL forwards verified accounts to their correct dashboard", async () => {
  const app = application(), Page = app.load("app/login/success/page.tsx").default;
  const boundary = Page().props.children.props.children;
  for (const [user, destination] of [[alice, "/dashboard"], [instructor, "/instructor"]]) {
    app.setTransport(async () => Response.json({ user }));
    await assert.rejects(() => boundary.type(), error => error.redirect === destination);
  }
  app.setCookie(undefined);
  await assert.rejects(() => boundary.type(), error => error.redirect === "/login");
});

test("cached instructor workspaces hide on account change, expiry, and backend outage", async () => {
  for (const scenario of ["student", "expired", "offline"]) {
    const app = application(), { InstructorSessionProvider } = app.load("app/components/instructor/instructor-session-provider.tsx");
    app.setTransport(async () => Response.json({ user: instructor }));
    const target = await mount(() => React.createElement(InstructorSessionProvider, { user: instructor }, React.createElement("p", null, "Existing instructor UI")));
    try {
      const wrapper = () => target.container.querySelector("[data-instructor-session-workspace]");
      assert.equal(wrapper().hidden, false);
      app.setTransport(async () => {
        if (scenario === "offline") throw new Error("Offline");
        return scenario === "expired" ? Response.json({}, { status: 401 }) : Response.json({ user: alice });
      });
      await act(async () => window.dispatchEvent(new window.StorageEvent("storage", { key: "decode-auth-change-v1" })));
      assert.equal(wrapper().hidden, true);
      if (scenario === "offline") {
        assert.deepEqual(app.redirects, []);
        assert.match(target.container.textContent, /Unable to verify your session/);
        app.setTransport(async () => Response.json({ user: instructor }));
        await act(async () => target.container.querySelector("button").click());
        assert.equal(wrapper().hidden, false);
      } else assert.deepEqual(app.redirects, [scenario === "expired" ? "/login" : "/dashboard"]);
    } finally { await target.dispose(); }
  }
});

test("authenticated UUIDs scope local records; old demo progress, drafts, avatars and images are never transferred", async () => {
  window.localStorage.clear(); const app = application();
  const legacy = { ...app.progress.emptyProgress(), lessons: ["html-introduction"], drafts: { "lesson-html-introduction": { html: "Old demo draft", css: "", javascript: "" } } };
  const images = app.load("app/lib/student/workspace-images.ts");
  const oldImage = { id: alice.id, name: "demo.png", data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+k5f8AAAAASUVORK5CYII=" };
  const oldRecords = { "decode-demo-session-v1": '"student"', [app.progress.progressKey("student")]: JSON.stringify(legacy), "decode-profile-v1-student": JSON.stringify({ version: 1, displayName: "Old demo name", avatar: "fox" }), [images.imageStorageKey("student", "lesson-html-introduction")]: JSON.stringify([oldImage]) };
  for (const [key, value] of Object.entries(oldRecords)) window.localStorage.setItem(key, value);
  const target = await mount(app.tree);
  try {
    assert.equal(app.identity.id, alice.id); assert.equal(app.identity.label, alice.name);
    assert.equal(app.snapshot.progress.lessons.length, 0); assert.equal(Object.keys(app.snapshot.progress.drafts).length, 0);
    assert.equal(images.readWorkspaceImages(window.localStorage, alice.id, "lesson-html-introduction").length, 0);
    assert.equal(images.readWorkspaceImages(window.localStorage, "student", "lesson-html-introduction").length, 1);
    await input(target, '[aria-label="Code draft"]', "Alice saved code"); await click(target, "Save local code");
    const savedAlice = window.localStorage.getItem(app.progress.progressKey(alice.id));
    app.setUser(bob); await act(async () => window.dispatchEvent(new window.Event("focus")));
    assert.equal(app.identity.id, bob.id); assert.equal(app.identity.label, bob.name);
    assert.equal(Object.keys(app.snapshot.progress.drafts).length, 0);
    await input(target, '[aria-label="Code draft"]', "Bob saved code"); await click(target, "Save local code");
    assert.equal(window.localStorage.getItem(app.progress.progressKey(alice.id)), savedAlice);
    assert.equal(JSON.parse(window.localStorage.getItem(app.progress.progressKey(bob.id))).drafts["lesson-html-introduction"].html, "Bob saved code");
    app.setUser(alice); await act(async () => window.dispatchEvent(new window.Event("pageshow")));
    assert.equal(app.snapshot.progress.drafts["lesson-html-introduction"].html, "Alice saved code");
    for (const [key, value] of Object.entries(oldRecords)) assert.equal(window.localStorage.getItem(key), value);
    for (const call of app.calls) { assert.equal(call.url, "/api/auth/me?scope=student"); assert.equal(call.options.credentials, "same-origin"); assert.equal(call.options.cache, "no-store"); }
    assert.equal(target.errors.length, 0);
  } finally { await target.dispose(); }
});

test("session rechecks preserve unsaved workspace state across cached Activity restoration and recoverable outages", async () => {
  window.localStorage.clear(); const app = application(), target = await mount(app.tree);
  try {
    await input(target, '[aria-label="Code draft"]', "Keep this unsaved code");
    await target.render(() => app.tree("hidden"));
    app.setTransport(async () => { throw new Error("Offline"); });
    await target.render(app.tree);
    assert.match(target.container.textContent, /Unable to verify your session/); assert.deepEqual(app.redirects, []);
    assert.equal(workspace(target).closest("[data-student-session-workspace]").hidden, true, "unverified workspace stays hidden");
    assert.equal(workspace(target).closest("[data-student-session-workspace]").hasAttribute("inert"), true);
    app.setTransport(async () => Response.json({ user: alice })); await click(target, "Try again");
    assert.equal(workspace(target).closest("[data-student-session-workspace]").hidden, false);
    assert.equal(target.container.querySelector('[aria-label="Code draft"]').value, "Keep this unsaved code");
    window.history.replaceState(null, "", "/courses"); await target.render();
    assert.equal(target.container.querySelector('[aria-label="Code draft"]').value, "Keep this unsaved code");
    assert.equal(target.errors.length, 0);
  } finally { await target.dispose(); window.history.replaceState(null, "", "/dashboard"); }
});

test("stale responses and forged storage identities cannot replace the latest verified account", async () => {
  window.localStorage.clear(); const app = application(), target = await mount(app.tree), pending = [];
  try {
    app.setTransport(() => new Promise(resolve => pending.push(resolve)));
    await act(() => window.dispatchEvent(new window.Event("focus")));
    await act(() => window.dispatchEvent(new window.StorageEvent("storage", { key: "decode-auth-change-v1", newValue: JSON.stringify({ user: { ...alice, role: "ADMIN" } }) })));
    assert.equal(pending.length, 2);
    await act(async () => pending[1](Response.json({ user: bob })));
    assert.equal(app.identity.id, bob.id);
    await act(async () => pending[0](Response.json({ user: alice })));
    assert.equal(app.identity.id, bob.id); assert.equal(workspace(target).dataset.user, bob.id);
    const count = app.calls.length; await target.dispose();
    await act(() => window.dispatchEvent(new window.Event("focus"))); assert.equal(app.calls.length, count);
  } finally { if (target.container.isConnected) await target.dispose(); }
});

test("a session recheck does not discard results from an already running isolated lab check", async () => {
  window.localStorage.clear(); const app = application(true), target = await mount(app.tree);
  let verified;
  try {
    await click(target, "Check Solution");
    const frame = target.container.querySelector(".student-lab-probes iframe"), source = frame.contentWindow;
    const token = JSON.parse(frame.srcdoc.match(/const input = (.*);/)[1]).token;
    const lab = app.load("app/lib/student/labs.ts").labs["html-heading"];
    app.setTransport(() => new Promise(resolve => { verified = resolve; }));
    await act(() => window.dispatchEvent(new window.Event("focus")));
    const data = { channel: "decode-preview", type: "lab-result", token, requirements: lab.requirements.map(({ id }) => ({ id, passed: true })) };
    await act(() => window.dispatchEvent(new window.MessageEvent("message", { source, data })));
    assert.equal(app.labResults.length, 1, "a temporary auth recheck must not remove the current probe listener");
    await act(async () => verified(Response.json({ user: alice })));
    assert.match(target.container.textContent, /All supported requirements passed/);
  } finally { verified?.(Response.json({ user: alice })); await target.dispose(); }
});

test("client expiry and non-student sessions hide protected content even with an old demo session present", async () => {
  for (const role of [null, "INSTRUCTOR", "ADMIN"]) {
    window.localStorage.clear(); window.localStorage.setItem("decode-demo-session-v1", '"student"');
    const app = application(); app.setTransport(async () => role ? Response.json({ user: { ...alice, role } }) : Response.json({ message: "Expired" }, { status: 401 }));
    const target = await mount(app.tree);
    try {
      assert.equal(workspace(target), null);
      if (role) { assert.match(target.container.textContent, /Student account required/); assert.deepEqual(app.redirects, []); }
      else assert.ok(app.redirects.includes("/login"));
      assert.equal(window.localStorage.getItem("decode-demo-session-v1"), '"student"');
      assert.equal(target.errors.length, 0);
    } finally { await target.dispose(); }
  }
});

test("client verification timeout is fail-closed, retryable, and cleaned up on unmount", async () => {
  window.localStorage.clear(); const app = application(), timers = new Map(); let timerId = -15;
  const setTimer = window.setTimeout, clearTimer = window.clearTimeout;
  window.setTimeout = (callback, delay, ...args) => { if (delay === 15_000) { const id = timerId--; timers.set(id, callback); return id; } return setTimer(callback, delay, ...args); };
  window.clearTimeout = id => { if (timers.has(id)) timers.delete(id); else clearTimer(id); };
  app.setTransport((_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("Aborted")), { once: true })));
  const target = await mount(app.tree);
  try {
    assert.equal(timers.size, 1); await act(async () => [...timers.values()][0]());
    assert.match(target.container.textContent, /Unable to verify your session/); assert.deepEqual(app.redirects, []);
    app.setTransport(async () => Response.json({ user: alice })); await click(target, "Try again");
    assert.equal(workspace(target).dataset.user, alice.id);
    await target.dispose(); assert.equal(timers.size, 0);
  } finally { if (target.container.isConnected) await target.dispose(); window.setTimeout = setTimer; window.clearTimeout = clearTimer; }
});

test("logout uses main's JSON endpoint once, preserves local records, and reports a failure without pretending to sign out", async () => {
  window.localStorage.clear(); const app = application(), target = await mount(app.tree);
  try {
    await click(target, "Save local code"); const saved = window.localStorage.getItem(app.progress.progressKey(alice.id));
    let finish; app.setTransport(() => new Promise(resolve => { finish = resolve; }));
    const buttons = [...target.container.querySelectorAll("button")].filter(button => button.textContent === "Log out");
    await act(() => { buttons[0].click(); buttons[1].click(); });
    const posts = app.calls.filter(call => call.url === "/api/auth/logout?scope=student"); assert.equal(posts.length, 1);
    assert.equal(posts[0].options.method, "POST"); assert.equal(posts[0].options.body, "{}");
    assert.equal(posts[0].options.credentials, "same-origin"); assert.equal(posts[0].options.headers["Content-Type"], "application/json");
    await act(async () => finish(Response.json({ message: "Service unavailable" }, { status: 503 })));
    assert.match(target.container.textContent, /Authentication is temporarily unavailable/); assert.deepEqual(app.redirects, []);
    assert.equal(workspace(target).dataset.user, alice.id);
    app.setTransport(async () => Response.json({ message: "Signed out successfully." }));
    await click(target, "Log out"); assert.equal(workspace(target), null); assert.deepEqual(app.redirects, ["/login"]);
    assert.equal(app.refreshes, 1); assert.equal(window.localStorage.getItem(app.progress.progressKey(alice.id)), saved);
    assert.ok(window.localStorage.getItem("decode-auth-change-v1"));
    assert.equal(target.errors.length, 0);
  } finally { await target.dispose(); }
});
