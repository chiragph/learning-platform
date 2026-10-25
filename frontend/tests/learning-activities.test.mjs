import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { JSDOM, VirtualConsole } from "jsdom";
import { build } from "esbuild";

function modules() {
  const cache = new Map();
  function load(file) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file).exports;
    const compiled = { exports: {} }; cache.set(file, compiled);
    const source = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    vm.runInNewContext(source, { module: compiled, exports: compiled.exports, require: relative => load(path.resolve(path.dirname(file), relative + ".ts")), console }, { filename: file });
    return compiled.exports;
  }
  return name => load("app/lib/student/" + name + ".ts");
}
const plain = value => JSON.parse(JSON.stringify(value));
const at = "2026-10-25T15:00:00.000Z";

test("quiz sessions and answer history retain accurate scores, retry best scores, and explicit submission semantics", () => {
  const load = modules(), { quizzes, scoreQuiz } = load("quizzes"), logic = load("progress"), actions = load("activity-progress"), curriculum = load("curriculum");
  for (const subject of Object.keys(quizzes)) {
    const questions = quizzes[subject], answers = Object.fromEntries(questions.map(question => [question.id, question.correct]));
    let progress = logic.emptyProgress();
    progress = actions.saveQuizSession(progress, subject, { [questions[0].id]: 3, unknown: 1 }, 2, at);
    assert.equal(progress.quizzes[subject], undefined); assert.equal(progress.quizSessions[subject].index, 2);
    assert.equal(progress.quizSessions[subject].answers.unknown, undefined);
    assert.equal(curriculum.activityStatus(curriculum.findCurriculumActivity("quiz:" + subject).activity, progress), "in-progress");
    const partial = { id: "partial", answers: {}, at };
    assert.equal(actions.submitQuizAttempt(progress, subject, partial), progress);
    const attempt = { id: "first", answers, at };
    progress = actions.submitQuizAttempt(progress, subject, attempt);
    assert.equal(progress.quizzes[subject].latest, 100); assert.equal(progress.quizzes[subject].attempts, 1);
    assert.equal(progress.quizSessions[subject], undefined); assert.equal(progress.quizHistory[subject][0].correct, questions.length);
    assert.equal(actions.submitQuizAttempt(progress, subject, attempt), progress, "replayed submission cannot add another attempt");
    answers[questions[0].id] = (questions[0].correct + 1) % 4;
    assert.equal(progress.quizHistory[subject][0].answers[questions[0].id], questions[0].correct, "history snapshots do not alias editable answers");
    progress = actions.submitQuizAttempt(progress, subject, { id: "retry", answers, at });
    assert.equal(progress.quizzes[subject].latest, scoreQuiz(questions, answers).percent);
    assert.equal(progress.quizzes[subject].best, 100); assert.equal(progress.quizzes[subject].attempts, 2);
    assert.equal(curriculum.activityComplete(curriculum.findCurriculumActivity("quiz:" + subject).activity, progress), true);
    const restored = logic.normalizeProgress(JSON.parse(JSON.stringify(progress)));
    assert.deepEqual(plain(restored.quizHistory), plain(progress.quizHistory));
    for (let index = 0; index < 23; index++) progress = actions.submitQuizAttempt(progress, subject, { id: "extra-" + index, answers, at });
    assert.equal(progress.quizzes[subject].attempts, 25); assert.equal(progress.quizHistory[subject].length, 20);
    assert.equal(progress.quizzes[subject].best, 100);
  }
  const unchanged = logic.emptyProgress(); assert.equal(actions.saveQuizSession(unchanged, "toString", {}, 0, at), unchanged);
  assert.equal(logic.saveQuiz(logic.emptyProgress(), "html", Number.NaN, at).quizzes.html, undefined);
});

test("six lab result records and stable workshop steps stay separate from code and curriculum completion", () => {
  const load = modules(), logic = load("progress"), actions = load("activity-progress"), { labs } = load("labs"), { projects } = load("projects"), curriculum = load("curriculum");
  let progress = logic.emptyProgress(); progress.drafts["project-portfolio"] = { html: "Keep my code", css: "", javascript: "" };
  for (const lab of Object.values(labs)) {
    const requirements = lab.requirements.map(requirement => ({ id: requirement.id, passed: true }));
    progress = actions.saveLabCheck(progress, lab.id, requirements, at);
    assert.equal(progress.labChecks[lab.id].passed, true);
    assert.equal(progress.challenges.length, 0);
    assert.equal(curriculum.activityStatus(curriculum.findCurriculumActivity("exercise:" + lab.id).activity, progress), "in-progress");
    const failed = requirements.map((requirement, index) => ({ ...requirement, passed: index !== 0 }));
    progress = actions.saveLabCheck(progress, lab.id, failed, at);
    assert.equal(progress.labChecks[lab.id].passed, false); assert.equal(progress.labChecks[lab.id].attempts, 2);
  }
  const ids = projects.flatMap(project => project.steps.map(step => step.id));
  assert.equal(new Set(ids).size, 20);
  for (const project of projects) {
    const last = project.steps.at(-1);
    progress = actions.selectWorkshopStep(progress, project.id, last.id, at);
    assert.equal(progress.workshops[project.id].currentStep, last.id, "all steps are open before earlier steps are reviewed");
    assert.equal(actions.completeWorkshop(progress, project.id, at), progress);
    for (const step of project.steps) progress = actions.setWorkshopStep(progress, project.id, step.id, true, at);
    assert.equal(progress.projects.includes(project.id), false, "reviewing every step is not final completion");
    const events = progress.activity.length;
    progress = actions.setWorkshopStep(progress, project.id, last.id, true, at);
    assert.equal(progress.activity.length, events, "rechecking a reviewed step does not add another activity");
    progress = actions.setWorkshopStep(progress, project.id, last.id, false, at);
    assert.equal(actions.completeWorkshop(progress, project.id, at), progress);
    progress = actions.setWorkshopStep(progress, project.id, last.id, true, at);
    progress = actions.completeWorkshop(progress, project.id, at);
    assert.equal(progress.projects.includes(project.id), true);
    assert.equal(actions.completeWorkshop(progress, project.id, at), progress);
    assert.equal(curriculum.activityComplete(curriculum.findCurriculumActivity("project:" + project.id).activity, progress), true);
  }
  assert.equal(progress.drafts["project-portfolio"].html, "Keep my code");
  assert.equal(curriculum.activityLocations().length, 38);
  assert.equal(new Set(progress.activity.map(item => item.id)).size, progress.activity.length, "same-millisecond actions have unique recent-activity IDs");
  const restored = logic.normalizeProgress(JSON.parse(JSON.stringify(progress)));
  assert.deepEqual(plain(restored.workshops), plain(progress.workshops));
  assert.deepEqual(plain(restored.labChecks), plain(progress.labChecks));
});

test("legacy demo data survives additive progress normalization and malformed activity records cannot grant completion", () => {
  const load = modules(), logic = load("progress"), { projects } = load("projects"), { labs } = load("labs"), { quizzes } = load("quizzes");
  const legacy = { version: 1, lessons: ["html-introduction"], challenges: ["css-card"], projects: ["portfolio"], quizzes: { html: { best: 88, latest: 50, attempts: 2, at } }, currentLesson: "html-introduction", visits: [], activity: [], drafts: { "challenge-css-card": { html: "Existing draft", css: ".card{}", javascript: "" } } };
  const normalized = logic.normalizeProgress(legacy);
  for (const key of Object.keys(legacy)) assert.deepEqual(plain(normalized[key]), plain(legacy[key]));
  const answers = Object.fromEntries(quizzes.html.map(question => [question.id, (question.correct + 1) % 4]));
  const bad = logic.normalizeProgress({ version: 1,
    quizHistory: { html: [{ id: "real-answers", at, answers, percent: 100, correct: 8, total: 8 }, { id: "empty", at, answers: {} }] },
    quizSessions: { css: { at, index: 99, answers: {} }, html: { at, index: 0, answers: { "html-1": 999, unknown: 2 } } },
    labChecks: { "html-heading": { attempts: 1, at, passed: true, requirements: labs["html-heading"].requirements.map(requirement => ({ id: requirement.id, passed: false })) }, toString: { attempts: 1, at, requirements: [] } },
    workshops: { portfolio: { completedSteps: [projects[0].steps[0].id, "unknown", projects[0].steps[0].id], currentStep: "missing", at } },
  });
  assert.equal(bad.quizHistory.html[0].percent, 0); assert.equal(bad.quizHistory.html.length, 1);
  assert.equal(bad.quizSessions.css, undefined); assert.equal(Object.keys(bad.quizSessions.html.answers).length, 0);
  assert.equal(bad.labChecks["html-heading"].passed, false);
  assert.deepEqual(plain(bad.workshops.portfolio.completedSteps), [projects[0].steps[0].id]);
  assert.equal(bad.workshops.portfolio.currentStep, projects[0].steps[1].id);
  assert.equal(bad.lessons.length + bad.challenges.length + bad.projects.length + Object.keys(bad.quizzes).length, 0);
});

function runLab(load, id, code, width = 800, setup = () => {}) {
  const { buildPreview } = load("preview"), messages = [], frames = [], tasks = [], console = new VirtualConsole();
  console.on("jsdomError", () => {});
  const dom = new JSDOM(buildPreview(code, "lab-token", undefined, { images: [], allowOnlineImages: true }, id), {
    runScripts: "dangerously", virtualConsole: console,
    beforeParse(view) {
      Object.defineProperty(view, "innerWidth", { value: width });
      view.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
      view.setTimeout = callback => { tasks.push(callback); return tasks.length; };
      view.postMessage = message => messages.push(message); setup(view);
    },
  });
  // Model a fully clipped iframe: no animation callbacks are delivered.
  dom.window.document.dispatchEvent(new dom.window.Event("DOMContentLoaded"));
  for (let index = 0; index < tasks.length && index < 30; index++) tasks[index]();
  const results = messages.find(message => message.type === "lab-result")?.requirements;
  return { dom, messages, results, frames, close: () => dom.window.close() };
}
const code = (html, javascript = "", css = "") => ({ html, javascript, css });
const passed = results => results.every(result => result.passed);

test("sandboxed HTML labs check structure and content instead of accepting any running code", () => {
  const load = modules();
  for (const [id, valid, invalid] of [
    ["html-heading", code("<h1>Hello, DECODE!</h1><p>A real paragraph.</p>"), code("<h1>Hello, DECODE!</h1><h1>Extra</h1><p> </p>")],
    ["html-link", code('<nav><a href="#learning">Start learning</a></nav><main id="learning"><h1>A useful heading</h1></main>'), code('<a href="#learning">Start learning</a><div id="learning"><h1>Not semantic main</h1></div>')],
  ]) {
    const good = runLab(load, id, valid), bad = runLab(load, id, invalid);
    try { assert.equal(passed(good.results), true); assert.equal(passed(bad.results), false); }
    finally { good.close(); bad.close(); }
  }
});

test("sandboxed JavaScript labs exercise repeated interactions and catch runtime errors and hardcoded outcomes", () => {
  const load = modules();
  const buttonHtml = '<button id="greet">Greet</button><p id="message">Hello, developer!</p>';
  const handler = 'document.querySelector("#greet").addEventListener("click", () => { document.querySelector("#message").textContent = "Hello, developer!"; });';
  const cases = [
    ["javascript-button", code(buttonHtml, handler), true],
    ["javascript-button", code(buttonHtml), false],
    ["javascript-button", code(buttonHtml, handler.replace("});", "}, { once: true });")), false],
    ["javascript-button", code(buttonHtml, handler.replace('textContent = "Hello, developer!";', 'textContent = "Hello, developer!"; throw new Error("broken handler");')), false],
    ["javascript-list", code('<ul id="goals"></ul><button id="add-goal">Add</button>', 'const list = document.querySelector("#goals"); function add(text) { const li = document.createElement("li"); li.textContent = text; list.append(li); } ["HTML", "CSS", "JS"].forEach(add); document.querySelector("button").addEventListener("click", () => add("Practice"));'), true],
    ["javascript-list", code('<ul id="goals"><li>HTML</li><li>CSS</li><li>JS</li></ul><button>Add</button>', 'document.querySelector("button").onclick = () => { document.querySelector("#goals").innerHTML = "<li>HTML</li><li>CSS</li><li>JS</li><li>Once</li>"; };'), false],
  ];
  for (const [id, source, expected] of cases) { const run = runLab(load, id, source); try { assert.equal(passed(run.results), expected); } finally { run.close(); } }
});

// JSDOM does not lay out CSS. These explicit geometry/style fixtures validate
// requirement logic; real browser CSS rendering remains on the review checklist.
function cssFixture(view, width, broken = "") {
  const cardWidth = Math.min(448, width - 48), galleryWidth = width - 48;
  Object.defineProperty(view.HTMLElement.prototype, "clientWidth", { get: () => width });
  Object.defineProperty(view.HTMLElement.prototype, "scrollWidth", { get: () => broken === "fits" ? width + 100 : width });
  view.HTMLElement.prototype.getBoundingClientRect = function () {
    const size = this.matches("article.card") ? cardWidth : this.matches(".gallery") ? galleryWidth : width === 320 ? galleryWidth : (galleryWidth - 32) / 3;
    const left = this.matches("article.card") ? (width - size) / 2 : 24;
    return { width: size, left, right: left + size, height: 100, top: 0, bottom: 100 };
  };
  view.getComputedStyle = () => ({ paddingTop: broken === "padding" ? "0px" : "24px", paddingRight: "24px", paddingBottom: "24px", paddingLeft: "24px", lineHeight: broken === "line-height" ? "16px" : "25.6px", fontSize: "16px", maxWidth: "448px", display: broken === "grid" ? "block" : "grid", gridTemplateColumns: broken === "columns" || width === 800 ? "240px 240px 240px" : "272px", rowGap: broken === "gap" ? "0px" : "16px", columnGap: "16px", getPropertyValue: property => property.endsWith("style") ? broken === "border" ? "none" : "solid" : "1px" });
}
test("CSS labs evaluate each documented requirement at both fixed viewport sizes", () => {
  const load = modules();
  for (const width of [320, 800]) for (const [id, html, failures] of [
    ["css-card", '<article class="card"><h1>Read</h1><p>Small steps help.</p></article>', ["padding", "border", "line-height", "fits"]],
    ["css-grid", '<div class="gallery"><article>HTML</article><article>CSS</article><article>JS</article></div>', ["grid", "gap", "fits", ...(width === 320 ? ["columns"] : [])]],
  ]) {
    const good = runLab(load, id, code(html), width, view => cssFixture(view, width));
    try { assert.equal(passed(good.results), true, id + " at " + width); } finally { good.close(); }
    for (const failure of failures) {
      const bad = runLab(load, id, code(html), width, view => cssFixture(view, width, failure));
      try { assert.equal(bad.results.find(result => result.id === failure).passed, false, failure + " at " + width); } finally { bad.close(); }
    }
  }
});

test("lab messages require the current token and exact requirement schema", () => {
  const load = modules(), { isLabCheckMessage } = load("preview"), { labs, findLab } = load("labs"), lab = labs["html-heading"];
  const message = { channel: "decode-preview", type: "lab-result", token: "current", requirements: lab.requirements.map(requirement => ({ id: requirement.id, passed: true })) };
  assert.equal(isLabCheckMessage(message, "current", lab), true);
  assert.equal(isLabCheckMessage(message, "old", lab), false);
  assert.equal(isLabCheckMessage({ ...message, requirements: [{ id: "all", passed: true }] }, "current", lab), false);
  assert.equal(isLabCheckMessage({ ...message, requirements: message.requirements.map(item => ({ ...item, passed: "true" })) }, "current", lab), false);
  assert.equal(findLab("toString"), undefined);
});

test("lab validation remains self-contained when bundled and minified for production", async () => {
  const bundled = await build({ entryPoints: ["app/lib/student/preview.ts"], bundle: true, write: false, platform: "node", format: "cjs", target: "es2017", minify: true });
  const compiled = { exports: {} };
  vm.runInNewContext(bundled.outputFiles[0].text, { module: compiled, exports: compiled.exports });
  const load = name => { assert.equal(name, "preview"); return compiled.exports; };
  const result = runLab(load, "html-heading", code("<h1>Hello, DECODE!</h1><p>It works.</p>"));
  try { assert.equal(passed(result.results), true); } finally { result.close(); }
});

test("heading checks finish even when the hidden iframe never receives animation frames", () => {
  const run = runLab(modules(), "html-heading", code("<h1>Hello, DECODE!</h1>\n<p>I am learning HTML with DECODE.</p>"));
  try {
    assert.ok(run.results, "a hidden probe must send results without a repaint");
    assert.equal(run.frames.length, 0);
    assert.deepEqual(plain(run.results), ["heading", "heading-text", "paragraph", "runtime"].map(id => ({ id, passed: true })));
  } finally { run.close(); }
});

test("heading lab reports all four requirements independently, including runtime failures", () => {
  const valid = "<h1>Hello, DECODE!</h1><p>I am learning HTML with DECODE.</p>";
  for (const [html, javascript, failed] of [
    [valid, "", []],
    [valid + "<h1>Extra heading</h1>", "", ["heading"]],
    [valid.replace("Hello, DECODE!", "Hello"), "", ["heading-text"]],
    [valid.replace("I am learning HTML with DECODE.", "  "), "", ["paragraph"]],
    [valid, 'throw new Error("Fix this script");', ["runtime"]],
    ["<h2>Wrong element</h2>", "", ["heading", "heading-text", "paragraph"]],
  ]) {
    const run = runLab(modules(), "html-heading", code(html, javascript));
    try { assert.deepEqual(plain(run.results.filter(item => !item.passed).map(item => item.id)), failed); }
    finally { run.close(); }
  }
});

test("lab checks wait for learner DOMContentLoaded handlers without waiting for a repaint", () => {
  const run = runLab(modules(), "html-heading", code("", 'document.addEventListener("DOMContentLoaded", () => { document.body.innerHTML = "<h1>Hello, DECODE!</h1><p>Ready to learn.</p>"; });'));
  try { assert.equal(passed(run.results), true); assert.equal(run.frames.length, 0); }
  finally { run.close(); }
});

test("internal validator failures send a distinct fail-closed message rather than disappearing into a timeout", () => {
  const load = modules(), run = runLab(load, "html-heading", code("<h1>Hello, DECODE!</h1><p>Practice.</p>"), 800, view => {
    view.document.querySelectorAll = () => { throw new Error("Unavailable DOM query"); };
  });
  try {
    assert.equal(run.results, undefined);
    const error = run.messages.find(message => message.type === "lab-error");
    assert.equal(load("preview").isLabCheckError(error, "lab-token"), true);
    assert.equal(load("preview").isLabCheckError(error, "stale"), false);
    assert.equal(load("preview").isLabCheckError({ ...error, type: "error" }, "lab-token"), false);
  } finally { run.close(); }
});
