import type { Challenge, Code } from "./types";

export type PreviewMessage = { channel: "decode-preview"; token: string; type: "ready" | "log" | "error" | "check"; text: string; passed?: boolean };
export function isPreviewMessage(value: unknown, token: string): value is PreviewMessage {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return v.channel === "decode-preview" && v.token === token && ["ready", "log", "error", "check"].includes(String(v.type)) && typeof v.text === "string" && v.text.length <= 2000 && (v.type !== "check" || typeof v.passed === "boolean");
}
const literal = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");

// This string is a standalone document. All learner code and DOM checks execute
// INSIDE an opaque-origin iframe, never in the React application.
export function buildPreview(code: Code, token: string, check?: Challenge["check"]) {
  const payload = literal({ ...code, token, check });
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; font-src 'none'; object-src 'none'; frame-src 'none'; worker-src 'none'; form-action 'none'; base-uri 'none'"><title>DECODE isolated preview</title></head><body><script>
(() => {
  const input = ${payload};
  const send = (type, text, extra = {}) => parent.postMessage({ channel: "decode-preview", token: input.token, type, text: String(text).slice(0, 2000), ...extra }, "*");
  let errors = 0;
  addEventListener("error", event => { errors++; send("error", event.message + (event.lineno ? " (line " + event.lineno + ")" : "")); });
  addEventListener("unhandledrejection", event => { errors++; send("error", String(event.reason)); });
  let logCount = 0;
  for (const level of ["log", "warn", "error"]) {
    const original = console[level].bind(console);
    console[level] = (...values) => { original(...values); if (logCount++ < 30) send("log", values.map(v => { try { return typeof v === "object" ? JSON.stringify(v) : String(v); } catch { return "[unprintable value]"; } }).join(" ")); };
  }
  // Parse HTML without executing inline HTML scripts. Use the JavaScript editor
  // for scripts; strip nested browsing contexts, navigation metadata and bases.
  const parsed = new DOMParser().parseFromString(input.html, "text/html");
  parsed.querySelectorAll("script, iframe, frame, object, embed, base, meta, link").forEach(el => el.remove());
  document.head.append(...Array.from(parsed.head.children));
  document.body.replaceChildren(...Array.from(parsed.body.childNodes));
  const style = document.createElement("style"); style.textContent = input.css; document.head.append(style);
  // Native form submission and external link navigation are not part of a local exercise.
  document.addEventListener("submit", event => event.preventDefault());
  document.addEventListener("click", event => { const a = event.target.closest?.("a"); if (a && !a.getAttribute("href")?.startsWith("#")) { event.preventDefault(); send("log", "External navigation is disabled in this local preview."); } }, true);
  const script = document.createElement("script"); script.textContent = input.javascript; document.body.append(script);
  setTimeout(() => {
    send("ready", errors ? "Preview rendered with JavaScript errors. Review the messages below." : "Preview rendered. Review the output and test its interactions.");
    if (!input.check) return;
    let passed = false;
    try {
      if (input.check === "heading") passed = document.querySelectorAll("h1").length === 1 && document.querySelector("h1").textContent.trim() === "Hello, DECODE!" && Array.from(document.querySelectorAll("p")).some(p => p.textContent.trim());
      if (input.check === "link") passed = Boolean(document.querySelector("main#learning h1") && Array.from(document.querySelectorAll('nav a[href="#learning"]')).some(a => a.textContent.trim() === "Start learning"));
      if (input.check === "button") { document.querySelector("button#greet")?.click(); passed = document.querySelector("#message")?.textContent.trim() === "Hello, developer!"; }
      passed = Boolean(passed && errors === 0);
      send("check", passed ? "Basic exercise checks passed." : "Basic checks did not pass. Review the instructions and any errors, then run again.", { passed });
    } catch { send("check", "Unable to finish the basic check. Review your code and retry.", { passed: false }); }
  }, 80);
})();
</script></body></html>`;
}
