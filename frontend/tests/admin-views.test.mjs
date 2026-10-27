import test from "node:test";
import assert from "node:assert/strict";
import { application, admin, user, userDetail, instructor, course, courseDetail, analytics, overview, event, page, React, act, window, mount, button, click, value, submit } from "./admin-test-helpers.mjs";

async function mountView(file, exportName) {
  const app = application(), View = app.load(`app/components/admin/${file}.tsx`)[exportName];
  return { app, ...await mount(() => React.createElement(View)) };
}
const field = (node, label) => [...node.querySelectorAll("label")].find(item => item.querySelector("span")?.textContent === label)?.querySelector("input,select,textarea");

test("all eight admin routes render their actual components with real integration-boundary fixtures", async () => {
  for (const route of ["", "/users", "/instructors", "/courses", "/analytics", "/activity", "/settings", "/profile"]) {
    window.history.replaceState(null, "", "/admin" + route);
    const app = application(), Page = app.load(`app/admin${route}/page.tsx`).default;
    const target = await mount(() => React.createElement(Page));
    try { assert.ok(target.node.querySelector("h1"), `Missing heading for ${route}`); assert.equal(target.errors.length, 0); }
    finally { await target.close(); }
  }
});

test("user filters and sort compose server queries, reset pagination, and handle loading, empty and retryable errors", async () => {
  const target = await mountView("users-view", "UsersView"), { app, node } = target;
  try {
    assert.match(node.textContent, /Alex Learner/);
    await value(field(node, "Search users"), "Alex & Taylor"); await value(field(node, "Role"), "STUDENT"); await value(field(node, "Account status"), "active"); await value(field(node, "Sort by"), "name:asc");
    const url = new URL(app.calls.at(-1).url, "http://localhost");
    assert.equal(url.searchParams.get("search"), "Alex & Taylor"); assert.equal(url.searchParams.get("role"), "STUDENT"); assert.equal(url.searchParams.get("status"), "active"); assert.equal(url.searchParams.get("sort"), "name:asc"); assert.equal(url.searchParams.get("page"), "1");
    app.setTransport(async () => Response.json(page([user], { total: 11 })));
    await value(field(node, "Search users"), "Alex"); await click(button(node, "Next")); assert.equal(new URL(app.calls.at(-1).url, "http://localhost").searchParams.get("page"), "2");
    app.setTransport(async () => Response.json(page([]))); await value(field(node, "Search users"), "Missing"); assert.match(node.textContent, /No users found/); assert.match(node.textContent, /0 results/);
    let finish; app.setTransport(() => new Promise(resolve => { finish = resolve; })); await value(field(node, "Search users"), "Pending"); assert.ok(node.querySelector(".adm-loading")); assert.doesNotMatch(node.textContent, /Alex Learner/);
    await act(async () => finish(Response.json({}, { status: 503 }))); assert.match(node.textContent, /temporarily unavailable/);
    app.setTransport(async () => Response.json(page([user]))); await click(button(node, "Try again")); assert.match(node.textContent, /Alex Learner/);
  } finally { await target.close(); }
});

test("user details show server participation and disable unsupported status actions without local changes", async () => {
  const target = await mountView("users-view", "UsersView");
  try {
    await click(button(target.node, "View details")); const dialog = target.node.querySelector("dialog");
    assert.ok(dialog.open); assert.equal(document.activeElement.getAttribute("aria-label"), "Close dialog");
    assert.match(dialog.textContent, /Participating courses/); assert.match(dialog.textContent, /0%/);
    assert.equal(button(dialog, "Suspend user").disabled, true); assert.match(dialog.textContent, /requires backend support|require.*backend support/);
    assert.equal(target.app.calls.filter(call => call.options.method === "PATCH").length, 0);
    await click(dialog.querySelector('[aria-label="Close dialog"]')); assert.equal(target.node.querySelector("dialog"), null);
  } finally { await target.close(); }
});

test("user suspension confirmation is cancellable, preserves errors and succeeds only on confirmed server state", async () => {
  const target = await mountView("users-view", "UsersView"), { app, node } = target;
  try {
    app.setTransport(async (url, options) => {
      if (options.method === "PATCH") return Response.json({ message: "Denied" }, { status: 403 });
      return Response.json(url.includes("/users/user-1") ? { ...userDetail, capabilities: { changeStatus: true } } : page([user]));
    });
    await click(button(node, "View details")); await click(button(node, "Suspend user"));
    let confirm = node.querySelectorAll("dialog")[1]; assert.equal(document.activeElement.textContent, "Cancel");
    await click(button(confirm, "Cancel")); assert.equal(app.calls.filter(c => c.options.method === "PATCH").length, 0);
    await click(button(node, "Suspend user")); confirm = node.querySelectorAll("dialog")[1];
    assert.equal(button(confirm, "Suspend user").disabled, true); await value(confirm.querySelector("textarea"), "Administrative review"); await submit(confirm.querySelector("form"));
    assert.match(confirm.textContent, /not authorized/); assert.doesNotMatch(node.textContent, /server confirmed/);
    app.setTransport(async (_url, options) => Response.json(options.method === "PATCH" ? { ...userDetail, status: "suspended" } : page([{ ...user, status: "suspended" }])));
    await submit(confirm.querySelector("form")); assert.equal(node.querySelectorAll("dialog").length, 0); assert.match(node.textContent, /Account suspended. The server confirmed/);
    assert.equal(JSON.parse(app.calls.find(call => call.options.method === "PATCH").options.body).reason, "Administrative review");
  } finally { await target.close(); }
});

test("self suspension remains disabled even if a backend capability mistakenly permits it", async () => {
  const target = await mountView("users-view", "UsersView");
  try {
    target.app.setTransport(async url => Response.json(url.includes("/users/admin-1") ? { ...userDetail, ...admin, capabilities: { changeStatus: true } } : page([{ ...user, ...admin }])));
    await value(field(target.node, "Search users"), "Morgan");
    await click(button(target.node, "View details")); assert.equal(button(target.node, "Suspend user").disabled, true); assert.match(target.node.textContent, /cannot suspend your own/);
  } finally { await target.close(); }
});

test("reactivation is confirmed by the server and never changes local account status on failure", async () => {
  const target = await mountView("users-view", "UsersView");
  try {
    target.app.setTransport(async (url, options) => Response.json(options.method === "PATCH" ? { ...userDetail, status: "active" } : url.includes("/users/user-1") ? { ...userDetail, status: "suspended", capabilities: { changeStatus: true } } : page([{ ...user, status: "active" }])));
    await click(button(target.node, "View details")); await click(button(target.node, "Reactivate user"));
    const confirm = target.node.querySelectorAll("dialog")[1]; await value(confirm.querySelector("textarea"), "Access review completed"); await submit(confirm.querySelector("form"));
    assert.match(target.node.textContent, /Account reactivated. The server confirmed/);
    const write = target.app.calls.find(call => call.options.method === "PATCH"); assert.equal(JSON.parse(write.options.body).status, "active");
  } finally { await target.close(); }
});

test("instructor management composes filters and details show assigned courses and real publishing records", async () => {
  const target = await mountView("instructors-view", "InstructorsView");
  try {
    assert.equal(button(target.node, "Provision instructor").disabled, true);
    await value(field(target.node, "Search instructors"), "Taylor"); await value(field(target.node, "Account status"), "active"); await value(field(target.node, "Sort by"), "createdAt:desc");
    const url = new URL(target.app.calls.at(-1).url, "http://localhost"); assert.equal(url.searchParams.get("search"), "Taylor"); assert.equal(url.searchParams.get("status"), "active");
    await click(button(target.node, "View details")); const dialog = target.node.querySelector("dialog");
    assert.match(dialog.textContent, /Assigned courses/); assert.match(dialog.textContent, /HTML foundations/); assert.match(dialog.textContent, /Recent publishing activity/);
    assert.equal(target.app.calls.some(call => call.options.method !== "GET"), false);
  } finally { await target.close(); }
});

test("course management applies instructor/status/title filters and inspects curriculum without exposing authoring controls", async () => {
  const target = await mountView("courses-view", "CoursesView");
  try {
    await value(field(target.node, "Search courses"), "HTML"); await value(field(target.node, "Instructor"), instructor.id); await value(field(target.node, "Publication status"), "published");
    const url = new URL(target.app.calls.at(-1).url, "http://localhost"); assert.equal(url.searchParams.get("instructorId"), instructor.id); assert.equal(url.searchParams.get("status"), "published");
    await click(button(target.node, "Review course")); const dialog = target.node.querySelector("dialog");
    assert.match(dialog.textContent, /Getting started/); await click(dialog.querySelector(".adm-module summary")); assert.match(dialog.textContent, /Your first page/);
    assert.match(dialog.textContent, /Quizzes/); assert.equal(button(dialog, "Archive course").disabled, true); assert.equal(dialog.querySelector("textarea"), null);
  } finally { await target.close(); }
});

test("archive and restore requests require explicit confirmation and correct server-returned course state", async () => {
  const target = await mountView("courses-view", "CoursesView"); let archived = false, mismatch = true;
  target.app.setTransport(async (url, options) => {
    if (options.method === "PATCH") {
      const desired = JSON.parse(options.body).archived;
      if (!mismatch) archived = desired;
      return Response.json({ ...courseDetail, status: archived ? "archived" : "published", capabilities: { archive: !archived, restore: archived } });
    }
    return Response.json(url.includes("/courses/html") ? { ...courseDetail, status: archived ? "archived" : "published", capabilities: { archive: !archived, restore: archived } } : page([{ ...course, status: archived ? "archived" : "published" }]));
  });
  try {
    await click(button(target.node, "Review course")); await click(button(target.node, "Archive course"));
    let confirm = target.node.querySelectorAll("dialog")[1]; await value(confirm.querySelector("textarea"), "Course moderation review"); await submit(confirm.querySelector("form"));
    assert.match(confirm.textContent, /did not confirm/); assert.doesNotMatch(target.node.textContent, /server confirmed/);
    mismatch = false; await submit(confirm.querySelector("form")); assert.match(target.node.textContent, /Course archived. The server confirmed/);
    await click(button(target.node, "Review course")); await click(button(target.node, "Restore course")); confirm = target.node.querySelectorAll("dialog")[1];
    await value(confirm.querySelector("textarea"), "Content review completed"); await submit(confirm.querySelector("form")); assert.match(target.node.textContent, /Course restored. The server confirmed/);
  } finally { await target.close(); }
});

test("analytics composes reporting filters, keeps measured zero distinct from missing metrics and exposes accessible chart data", async () => {
  const target = await mountView("analytics-view", "AnalyticsView");
  try {
    await value(field(target.node, "Reporting period"), "7d"); await value(field(target.node, "Course"), course.id); await value(field(target.node, "Instructor"), instructor.id);
    const url = new URL(target.app.calls.at(-1).url, "http://localhost"); assert.equal(url.searchParams.get("period"), "7d"); assert.equal(url.searchParams.get("courseId"), course.id); assert.equal(url.searchParams.get("instructorId"), instructor.id);
    assert.match(target.node.textContent, /Metric unavailable/); assert.match(target.node.textContent, /No activity in this period/);
    const stats = [...target.node.querySelectorAll(".adm-stat")]; assert.equal(stats.find(item => item.textContent.includes("Lessons Completed")).querySelector("strong").textContent, "0");
    assert.equal(stats.find(item => item.textContent.includes("Average Quiz Score")).querySelector("strong").textContent, "—");
    target.app.setTransport(async () => Response.json({ ...analytics, users: { ...analytics.users, registrations: [{ date: user.createdAt, value: 0 }] } }));
    await value(field(target.node, "Reporting period"), "90d"); const summary = [...target.node.querySelectorAll("summary")].find(item => item.textContent === "View chart data");
    await click(summary); assert.match(summary.parentElement.textContent, /Date \(UTC\)/); assert.doesNotMatch(target.node.innerHTML, /NaN|Infinity/);
  } finally { await target.close(); }
});

test("overview uses real response metrics and registrations, period changes, and meaningful missing-metric states", async () => {
  const target = await mountView("overview-view", "OverviewView");
  try {
    assert.match(target.node.textContent, /Welcome back, Morgan/); assert.equal(target.node.querySelectorAll(".adm-stat").length, 6);
    assert.equal(target.node.querySelector(".adm-stat strong").textContent, "12"); assert.equal(target.node.querySelectorAll(".adm-quick-action").length, 4);
    assert.match(target.node.textContent, /Published an HTML course/); assert.doesNotMatch(target.node.textContent, /\+\d+%/);
    await value(field(target.node, "Reporting period"), "all"); assert.equal(new URL(target.app.calls.at(-1).url, "http://localhost").searchParams.get("period"), "all");
    target.app.setTransport(async () => Response.json({ ...overview, recentActivity: [], courseDistribution: [], registrations: [] }));
    await value(field(target.node, "Reporting period"), "7d"); assert.match(target.node.textContent, /No recorded events/); assert.match(target.node.textContent, /No records to compare/);
  } finally { await target.close(); }
});

test("activity logs apply search/type/UTC dates and reject reversed dates without making another HTTP request", async () => {
  const target = await mountView("activity-view", "ActivityView");
  try {
    assert.match(target.node.textContent, /Published an HTML course/); assert.match(target.node.textContent, /Taylor Instructor/);
    await value(field(target.node, "Search events"), "HTML"); await value(field(target.node, "Event type"), "course.published"); await value(field(target.node, "From (UTC)"), "2026-10-01"); await value(field(target.node, "Through (UTC)"), "2026-10-27");
    const url = new URL(target.app.calls.at(-1).url, "http://localhost"); assert.equal(url.searchParams.get("from"), "2026-10-01"); assert.equal(url.searchParams.get("to"), "2026-10-27"); assert.equal(url.searchParams.get("type"), event.type);
    const before = target.app.calls.length; await value(field(target.node, "From (UTC)"), "2026-11-01"); assert.match(target.node.textContent, /start date must/); assert.equal(target.app.calls.length, before);
    await value(field(target.node, "From (UTC)"), "2026-10-01"); assert.ok(target.node.querySelector("table"));
  } finally { await target.close(); }
});

test("unimplemented endpoints show unavailable states rather than seeded users, courses, audit events or statistics", async () => {
  for (const [file, name] of [["overview-view", "OverviewView"], ["users-view", "UsersView"], ["instructors-view", "InstructorsView"], ["courses-view", "CoursesView"], ["analytics-view", "AnalyticsView"], ["activity-view", "ActivityView"]]) {
    const app = application(); app.setTransport(async () => Response.json({ message: "Missing route" }, { status: 404 }));
    const View = app.load(`app/components/admin/${file}.tsx`)[name], target = await mount(() => React.createElement(View));
    try { assert.match(target.node.textContent, /Awaiting backend integration/); assert.doesNotMatch(target.node.textContent, /Alex Learner|Taylor Instructor|HTML foundations|Published an HTML course/); assert.equal(target.node.querySelectorAll("tbody tr").length, 0); }
    finally { await target.close(); }
  }
});

test("shell navigation, account disclosure, persistent collapse, tooltips, mobile drawer and Escape dismissal work", async () => {
  window.localStorage.clear(); window.history.replaceState(null, "", "/admin");
  const app = application(), { AdminShell } = app.load("app/components/admin/admin-shell.tsx");
  const target = await mount(() => React.createElement(AdminShell, null, React.createElement("p", null, "Page content")));
  try {
    assert.equal(target.node.querySelector('a[href="/admin"][aria-current="page"]').getAttribute("aria-label"), "Dashboard");
    await click(target.node.querySelector('a[aria-label="Users"]')); assert.equal(window.location.pathname, "/admin/users"); assert.equal(target.node.querySelector('a[aria-label="Users"]').getAttribute("aria-current"), "page");
    await click(target.node.querySelector('[aria-label="Collapse sidebar"]')); assert.equal(window.localStorage.getItem("decode-admin-sidebar-collapsed"), "true");
    await act(async () => target.node.querySelector('a[aria-label="Courses"]').focus()); assert.equal(target.node.querySelector('[role="tooltip"]').textContent, "Courses");
    const summary = target.node.querySelector('summary[aria-label="Account menu for Morgan Admin"]'); await click(summary); assert.equal(summary.parentElement.open, true);
    await act(async () => document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }))); assert.equal(summary.parentElement.open, false);
    await click(target.node.querySelector('[aria-label="Open navigation"]')); const dialog = target.node.querySelector("dialog"); assert.ok(dialog.open); assert.equal(dialog.querySelectorAll("nav a").length, 8);
    await act(async () => dialog.dispatchEvent(new window.Event("cancel", { cancelable: true }))); assert.equal(target.node.querySelector("dialog"), null);
    await click(target.node.querySelector('[aria-label="Open navigation"]')); await click(target.node.querySelector('dialog a[href="/admin/courses"]')); assert.equal(target.node.querySelector("dialog"), null); assert.equal(window.location.pathname, "/admin/courses");
  } finally { await target.close(); }
});

test("settings and profile reuse session identity, persist existing theme preference, and disable unsupported account edits", async () => {
  for (const [file, name] of [["settings-view", "SettingsView"], ["profile-view", "ProfileView"]]) {
    const target = await mountView(file, name);
    try {
      assert.match(target.node.textContent, /morgan@example.test/); assert.equal(button(target.node, "Save display name").disabled, true);
      await click(target.node.querySelector('input[name="admin-theme"][value="dark"]')); assert.equal(document.documentElement.dataset.theme, "dark"); assert.equal(window.localStorage.getItem("decode-theme"), "dark");
      const { ThemeToggle } = target.app.load("app/components/theme-toggle.tsx"), toggle = await mount(() => React.createElement(ThemeToggle));
      try { await click(toggle.node.querySelector("button")); assert.equal(document.documentElement.dataset.theme, "light"); assert.equal(target.node.querySelector('input[value="light"]').checked, true); }
      finally { await toggle.close(); }
      assert.equal(target.app.calls.some(call => call.options.method === "PATCH"), false);
    } finally { await target.close(); }
  }
});

test("obsolete management responses cannot replace data for a newer search", async () => {
  const target = await mountView("users-view", "UsersView"), pending = [];
  try {
    target.app.setTransport(() => new Promise(resolve => pending.push(resolve)));
    await value(field(target.node, "Search users"), "Old"); await value(field(target.node, "Search users"), "New");
    await act(async () => pending[1](Response.json(page([{ ...user, name: "New result" }]))));
    await act(async () => pending[0](Response.json(page([{ ...user, name: "Old result" }]))));
    assert.match(target.node.textContent, /New result/); assert.doesNotMatch(target.node.textContent, /Old result/);
  } finally { await target.close(); }
});

test("supported display-name editing reports backend rejection without claiming the profile was saved", async () => {
  const app = application(), View = app.load("app/components/admin/account-preferences.tsx").AccountPreferences;
  app.setTransport(async (_url, options) => options.method === "PATCH" ? Response.json({ message: "Forbidden" }, { status: 403 }) : Response.json({ user: { ...admin, status: "active", createdAt: user.createdAt }, capabilities: { editName: true } }));
  const target = await mount(() => React.createElement(View));
  try {
    await value(field(target.node, "Display name"), "Updated Admin"); await submit(target.node.querySelector("form"));
    assert.match(target.node.textContent, /not authorized/); assert.doesNotMatch(target.node.textContent, /saved successfully/);
    assert.equal(JSON.parse(app.calls.find(call => call.options.method === "PATCH").options.body).name, "Updated Admin");
  } finally { await target.close(); }
});

test("admin data requests remain disabled before client session verification", async () => {
  const app = application(); app.setReady(false);
  const View = app.load("app/components/admin/users-view.tsx").UsersView, target = await mount(() => React.createElement(View));
  try { assert.equal(app.calls.length, 0); assert.ok(target.node.querySelector(".adm-loading")); }
  finally { await target.close(); }
});
