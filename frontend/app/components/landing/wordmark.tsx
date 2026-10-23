import type { CSSProperties } from "react";

// Monoline glyphs are constructed from paths, rather than a font-dependent typing mask.
const glyphs = [
  "M0 7H5C15 7 15 25 5 25H0Z",
  "M12 7H0V25H12M0 16H10",
  "M12 9C9 5 0 6 0 16S9 27 12 23",
  "M6 7C-2 7-2 25 6 25S14 7 6 7Z",
  "M0 7H5C15 7 15 25 5 25H0Z",
  "M12 7H0V25H12M0 16H10",
];

export function Wordmark({ animated = true }: { animated?: boolean }) {
  return (
    <svg className={`decode-wordmark${animated ? " decode-wordmark-animated" : ""}`} viewBox="0 0 180 32" fill="none" stroke="currentColor" strokeWidth="2.65" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="DECODE">
      <path d="m11 8-8 8 8 8M26 5l-8 22" />
      {glyphs.map((d, index) => (
        <g key={index} transform={`translate(${38 + index * 20} 0)`}>
          <path className="decode-logo-letter" pathLength="1" style={{ "--glyph-animation": `decode-letter-${index}` } as CSSProperties} d={d} />
        </g>
      ))}
      <path className="decode-logo-close" d="m164 8 8 8-8 8" />
    </svg>
  );
}
