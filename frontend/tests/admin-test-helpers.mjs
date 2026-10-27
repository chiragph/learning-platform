// Isolated fixtures for automated tests only. None are imported by application code.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import React, { act } from "react";
import { JSDOM } from "jsdom";
import ts from "typescript";

export const dom = new JSDOM("<!doctype html><body></body>", { url: "http://localhost/admin", pretendToBeVisual: true });
export const { window } = dom;
Object.assign(globalThis, { window, document: window.document, IS_REACT_ACT_ENVIRONMENT: true });
window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
window.HTMLDialogElement.prototype.close = function () { this.open = false; };
window.matchMedia = query => ({ matches: query === "(min-width: 761px)", addEventListener() {}, removeEventListener() {} });
const { createRoot } = await import("react-dom/client");
const dependency = createRequire(import.meta.url);
export const admin = { id: "admin-1", name: "Morgan Admin", email: "morgan@example.test", role: "ADMIN" };
export const user = { id: "user-1", name: "Alex Learner", email: "alex@example.test", role: "STUDENT", status: "active", createdAt: "2026-10-01T09:00:00.000Z" };
export const instructor = { id: "instructor-1", name: "Taylor Instructor", email: "decode.instructor@gmail.com", role: "INSTRUCTOR", status: "active", createdAt: user.createdAt, publishedCourses: 1, draftCourses: 0, activeStudents: null };
export const course = { id: "html", title: "HTML foundations", description: "Build semantic web pages.", instructor: { id: instructor.id, name: instructor.name, email: instructor.email }, moduleCount: 1, activityCount: 2, status: "published", updatedAt: user.createdAt, publishedAt: user.createdAt };
export const userDetail = { ...user, participation: { courses: 1, completedCourses: 0, completedActivities: 2, completionRate: 0 }, capabilities: { changeStatus: false } };
export const courseDetail = { ...course, modules: [{ id: "module-1", title: "Getting started", activities: [{ id: "theory-1", title: "Your first page", type: "theory" }, { id: "quiz-1", title: "HTML review", type: "quiz" }] }], participation: { learners: null, completed: null, completionRate: null }, capabilities: { archive: false, restore: false } };
export const event = { id: "event-1", type: "course.published", actor: course.instructor, target: { id: "html", label: course.title, kind: "course" }, description: "Published an HTML course.", createdAt: user.createdAt };
export const overview = { generatedAt: user.createdAt, metrics: { students: 12, instructors: 1, courses: 1, publishedCourses: 1, activeLearners: null, completionRate: null }, registrations: [{ date: user.createdAt, value: 0 }], learningActivity: null, courseDistribution: [{ status: "published", count: 1 }], recentActivity: [event] };
export const analytics = { generatedAt: user.createdAt, users: { byRole: [{ role: "STUDENT", count: 12 }], active: null, registrations: [] }, learning: { participants: 0, lessonsCompleted: 0, courseCompletionRate: null, averageQuizScore: null, labsCompleted: null, activity: [] }, workshops: { total: 0, pending: 0, approved: 0, changesRequested: 0 } };
export const page = (items, options = {}) => ({ items, page: 1, pageSize: 10, total: items.length, ...options });
export const plain = value => JSON.parse(JSON.stringify(value));

export function application({ realProvider = false } = {}) {
  const calls = [], redirects = [], cache = new Map();
  let refreshes = 0, cookie = "a".repeat(64), roleCookie, ready = true;
  let transport = async url => {
    if (url.includes("/auth/")) return Response.json(url.includes("logout") ? { message: "Signed out." } : { user: admin });
    const pathname = new URL(url, "http://localhost").pathname;
    const data = {
      "/api/admin/overview": overview, "/api/admin/users": page([user]), "/api/admin/users/user-1": userDetail,
      "/api/admin/instructors": page([instructor]), "/api/admin/instructors/instructor-1": { ...instructor, courses: [course], recentPublications: [{ courseId: course.id, title: course.title, publishedAt: course.publishedAt }] },
      "/api/admin/courses": page([course]), "/api/admin/courses/html": courseDetail, "/api/admin/analytics": analytics,
      "/api/admin/activity": page([event]), "/api/admin/filter-options": { courses: [{ id: course.id, label: course.title }], instructors: [{ id: instructor.id, label: instructor.name }] },
      "/api/admin/settings": { uploadLimitBytes: null, accountPolicy: null },
      "/api/admin/account": { user: { ...admin, status: "active", createdAt: user.createdAt }, capabilities: { editName: false } },
    }[pathname];
    return data ? Response.json(data) : Response.json({ statusCode: 404, message: "Cannot GET " + pathname }, { status: 404 });
  };
  const router = { replace: href => redirects.push(href), refresh: () => refreshes++, push: href => redirects.push(href) };
  const mockProvider = { useAdmin: () => ({ user: admin, ready, logout: async () => {}, signingOut: false, logoutError: "" }), AdminLogout: () => React.createElement("button", null, "Sign out") };
  async function fetch(url, options = {}) { calls.push({ url, options }); return transport(url, options); }
  function load(file) {
    file = path.resolve(file); if (cache.has(file)) return cache.get(file).exports;
    const compiled = { exports: {} }; cache.set(file, compiled);
    const source = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    function require(specifier) {
      if (specifier === "server-only" || specifier.endsWith(".css")) return {};
      if (specifier === "./animated-owl") return { AnimatedOwl: () => null };
      if (specifier === "next/link") return { __esModule: true, default: ({ href, children, onClick, ...props }) => React.createElement("a", { href, ...props, onClick: e => { e.preventDefault(); onClick?.(e); window.history.pushState(null, "", href); window.dispatchEvent(new window.PopStateEvent("popstate")); } }, children) };
      if (specifier === "next/headers") return { cookies: async () => ({ get: name => { const value = name === "decode_session" ? cookie : name === "decode_admin_session" ? roleCookie : undefined; return value === undefined ? undefined : { value }; } }) };
      if (specifier === "next/navigation") return { usePathname: () => React.useSyncExternalStore(listener => { window.addEventListener("popstate", listener); return () => window.removeEventListener("popstate", listener); }, () => window.location.pathname, () => "/admin"), useRouter: () => router, redirect: href => { throw Object.assign(new Error("Redirect " + href), { redirect: href }); } };
      const base = specifier.startsWith("@/") ? path.resolve(specifier.slice(2)) : path.resolve(path.dirname(file), specifier);
      // View tests exercise browser components below the server guard. Separate
      // realProvider tests execute the actual guard for every route and role.
      if (!realProvider && /[/\\]admin-workspace$/.test(base)) return { AdminWorkspace: ({ children }) => children };
      if (!realProvider && /[/\\]admin-provider$/.test(base)) return mockProvider;
      if (!specifier.startsWith(".") && !specifier.startsWith("@/")) return dependency(specifier);
      return load([base + ".ts", base + ".tsx"].find(fs.existsSync));
    }
    vm.runInNewContext(source, { module: compiled, exports: compiled.exports, require, fetch, console, window, document: window.document, localStorage: window.localStorage, MutationObserver: window.MutationObserver, Element: window.Element, Event: window.Event, Error, Response, URL, URLSearchParams, AbortController, AbortSignal, crypto: globalThis.crypto, requestAnimationFrame: callback => setTimeout(callback, 0), process: { env: { NODE_ENV: "test", API_URL: "http://backend.test" } } }, { filename: file });
    return compiled.exports;
  }
  return { load, calls, redirects, get refreshes() { return refreshes; }, setTransport: value => { transport = value; }, setCookie: value => { cookie = value; }, setRoleCookie: value => { roleCookie = value; }, setReady: value => { ready = value; } };
}
export async function mount(tree) {
  const node = document.createElement("div"); document.body.append(node);
  const errors = [], root = createRoot(node, { onUncaughtError: e => errors.push(e), onRecoverableError: e => errors.push(e) });
  await act(async () => root.render(tree()));
  return { node, errors, async render(next = tree) { await act(async () => root.render(next())); }, async close() { await act(async () => root.unmount()); node.remove(); assertNoErrors(errors); } };
}
function assertNoErrors(errors) { if (errors.length) throw errors[0]; }
export const button = (node, label) => [...node.querySelectorAll("button")].find(item => item.textContent.trim() === label);
export async function click(node) { if (!node) throw new Error("Missing actionable element"); await act(async () => node.click()); }
export async function value(node, text) {
  if (!node) throw new Error("Missing input");
  const proto = node.tagName === "SELECT" ? window.HTMLSelectElement.prototype : node.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  await act(async () => { Object.getOwnPropertyDescriptor(proto, "value").set.call(node, text); node.dispatchEvent(new window.Event(node.tagName === "SELECT" ? "change" : "input", { bubbles: true })); });
}
export async function submit(node) { await act(async () => node.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }))); }
export { React, act };
