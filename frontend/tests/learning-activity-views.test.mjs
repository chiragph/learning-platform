import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import React, { act, StrictMode } from "react";
import { JSDOM, VirtualConsole } from "jsdom";
import ts from "typescript";

const dom = new JSDOM("<!doctype html><body></body>", { url: "http://localhost/quizzes/html", pretendToBeVisual: true }), { window } = dom;
Object.assign(globalThis, { window, document: window.document, IS_REACT_ACT_ENVIRONMENT: true });
window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
window.scrollTo = () => {}; window.HTMLElement.prototype.scrollIntoView = () => {};
// JSDOM has no top-layer dialog implementation. Native focus trapping/backdrop
// rendering still needs browser review; tests exercise our open/close/focus flow.
window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
window.HTMLDialogElement.prototype.close = function () { this.open = false; };
const { createRoot } = await import("react-dom/client"), dependency = createRequire(import.meta.url);
function application() {
  let studentId = "student", snapshot;
  const cache = new Map();
  function load(file) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file).exports;
    const compiled = { exports: {} }; cache.set(file, compiled);
    const source = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
    function require(specifier) {
      if (specifier.endsWith(".css")) return {};
      if (specifier === "next/link") return { __esModule: true, default: ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children) };
      if (specifier === "next/navigation") return { usePathname: () => window.location.pathname };
      if (specifier === "./student-provider") return { useStudent: () => ({ id: studentId, label: "Demo" }) };
      if (specifier === "next/dynamic") return { __esModule: true, default: () => () => React.createElement("div", null, "Monaco client boundary") };
      if (!specifier.startsWith(".") && !specifier.startsWith("@/")) return dependency(specifier);
      const base = specifier.startsWith("@/") ? path.resolve(specifier.slice(2)) : path.resolve(path.dirname(file), specifier);
      return load([base + ".ts", base + ".tsx"].find(fs.existsSync));
    }
    vm.runInNewContext(source, { module: compiled, exports: compiled.exports, require, window, document, console, localStorage: window.localStorage, Element: window.Element, URL: window.URL, FileReader: window.FileReader, atob: window.atob.bind(window), crypto: globalThis.crypto, ResizeObserver: class { observe() {} disconnect() {} }, requestAnimationFrame: callback => setTimeout(callback, 0), cancelAnimationFrame: clearTimeout }, { filename: file });
    return compiled.exports;
  }
  const { ProgressProvider, useProgress } = load("app/components/student/progress-provider.tsx"), { ActivityVisitTracker } = load("app/components/student/activity-visit-tracker.tsx");
  const curriculum = load("app/lib/student/curriculum.ts");
  function Probe() { snapshot = useProgress().progress; return React.createElement("output", { "data-testid": "probe" }, JSON.stringify(curriculum.curriculumStats("html", snapshot))); }
  function tree(View, props) { return React.createElement(StrictMode, null, React.createElement(ProgressProvider, { key: studentId }, React.createElement(ActivityVisitTracker), React.createElement(Probe), React.createElement(View, props))); }
  return { load, tree, setStudent: id => { studentId = id; }, get progress() { return snapshot; }, curriculum };
}
async function mount(app, View, props) {
  const container = document.createElement("div"); document.body.append(container); const errors = [];
  const root = createRoot(container, { onUncaughtError: error => errors.push(error) });
  await act(async () => root.render(app.tree(View, props)));
  return { container, errors, root, async refresh() { await act(async () => root.render(app.tree(View, props))); }, async dispose() { await act(() => root.unmount()); container.remove(); } };
}
async function click(target, label) {
  const button = [...target.container.querySelectorAll("button")].find(button => button.textContent.trim() === label);
  assert.ok(button, "Button not found: " + label); await act(() => button.click()); return button;
}
async function answerAll(target, questions, correct = true) {
  for (let index = 0; index < questions.length; index++) {
    await act(() => target.container.querySelector(`button[aria-label^="Question ${index + 1},"]`).click());
    const value = correct ? questions[index].correct : (questions[index].correct + 1) % 4;
    await act(() => target.container.querySelector(`input[value="${value}"]`).click());
  }
}
async function changeCode(target, value) {
  const input = target.container.querySelector("textarea"), setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
  assert.ok(input); await act(() => { setter.call(input, value); input.dispatchEvent(new window.Event("input", { bubbles: true })); });
}

test("quiz answer changes, missing-answer navigation, confirmation, explanations, history and lower retries integrate with progress", async () => {
  window.localStorage.clear(); window.history.replaceState(null, "", "/quizzes/html");
  const app = application(), { QuizView } = app.load("app/components/student/quiz-view.tsx"), questions = app.load("app/lib/student/quizzes.ts").quizzes.html;
  const target = await mount(app, QuizView, { subject: "html" });
  try {
    assert.equal(app.progress.quizzes.html, undefined); assert.equal(app.progress.visits[0].activityId, "quiz:html");
    await click(target, "Review & submit"); assert.equal(target.container.querySelector("dialog"), null); assert.match(target.container.textContent, /first unanswered question/);
    await act(() => target.container.querySelector('input[value="0"]').click());
    await act(() => target.container.querySelector('input[value="1"]').click());
    assert.equal(app.progress.quizSessions.html.answers[questions[0].id], 1);
    await answerAll(target, questions); await click(target, "Review & submit");
    assert.equal(target.container.querySelector("dialog").open, true); assert.equal(document.activeElement.textContent, "Keep reviewing");
    await click(target, "Keep reviewing"); assert.equal(app.progress.quizzes.html, undefined);
    await click(target, "Review & submit");
    const submit = [...target.container.querySelectorAll("button")].find(button => button.textContent === "Submit quiz");
    await act(() => { submit.click(); submit.click(); });
    assert.equal(app.progress.quizzes.html.latest, 100); assert.equal(app.progress.quizzes.html.attempts, 1);
    assert.equal(target.container.querySelectorAll(".student-quiz-review li").length, questions.length);
    assert.ok(target.container.textContent.includes(questions[0].explanation));
    assert.equal(app.curriculum.curriculumStats("html", app.progress).completed, 1);
    assert.equal(app.progress.quizSessions.html, undefined);
    await click(target, "Retry quiz"); assert.equal(target.container.querySelector('input:checked'), null);
    await answerAll(target, questions, false); await click(target, "Review & submit"); await click(target, "Submit quiz");
    assert.equal(app.progress.quizzes.html.latest, 0); assert.equal(app.progress.quizzes.html.best, 100); assert.equal(app.progress.quizzes.html.attempts, 2);
    assert.equal(app.progress.quizHistory.html.length, 2); assert.equal(app.curriculum.curriculumStats("html", app.progress).completed, 1);
    assert.match(target.container.textContent, /ATTEMPTED · NOT PASSED/); assert.match(target.container.textContent, /Curriculum completed/);
    assert.equal(target.errors.length, 0);
  } finally { await target.dispose(); }
});

test("unfinished quiz answers and current question survive reload and stay isolated by student", async () => {
  window.localStorage.clear(); window.history.replaceState(null, "", "/quizzes/css");
  const app = application(), { QuizView } = app.load("app/components/student/quiz-view.tsx"); let target = await mount(app, QuizView, { subject: "css" });
  try {
    await act(() => target.container.querySelector('input[value="2"]').click());
    await click(target, "Next question →");
    const before = JSON.stringify(app.progress.quizSessions.css);
    await target.dispose(); target = await mount(app, QuizView, { subject: "css" });
    assert.match(target.container.textContent, /Question 2 of 8/); assert.equal(JSON.stringify(app.progress.quizSessions.css), before);
    app.setStudent("other"); await target.refresh(); assert.equal(app.progress.quizSessions.css, undefined); assert.match(target.container.textContent, /Question 1 of 8/);
    app.setStudent("student"); await target.refresh(); assert.equal(JSON.stringify(app.progress.quizSessions.css), before);
    assert.equal(app.progress.quizzes.css, undefined);
  } finally { await target.dispose(); }
});

test("quiz storage failure preserves visible answers and retries the same submission without double counting", async () => {
  window.localStorage.clear(); window.history.replaceState(null, "", "/quizzes/html");
  const app = application(), { QuizView } = app.load("app/components/student/quiz-view.tsx"), questions = app.load("app/lib/student/quizzes.ts").quizzes.html;
  const target = await mount(app, QuizView, { subject: "html" }), original = window.Storage.prototype.setItem;
  try {
    window.Storage.prototype.setItem = () => { throw new Error("quota"); };
    await answerAll(target, questions); await click(target, "Review & submit"); await click(target, "Submit quiz");
    assert.match(target.container.textContent, /You scored 100%/); assert.equal(app.progress.quizzes.html, undefined);
    const retry = [...target.container.querySelectorAll("button")].find(button => button.textContent.startsWith("Retry quiz")); assert.equal(retry.disabled, true);
    window.Storage.prototype.setItem = original;
    const save = [...target.container.querySelectorAll("button")].find(button => button.textContent === "Retry saving attempt");
    await act(() => { save.click(); save.click(); });
    assert.equal(app.progress.quizzes.html.attempts, 1); assert.equal(app.progress.quizzes.html.best, 100);
  } finally { window.Storage.prototype.setItem = original; await target.dispose(); }
});

async function finishProbes(target, app, labId, passed, { wrongToken = false, firstOnly = false } = {}) {
  const lab = app.load("app/lib/student/labs.ts").labs[labId];
  const frames = [...target.container.querySelectorAll(".student-lab-probes iframe")]; assert.equal(frames.length, lab.widths.length);
  for (const [index, frame] of frames.entries()) {
    const payload = JSON.parse(frame.srcdoc.match(/const input = (.*);/)[1]);
    const requirements = lab.requirements.map((requirement, requirementIndex) => ({ id: requirement.id, passed: passed || requirementIndex !== 0 }));
    await act(() => window.dispatchEvent(new window.MessageEvent("message", { source: frame.contentWindow, data: { channel: "decode-preview", type: "lab-result", token: wrongToken ? "stale" : payload.token, requirements } })));
    if (firstOnly && index === 0) break;
  }
}
test("lab checks require every viewport, reject stale tokens, invalidate edits, and complete only on the explicit action", async () => {
  window.localStorage.clear(); window.history.replaceState(null, "", "/challenges/css-grid");
  const app = application(), { ChallengeView } = app.load("app/components/student/challenge-view.tsx"), challenge = app.load("app/lib/student/challenges.ts").challenges.find(challenge => challenge.id === "css-grid");
  const target = await mount(app, ChallengeView, { challenge });
  const complete = () => [...target.container.querySelectorAll("button")].find(button => button.textContent.startsWith("Complete lab"));
  try {
    assert.equal(complete().disabled, true); assert.equal(app.progress.challenges.length, 0);
    assert.match(target.container.textContent, /Images for this lab/);
    await click(target, "Check Solution");
    for (const frame of target.container.querySelectorAll(".student-lab-probes iframe")) { assert.equal(frame.getAttribute("sandbox"), "allow-scripts"); assert.ok(!frame.getAttribute("sandbox").includes("allow-same-origin")); }
    await finishProbes(target, app, "css-grid", true, { wrongToken: true }); assert.equal(app.progress.labChecks["css-grid"], undefined);
    await finishProbes(target, app, "css-grid", true, { firstOnly: true }); assert.equal(complete().disabled, true);
    await finishProbes(target, app, "css-grid", true);
    assert.equal(app.progress.labChecks["css-grid"].passed, true); assert.equal(app.progress.challenges.length, 0); assert.equal(complete().disabled, false);
    await click(target, "Accessible editor"); await changeCode(target, ".gallery { display: block; }");
    assert.equal(complete().disabled, true); assert.match(target.container.textContent, /changed since the last check/);
    await click(target, "Check Solution"); await finishProbes(target, app, "css-grid", false);
    assert.equal(app.progress.labChecks["css-grid"].passed, false); assert.equal(complete().disabled, true);
    await click(target, "Check Solution"); await finishProbes(target, app, "css-grid", true);
    await click(target, "Check Solution"); assert.equal(complete().disabled, true, "a new check invalidates the earlier pass while it is running");
    await click(target, "Cancel check"); assert.equal(complete().disabled, true); assert.equal(app.progress.labChecks["css-grid"].attempts, 3);
    await click(target, "Check Solution"); await finishProbes(target, app, "css-grid", true); await click(target, "Complete lab");
    assert.equal(app.progress.challenges.includes("css-grid"), true); assert.equal(app.progress.labChecks["css-grid"].attempts, 4);
    assert.equal(app.curriculum.curriculumStats("css", app.progress).completed, 1);
    assert.equal(app.curriculum.mostRecentActivity(app.progress).activity.id, "exercise:css-grid");
    assert.equal(app.progress.drafts["challenge-css-grid"], undefined, "lab completion does not silently save code");
    app.setStudent("other"); await target.refresh(); assert.equal(app.progress.labChecks["css-grid"], undefined); assert.equal(app.progress.challenges.length, 0);
    app.setStudent("student"); await target.refresh(); assert.equal(app.progress.labChecks["css-grid"].attempts, 4); assert.equal(app.progress.challenges.includes("css-grid"), true);
    assert.equal(target.errors.length, 0);
  } finally { await target.dispose(); }
});

test("editing, timeout and unmount cancel lab probes without accepting late results", async () => {
  window.localStorage.clear(); window.history.replaceState(null, "", "/challenges/html-heading");
  const app = application(), { LabCheckRunner } = app.load("app/components/student/lab-check-runner.tsx"), lab = app.load("app/lib/student/labs.ts").labs["html-heading"];
  let checked = 0, checking = 0, timeout;
  const setTimer = window.setTimeout, clearTimer = window.clearTimeout;
  window.setTimeout = (callback, delay, ...args) => { if (delay === 7000) { timeout = callback; return -7; } return setTimer(callback, delay, ...args); };
  window.clearTimeout = id => { if (id === -7) timeout = null; else clearTimer(id); };
  const props = { lab, code: { html: "<h1>Initial</h1>", css: "", javascript: "" }, images: [], onChecked: () => checked++, onChecking: () => checking++ };
  const target = await mount(app, LabCheckRunner, props);
  try {
    await click(target, "Check Solution"); assert.equal(checking, 1);
    const frame = target.container.querySelector("iframe"), source = frame.contentWindow, payload = JSON.parse(frame.srcdoc.match(/const input = (.*);/)[1]);
    const message = { channel: "decode-preview", type: "lab-result", token: payload.token, requirements: lab.requirements.map(requirement => ({ id: requirement.id, passed: true })) };
    props.code = { html: "<h1>Changed</h1>", css: "", javascript: "" }; await target.refresh();
    assert.equal(target.container.querySelector("iframe"), null); assert.equal(timeout, null);
    await act(() => window.dispatchEvent(new window.MessageEvent("message", { source, data: message }))); assert.equal(checked, 0);
    await click(target, "Check Solution"); await act(() => timeout());
    assert.match(target.container.textContent, /Checks did not finish/); assert.equal(checked, 0); assert.equal(target.container.querySelector("iframe"), null);
    await click(target, "Check Solution");
    await target.dispose();
    await act(() => window.dispatchEvent(new window.MessageEvent("message", { source, data: message }))); assert.equal(checked, 0); assert.equal(timeout, null);
  } finally { if (target.container.isConnected) await target.dispose(); window.setTimeout = setTimer; window.clearTimeout = clearTimer; }
});

test("workshops save steps and drafts independently, resume correctly, and require a final self-review", async () => {
  window.localStorage.clear(); window.history.replaceState(null, "", "/projects/portfolio");
  const app = application(), { ProjectView } = app.load("app/components/student/project-view.tsx"), project = app.load("app/lib/student/projects.ts").projects[0];
  let target = await mount(app, ProjectView, { project });
  const complete = () => [...target.container.querySelectorAll("button")].find(button => button.textContent.startsWith("Complete workshop"));
  try {
    assert.equal(app.progress.projects.length, 0); assert.equal(complete().disabled, true);
    const stepButtons = () => [...target.container.querySelectorAll('nav[aria-label="Workshop steps"] button')];
    await act(() => stepButtons()[4].click()); assert.match(target.container.textContent, /STEP 5 OF 5/); assert.equal(app.progress.workshops.portfolio.completedSteps.length, 0);
    await act(() => stepButtons()[0].click()); await click(target, "Mark step reviewed");
    assert.equal(app.progress.workshops.portfolio.completedSteps.length, 1); assert.match(target.container.textContent, /STEP 2 OF 5/);
    await click(target, "Accessible editor"); await changeCode(target, "<main>My saved workshop draft</main>"); await click(target, "Save Draft");
    await target.dispose(); target = await mount(app, ProjectView, { project });
    assert.match(target.container.textContent, /STEP 2 OF 5/); assert.equal(app.progress.projects.length, 0);
    await click(target, "Accessible editor"); assert.equal(target.container.querySelector("textarea").value, "<main>My saved workshop draft</main>");
    for (let index = 1; index < 5; index++) await click(target, "Mark step reviewed");
    assert.equal(app.progress.workshops.portfolio.completedSteps.length, 5); assert.equal(app.progress.projects.length, 0);
    assert.equal(complete().disabled, true);
    await act(() => target.container.querySelector('.student-workshop-finish input[type="checkbox"]').click());
    assert.equal(complete().disabled, false);
    await changeCode(target, "<main>A revised draft</main>"); assert.equal(complete().disabled, true); assert.equal(target.container.querySelector('.student-workshop-finish input').checked, false);
    await click(target, "Save Draft"); await act(() => target.container.querySelector('.student-workshop-finish input').click()); await click(target, "Complete workshop");
    assert.equal(app.progress.projects.includes("portfolio"), true); assert.equal(app.progress.drafts["project-portfolio"].html, "<main>A revised draft</main>");
    assert.equal(app.curriculum.curriculumStats("html", app.progress).completed, 1);
    assert.equal(app.curriculum.mostRecentActivity(app.progress).activity.id, "project:portfolio");
    assert.match(target.container.textContent, /Images for this workshop/); assert.equal(target.errors.length, 0);
    app.setStudent("other"); await target.refresh(); assert.equal(app.progress.workshops.portfolio, undefined); assert.equal(app.progress.projects.length, 0); assert.equal(app.progress.drafts["project-portfolio"], undefined);
  } finally { await target.dispose(); }
});

test("legacy workshop completion remains reviewable without inventing step history or replacing its code draft", async () => {
  window.localStorage.clear(); window.history.replaceState(null, "", "/projects/portfolio");
  const app = application(), logic = app.load("app/lib/student/progress.ts"), { ProjectView } = app.load("app/components/student/project-view.tsx"), project = app.load("app/lib/student/projects.ts").projects[0];
  const initial = logic.emptyProgress(); initial.projects = [project.id]; initial.drafts["project-portfolio"] = { html: "Legacy code", css: "", javascript: "" };
  window.localStorage.setItem(logic.progressKey("student"), JSON.stringify(initial));
  const target = await mount(app, ProjectView, { project });
  try {
    assert.match(target.container.textContent, /earlier project completion is preserved/);
    assert.equal(app.progress.workshops.portfolio, undefined); assert.equal(app.curriculum.curriculumStats("html", app.progress).completed, 1);
    assert.equal(target.container.querySelectorAll('nav[aria-label="Workshop steps"] button:not(:disabled)').length, 5);
    await click(target, "Accessible editor"); assert.equal(target.container.querySelector("textarea").value, "Legacy code");
    assert.equal(app.progress.drafts["project-portfolio"].html, "Legacy code");
  } finally { await target.dispose(); }
});

// Execute the actual generated sandbox document, then bridge its messages using
// the real probe WindowProxy as source. JSDOM does not execute iframe srcDoc or
// enforce browser sandbox security; the sandbox attributes are asserted above.
async function executeProbes(target) {
  for (const frame of target.container.querySelectorAll(".student-lab-probes iframe")) {
    let probe, guard, delivered;
    await act(async () => {
      try {
        const result = await new Promise((resolve, reject) => {
          guard = setTimeout(() => reject(new Error("Probe sent no terminal result")), 2000);
          const quiet = new VirtualConsole(); quiet.on("jsdomError", () => {});
          probe = new JSDOM(frame.srcdoc, { runScripts: "dangerously", virtualConsole: quiet, beforeParse(view) {
            // Never deliver rendering callbacks, as in an invisible probe.
            view.requestAnimationFrame = () => 1;
            view.postMessage = data => { if (["lab-result", "lab-error"].includes(data.type)) resolve(data); };
          } });
        });
        delivered = result;
        window.dispatchEvent(new window.MessageEvent("message", { source: frame.contentWindow, data: result }));
      } finally { clearTimeout(guard); probe?.window.close(); }
    });
    assert.equal(delivered.type, "lab-result");
  }
}

test("actual heading probe results gate completion, persist per student, and update all progress views", async () => {
  window.localStorage.clear(); window.history.replaceState(null, "", "/challenges/html-heading");
  const app = application(), { ChallengeView } = app.load("app/components/student/challenge-view.tsx");
  const challenge = app.load("app/lib/student/challenges.ts").challenges.find(item => item.id === "html-heading");
  let target = await mount(app, ChallengeView, { challenge });
  const complete = () => [...target.container.querySelectorAll("button")].find(button => button.textContent.startsWith("Complete lab"));
  try {
    await click(target, "Accessible editor"); await changeCode(target, "<h1>Incorrect title</h1><p>  </p>");
    await click(target, "Check Solution"); await executeProbes(target);
    assert.equal(app.progress.labChecks[challenge.id].passed, false);
    assert.equal(complete().disabled, true); assert.equal(app.progress.challenges.length, 0);
    const results = () => [...target.container.querySelectorAll(".student-lab-results li")];
    assert.equal(results().length, 4); assert.equal(results().filter(item => item.dataset.passed === "false").length, 2);
    assert.match(results()[1].textContent, /Needs work.*Heading says Hello, DECODE!/);
    await click(target, "Save Draft");
    await target.dispose(); target = await mount(app, ChallengeView, { challenge });
    assert.equal(complete().disabled, true); assert.equal(app.progress.challenges.length, 0);
    await click(target, "Accessible editor");
    await changeCode(target, "<h1>Hello, DECODE!</h1>\n<p>I am learning HTML with DECODE.</p>");
    await click(target, "Check Solution"); await executeProbes(target);
    assert.equal(results().length, 4); assert.ok(results().every(item => item.dataset.passed === "true"));
    assert.ok(results().every(item => item.textContent.startsWith("Passed")));
    assert.equal(complete().disabled, false); assert.equal(app.progress.challenges.length, 0);
    await click(target, "Save Draft"); await click(target, "Complete lab");
    assert.deepEqual([...app.progress.challenges], [challenge.id]);
    assert.equal(app.progress.labChecks[challenge.id].attempts, 2);
    await target.dispose(); target = await mount(app, ChallengeView, { challenge });
    assert.match(target.container.textContent, /Completion saved/);
    assert.equal(app.progress.drafts["challenge-html-heading"].html, "<h1>Hello, DECODE!</h1>\n<p>I am learning HTML with DECODE.</p>");
    const total = app.curriculum.activityLocations().length, stats = app.curriculum.curriculumStats("html", app.progress);
    const percent = Math.round(100 / total);
    for (const [file, name, route] of [
      ["dashboard-view", "DashboardView", "/dashboard"], ["curriculum-view", "CoursesView", "/courses"], ["progress-view", "ProgressView", "/progress"],
    ]) {
      window.history.replaceState(null, "", route);
      const View = app.load("app/components/student/" + file + ".tsx")[name];
      await act(async () => target.root.render(app.tree(View, {})));
      const bar = target.container.querySelector('progress[aria-label^="HTML"][aria-label$=" completion"]');
      assert.ok(bar, name + " missing HTML progress; labels=" + [...target.container.querySelectorAll("progress")].map(item => item.getAttribute("aria-label")) + "; errors=" + target.errors.map(error => error.stack));
      assert.equal(Number(bar.value), stats.percent, name + " shows the actual HTML percentage");
      if (name === "CoursesView") {
        const row = target.container.querySelector('a.curriculum-activity[href="/challenges/html-heading"]');
        assert.equal(row.querySelector("[data-status]").dataset.status, "completed");
      } else assert.equal(Number(target.container.querySelector('progress[aria-label^="Overall"]').value), percent);
      if (name !== "ProgressView") assert.equal(target.container.querySelector(".curriculum-continue .student-button").getAttribute("href"), "/challenges/html-heading");
    }
    app.setStudent("other"); await act(async () => target.root.render(app.tree(ChallengeView, { challenge })));
    assert.equal(app.progress.challenges.length, 0); assert.equal(app.progress.labChecks[challenge.id], undefined);
    assert.equal(target.errors.length, 0);
  } finally { await target.dispose(); }
});

test("checker failures reject unrelated frames and stale jobs, stop promptly, and never persist a pass", async () => {
  window.localStorage.clear(); window.history.replaceState(null, "", "/challenges/html-heading");
  const app = application(), { ChallengeView } = app.load("app/components/student/challenge-view.tsx");
  const challenge = app.load("app/lib/student/challenges.ts").challenges.find(item => item.id === "html-heading");
  const target = await mount(app, ChallengeView, { challenge });
  try {
    await click(target, "Check Solution");
    const frame = target.container.querySelector(".student-lab-probes iframe"), token = JSON.parse(frame.srcdoc.match(/const input = (.*);/)[1]).token;
    const error = { channel: "decode-preview", type: "lab-error", token };
    for (const [source, data] of [[window, error], [frame.contentWindow, { ...error, token: "old-job" }], [frame.contentWindow, { ...error, type: "error" }]]) {
      await act(() => window.dispatchEvent(new window.MessageEvent("message", { source, data })));
      assert.ok(target.container.querySelector(".student-lab-probes iframe"));
    }
    await act(() => window.dispatchEvent(new window.MessageEvent("message", { source: frame.contentWindow, data: error })));
    assert.equal(target.container.querySelector(".student-lab-probes iframe"), null);
    assert.match(target.container.textContent, /checker could not evaluate.*No completion was granted/);
    assert.equal(app.progress.labChecks[challenge.id], undefined); assert.equal(app.progress.challenges.length, 0);
    assert.equal([...target.container.querySelectorAll("button")].find(button => button.textContent === "Complete lab").disabled, true);
    await click(target, "Check Solution"); assert.ok(target.container.querySelector(".student-lab-probes iframe"));
  } finally { await target.dispose(); }
});

test("a timed-out heading check ignores its late pass and cannot persist completion after reload", async () => {
  window.localStorage.clear(); window.history.replaceState(null, "", "/challenges/html-heading");
  const app = application(), { ChallengeView } = app.load("app/components/student/challenge-view.tsx");
  const challenge = app.load("app/lib/student/challenges.ts").challenges.find(item => item.id === "html-heading");
  const lab = app.load("app/lib/student/labs.ts").labs[challenge.id];
  let target = await mount(app, ChallengeView, { challenge }), timeout;
  const originalSet = window.setTimeout, originalClear = window.clearTimeout;
  window.setTimeout = (callback, delay, ...args) => { if (delay === 7000) { timeout = callback; return -7; } return originalSet(callback, delay, ...args); };
  window.clearTimeout = id => { if (id === -7) timeout = null; else originalClear(id); };
  try {
    await click(target, "Check Solution");
    const frame = target.container.querySelector(".student-lab-probes iframe"), source = frame.contentWindow;
    const token = JSON.parse(frame.srcdoc.match(/const input = (.*);/)[1]).token;
    await act(() => timeout());
    const data = { channel: "decode-preview", type: "lab-result", token, requirements: lab.requirements.map(({ id }) => ({ id, passed: true })) };
    await act(() => window.dispatchEvent(new window.MessageEvent("message", { source, data })));
    assert.match(target.container.textContent, /Checks did not finish.*No completion was granted/);
    assert.equal(app.progress.labChecks[challenge.id], undefined); assert.equal(app.progress.challenges.length, 0);
    assert.equal(target.container.querySelector(".student-lab-probes iframe"), null);
    await target.dispose(); target = await mount(app, ChallengeView, { challenge });
    assert.equal(app.progress.challenges.length, 0); assert.equal(app.progress.labChecks[challenge.id], undefined);
    assert.equal([...target.container.querySelectorAll("button")].find(button => button.textContent === "Complete lab").disabled, true);
  } finally { await target.dispose(); window.setTimeout = originalSet; window.clearTimeout = originalClear; }
});
