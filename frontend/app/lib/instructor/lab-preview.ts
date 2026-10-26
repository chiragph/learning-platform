import { buildPreview } from "../student/preview";
import { evaluateLab } from "../student/lab-validation";
import type { LabId } from "../student/labs";
import type { Code } from "../student/types";
import { labReadiness } from "./lab";
import type { LabCheck, LabCheckResult, LabContent } from "./lab-types";

// Trusted, self-contained runner serialized into an opaque iframe. Never pass
// the application document/window here. Authored configuration contains no code.
export function evaluateInstructorLab(document: Document, view: Window, checks: LabCheck[], errors: number, legacy: typeof evaluateLab): LabCheckResult[] {
  const cached = new Map<LabId, LabCheckResult[]>();
  const text = (element: Element | null) => element?.textContent?.trim() ?? "";
  return checks.map(check => {
    let passed = false;
    try {
      if (check.type === "student") {
        if (!cached.has(check.labId)) cached.set(check.labId, legacy(document, view, check.labId, errors));
        passed = cached.get(check.labId)!.find(r => r.id === check.requirementId)?.passed === true;
      } else if (check.type === "runtime") passed = errors === 0;
      else if (check.type === "element") { const count = document.querySelectorAll(check.selector).length; passed = check.min !== null && count >= check.min && (check.max === null || count <= check.max); }
      else {
        const element = document.querySelector(check.selector);
        if (check.type === "text") passed = !!element && (check.match === "exact" ? text(element) === check.expected.trim() : text(element).includes(check.expected.trim()));
        if (check.type === "attribute") passed = !!element && element.getAttribute(check.attribute) === check.expected;
        if (check.type === "style") passed = !!element && view.getComputedStyle(element).getPropertyValue(check.property).trim() === check.expected.trim();
        if (check.type === "click-text" && element && typeof (element as HTMLElement).click === "function") { (element as HTMLElement).click(); passed = text(document.querySelector(check.target)) === check.expected.trim(); }
      }
    } catch { passed = false; }
    return { id: check.id, passed: Boolean(passed) };
  });
}
const literal = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
export function buildInstructorLabPreview(code: Code, token: string, content?: LabContent): string {
  const document = buildPreview(code, token);
  if (!content) return document;
  if (!labReadiness(content).ready) throw new Error("Complete the lab readiness checks before checking a solution.");
  // Install the observer BEFORE the shared bootstrap runs learner scripts. The
  // bootstrap keeps the student's CSP, HTML filtering and navigation controls.
  const probe = `(() => {
    const token = ${literal(token)}, checks = ${literal(content.checks)};
    let errors = 0;
    addEventListener("error", () => errors++);
    addEventListener("unhandledrejection", () => errors++);
    const run = () => setTimeout(() => {
      try {
        const results = (${evaluateInstructorLab.toString()})(document, window, checks, errors, (${evaluateLab.toString()}));
        results.forEach((r, i) => { if (checks[i].type === "runtime" || checks[i].type === "student" && checks[i].requirementId === "runtime") r.passed = errors === 0; });
        parent.postMessage({ channel: "decode-instructor-lab", token, type: "result", results, runtimePassed: errors === 0 }, "*");
      } catch { parent.postMessage({ channel: "decode-instructor-lab", token, type: "error" }, "*"); }
    }, 0);
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run, { once: true }); else run();
  })();`;
  return document.replace("<body><script>", `<body><script>${probe}</script><script>`);
}
export function isInstructorLabResult(value: unknown, token: string, checks: LabCheck[]): value is { results: LabCheckResult[]; runtimePassed: boolean } {
  if (!value || typeof value !== "object") return false;
  const message = value as Record<string, unknown>;
  return message.channel === "decode-instructor-lab" && message.token === token && message.type === "result" && typeof message.runtimePassed === "boolean" && Array.isArray(message.results) && message.results.length === checks.length && message.results.every((r, i) => r && typeof r === "object" && r.id === checks[i].id && typeof r.passed === "boolean");
}
export function isInstructorLabError(value: unknown, token: string): boolean {
  if (!value || typeof value !== "object") return false;
  const message = value as Record<string, unknown>;
  return message.channel === "decode-instructor-lab" && message.token === token && message.type === "error";
}
