import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import React, { act, StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { JSDOM } from "jsdom";
import ts from "typescript";

const dom = new JSDOM("<!doctype html><body></body>", { url: "http://localhost/instructor/workshops/project%3Aportfolio", pretendToBeVisual: true }), { window } = dom;
Object.assign(globalThis, { window, document: window.document, IS_REACT_ACT_ENVIRONMENT: true });
window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
window.HTMLDialogElement.prototype.close = function () { this.open = false; };
window.confirm = () => false;
window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
const { createRoot, hydrateRoot } = await import("react-dom/client"), dependency = createRequire(import.meta.url);
let submissionRows = [], reviewFailure = false;
function application(runtime) {
  const cache = new Map(), navigation = [];
  function load(file) {
    file = path.resolve(file); if (cache.has(file)) return cache.get(file).exports;
    const compiled = { exports: {} }; cache.set(file, compiled);
    const source = ts.transpileModule(fs.readFileSync(file.endsWith("/progress-provider.tsx") || file.endsWith("\\progress-provider.tsx") ? path.resolve("tests/fixtures/local-progress-provider.txt") : file, "utf8"), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    function require(specifier) {
      if (specifier === "../../lib/learning/client") return { learningRequest: async (url, body) => {
        if(url === 'instructor/submissions') return {records:structuredClone(submissionRows)};
        if(url === 'instructor/reviews') { if(reviewFailure)throw new Error('Review changed. Reload before saving.'); const row=submissionRows.find(r=>r.id===body.id); assert.equal(body.expectedRevision,row.revision);Object.assign(row,{feedback:body.feedback,status:body.status,revision:row.revision+1});return {records:structuredClone(submissionRows)}; }
        return {html:'<h1>Saved work</h1>',css:'',javascript:''};
      }};
      if (specifier === "../../lib/instructor/remote-repository") return { RemoteInstructorRepository: load("app/lib/instructor/repository.ts").LocalInstructorRepository };
      if (specifier.endsWith(".css")) return {};
      if (specifier === "next/link") return { __esModule: true, default: ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children) };
      if (specifier === "../student/monaco-runtime" && runtime) return runtime;
      if (specifier === "next/dynamic") return { __esModule: true, default: () => props => React.createElement("textarea", { "aria-label": `Syntax ${props.language}`, value: props.value, readOnly: props.readOnly, onChange: e => props.onChange(e.target.value) }) };
      if (specifier === "next/navigation") return { usePathname: () => window.location.pathname, useSearchParams: () => new URLSearchParams(window.location.search), useRouter: () => ({ push: href => navigation.push(href) }) };
      if (!specifier.startsWith(".") && !specifier.startsWith("@/")) return dependency(specifier);
      const base = specifier.startsWith("@/") ? path.resolve(specifier.slice(2)) : path.resolve(path.dirname(file), specifier);
      return load([base + ".ts", base + ".tsx"].find(fs.existsSync));
    }
    vm.runInNewContext(source, { module: compiled, exports: compiled.exports, require, window, document, console, Error, MutationObserver: window.MutationObserver, localStorage: window.localStorage, FormData: window.FormData, Element: window.Element, structuredClone, URL, crypto: globalThis.crypto, requestAnimationFrame: window.requestAnimationFrame.bind(window) }, { filename: file });
    return compiled.exports;
  }
  const { InstructorProvider } = load("app/components/instructor/instructor-provider.tsx");
  return { load, navigation, tree: (View, props) => React.createElement(StrictMode, null, React.createElement(InstructorProvider, null, React.createElement(View, props))) };
}
async function routeElement(app, href) {
  const url = new URL(href, "http://localhost"), Page = app.load("app/instructor/workshops/[activityId]/page.tsx").default;
  const page = Page({ params: Promise.resolve({ activityId: url.pathname.slice("/instructor/workshops/".length) }), searchParams: Promise.resolve({ preview: url.searchParams.get("preview") ?? undefined }) });
  assert.equal(page.type, React.Suspense); return page.props.children.type(page.props.children.props);
}
async function mount(name, exportName, props, stored, { demoStored, href = "/instructor/workshops/project%3Aportfolio", hydrate = false, route = false } = {}) {
  window.localStorage.clear(); window.history.replaceState(null, "", href);
  if (stored) window.localStorage.setItem("decode-instructor-preview-v1", typeof stored === "string" ? stored : JSON.stringify(stored));
  if (demoStored) window.localStorage.setItem("decode-instructor-submissions-demo-v1", typeof demoStored === "string" ? demoStored : JSON.stringify(demoStored));
  const app = application(), element = route ? await routeElement(app, href) : { type: app.load(`app/components/instructor/${name}.tsx`)[exportName], props }, tree = app.tree(element.type, element.props), node = document.createElement("div"), errors = []; document.body.append(node); let root;
  if (hydrate) { node.innerHTML = renderToString(tree); assert.doesNotMatch(node.textContent, /Workshop not found/); await act(async () => { root = hydrateRoot(node, tree, { onRecoverableError: error => errors.push(error) }); }); }
  else { root = createRoot(node); await act(async () => root.render(tree)); }
  return { app, node, errors, async renderRoute(nextHref) { window.history.replaceState(null, "", nextHref); const next = await routeElement(app, nextHref); await act(async () => root.render(app.tree(next.type, next.props))); }, async close() { await act(async () => root.unmount()); node.remove(); } };
}
const button = (root, text) => [...root.querySelectorAll("button")].find(b => b.textContent.trim().replace(/^＋\s*/, "") === text);
async function click(node) { assert.ok(node, "Expected an actionable element"); await act(async () => node.click()); }
async function value(node, text) {
  assert.ok(node, "Expected a field"); await act(async () => { const proto = node.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : node.tagName === "SELECT" ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, "value").set.call(node, text); node.dispatchEvent(new window.Event(node.tagName === "SELECT" ? "change" : "input", { bubbles: true })); });
}
async function submit(root) { await act(async () => root.querySelector("form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }))); }
const entry = id => ({ id, title: `Title ${id}`, description: `Instructions for ${id}` });
const content = () => ({ title: "Local project workshop", objectives: ["Build a semantic page"], description: "Build a fictional project with a clear structure.", steps: [entry("one"), entry("two")], requirements: [entry("required")], deliverables: [entry("delivered")], hints: "Try a main element.", resources: [{ id: "resource", title: "HTML resource", url: "https://example.com/learning" }], estimatedMinutes: 60, submission: { instructions: "Package your project as a ZIP.", acceptedTypes: [".zip"], maxFileSizeMb: 10 }, evaluation: "Check structure and focus states.", feedbackGuidance: "Instructor-only feedback notes.", starter: { html: "<main>\n  <h1>Start</h1>\n</main>\n", css: "body {\n  margin: 0;\n}\n", javascript: "// Optional enhancements\n\n" } });
function fixture() {
  const app = application(), repo = app.load("app/lib/instructor/repository.ts"); let state = repo.seedInstructorState();
  function run(command) { const result = repo.applyInstructorCommand(state, command); state = result.state; return result.id; }
  const courseId = run({ type: "course.create", id: "local-workshop-course", fields: { title: "Local workshop course", description: "Guided projects", category: "Web development", difficulty: "Beginner", duration: "2 hours", objectives: ["Build a project"], color: "blue", icon: "book" } }), moduleId = run({ type: "module.create", courseId, title: "Project module", description: "A local sequence" }), activityId = run({ type: "activity.create", courseId, moduleId, activityType: "workshop", title: "New local workshop", description: "A practical project" });
  return { app, run, courseId, moduleId, activityId, get state() { return state; }, save(content) { const draft = state.workshop?.drafts[activityId]; run({ type: "workshop.save", courseId, moduleId, activityId, content, expectedUpdatedAt: draft?.updatedAt ?? null, expectedRevision: draft?.revision ?? null }); } };
}

test("Workshop library lists four originals once, combines title/course/module/status filters and links to Edit/Preview and curriculum", async () => {
  const page = await mount("workshop-library", "WorkshopLibrary");
  try { assert.equal(page.node.querySelectorAll('.ins-workshop-row').length, 4); assert.ok(page.node.querySelector('a[href="/instructor/workshops/project%3Aportfolio"]')); assert.ok(page.node.querySelector('a[href="/instructor/workshops/project%3Aportfolio?preview=1"]')); await value(page.node.querySelector('[aria-label="Filter workshops by course"]'), "html"); assert.equal(page.node.querySelectorAll('.ins-workshop-row').length, 1); const moduleSelect = page.node.querySelector('[aria-label="Filter workshops by module"]'); await value(moduleSelect, moduleSelect.options[1].value); assert.equal(page.node.querySelectorAll('.ins-workshop-row').length, 0); await value(page.node.querySelector('[aria-label="Filter workshops by course"]'), "all"); assert.equal(moduleSelect.value, "all"); await value(page.node.querySelector('[type="search"]'), "not present"); assert.match(page.node.textContent, /No matching workshops/); }
  finally { await page.close(); }
});

test("encoded original Workshop URLs hydrate, save protected working drafts, and reopen on direct refresh in edit/preview modes", async () => {
  let page = await mount(null, null, null, undefined, { route: true, hydrate: true }), raw;
  try { assert.equal(page.errors.length, 0); assert.match(page.node.textContent, /Published Original \/ Working Draft/); assert.match(page.node.textContent, /Original workshops use self-review/); const before = JSON.stringify(page.app.load("app/lib/instructor/repository.ts").seedInstructorState().courses); await value(page.node.querySelector('[aria-label="Workshop title"]'), "Edited original portfolio"); await click(button(page.node, "Save Draft")); raw = window.localStorage.getItem("decode-instructor-preview-v1"); assert.equal(JSON.stringify(JSON.parse(raw).courses), before); assert.ok(JSON.parse(raw).workshop.drafts["project:portfolio"]); }
  finally { await page.close(); }
  for (const href of ["/instructor/workshops/project%3Aportfolio", "/instructor/workshops/project:portfolio", "/instructor/workshops/project%3Aportfolio?preview=1"]) { page = await mount(null, null, null, raw, { route: true, hydrate: true, href }); try { assert.equal(page.errors.length, 0); assert.match(page.node.textContent, /Edited original portfolio/); assert.equal(window.localStorage.getItem("decode-instructor-preview-v1"), raw); } finally { await page.close(); } }
});

test("new Workshop fields and all starter files persist formatting, objectives, resource and submission guidance after refresh", async () => {
  const local = fixture(); let page = await mount("workshop-editor", "WorkshopEditor", { activityId: local.activityId }, local.state), raw;
  try { for (const [label, text] of [["Workshop title", content().title], ["Learning objectives", "First objective\nSecond objective"], ["Project description", content().description], ["Estimated completion time", "60"], ["Workshop hints", content().hints], ["Submission instructions", content().submission.instructions], ["Maximum file size", "10"], ["Evaluation criteria", content().evaluation], ["Feedback guidance", content().feedbackGuidance]]) await value(page.node.querySelector(`[aria-label="${label}"]`), text); await click(page.node.querySelector('.ins-workshop-file-types input')); await click(button(page.node, "Add Resource")); await value(page.node.querySelector('[aria-label="Resource 1 title"]'), "HTML resource"); await value(page.node.querySelector('[aria-label="Resource 1 URL"]'), "https://example.com/learning"); await click(button(page.node, "Show Starter Files"));
    for (const language of ["html", "css", "javascript"]) { await click(button(page.node, language === "javascript" ? "JavaScript" : language.toUpperCase())); await value(page.node.querySelector(`[aria-label="Syntax ${language}"]`), content().starter[language]); }
    await click(button(page.node, "Save Draft")); raw = window.localStorage.getItem("decode-instructor-preview-v1"); const saved = JSON.parse(raw).workshop.drafts[local.activityId]; assert.deepEqual(saved.starter, content().starter); assert.deepEqual(saved.objectives, ["First objective", "Second objective"]); assert.deepEqual(saved.submission, content().submission); assert.match(page.node.querySelector('.ins-readiness').textContent, /Incomplete Draft/);
  } finally { await page.close(); }
  page = await mount(null, null, null, raw, { route: true, hydrate: true, href: `/instructor/workshops/${local.activityId}` });
  try { assert.equal(page.errors.length, 0); assert.equal(page.node.querySelector('[aria-label="Workshop title"]').value, content().title); await click(button(page.node, "Show Starter Files")); assert.equal(page.node.querySelector('[aria-label="Syntax html"]').value, content().starter.html); assert.equal(button(page.node, "Save Draft").disabled, true); }
  finally { await page.close(); }
});

test("structured Workshop entries support add/edit/duplicate/reorder and cancellable deletion, with readiness reflecting saved content", async () => {
  const local = fixture(); local.save(content()); const page = await mount("workshop-editor", "WorkshopEditor", { activityId: local.activityId }, local.state);
  try { await click(button(page.node, "Add Step")); let step = page.node.querySelector('[aria-label="Step 3"]'); await value(step.querySelector('[aria-label="Step title"]'), "Third step"); await value(step.querySelector('[aria-label="Step instructions"]'), "Build the footer."); const id = step.id; await click(step.querySelector('[aria-label="Duplicate step 3"]')); assert.ok(page.node.querySelector('[aria-label="Step 4"]')); await click(page.node.querySelector('[aria-label="Move step 4 up"]')); assert.notEqual(page.node.querySelector('[aria-label="Step 3"]').id, id); await click(page.node.querySelector('[aria-label="Delete step 4"]')); assert.equal(document.activeElement.textContent, "Cancel"); await click(button(page.node.querySelector('dialog'), "Cancel")); assert.ok(page.node.querySelector('[aria-label="Step 4"]')); await click(page.node.querySelector('[aria-label="Delete step 4"]')); await click(button(page.node.querySelector('dialog'), "Delete Step")); assert.equal(page.node.querySelector('[aria-label="Step 4"]'), null); await click(button(page.node, "Add Requirement")); const requirement = page.node.querySelector('[aria-label="Requirement 2"]'); await value(requirement.querySelector('[aria-label="Requirement title"]'), "Keyboard support"); await value(requirement.querySelector('[aria-label="Requirement instructions"]'), "Use visible focus styles."); assert.match(page.node.querySelector('.ins-readiness').textContent, /Ready for Publication/); await click(button(page.node, "Save Draft")); const saved = JSON.parse(window.localStorage.getItem("decode-instructor-preview-v1")).workshop.drafts[local.activityId]; assert.equal(saved.steps.length, 3); assert.equal(saved.steps[2].title, "Third step"); assert.equal(saved.requirements.length, 2); await act(async () => new Promise(resolve => window.requestAnimationFrame(resolve))); }
  finally { await page.close(); }
});

test("Workshop preview uses unsaved content, keeps step review in memory and never creates a file or demo submission", async () => {
  const local = fixture(); local.save(content()); const page = await mount("workshop-editor", "WorkshopEditor", { activityId: local.activityId }, local.state); const raw = window.localStorage.getItem("decode-instructor-preview-v1"); window.localStorage.setItem("student-progress", "untouched");
  try { await value(page.node.querySelector('[aria-label="Workshop title"]'), "Unsaved preview title"); await click(button(page.node, "Preview Workshop")); assert.match(page.node.querySelector('.ins-workshop-preview').textContent, /Unsaved preview title/); assert.doesNotMatch(page.node.querySelector('.ins-workshop-preview').textContent, /Instructor-only feedback notes/); assert.equal(page.node.querySelector('input[type="file"]').disabled, true); assert.equal(page.node.querySelector('iframe'), null); await click(button(page.node, "Mark Preview Step Reviewed")); assert.match(page.node.textContent, /1 \/ 2 reviewed in this preview/); await click(button(page.node, "Next")); assert.match(page.node.querySelector('.ins-workshop-current-step').textContent, /Title two/); await click(button(page.node, "Try Submission Demonstration")); assert.match(page.node.textContent, /No file was selected or delivered/); assert.equal(window.localStorage.getItem("decode-instructor-submissions-demo-v1"), null); assert.equal(window.localStorage.getItem("decode-instructor-preview-v1"), raw); assert.equal(window.localStorage.getItem("student-progress"), "untouched"); await click(button(page.node, "Restart Workshop Preview")); assert.match(page.node.textContent, /0 \/ 2 reviewed/); await click(button(page.node, "Back to Editor")); assert.equal(page.node.querySelector('[aria-label="Workshop title"]').value, "Unsaved preview title"); assert.equal(button(page.node, "Save Draft").disabled, false); }
  finally { await page.close(); }
});

test("Workshop preview escapes authored text/code, disables unsafe links, and incomplete drafts cannot record preview review", async () => {
  const local = fixture(), draft = content(); draft.description = '<img src=x onerror="window.hacked=1">'; draft.steps[0].description = '<script>window.hacked=1</script>'; draft.resources[0].url = "javascript:alert(1)"; local.save(draft); const page = await mount("workshop-editor", "WorkshopEditor", { activityId: local.activityId, initialPreview: true }, local.state);
  try { assert.equal(page.node.querySelector('.ins-workshop-preview img'), null); assert.equal(page.node.querySelector('.ins-workshop-preview script'), null); assert.equal(page.node.querySelector('.ins-workshop-preview a'), null); assert.match(page.node.textContent, /Invalid link disabled/); assert.equal(button(page.node, "Mark Preview Step Reviewed").disabled, true); assert.equal(window.hacked, undefined); }
  finally { await page.close(); }
});

test("Workshop curriculum creation opens its editor, preserves order/counts, and Edit/Preview/Duplicate menus use stable IDs", async () => {
  const local = fixture(), page = await mount("curriculum-view", "CurriculumView", undefined, local.state, { href: `/instructor/curriculum?course=${local.courseId}` });
  try { await click(button(page.node, "Add Curriculum Item")); const dialog = page.node.querySelector('dialog'); await value(dialog.querySelector('[name="type"]'), "workshop"); await value(dialog.querySelector('[name="title"]'), "Created Workshop"); await value(dialog.querySelector('[name="description"]'), "A project in order"); await submit(dialog); let saved = JSON.parse(window.localStorage.getItem("decode-instructor-preview-v1")), list = saved.courses.at(-1).modules[0].activities, created = list.at(-1); assert.equal(list[0].id, local.activityId); assert.equal(list.length, 2); assert.equal(page.app.navigation.at(-1), `/instructor/workshops/${created.id}`); assert.match(page.node.querySelector('.ins-selector-counts').textContent, /2 activities/); assert.ok(page.node.querySelector(`a[href="/instructor/workshops/${created.id}?preview=1"]`)); const row = [...page.node.querySelectorAll('.ins-activity')].find(row => row.textContent.includes("Created Workshop")); await click(button(row, "Duplicate Workshop")); saved = JSON.parse(window.localStorage.getItem("decode-instructor-preview-v1")); list = saved.courses.at(-1).modules[0].activities; assert.equal(list.length, 3); assert.equal(list[2].title, "Created Workshop (copy)"); assert.equal(list[2].hasBeenPublished, false); assert.equal(list[2].status, "draft"); }
  finally { await page.close(); }
});

test("Workshop routes honor edit/preview mode changes and missing/deleted/wrong-type IDs without recreating records", async () => {
  const local = fixture(); local.save(content()); let page = await mount(null, null, null, local.state, { route: true, href: `/instructor/workshops/${local.activityId}` });
  try { await page.renderRoute(`/instructor/workshops/${local.activityId}?preview=1`); assert.ok(page.node.querySelector('.ins-workshop-preview')); await page.renderRoute(`/instructor/workshops/${local.activityId}`); assert.ok(page.node.querySelector('[aria-label="Workshop title"]')); }
  finally { await page.close(); }
  local.run({ type: "activity.delete", courseId: local.courseId, moduleId: local.moduleId, activityId: local.activityId }); for (const id of [local.activityId, "missing", "quiz%3Ahtml", "project%253Aportfolio"]) { page = await mount(null, null, null, local.state, { route: true, hydrate: true, href: `/instructor/workshops/${id}` }); try { assert.equal(page.errors.length, 0); assert.match(page.node.textContent, /Workshop not found/); assert.equal(JSON.parse(window.localStorage.getItem("decode-instructor-preview-v1")).workshop.drafts[local.activityId], undefined); } finally { await page.close(); } }
});

test("Workshop dirty navigation, save failures and external conflict reload preserve edits honestly", async () => {
  const local = fixture(); local.save(content()); const page = await mount("workshop-editor", "WorkshopEditor", { activityId: local.activityId }, local.state);
  try { await value(page.node.querySelector('[aria-label="Workshop title"]'), "Unsaved local edit"); const unload = new window.Event("beforeunload", { cancelable: true }); window.dispatchEvent(unload); assert.equal(unload.defaultPrevented, true); const proto = Object.getPrototypeOf(window.localStorage), set = proto.setItem; proto.setItem = () => { throw Error("Quota"); }; try { await click(button(page.node, "Save Draft")); assert.match(page.node.textContent, /Changes were not saved/); } finally { proto.setItem = set; } local.save({ ...content(), title: "Other tab title" }); window.localStorage.setItem("decode-instructor-preview-v1", JSON.stringify(local.state)); await act(async () => window.dispatchEvent(new window.StorageEvent("storage", { key: "decode-instructor-preview-v1" }))); assert.equal(button(page.node, "Save Draft").disabled, true); await click(button(page.node, "Reload saved draft")); await click(button(page.node.querySelector('dialog'), "Cancel")); assert.equal(page.node.querySelector('[aria-label="Workshop title"]').value, "Unsaved local edit"); await click(button(page.node, "Reload saved draft")); await click(button(page.node.querySelector('dialog'), "Reload Draft")); assert.equal(page.node.querySelector('[aria-label="Workshop title"]').value, "Other tab title"); }
  finally { await page.close(); }
});

test("archived/unsupported Workshop records are read-only while original starter code remains inspectable", async () => {
  const local = fixture(); local.save(content()); local.run({ type: "activity.archive", courseId: local.courseId, moduleId: local.moduleId, activityId: local.activityId, archived: true }); const raw = JSON.stringify(local.state), page = await mount("workshop-editor", "WorkshopEditor", { activityId: local.activityId }, raw);
  try { assert.equal(button(page.node, "Save Draft").disabled, true); assert.equal(page.node.querySelector('[aria-label="Workshop title"]').closest('fieldset').disabled, true); await click(button(page.node, "Show Starter Files")); await click(button(page.node, "CSS")); assert.equal(page.node.querySelector('[aria-label="Syntax css"]').readOnly, true); assert.equal(page.node.querySelector('[aria-label="Syntax css"]').value, content().starter.css); assert.equal(window.localStorage.getItem("decode-instructor-preview-v1"), raw); }
  finally { await page.close(); }
});

const submissionFixture=()=>({id:'submission-one',studentName:'Real learner',referenceId:'portfolio',courseId:'html',activityId:'project:portfolio',courseTitle:'HTML',workshopTitle:'Portfolio',projectTitle:'Portfolio',status:'pending',feedback:'',revision:1,createdAt:'2026-10-27T00:00:00Z',submittedAt:'2026-10-27T00:00:00Z',updatedAt:'2026-10-27T00:00:00Z',reviewedAt:null});
test('server submissions show an empty state and never fabricate demo records',async()=>{
 submissionRows=[];const page=await mount('submissions-view','SubmissionsView');try{assert.match(page.node.textContent,/No submissions found/);assert.equal(page.node.querySelectorAll('.ins-demo-row').length,0);assert.doesNotMatch(page.node.textContent,/Load Local Demo/);}finally{await page.close();}
});
test('server submissions filter actual students and save final feedback with the expected revision',async()=>{
 submissionRows=[submissionFixture()];reviewFailure=false;const page=await mount('submissions-view','SubmissionsView');try{
 assert.equal(page.node.querySelectorAll('.ins-demo-row').length,1);await value(page.node.querySelector('input'),'unmatched');assert.equal(page.node.querySelectorAll('.ins-demo-row').length,0);await value(page.node.querySelector('input'),'Real learner');
 await click(button(page.node,'Review'));await value(page.node.querySelector('dialog textarea'),'Useful instructor feedback');await value(page.node.querySelector('dialog select'),'reviewed');await click(button(page.node,'Save Review'));
 assert.equal(submissionRows[0].feedback,'Useful instructor feedback');assert.equal(submissionRows[0].revision,2);assert.match(page.node.textContent,/Reviewed/);
 }finally{await page.close();}
});
test('review conflict retains entered feedback and untrusted names render as text',async()=>{
 submissionRows=[{...submissionFixture(),studentName:'<img src=x onerror=alert(1)>'}];reviewFailure=true;const page=await mount('submissions-view','SubmissionsView');try{
 assert.equal(page.node.querySelector('img'),null);await click(button(page.node,'Review'));await value(page.node.querySelector('dialog textarea'),'Keep my feedback');await click(button(page.node,'Save Review'));assert.match(page.node.textContent,/Review changed/);assert.equal(page.node.querySelector('dialog textarea').value,'Keep my feedback');assert.equal(submissionRows[0].revision,1);
 }finally{reviewFailure=false;await page.close();}
});

test("Workshop and Submissions navigation preserve breadcrumbs, active state, responsive drawer and animated branding", async () => {
  for (const [href, title, active] of [["/instructor/workshops/project%3Aportfolio", "Workshop Builder", "Workshops"], ["/instructor/submissions", "Submissions", "Submissions"]]) { const page = await mount("instructor-shell", "InstructorShell", { children: React.createElement("p", null, "Stage 5D route") }, undefined, { href }); try { assert.equal(page.node.querySelector('.ins-sidebar nav a[aria-current="page"]').textContent, active); assert.equal(page.node.querySelector('.ins-breadcrumb span').textContent, title); assert.ok(page.node.querySelector('.ins-brand .decode-wordmark')); await click(page.node.querySelector('[aria-label="Open navigation"]')); assert.ok(page.node.querySelector('dialog a[href="/instructor/submissions"]')); } finally { await page.close(); } }
});
