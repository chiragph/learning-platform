import { MotionControl } from "./interactions";

const snippets = [
  { name: "HTML", file: "index.html", className: "html", lines: ["<h1>Hello, world!</h1>", "<p>My first website.</p>", '<button id="hello">', "  Say hello", "</button>"] },
  { name: "CSS", file: "style.css", className: "css", lines: ["body {", "  background: #FAF9F6;", "  font-family: sans-serif;", "}", "button {", "  background: #315DB5;", "  color: white;", "  border-radius: 8px;", "}"] },
  { name: "JavaScript", file: "script.js", className: "js", lines: ['const btn = document', '  .querySelector("#hello");', "", 'btn.onclick = () => {', '  btn.textContent =', '    "You\'re ready!";', "};"] },
] as const;

export function CodeDemo() {
  return (
    <figure className="decode-demo min-w-0" aria-labelledby="demo-caption">
      <div className="mb-3 flex items-center justify-between gap-3"><span className="font-mono text-xs text-secondary">A FEW LINES. SOMETHING REAL.</span><MotionControl compact /></div>
      <div className="decode-workspace overflow-hidden rounded-xl border border-border bg-white">
        <div aria-hidden="true">
          <div className="decode-editor-tabs flex border-b border-border font-mono text-xs">{snippets.map((snippet) => <span key={snippet.name} className={`decode-editor-tab decode-tab-${snippet.className}`}><span className={`decode-file-dot decode-dot-${snippet.className}`} />{snippet.file}</span>)}</div>
          <div className="decode-editor relative">
            {snippets.map((snippet) => (
              <div className={`decode-code-panel decode-panel-${snippet.className}`} key={snippet.name}>
                <pre className="font-mono"><code>{snippet.lines.map((line, index) => <span className="decode-code-line" key={index}><span className="decode-line-number">{index + 1}</span><span className={`decode-code-text decode-line-${index}`}>{line || " "}</span></span>)}</code></pre>
              </div>
            ))}
          </div>
          <div className="decode-browser-toolbar flex items-center gap-3 border-y border-border px-4 py-3"><span className="flex gap-1.5"><i /><i /><i /></span><span className="decode-browser-address flex-1 rounded border border-border px-3 py-1 text-center font-mono">my-first-website.local</span><span className="decode-live-label font-mono">PREVIEW</span></div>
          <div className="decode-preview">
            <div className="decode-preview-content">
              <span className="decode-preview-tag">MY LITTLE CORNER OF THE WEB</span>
              <h3>Hello, world!</h3>
              <p>My first website.</p>
              <span className="decode-preview-button"><span className="decode-say-hello">Say hello</span><span className="decode-ready">You&apos;re ready!</span></span>
              <svg className="decode-demo-cursor" width="22" height="26" viewBox="0 0 22 26" fill="none"><path d="m3 2 15 12-7 1-3 7L3 2Z" fill="#202A32" stroke="white" strokeWidth="2" /></svg>
            </div>
          </div>
        </div>
      </div>
      <figcaption id="demo-caption" className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-mono text-xs text-secondary"><span>01 Structure</span><span aria-hidden="true">→</span><span>02 Style</span><span aria-hidden="true">→</span><span>03 Interact</span></figcaption>
      <p className="sr-only">An animated example: HTML creates a heading and a button. CSS adds colors, typography, and spacing. JavaScript simulates a button click, changing “Say hello” to “You&apos;re ready!” Use the animation control to pause or play. With reduced motion, the completed website is shown.</p>
    </figure>
  );
}
