import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import React, { act, StrictMode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import ts from "typescript";

const dom = new JSDOM("<!doctype html><body></body>", { url:"http://localhost/instructor", pretendToBeVisual:true }), { window } = dom;
Object.assign(globalThis, { window, document:window.document, IS_REACT_ACT_ENVIRONMENT:true });
window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
window.HTMLDialogElement.prototype.close = function () { this.open = false; };
window.matchMedia = () => ({ matches:false });
const { createRoot } = await import("react-dom/client"), dependency = createRequire(import.meta.url);
function application({ pathname = () => window.location.pathname } = {}) {
  const cache = new Map();
  function load(file) {
    file = path.resolve(file); if (cache.has(file)) return cache.get(file).exports;
    const compiled = { exports:{} }; cache.set(file,compiled);
    const source = ts.transpileModule(fs.readFileSync(file,"utf8"), { compilerOptions:{ jsx:ts.JsxEmit.ReactJSX, module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022, esModuleInterop:true } }).outputText;
    function require(specifier) {
      if (specifier.endsWith(".css")) return {};
      if (specifier === "next/link") return { __esModule:true, default:({ href,children,...props }) => React.createElement("a",{ href,...props },children) };
      if (specifier === "next/navigation") return { usePathname:pathname, useSearchParams:() => new URLSearchParams(window.location.search), useRouter:() => ({ push() {} }) };
      if (!specifier.startsWith(".") && !specifier.startsWith("@/")) return dependency(specifier);
      const base = specifier.startsWith("@/") ? path.resolve(specifier.slice(2)) : path.resolve(path.dirname(file),specifier);
      return load([base + ".ts",base + ".tsx"].find(fs.existsSync));
    }
    vm.runInNewContext(source,{ module:compiled,exports:compiled.exports,require,window,document,console,Error,localStorage:window.localStorage,FormData:window.FormData,Element:window.Element,structuredClone,URLSearchParams,crypto:globalThis.crypto },{ filename:file });
    return compiled.exports;
  }
  const { InstructorProvider } = load("app/components/instructor/instructor-provider.tsx");
  return { load, tree:(View,props) => React.createElement(StrictMode,null,React.createElement(InstructorProvider,null,React.createElement(View,props))) };
}
async function mount(name,exportName,props,storedState) {
  window.localStorage.clear(); window.history.replaceState(null,"","/instructor");
  if (storedState) window.localStorage.setItem("decode-instructor-preview-v1",JSON.stringify(storedState));
  const app = application(), node = document.createElement("div"); document.body.append(node); const root = createRoot(node);
  await act(async () => root.render(app.tree(app.load(`app/components/instructor/${name}.tsx`)[exportName],props)));
  return { app,node,async close() { await act(async () => root.unmount()); node.remove(); } };
}
const button = (root,text) => [...root.querySelectorAll("button")].find(b => b.textContent.trim().replace(/^＋\s*/, "") === text);
async function click(node) { assert.ok(node,"Expected an actionable element"); await act(async () => node.click()); }
async function value(node,text) {
  assert.ok(node,"Expected a field");
  await act(async () => { const proto = node.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : node.tagName === "SELECT" ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto,"value").set.call(node,text); node.dispatchEvent(new window.Event(node.tagName === "SELECT" ? "change" : "input",{ bubbles:true })); });
}
async function submit(root) { await act(async () => root.querySelector("form").dispatchEvent(new window.Event("submit",{ bubbles:true,cancelable:true }))); }
async function details(root,label) { const summary = root.querySelector(`summary[aria-label="${label}"]`); await click(summary); return summary.parentElement; }
function deletionFixture() {
  const repo = application().load("app/lib/instructor/repository.ts"); let state = repo.seedInstructorState();
  function run(command) { const result = repo.applyInstructorCommand(state,command); state = result.state; return result.id; }
  const courseId = run({ type:"course.create",id:"local-draft",fields:{ title:"Local draft course",description:"Local test content",category:"Web development",difficulty:"Beginner",duration:"1 hour",objectives:["Practice"],color:"blue",icon:"code" } });
  const moduleId = run({ type:"module.create",courseId,title:"Local draft module",description:"Draft sequence" });
  const activityId = run({ type:"activity.create",courseId,moduleId,activityType:"theory",title:"Local draft theory",description:"Draft record" });
  run({ type:"activity.create",courseId,moduleId,activityType:"lab",title:"Local draft lab",description:"Draft practice" });
  return { state,courseId,moduleId,activityId };
}

test("server loading state renders the child route for Next segment validation while hiding seed content", () => {
  const app = application(), View = app.load("app/components/instructor/courses-view.tsx").CoursesView;
  const markup = JSDOM.fragment(renderToStaticMarkup(app.tree(View)));
  assert.match(markup.querySelector('[role="status"]').textContent,/Opening your local/);
  assert.equal(markup.querySelectorAll('[hidden] .ins-course-card').length,3);
  assert.ok([...markup.querySelectorAll('[hidden] button')].filter(b => b.textContent.includes("Create Course")).every(b => b.disabled));
});

test("course UI creates a validated draft, searches, prevents duplicates and persists through provider remount", async () => {
  const page = await mount("courses-view","CoursesView");
  try {
    assert.equal(page.node.querySelectorAll(".ins-course-card").length,3);
    await click(button(page.node,"Create Course")); assert.equal(document.activeElement.name,"title");
    await value(page.node.querySelector('[name="title"]'),"Web accessibility"); assert.equal(page.node.querySelector('[name="id"]').value,"web-accessibility");
    for (const [name,text] of Object.entries({ description:"Build inclusive interfaces",category:"Web development",duration:"4 hours",objectives:"Build a labeled form\nTest keyboard navigation" })) await value(page.node.querySelector(`[name="${name}"]`),text);
    await value(page.node.querySelector('[name="id"]'),"html"); await submit(page.node); assert.match(page.node.querySelector("dialog").textContent,/already in use/);
    await value(page.node.querySelector('[name="id"]'),"web-accessibility"); await submit(page.node); assert.equal(page.node.querySelector("dialog"),null); assert.equal(page.node.querySelectorAll(".ins-course-card").length,4);
    const raw = window.localStorage.getItem("decode-instructor-preview-v1"); assert.equal(JSON.parse(raw).courses.at(-1).status,"draft");
    await value(page.node.querySelector('[type="search"]'),"accessibility"); assert.equal(page.node.querySelectorAll(".ins-course-card").length,1);
    const actions = await details(page.node,"Actions for Web accessibility"); await click(button(actions,"Edit course")); assert.equal(page.node.querySelector('[name="id"]').readOnly,true);
    await value(page.node.querySelector('[name="title"]'),"Inclusive web interfaces"); await submit(page.node);
    const remount = document.createElement("div"); document.body.append(remount); const root = createRoot(remount), app = application();
    await act(async () => root.render(app.tree(app.load("app/components/instructor/courses-view.tsx").CoursesView)));
    assert.match(remount.textContent,/Inclusive web interfaces/); await act(async () => root.unmount()); remount.remove();
  } finally { await page.close(); }
});

test("course publication and archiving require confirmation; cancellation leaves content intact", async () => {
  const page = await mount("courses-view","CoursesView");
  try {
    let menu = await details(page.node,"Actions for HTML"); await click(button(menu,"Unpublish locally")); assert.ok(page.node.querySelector("dialog"));
    assert.equal(document.activeElement.textContent,"Cancel"); await click(button(page.node.querySelector("dialog"),"Cancel")); assert.equal(page.node.querySelectorAll(".ins-status.published").length,3);
    menu = await details(page.node,"Actions for HTML"); await click(button(menu,"Unpublish locally")); await click(button(page.node.querySelector("dialog"),"Unpublish locally")); assert.equal(page.node.querySelectorAll(".ins-status.draft").length,1);
    menu = await details(page.node,"Actions for HTML"); await click(button(menu,"Publish locally")); await click(button(page.node.querySelector("dialog"),"Publish locally")); assert.equal(page.node.querySelectorAll(".ins-status.published").length,3);
    menu = await details(page.node,"Actions for HTML"); await click(button(menu,"Archive course")); await click(button(page.node.querySelector("dialog"),"Archive course")); assert.equal(page.node.querySelectorAll(".ins-course-card").length,2);
    await value(page.node.querySelector('[aria-label="Filter courses by status"]'),"archived"); menu = await details(page.node,"Actions for HTML"); await click(button(menu,"Restore course")); await click(button(page.node.querySelector("dialog"),"Restore course"));
    await value(page.node.querySelector('[aria-label="Filter courses by status"]'),"active"); assert.equal(page.node.querySelectorAll(".ins-course-card").length,3);
  } finally { await page.close(); }
});

test("curriculum UI adds a module and typed activity, reorders, archives and restores records", async () => {
  const page = await mount("curriculum-view","CurriculumView");
  try {
    assert.equal(page.node.querySelectorAll(".ins-module").length,3); assert.equal(page.node.querySelectorAll(".ins-activity").length,12);
    await click(button(page.node,"Add Module")); await value(page.node.querySelector('[name="title"]'),"Practice concepts"); await value(page.node.querySelector('[name="description"]'),"A new module"); await submit(page.node);
    assert.equal(page.node.querySelectorAll(".ins-module").length,4);
    await click(button(page.node,"Add Curriculum Item")); await value(page.node.querySelector('[name="type"]'),"workshop");
    const moduleSelect = page.node.querySelector('[name="module"]'); await value(moduleSelect,moduleSelect.options[3].value);
    await value(page.node.querySelector('[name="title"]'),"Build an accessible page"); await value(page.node.querySelector('[name="description"]'),"Guided practice"); await submit(page.node);
    assert.equal(page.node.querySelectorAll(".ins-activity").length,13); assert.match(page.node.textContent,/Open Workshop Builder/);
    const menu = await details(page.node,"Actions for module Practice concepts"); await click(button(menu,"Move module up")); assert.match(page.node.querySelectorAll(".ins-module")[2].textContent,/Practice concepts/);
    const itemMenu = await details(page.node,"Actions for activity Build an accessible page"); await click(button(itemMenu,"Archive activity")); await click(button(page.node.querySelector("dialog"),"Archive")); assert.equal(page.node.querySelectorAll(".ins-activity").length,12);
    await click(page.node.querySelector('[type="checkbox"]')); const restoredMenu = await details(page.node,"Actions for activity Build an accessible page"); await click(button(restoredMenu,"Restore activity"));
    assert.equal(page.node.querySelectorAll(".ins-activity").length,13);
    await click(button(page.node,"Collapse all")); assert.ok([...page.node.querySelectorAll(".ins-module-toggle")].every(b => b.getAttribute("aria-expanded") === "false"));
    await click(button(page.node,"Expand all")); assert.ok([...page.node.querySelectorAll(".ins-module-toggle")].every(b => b.getAttribute("aria-expanded") === "true"));
  } finally { await page.close(); }
});

test("overview derives counts and history; content pages filter real records and link to curriculum", async () => {
  let page = await mount("overview-view","OverviewView");
  try { assert.deepEqual([...page.node.querySelectorAll(".ins-stats strong")].map(n => n.textContent),["3","3","0","38"]); assert.match(page.node.textContent,/No local changes yet/); assert.match(page.node.textContent,/unavailable/); }
  finally { await page.close(); }
  for (const [type,count] of [["theory",25],["quiz",3],["lab",6],["workshop",4]]) {
    page = await mount("content-view","ContentView",{ type });
    try { assert.equal(page.node.querySelectorAll(".ins-content-row").length,count); assert.ok([...page.node.querySelectorAll(".ins-content-row a")].every(a => a.href.includes("/instructor/curriculum?course="))); await value(page.node.querySelector('[type="search"]'),"nothing-matches"); assert.equal(page.node.querySelectorAll(".ins-content-row").length,0); }
    finally { await page.close(); }
  }
});

test("workspace navigation, mobile drawer, collapse, Escape and dialog focus restoration work", async () => {
  window.localStorage.clear(); const app = application(), node = document.createElement("div"); document.body.append(node); const root = createRoot(node);
  try {
    const Shell = app.load("app/components/instructor/instructor-shell.tsx").InstructorShell;
    await act(async () => root.render(React.createElement(StrictMode,null,React.createElement(Shell,null,React.createElement("p",null,"Workspace content")))));
    assert.equal(node.querySelectorAll('.ins-sidebar nav a').length,10); assert.equal(node.querySelector('a[aria-current="page"]').textContent,"Overview");
    await click(node.querySelector('[aria-label="Collapse sidebar"]')); assert.ok(node.querySelector(".is-collapsed"));
    const trigger = node.querySelector('[aria-label="Open navigation"]'); trigger.focus(); await click(trigger); assert.ok(node.querySelector("dialog[open]"));
    await act(async () => node.querySelector("dialog").dispatchEvent(new window.Event("cancel",{ cancelable:true }))); assert.equal(node.querySelector("dialog"),null); assert.equal(document.activeElement,trigger);
    const menu = await details(node,"Instructor preview profile"); await act(async () => document.dispatchEvent(new window.KeyboardEvent("keydown",{ key:"Escape",bubbles:true }))); assert.equal(menu.open,false);
  } finally { await act(async () => root.unmount()); node.remove(); }
});

test("unknown dynamic pathname suspends only navigation and breadcrumb, preserving the shell and child route", () => {
  const pending = new Promise(() => {}), app = application({ pathname: () => { throw pending; } });
  const Shell = app.load("app/components/instructor/instructor-shell.tsx").InstructorShell;
  const markup = JSDOM.fragment(renderToStaticMarkup(React.createElement(Shell, null, React.createElement("p", null, "Editor route still renders"))));
  assert.equal(markup.querySelectorAll('.ins-sidebar nav a').length, 10);
  assert.equal(markup.querySelectorAll('.ins-sidebar nav a[aria-current]').length, 0);
  assert.ok(markup.querySelector('.ins-brand .decode-wordmark'));
  assert.ok(markup.querySelector('[aria-label="Open navigation"]'));
  assert.ok(markup.querySelector('.decode-theme-toggle'));
  assert.match(markup.querySelector('#instructor-main').textContent, /Editor route still renders/);
  assert.equal(markup.querySelector('.ins-breadcrumb span').textContent, "Workspace");
});

test("pathname suspension and resolution preserve shell state, route state and nested Theory navigation", async () => {
  window.localStorage.clear();
  let suspended = false, pathname = "/instructor/theory", resume;
  const pending = new Promise(resolve => { resume = resolve; });
  const app = application({ pathname: () => { if (suspended) throw pending; return pathname; } });
  const Shell = app.load("app/components/instructor/instructor-shell.tsx").InstructorShell;
  function Child() { const [text, setText] = React.useState("Draft text"); return React.createElement("input", { "aria-label":"Retained draft", value:text, onChange:e => setText(e.target.value) }); }
  const node = document.createElement("div"); document.body.append(node); const root = createRoot(node);
  const tree = () => React.createElement(Shell, null, React.createElement(Child));
  try {
    await act(async () => root.render(tree())); await click(node.querySelector('[aria-label="Collapse sidebar"]'));
    const field = node.querySelector('[aria-label="Retained draft"]'); await value(field, "Unsaved editor text");
    suspended = true; await act(async () => root.render(tree()));
    assert.ok(node.querySelector('.is-collapsed')); assert.equal(node.querySelector('[aria-label="Retained draft"]'), field); assert.equal(field.value, "Unsaved editor text");
    pathname = "/instructor/theory/lesson%3Ahtml-introduction"; suspended = false;
    await act(async () => { resume(); root.render(tree()); });
    assert.equal(node.querySelector('.ins-sidebar nav a[aria-current="page"]').textContent, "Theory Lessons");
    assert.equal(node.querySelector('.ins-breadcrumb span').textContent, "Theory Lesson Editor");
    assert.ok(node.querySelector('.is-collapsed')); assert.equal(field.value, "Unsaved editor text");
  } finally { await act(async () => root.unmount()); node.remove(); }
});

test("course Delete is distinct and destructive; Cancel/Escape preserve data and confirmation persists the cascade", async () => {
  const fixture = deletionFixture(); let page = await mount("courses-view","CoursesView",undefined,fixture.state), saved;
  try {
    let menu = await details(page.node,"Actions for Local draft course");
    assert.ok(button(menu,"Archive course")); const remove = button(menu,"Delete course"); assert.equal(remove.disabled,false); assert.ok(remove.classList.contains("ins-delete-action")); assert.ok(remove.querySelector('svg[aria-hidden="true"]'));
    const before = window.localStorage.getItem("decode-instructor-preview-v1");
    await click(remove); let dialog = page.node.querySelector("dialog"); assert.match(dialog.textContent,/all its modules/); assert.match(dialog.textContent,/draft activities/); assert.match(dialog.textContent,/cannot be undone/); assert.equal(document.activeElement.textContent,"Cancel");
    assert.ok(button(dialog,"Delete course").classList.contains("destructive")); assert.ok(button(dialog,"Delete course").querySelector("svg"));
    await click(button(dialog,"Cancel")); assert.equal(page.node.querySelectorAll(".ins-course-card").length,4); assert.equal(window.localStorage.getItem("decode-instructor-preview-v1"),before);
    menu = await details(page.node,"Actions for Local draft course"); await click(button(menu,"Delete course"));
    await act(async () => page.node.querySelector("dialog").dispatchEvent(new window.Event("cancel",{ cancelable:true }))); assert.equal(window.localStorage.getItem("decode-instructor-preview-v1"),before);
    menu = await details(page.node,"Actions for Local draft course"); await click(button(menu,"Delete course")); await click(button(page.node.querySelector("dialog"),"Delete course"));
    assert.equal(page.node.querySelector("dialog"),null); assert.equal(page.node.querySelectorAll(".ins-course-card").length,3); assert.match(page.node.querySelector(".ins-catalog-summary").textContent,/3 active courses/);
    saved = JSON.parse(window.localStorage.getItem("decode-instructor-preview-v1")); assert.equal(saved.courses.some(c => c.id === fixture.courseId),false);
  } finally { await page.close(); }
  page = await mount("courses-view","CoursesView",undefined,saved);
  try { assert.equal(page.node.querySelectorAll(".ins-course-card").length,3); assert.equal(page.node.querySelector('summary[aria-label="Actions for Local draft course"]'),null); }
  finally { await page.close(); }
  page = await mount("overview-view","OverviewView",undefined,saved);
  try { assert.deepEqual([...page.node.querySelectorAll(".ins-stats strong")].map(n => n.textContent),["3","3","0","38"]); assert.equal(page.node.querySelector('.ins-history a[href*="local-draft"]'),null); assert.match(page.node.querySelector(".ins-history").textContent,/Deleted course/); }
  finally { await page.close(); }
});

test("activity and module Delete dialogs cancel safely, explain cascades and persist removal and counts", async () => {
  const fixture = deletionFixture(); let page = await mount("curriculum-view","CurriculumView",undefined,fixture.state), saved;
  try {
    await value(page.node.querySelector('[aria-label="Select course"]'),fixture.courseId);
    let menu = await details(page.node,"Actions for activity Local draft theory"); assert.ok(button(menu,"Archive activity")); assert.ok(button(menu,"Delete activity").querySelector("svg"));
    const before = window.localStorage.getItem("decode-instructor-preview-v1"); await click(button(menu,"Delete activity")); assert.match(page.node.querySelector("dialog").textContent,/cannot be undone/);
    await click(button(page.node.querySelector("dialog"),"Cancel")); assert.equal(window.localStorage.getItem("decode-instructor-preview-v1"),before); assert.equal(page.node.querySelectorAll(".ins-activity").length,2);
    menu = await details(page.node,"Actions for activity Local draft theory"); await click(button(menu,"Delete activity")); await click(button(page.node.querySelector("dialog"),"Delete activity"));
    assert.equal(page.node.querySelectorAll(".ins-activity").length,1); assert.match(page.node.querySelector(".ins-selector-counts").textContent,/1 modules.*1 activities/);
    saved = JSON.parse(window.localStorage.getItem("decode-instructor-preview-v1")); assert.equal(saved.courses.at(-1).modules[0].activities.some(a => a.id === fixture.activityId),false);
  } finally { await page.close(); }
  page = await mount("curriculum-view","CurriculumView",undefined,saved);
  try {
    await value(page.node.querySelector('[aria-label="Select course"]'),fixture.courseId); assert.equal(page.node.querySelectorAll(".ins-activity").length,1);
    let menu = await details(page.node,"Actions for module Local draft module"); assert.ok(button(menu,"Archive module")); const before = window.localStorage.getItem("decode-instructor-preview-v1");
    await click(button(menu,"Delete module")); assert.match(page.node.querySelector("dialog").textContent,/all its draft activities/); assert.match(page.node.querySelector("dialog").textContent,/cannot be undone/); await click(button(page.node.querySelector("dialog"),"Cancel")); assert.equal(window.localStorage.getItem("decode-instructor-preview-v1"),before);
    menu = await details(page.node,"Actions for module Local draft module"); await click(button(menu,"Delete module")); await click(button(page.node.querySelector("dialog"),"Delete module"));
    assert.equal(page.node.querySelectorAll(".ins-module").length,0); assert.equal(page.node.querySelectorAll(".ins-activity").length,0); assert.match(page.node.querySelector(".ins-selector-counts").textContent,/0 modules.*0 activities/);
    saved = JSON.parse(window.localStorage.getItem("decode-instructor-preview-v1")); assert.equal(saved.courses.at(-1).modules.length,0);
  } finally { await page.close(); }
  page = await mount("curriculum-view","CurriculumView",undefined,saved);
  try { await value(page.node.querySelector('[aria-label="Select course"]'),fixture.courseId); assert.equal(page.node.querySelectorAll(".ins-module").length,0); }
  finally { await page.close(); }
});

test("protected course/module/activity menus disable Delete and explicitly offer Archive", async () => {
  let page = await mount("courses-view","CoursesView");
  try {
    for (const title of ["HTML","CSS","JavaScript"]) { const menu = await details(page.node,`Actions for ${title}`); assert.equal(button(menu,"Delete course").disabled,true); assert.equal(button(menu,"Archive course").disabled,false); assert.match(menu.querySelector(".ins-delete-reason").textContent,/Archive instead/); }
  } finally { await page.close(); }
  page = await mount("curriculum-view","CurriculumView");
  try {
    const topic = await details(page.node,"Actions for module Your first web page"); assert.equal(button(topic,"Delete module").disabled,true); assert.equal(button(topic,"Archive module").disabled,false); assert.match(topic.querySelector(".ins-delete-reason").textContent,/Archive instead/);
    const item = await details(page.node,"Actions for activity Introduction to HTML"); assert.equal(button(item,"Delete activity").disabled,true); assert.equal(button(item,"Archive activity").disabled,false); assert.match(item.querySelector(".ins-delete-reason").textContent,/Archive instead/);
    await click(button(item,"Delete activity")); assert.equal(page.node.querySelector("dialog"),null);
  } finally { await page.close(); }
});

test("failed Delete keeps the confirmation and saved content available without pretending it succeeded", async () => {
  const fixture = deletionFixture(), page = await mount("courses-view","CoursesView",undefined,fixture.state), originalWrite = window.Storage.prototype.setItem;
  try {
    const menu = await details(page.node,"Actions for Local draft course"), before = window.localStorage.getItem("decode-instructor-preview-v1"); await click(button(menu,"Delete course"));
    window.Storage.prototype.setItem = () => { throw new Error("Storage full"); };
    await click(button(page.node.querySelector("dialog"),"Delete course")); assert.ok(page.node.querySelector("dialog")); assert.match(page.node.querySelector('dialog [role="alert"]').textContent,/not saved/); assert.equal(page.node.querySelectorAll(".ins-course-card").length,4); assert.equal(window.localStorage.getItem("decode-instructor-preview-v1"),before);
    window.Storage.prototype.setItem = originalWrite; await click(button(page.node.querySelector("dialog"),"Cancel")); assert.equal(page.node.querySelector("dialog"),null);
  } finally { window.Storage.prototype.setItem = originalWrite; await page.close(); }
});

test("course dates display compactly in cards/details and all date sorts work with filters and persistence", async () => {
  const fixture = deletionFixture(), repo = application().load("app/lib/instructor/repository.ts"), created = "2026-10-26T09:05:00.000Z", updated = "2026-10-26T09:25:00.000Z", later = "2026-10-26T09:15:00.000Z";
  Object.assign(fixture.state.courses.at(-1),{ createdAt:created,updatedAt:updated });
  const state = repo.applyInstructorCommand(fixture.state,{ type:"course.create",id:"newest-course",fields:{ ...fixture.state.courses.at(-1),title:"Newest dated course" } },later).state;
  let page = await mount("courses-view","CoursesView",undefined,state), saved;
  try {
    const titles = () => [...page.node.querySelectorAll(".ins-course-card h2")].map(n => n.textContent);
    const raw = window.localStorage.getItem("decode-instructor-preview-v1"), format = page.app.load("app/lib/instructor/dates.ts").formatInstructorTimestamp;
    assert.equal(page.node.querySelectorAll(".ins-course-card")[0].querySelectorAll(".ins-timestamps dd span").length,2);
    await value(page.node.querySelector('[aria-label="Sort courses"]'),"newest-created"); assert.deepEqual(titles(),["Newest dated course","Local draft course","HTML","CSS","JavaScript"]);
    await value(page.node.querySelector('[aria-label="Sort courses"]'),"oldest-created"); assert.deepEqual(titles(),["Local draft course","Newest dated course","HTML","CSS","JavaScript"]);
    await value(page.node.querySelector('[aria-label="Sort courses"]'),"recently-updated"); assert.equal(titles()[0],"Local draft course");
    await value(page.node.querySelector('[aria-label="Filter courses by status"]'),"draft"); assert.equal(titles().length,2);
    await value(page.node.querySelector('[type="search"]'),"Newest dated"); assert.deepEqual(titles(),["Newest dated course"]); await value(page.node.querySelector('[type="search"]'),"");
    const menu = await details(page.node,"Actions for Local draft course"); await click(button(menu,"View course details"));
    const dialog = page.node.querySelector("dialog"); assert.match(dialog.textContent,/Created/); assert.match(dialog.textContent,/Last updated/); assert.match(dialog.textContent,/Last published/); assert.match(dialog.textContent,/Not published/);
    assert.deepEqual([...dialog.querySelectorAll("time")].map(n => n.getAttribute("datetime")),[created,updated]); assert.ok(dialog.textContent.includes(format(created))); assert.ok(dialog.textContent.includes(format(updated))); assert.match(dialog.textContent,/local timezone/);
    await click(button(dialog,"Close details")); assert.equal(window.localStorage.getItem("decode-instructor-preview-v1"),raw); saved = JSON.parse(raw);
  } finally { await page.close(); }
  page = await mount("courses-view","CoursesView",undefined,saved);
  try { const menu = await details(page.node,"Actions for Local draft course"); await click(button(menu,"View course details")); assert.deepEqual([...page.node.querySelectorAll("dialog time")].map(n => n.getAttribute("datetime")),[created,updated]); }
  finally { await page.close(); }
});

test("activity/module timestamps stay in menus and details, with unavailable seed history and no editable date fields", async () => {
  let page = await mount("curriculum-view","CurriculumView");
  try {
    const menu = await details(page.node,"Actions for activity Introduction to HTML"); assert.equal(menu.querySelectorAll(".ins-timestamps dd").length,3); assert.equal(menu.querySelectorAll("time").length,0); assert.ok([...menu.querySelectorAll(".ins-timestamps dd")].every(n => n.textContent === "Unavailable"));
    assert.equal(menu.closest(".ins-activity").querySelector(".ins-activity-title time"),null); assert.ok(![...menu.closest(".ins-activity").children].some(n => n.classList.contains("ins-timestamps")));
    const topic = await details(page.node,"Actions for module Your first web page"); assert.equal(topic.querySelectorAll(".ins-timestamps dd").length,2); assert.equal(topic.querySelectorAll("time").length,0);
  } finally { await page.close(); }
  const fixture = deletionFixture(), at = "2026-10-26T09:05:00.000Z"; Object.assign(fixture.state.courses.at(-1).modules[0].activities[0],{ createdAt:at,updatedAt:at });
  page = await mount("curriculum-view","CurriculumView",undefined,fixture.state);
  try {
    await value(page.node.querySelector('[aria-label="Select course"]'),fixture.courseId); const menu = await details(page.node,"Actions for activity Local draft theory"); assert.equal(menu.querySelectorAll("time").length,2); assert.match(menu.querySelector(".ins-timestamps").textContent,/Not published/);
    await click(button(menu,"Edit activity details")); assert.equal(page.node.querySelectorAll("dialog .ins-timestamps time").length,2); assert.equal(page.node.querySelector('input[name="createdAt"], input[name="updatedAt"], input[name="publishedAt"]'),null);
    const raw = window.localStorage.getItem("decode-instructor-preview-v1"); await click(button(page.node.querySelector("dialog"),"Cancel")); assert.equal(window.localStorage.getItem("decode-instructor-preview-v1"),raw);
  } finally { await page.close(); }
});

test("overview recent changes identify affected content/actions and render consistent local timestamps in date order", async () => {
  const app = application(), repo = app.load("app/lib/instructor/repository.ts"), times = ["2026-10-26T09:05:00.000Z","2026-10-26T09:10:00.000Z","2026-10-26T09:15:00.000Z"];
  let state = repo.seedInstructorState();
  for (const [command,at] of [[{ type:"course.status",courseId:"html",status:"draft" },times[0]],[{ type:"module.update",courseId:"html",moduleId:"html-first-page",title:"Learning foundations",description:"Updated sequence" },times[1]],[{ type:"activity.update",courseId:"html",moduleId:"html-first-page",activityId:"lesson:html-introduction",title:"Markup basics",description:"Updated explanation" },times[2]]]) state = repo.applyInstructorCommand(state,command,at).state;
  state.changes.reverse(); state.changes.push({ id:"legacy-change",courseId:"html",title:"Legacy local edit",at:"2026-10-26T09:00:00.000Z" });
  const page = await mount("overview-view","OverviewView",undefined,state);
  try {
    const entries = [...page.node.querySelectorAll(".ins-history li")], format = app.load("app/lib/instructor/dates.ts").formatInstructorTimestamp;
    assert.match(entries[0].textContent,/Updated activity: Markup basics/); assert.match(entries[1].textContent,/Updated module: Learning foundations/); assert.match(entries[2].textContent,/Unpublished locally: HTML/); assert.match(entries[3].textContent,/Legacy local edit/);
    assert.deepEqual(entries.slice(0,3).map(n => n.querySelector("time").getAttribute("datetime")),[...times].reverse()); assert.ok(entries[0].textContent.includes(format(times[2])));
    assert.ok(entries[0].querySelector("a").getAttribute("href").includes("activity=lesson%3Ahtml-introduction"));
    const saved = JSON.parse(window.localStorage.getItem("decode-instructor-preview-v1")); assert.equal(saved.courses[0].createdAt,null); assert.equal(saved.courses[0].modules[0].activities[0].publishedAt,null);
  } finally { await page.close(); }
});

test("published course duplicate remains a deletable draft across refresh and never changes the original", async () => {
  let page = await mount("courses-view","CoursesView"), saved, copyId;
  try {
    const menu = await details(page.node,"Actions for HTML"); await click(button(menu,"Duplicate course"));
    const copyMenu = await details(page.node,"Actions for HTML (copy)"); assert.equal(button(copyMenu,"Delete course").disabled,false); assert.equal(button(copyMenu,"Publish locally").disabled,true);
    const card = copyMenu.closest(".ins-course-card"); assert.equal(card.querySelector(".ins-status").textContent,"Draft");
    saved = JSON.parse(window.localStorage.getItem("decode-instructor-preview-v1")); const copy = saved.courses.at(-1); copyId = copy.id;
    assert.equal(copy.status,"draft"); assert.equal(copy.hasBeenPublished,false); assert.equal(copy.publishedAt,null); assert.ok(copy.modules.every(m => m.status === "draft" && !m.hasBeenPublished && m.activities.every(a => a.status === "draft" && !a.hasBeenPublished && a.publishedAt === null && !a.reference)));
    assert.equal(saved.courses[0].id,"html"); assert.equal(saved.courses[0].status,"published");
  } finally { await page.close(); }
  page = await mount("courses-view","CoursesView",undefined,saved);
  try {
    const menu = await details(page.node,"Actions for HTML (copy)"); assert.equal(button(menu,"Delete course").disabled,false); await click(button(menu,"Delete course")); await click(button(page.node.querySelector("dialog"),"Cancel")); assert.equal(page.node.querySelectorAll(".ins-course-card").length,4);
    const again = await details(page.node,"Actions for HTML (copy)"); await click(button(again,"Delete course")); await click(button(page.node.querySelector("dialog"),"Delete course")); saved = JSON.parse(window.localStorage.getItem("decode-instructor-preview-v1")); assert.equal(saved.courses.some(c => c.id === copyId),false);
    const original = await details(page.node,"Actions for HTML"); assert.equal(button(original,"Delete course").disabled,true); assert.equal(button(original,"Archive course").disabled,false);
  } finally { await page.close(); }
  page = await mount("courses-view","CoursesView",undefined,saved);
  try { assert.equal(page.node.querySelectorAll(".ins-course-card").length,3); assert.equal(page.node.querySelector('summary[aria-label="Actions for HTML (copy)"]'),null); }
  finally { await page.close(); }
});

test("legacy recovery is explicit, cancellable and preserves original publication history through copy/archive/reload", async () => {
  const repo = application().load("app/lib/instructor/repository.ts"), state = repo.seedInstructorState(), legacy = structuredClone(state.courses[0]);
  legacy.id = "legacy-ui-copy"; legacy.title = "Legacy HTML copy"; legacy.source = "local"; legacy.status = "draft"; legacy.hasBeenPublished = true; legacy.publishedAt = "2026-10-26T09:05:00.000Z";
  legacy.modules.forEach((m,index) => { m.id = `old-module-${index}`; m.source = "local"; m.activities.forEach((a,at) => { a.id = `old-activity-${index}-${at}`; a.source = "local"; }); }); state.courses.push(legacy);
  const original = JSON.stringify(legacy); let page = await mount("courses-view","CoursesView",undefined,state), saved;
  try {
    let menu = await details(page.node,"Actions for Legacy HTML copy"); assert.equal(button(menu,"Delete course").disabled,true); await click(button(menu,"Create clean draft copy"));
    assert.match(page.node.querySelector("dialog").textContent,/history will remain unchanged/); assert.match(page.node.querySelector("dialog").textContent,/new unpublished course/); await click(button(page.node.querySelector("dialog"),"Cancel")); assert.equal(page.node.querySelectorAll(".ins-course-card").length,4);
    menu = await details(page.node,"Actions for Legacy HTML copy"); await click(button(menu,"Create clean draft copy")); await click(button(page.node.querySelector("dialog"),"Create clean draft copy"));
    saved = JSON.parse(window.localStorage.getItem("decode-instructor-preview-v1")); assert.equal(JSON.stringify(saved.courses.find(c => c.id === legacy.id)),original);
    const fresh = await details(page.node,"Actions for Legacy HTML copy (copy)"); assert.equal(button(fresh,"Delete course").disabled,false); await click(button(fresh,"Delete course")); await click(button(page.node.querySelector("dialog"),"Delete course"));
    menu = await details(page.node,"Actions for Legacy HTML copy"); await click(button(menu,"Archive course")); await click(button(page.node.querySelector("dialog"),"Archive course")); saved = JSON.parse(window.localStorage.getItem("decode-instructor-preview-v1")); assert.equal(saved.courses.find(c => c.id === legacy.id).publishedAt,legacy.publishedAt); assert.equal(saved.courses.find(c => c.id === legacy.id).archived,true);
  } finally { await page.close(); }
  page = await mount("courses-view","CoursesView",undefined,saved);
  try {
    await value(page.node.querySelector('[aria-label="Filter courses by status"]'),"archived"); const menu = await details(page.node,"Actions for Legacy HTML copy"); assert.equal(button(menu,"Delete course").disabled,true); assert.equal(button(menu,"Restore course").disabled,false); assert.ok(button(menu,"Create clean draft copy"));
  } finally { await page.close(); }
});

test("instructor logo reuses the animated shared wordmark across navigation, theme changes and refresh", async () => {
  const app = application(), node = document.createElement("div"), previousTheme = document.documentElement.dataset.theme; document.body.append(node); let root = createRoot(node);
  const Shell = app.load("app/components/instructor/instructor-shell.tsx").InstructorShell;
  const tree = () => React.createElement(StrictMode,null,React.createElement(Shell,null,React.createElement("p",null,"Content")));
  try {
    window.history.replaceState(null,"","/instructor"); await act(async () => root.render(tree()));
    const brand = node.querySelector(".ins-brand"), logo = brand.querySelector("svg"); assert.equal(brand.getAttribute("href"),"/instructor"); assert.ok(brand.classList.contains("decode-logo-link")); assert.ok(logo.classList.contains("decode-wordmark-animated")); assert.equal(logo.getAttribute("stroke"),"currentColor");
    const Wordmark = app.load("app/components/landing/wordmark.tsx").Wordmark, expected = JSDOM.fragment(renderToStaticMarkup(React.createElement(Wordmark))).querySelector("svg");
    assert.deepEqual([...logo.querySelectorAll("path")].map(n => n.getAttribute("d")),[...expected.querySelectorAll("path")].map(n => n.getAttribute("d")));
    await click(node.querySelector(".decode-theme-toggle")); assert.equal(brand.querySelector("svg"),logo); assert.ok(logo.classList.contains("decode-wordmark-animated"));
    window.history.replaceState(null,"","/instructor/courses"); await act(async () => root.render(tree())); assert.equal(node.querySelector(".ins-brand svg"),logo); assert.equal(node.querySelector('.ins-sidebar a[aria-current="page"]').textContent,"My Courses");
    await act(async () => root.unmount()); root = createRoot(node); await act(async () => root.render(tree())); assert.ok(node.querySelector(".ins-brand .decode-wordmark-animated")); assert.equal(node.querySelector(".ins-brand").getAttribute("href"),"/instructor");
  } finally { await act(async () => root.unmount()); node.remove(); window.history.replaceState(null,"","/instructor"); if (previousTheme === undefined) delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = previousTheme; }
});
