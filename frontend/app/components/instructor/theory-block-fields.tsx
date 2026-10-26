"use client";

import dynamic from "next/dynamic";
import { Component, useId, useRef, type ReactNode } from "react";
import type { TheoryBlock } from "../../lib/instructor/theory-types";
import { theoryLanguages } from "../../lib/instructor/theory-types";

const CodeEditor = dynamic(() => import("./theory-code-editor"), { ssr: false, loading: () => <p role="status">Loading syntax editor…</p> });
class CodeBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <p role="status">Syntax editor unavailable. Use the plain code field below.</p> : this.props.children; }
}
function FormattedText({ label, text, onChange, multiline = true }: { label: string; text: string; onChange: (value: string) => void; multiline?: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null), helpId = useId();
  function format(marker: string, placeholder: string) {
    const field = ref.current!, start = field.selectionStart, end = field.selectionEnd, selected = text.slice(start, end) || placeholder;
    onChange(text.slice(0, start) + marker + selected + marker + text.slice(end));
    requestAnimationFrame(() => { field.focus(); field.setSelectionRange(start + marker.length, start + marker.length + selected.length); });
  }
  return <div className="ins-formatted-field"><label>{label}<textarea ref={ref} rows={multiline ? 4 : 2} value={text} maxLength={100000} onChange={e => onChange(e.target.value)} aria-describedby={helpId} /></label><div className="ins-format-tools" role="group" aria-label={`Format ${label.toLowerCase()}`}><button type="button" onClick={() => format("**", "bold text")}><strong>Bold</strong></button><button type="button" onClick={() => format("*", "italic text")}><em>Italic</em></button><button type="button" onClick={() => format("`", "code")}><code>Inline code</code></button></div><small id={helpId}>Select text, then choose a format. Preview shows the result.</small></div>;
}
export function TheoryBlockFields({ block, onChange, syntaxActive, onSyntax }: { block: TheoryBlock; onChange: (block: TheoryBlock) => void; syntaxActive: boolean; onSyntax: () => void }) {
  switch (block.type) {
    case "heading": return <div className="ins-theory-field-grid"><label>Heading text<input value={block.text} maxLength={100000} onChange={e => onChange({ ...block, text: e.target.value })} /></label><label>Heading size<select value={block.level} onChange={e => onChange({ ...block, level: Number(e.target.value) as 2 | 3 })}><option value={2}>Section heading</option><option value={3}>Subheading</option></select></label></div>;
    case "paragraph": return <FormattedText label="Paragraph text" text={block.text} onChange={text => onChange({ ...block, text })} />;
    case "list": return <><label>List style<select value={block.ordered ? "ordered" : "unordered"} onChange={e => onChange({ ...block, ordered: e.target.value === "ordered" })}><option value="unordered">Bulleted list</option><option value="ordered">Numbered list</option></select></label><FormattedText label="List items (one per line)" text={block.items.join("\n")} onChange={text => onChange({ ...block, items: text.split("\n").slice(0, 200) })} /></>;
    case "code": return <><div className="ins-theory-field-grid"><label>Example title (optional)<input maxLength={200} value={block.title} onChange={e => onChange({ ...block, title: e.target.value })} /></label><label>Code language<select value={block.language} onChange={e => onChange({ ...block, language: e.target.value as typeof block.language })}>{theoryLanguages.map(language => <option key={language} value={language}>{language === "plaintext" ? "Plain text" : language.toUpperCase()}</option>)}</select></label></div><div className="ins-code-tools"><span>Code is displayed only. It never runs here.</span><button type="button" className="ins-text-link" aria-pressed={syntaxActive} onClick={onSyntax}>{syntaxActive ? "Close syntax editor" : "Open syntax editor"}</button></div>{syntaxActive && <CodeBoundary><CodeEditor value={block.code} language={block.language} onChange={code => onChange({ ...block, code })} /></CodeBoundary>}<label>Code{syntaxActive && " (plain text alternative)"}<textarea className="ins-code-input" spellCheck={false} value={block.code} rows={syntaxActive ? 3 : 7} maxLength={100000} onChange={e => onChange({ ...block, code: e.target.value })} /></label><FormattedText label="Example explanation (optional)" multiline={false} text={block.explanation} onChange={explanation => onChange({ ...block, explanation })} /></>;
    case "callout": return <><div className="ins-theory-field-grid"><label>Callout title (optional)<input maxLength={200} value={block.title} onChange={e => onChange({ ...block, title: e.target.value })} /></label><label>Callout style<select value={block.tone} onChange={e => onChange({ ...block, tone: e.target.value as "tip" | "note" })}><option value="tip">Tip</option><option value="note">Note</option></select></label></div><FormattedText label="Callout text" text={block.text} onChange={text => onChange({ ...block, text })} /></>;
    case "resource": return <><label>Resource title<input maxLength={200} value={block.title} onChange={e => onChange({ ...block, title: e.target.value })} /></label><label>External link<input type="text" inputMode="url" placeholder="https://example.com/learn" maxLength={2000} value={block.url} onChange={e => onChange({ ...block, url: e.target.value })} /></label><small>Use an HTTP or HTTPS address. Links open in a new tab.</small><FormattedText label="Resource description (optional)" multiline={false} text={block.description} onChange={description => onChange({ ...block, description })} /></>;
  }
}
