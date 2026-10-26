"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { safeResourceUrl } from "../../lib/instructor/theory";
import type { TheoryBlock, TheoryContent, TheoryLanguage } from "../../lib/instructor/theory-types";
import { Icon } from "./ui";

// A deliberately small text-only format. HTML and Markdown links are never
// interpreted. React escapes every token, including code and imported text.
export function InlineText({ text }: { text: string }) {
  const pieces = text.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g);
  return <>{pieces.map((part, i) => /^`[^`\n]+`$/.test(part) ? <code key={i}>{part.slice(1, -1)}</code> : /^\*\*[^*\n]+\*\*$/.test(part) ? <strong key={i}>{part.slice(2, -2)}</strong> : /^\*[^*\n]+\*$/.test(part) ? <em key={i}>{part.slice(1, -1)}</em> : part)}</>;
}
export function HighlightedCode({ code, language }: { code: string; language: TheoryLanguage }) {
  if (language === "plaintext") return <code>{code}</code>;
  // Highlight strings, comments, markup, and common keywords without an HTML
  // highlighter or a second Monaco instance. This never evaluates source code.
  const tokens = code.split(/(\/\*[\s\S]*?\*\/|\/\/[^\n]*|<!--[\s\S]*?-->|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|<\/?[A-Za-z][^>]*>|\b(?:const|let|var|function|return|if|else|for|while|true|false|null|new|class|import|export|from)\b)/g);
  return <code>{tokens.map((token, i) => { const kind = /^(\/\/|\/\*|<!--)/.test(token) ? "comment" : /^["'`]/.test(token) ? "string" : /^</.test(token) ? "tag" : /^(const|let|var|function|return|if|else|for|while|true|false|null|new|class|import|export|from)$/.test(token) ? "keyword" : ""; return kind ? <span key={i} className={`ins-syntax-${kind}`}>{token}</span> : token; })}</code>;
}
function CodeExample({ block }: { block: Extract<TheoryBlock, { type: "code" }> }) {
  const [notice, setNotice] = useState("");
  async function copy() { try { await navigator.clipboard.writeText(block.code); setNotice("Code copied."); } catch { setNotice("Clipboard unavailable. Select the code and copy it manually."); } }
  return <section className="ins-reading-example">{block.explanation && <p><InlineText text={block.explanation} /></p>}<div className="ins-example-file"><span><Icon name="code" />{block.title || "Code example"}<small>{block.language === "plaintext" ? "Plain text" : block.language.toUpperCase()}</small></span><button type="button" onClick={copy}>Copy Code</button></div><pre tabIndex={0} aria-label={`${block.language} code example`}><HighlightedCode code={block.code} language={block.language} /></pre><small role="status">{notice}</small></section>;
}
export function TheoryPreview({ content, context, width }: { content: TheoryContent; context: string; width: "desktop" | "mobile" }) {
  return <div className={`ins-lesson-preview ${width}`}><article className="ins-reading-article" aria-label="Read-only lesson preview"><header><p className="ins-eyebrow">THEORY LESSON · READ-ONLY PREVIEW</p><p className="ins-reading-context">{context}</p><h1>{content.title.trim() || "Untitled lesson"}</h1></header>{!content.blocks.length && <p className="ins-muted">This working draft has no content blocks yet.</p>}{content.blocks.map(block => {
    let rendered: ReactNode;
    switch (block.type) {
      case "heading": rendered = block.level === 3 ? <h3>{block.text}</h3> : <h2>{block.text}</h2>; break;
      case "paragraph": rendered = <p><InlineText text={block.text} /></p>; break;
      case "list": { const List = block.ordered ? "ol" : "ul"; rendered = <List>{block.items.map((item, i) => <li key={i}><InlineText text={item} /></li>)}</List>; break; }
      case "code": rendered = <CodeExample block={block} />; break;
      case "callout": rendered = <aside className={`ins-reading-callout ${block.tone}`}><strong><Icon name={block.tone === "tip" ? "spark" : "book"} />{block.title || (block.tone === "tip" ? "Tip" : "Note")}</strong><p><InlineText text={block.text} /></p></aside>; break;
      case "resource": { const href = safeResourceUrl(block.url); rendered = <aside className="ins-reading-resource">{href ? <a href={href} target="_blank" rel="noopener noreferrer">{block.title || "Learning resource"}<Icon name="arrow" /><span className="sr-only"> (opens in a new tab)</span></a> : <strong>{block.title || "Learning resource"} · Link unavailable</strong>}{block.description && <p><InlineText text={block.description} /></p>}</aside>; break; }
    }
    return <div className="ins-reading-block" key={block.id}>{rendered}</div>;
  })}</article></div>;
}
