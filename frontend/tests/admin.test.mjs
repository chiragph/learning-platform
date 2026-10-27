import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { application, admin, user, instructor, userDetail, page, plain, React, act, window, mount, button, click } from "./admin-test-helpers.mjs";

test("admin navigation is role-based and preserves student and designated instructor homes", () => {
  const { accountHome, instructorAccessAllowed } = application().load("app/lib/instructor/access.ts");
  assert.equal(accountHome(admin), "/admin"); assert.equal(accountHome(user), "/dashboard");
  assert.equal(accountHome(instructor), "/instructor"); assert.equal(instructorAccessAllowed(admin), false);
  assert.equal(accountHome({ ...instructor, email: "someone@example.test" }), "/dashboard");
});

test("admin session parsing accepts only verified ADMIN and strips private fields", async () => {
  const { adminSessionResponse } = application().load("app/components/auth/admin-session.ts");
  assert.deepEqual(plain(await adminSessionResponse(Response.json({ user: { ...admin, passwordHash: "private", token: "private" } }))), { status: "authenticated", user: admin });
  for (const [account, destination] of [[user, "/dashboard"], [instructor, "/instructor"]]) assert.deepEqual(plain(await adminSessionResponse(Response.json({ user: account }))), { status: "forbidden", destination });
  assert.equal((await adminSessionResponse(new Response(null, { status: 401 }))).status, "anonymous");
  for (const response of [new Response(null, { status: 500 }), new Response(null, { status: 403 }), Response.json({ user: { ...admin, role: "ROOT" } }), Response.json({ user: { ...admin, id: "" } }), Response.json({ user: { ...admin, name: " " } }), new Response("not-json")]) assert.equal((await adminSessionResponse(response)).status, "unavailable");
});

test("server guard prefers admin cookie, rejects invalid scoped cookies, forwards no unrelated cookies and fails closed", async () => {
  const app = application(), { verifyAdminSession } = app.load("app/components/auth/server-admin-session.ts");
  app.setRoleCookie("b".repeat(64));
  assert.equal((await verifyAdminSession()).status, "authenticated");
  assert.equal(app.calls[0].url, "http://backend.test/api/auth/me?scope=admin");
  assert.equal(app.calls[0].options.headers.Cookie, "decode_admin_session=" + "b".repeat(64));
  assert.equal(app.calls[0].options.cache, "no-store");
  app.setRoleCookie("invalid; forged=cookie"); const before = app.calls.length;
  assert.equal((await verifyAdminSession()).status, "anonymous"); assert.equal(app.calls.length, before);
  app.setRoleCookie(undefined); await verifyAdminSession(); assert.equal(app.calls.at(-1).options.headers.Cookie, "decode_session=" + "a".repeat(64));
  app.setTransport(async () => { throw new Error("Offline"); }); assert.equal((await verifyAdminSession()).status, "unavailable");
  app.setTransport(async () => Response.json({ message: "Choose a valid session scope." }, { status: 400 })); assert.equal((await verifyAdminSession()).status, "unavailable");
  app.setCookie(undefined); assert.equal((await verifyAdminSession()).status, "anonymous");
});

test("admin layout keeps the child route in the render tree without waiting on session availability", () => {
  const app = application({ realProvider: true }), Layout = app.load("app/admin/layout.tsx").default;
  const segment = React.createElement("main", { "data-route-segment": "/admin/page.tsx" });
  app.setTransport(async () => Response.json({}, { status: 503 }));
  assert.equal(Layout({ children: segment }), segment, "The layout must forward its page segment; the page owns the server access check.");
  assert.equal(app.calls.length, 0, "Layout rendering must not depend on the auth backend.");
});

test("admin workspace protects page content before shell rendering and keeps outages distinct from anonymous sessions", async () => {
  const app = application({ realProvider: true }), { AdminWorkspace } = app.load("app/components/admin/admin-workspace.tsx");
  const shell = AdminWorkspace({ children: "Protected data" }); assert.equal(shell.type, React.Suspense);
  const boundary = shell.props.children;
  assert.equal((await boundary.type(boundary.props)).props.user.role, "ADMIN");
  for (const [account, destination] of [[user, "/dashboard"], [instructor, "/instructor"]]) {
    app.setTransport(async () => Response.json({ user: account }));
    await assert.rejects(() => boundary.type(boundary.props), e => e.redirect === destination);
  }
  app.setTransport(async () => Response.json({}, { status: 503 })); const notice = await boundary.type(boundary.props);
  assert.equal(notice.props.role, "alert"); assert.ok(!JSON.stringify(notice).includes("Protected data"));
  app.setCookie(undefined); await assert.rejects(() => boundary.type(boundary.props), e => e.redirect === "/login");
});

test("every admin page reaches its own Suspense-covered server guard and denies non-admin or unavailable sessions", async () => {
  const app = application({ realProvider: true }), Layout = app.load("app/admin/layout.tsx").default;
  const { AdminWorkspace } = app.load("app/components/admin/admin-workspace.tsx");
  const pages = fs.readdirSync("app/admin", { recursive: true }).filter(file => path.basename(file) === "page.tsx");
  assert.equal(pages.length, 8);
  for (const file of pages) {
    const route = app.load(path.join("app/admin", file)), segment = route.default();
    assert.notEqual(route.instant, false, `${file} must retain instant-navigation validation`);
    assert.equal(Layout({ children: segment }), segment);
    assert.equal(segment.type, AdminWorkspace, `${file} must enforce the shared server guard`);
    const shell = segment.type(segment.props); assert.equal(shell.type, React.Suspense);
    assert.match(shell.props.fallback.props.children, /Checking your admin session/);
    const boundary = shell.props.children;
    app.setCookie(undefined);
    await assert.rejects(() => boundary.type(boundary.props), e => e.redirect === "/login");
    app.setCookie("a".repeat(64));
    for (const [account, destination] of [[user, "/dashboard"], [instructor, "/instructor"]]) {
      app.setTransport(async () => Response.json({ user: account }));
      await assert.rejects(() => boundary.type(boundary.props), e => e.redirect === destination);
    }
    app.setTransport(async () => Response.json({}, { status: 503 }));
    const notice = await boundary.type(boundary.props);
    assert.equal(notice.type, "main"); assert.equal(notice.props.role, "alert");
    assert.match(JSON.stringify(notice), /Unable to verify admin access/);
    assert.ok(!JSON.stringify(notice).includes("AdminShell"));
    app.setTransport(async () => Response.json({ user: admin }));
    const allowed = await boundary.type(boundary.props);
    assert.deepEqual(plain(allowed.props.user), admin);
    assert.equal(allowed.props.children.type.name, "AdminShell");
    assert.equal(allowed.props.children.props.children, segment.props.children);
  }
});

test("typed admin transport uses real no-store credentialed HTTP and composes encoded server-side filters", async () => {
  const app = application(), { adminApi, queryString } = app.load("app/lib/admin/api.ts");
  const result = await adminApi.users({ page: 2, pageSize: 10, search: "Alex & Taylor", role: "STUDENT", status: "active", sort: "name:asc" }, new AbortController().signal);
  assert.equal(result.items[0].id, user.id);
  const url = new URL(app.calls[0].url, "http://localhost");
  assert.equal(url.searchParams.get("search"), "Alex & Taylor"); assert.equal(url.searchParams.get("page"), "2"); assert.equal(url.searchParams.get("sort"), "name:asc");
  assert.equal(app.calls[0].options.method, "GET"); assert.equal(app.calls[0].options.credentials, "same-origin"); assert.equal(app.calls[0].options.cache, "no-store");
  assert.equal(queryString({ search: "", status: undefined, page: 1 }), "?page=1");
});

test("missing APIs, expired sessions, denied permissions, missing records and invalid payloads never become fake data", async () => {
  const app = application(), { adminApi } = app.load("app/lib/admin/api.ts"), signal = new AbortController().signal;
  for (const [status, kind] of [[401, "unauthorized"], [403, "forbidden"], [404, "unavailable"], [501, "unavailable"], [409, "conflict"], [503, "error"]]) {
    app.setTransport(async () => Response.json({ message: "Backend response" }, { status }));
    await assert.rejects(() => adminApi.users({ page: 1, pageSize: 10 }, signal), e => e.kind === kind);
  }
  app.setTransport(async () => Response.json({ message: "Record not found" }, { status: 404 }));
  await assert.rejects(() => adminApi.user("missing", signal), e => e.kind === "not-found");
  app.setTransport(async () => Response.json({ message: "Cannot GET /api/admin/users/missing" }, { status: 404 }));
  await assert.rejects(() => adminApi.user("missing", signal), e => e.kind === "unavailable");
  for (const data of [null, {}, page([{ ...user, status: "enabled" }]), page([user], { total: -1 }), page([user], { page: 0 }), { ...userDetail, capabilities: undefined }]) {
    app.setTransport(async () => Response.json(data));
    await assert.rejects(() => adminApi.users({ page: 1, pageSize: 10 }, signal), e => e.kind === "error");
  }
  app.setTransport(async () => { throw new Error("Offline"); });
  await assert.rejects(() => adminApi.overview({ period: "30d" }, signal), /Unable to reach/);
});

test("sensitive API calls send reason and desired state and require full server confirmation", async () => {
  const app = application(), { adminApi } = app.load("app/lib/admin/api.ts");
  app.setTransport(async () => Response.json({ ...userDetail, status: "suspended" }));
  const result = await adminApi.setUserStatus(user.id, "suspended", "Review completed", new AbortController().signal);
  assert.equal(result.status, "suspended"); assert.equal(app.calls[0].options.method, "PATCH");
  assert.deepEqual(JSON.parse(app.calls[0].options.body), { status: "suspended", reason: "Review completed" });
  app.setTransport(async () => Response.json({ success: true }));
  await assert.rejects(() => adminApi.setUserStatus(user.id, "active", "Restore access", new AbortController().signal), /incomplete or invalid/);
});

test("runtime contracts reject fabricated percentages, unknown event types, and missing capability fields", () => {
  const contracts = application().load("app/lib/admin/contracts.ts");
  assert.equal(contracts.isUserDetail(userDetail), true);
  assert.equal(contracts.isUserDetail({ ...userDetail, participation: { ...userDetail.participation, completionRate: 120 } }), false);
  assert.equal(contracts.isUserDetail({ ...userDetail, capabilities: {} }), false);
  assert.equal(contracts.isEvent({ id: "x", type: "frontend.fake" }), false);
});

test("detail APIs reject a response for a different resource before any management action is displayed", async () => {
  const app = application(), { adminApi } = app.load("app/lib/admin/api.ts");
  app.setTransport(async () => Response.json({ ...userDetail, id: "another-user" }));
  await assert.rejects(() => adminApi.user(user.id, new AbortController().signal), /incomplete or invalid/);
});

test("late session responses cannot revoke a more recent verified admin session", async () => {
  const app = application({ realProvider: true }), { AdminProvider } = app.load("app/components/admin/admin-provider.tsx");
  const target = await mount(() => React.createElement(AdminProvider, { user: admin }, React.createElement("p", null, "Admin workspace"))), pending = [];
  try {
    app.setTransport(() => new Promise(resolve => pending.push(resolve)));
    await act(async () => window.dispatchEvent(new window.Event("focus")));
    await act(async () => window.dispatchEvent(new window.StorageEvent("storage", { key: "decode-auth-change-v1" })));
    await act(async () => pending[1](Response.json({ user: admin })));
    await act(async () => pending[0](Response.json({ user })));
    assert.equal(target.node.querySelector("[data-admin-session-workspace]").hidden, false); assert.deepEqual(app.redirects, []);
  } finally { await target.close(); }
});

test("session verification timeout fails closed with a working retry and releases its timer on unmount", async () => {
  const app = application({ realProvider: true }), { AdminProvider } = app.load("app/components/admin/admin-provider.tsx");
  const timers = new Map(), setTimer = window.setTimeout, clearTimer = window.clearTimeout;
  let next = -1;
  window.setTimeout = (fn, delay, ...args) => { if (delay === 15000) { const id = next--; timers.set(id, fn); return id; } return setTimer(fn, delay, ...args); };
  window.clearTimeout = id => timers.has(id) ? timers.delete(id) : clearTimer(id);
  app.setTransport((_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(new Error("Aborted")), { once: true })));
  const target = await mount(() => React.createElement(AdminProvider, { user: admin }, "Admin content"));
  try {
    assert.equal(timers.size, 1); await act(async () => [...timers.values()][0]());
    assert.match(target.node.textContent, /Unable to verify admin access/); assert.equal(target.node.querySelector("[data-admin-session-workspace]").hidden, true);
    app.setTransport(async () => Response.json({ user: admin })); await click(button(target.node, "Try again")); assert.equal(target.node.querySelector("[data-admin-session-workspace]").hidden, false);
    await target.close(); assert.equal(timers.size, 0);
  } finally { if (target.node.isConnected) await target.close(); window.setTimeout = setTimer; window.clearTimeout = clearTimer; }
});

test("client admin provider hides cached content on role changes, expiry, and outage and recovers only after verification", async () => {
  for (const scenario of ["student", "instructor", "expired", "offline"]) {
    const app = application({ realProvider: true }), { AdminProvider } = app.load("app/components/admin/admin-provider.tsx");
    const target = await mount(() => React.createElement(AdminProvider, { user: admin }, React.createElement("p", null, "Sensitive admin content")));
    try {
      const wrapper = () => target.node.querySelector("[data-admin-session-workspace]");
      assert.equal(wrapper().hidden, false);
      app.setTransport(async () => {
        if (scenario === "offline") throw new Error("Offline");
        if (scenario === "expired") return Response.json({}, { status: 401 });
        return Response.json({ user: scenario === "student" ? user : instructor });
      });
      await act(async () => window.dispatchEvent(new window.StorageEvent("storage", { key: "decode-auth-change-v1", newValue: JSON.stringify({ user: admin }) })));
      assert.equal(wrapper().hidden, true); assert.equal(wrapper().hasAttribute("inert"), true);
      if (scenario === "offline") {
        assert.deepEqual(app.redirects, []); assert.match(target.node.textContent, /Unable to verify admin access/);
        app.setTransport(async () => Response.json({ user: admin })); await click(button(target.node, "Try again")); assert.equal(wrapper().hidden, false);
      } else assert.deepEqual(app.redirects, [scenario === "expired" ? "/login" : scenario === "student" ? "/dashboard" : "/instructor"]);
    } finally { await target.close(); }
  }
});

test("admin logout is deduplicated, reports real failures, and navigates only after server success", async () => {
  const app = application({ realProvider: true }), { AdminProvider, AdminLogout } = app.load("app/components/admin/admin-provider.tsx");
  const target = await mount(() => React.createElement(AdminProvider, { user: admin }, React.createElement(AdminLogout)));
  try {
    let finish; app.setTransport(() => new Promise(resolve => { finish = resolve; }));
    await act(async () => { button(target.node, "Sign out").click(); button(target.node, "Sign out")?.click(); });
    assert.equal(app.calls.filter(call => call.url.includes("logout")).length, 1);
    assert.equal(app.calls.at(-1).url, "/api/auth/logout?scope=admin"); assert.equal(app.calls.at(-1).options.body, "{}");
    await act(async () => finish(Response.json({ message: "Offline" }, { status: 503 }))); assert.deepEqual(app.redirects, []);
    app.setTransport(async () => Response.json({ message: "Signed out." })); await click(button(target.node, "Sign out"));
    assert.deepEqual(app.redirects, ["/login"]); assert.equal(app.refreshes, 1); assert.equal(target.node.querySelector("[data-admin-session-workspace]").hidden, true);
  } finally { await target.close(); }
});

test("ADMIN sign-in and legacy success route navigate to admin, with a document fallback for interrupted login navigation", async () => {
  const app = application(), { AuthForm } = app.load("app/components/auth/auth-form.tsx");
  const { value, submit } = await import("./admin-test-helpers.mjs");
  const timers = new Map(), setTimer = window.setTimeout, clearTimer = window.clearTimeout;
  window.setTimeout = (fn, delay, ...args) => delay === 1500 ? (timers.set(-1, fn), -1) : setTimer(fn, delay, ...args);
  window.clearTimeout = id => id === -1 ? timers.delete(id) : clearTimer(id);
  const target = await mount(() => React.createElement(AuthForm, { mode: "login" }));
  try {
    await value(target.node.querySelector('[name="email"]'), admin.email); await value(target.node.querySelector('[name="password"]'), "Strong password!");
    await submit(target.node.querySelector("form")); assert.deepEqual(app.redirects, ["/admin"]); assert.equal(timers.size, 1);
    const Page = app.load("app/login/success/page.tsx").default, boundary = Page().props.children.props.children;
    await assert.rejects(() => boundary.type(), e => e.redirect === "/admin");
    await target.close(); assert.equal(timers.size, 0);
  } finally { if (target.node.isConnected) await target.close(); window.setTimeout = setTimer; window.clearTimeout = clearTimer; }
});
