"use client";

import { forwardRef, memo, useId, useImperativeHandle, useRef } from "react";
import type { FieldName } from "./validation";
import "./animated-owl.css";

export type AnimatedOwlHandle = {
  lookAt: (input: HTMLInputElement) => void;
  reactToSubmit: () => void;
};

type OwlProps = { focusedField: FieldName | null; concealed: boolean };

// The illustration is memoized; typing updates two CSS variables rather than
// rendering the SVG again. Focus and visibility are the only React pose state.
export const AnimatedOwl = memo(forwardRef<AnimatedOwlHandle, OwlProps>(function AnimatedOwl({ focusedField, concealed }, ref) {
  const id = useId();
  const owl = useRef<HTMLDivElement>(null);
  const pose = useRef<SVGGElement>(null);
  const lids = useRef<SVGGElement>(null);
  const reaction = useRef<Animation | null>(null);
  const blink = useRef<Animation | null>(null);
  const watching = focusedField === "name" || focusedField === "email";

  useImperativeHandle(ref, () => ({
    lookAt(input) {
      if (input.name !== "name" && input.name !== "email") return;
      // Email inputs do not expose selectionStart in all browsers. Their text
      // length is a gentle, bounded proxy for the typing/caret direction.
      const cursor = input.selectionStart ?? input.value.length;
      const x = Math.max(-5, Math.min(5, (cursor - 12) / 2.4));
      owl.current?.style.setProperty("--owl-look-x", `${x}px`);
    },
    reactToSubmit() {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      reaction.current?.cancel();
      blink.current?.cancel();
      reaction.current = pose.current?.animate([
        { transform: "rotate(0deg)" },
        { transform: "rotate(-3deg)", offset: .45 },
        { transform: "rotate(0deg)" },
      ], { duration: 480, easing: "ease-in-out" }) ?? null;
      blink.current = lids.current?.animate([
        { transform: "scaleY(0)" },
        { transform: "scaleY(1)", offset: .35 },
        { transform: "scaleY(0)" },
      ], { duration: 320, easing: "ease-in-out" }) ?? null;
    },
  }), []);

  return (
    <div ref={owl} className="decode-owl" data-cover={concealed} data-watching={watching} aria-hidden="true">
      <svg viewBox="0 0 280 240" fill="none" focusable="false">
        <defs>
          <linearGradient id={`${id}-plumage`} x1="140" y1="28" x2="140" y2="190" gradientUnits="userSpaceOnUse"><stop stopColor="#A47752" /><stop offset="1" stopColor="#785036" /></linearGradient>
          <linearGradient id={`${id}-face`} x1="140" y1="55" x2="140" y2="163" gradientUnits="userSpaceOnUse"><stop stopColor="#F7E7CA" /><stop offset="1" stopColor="#E8CEAA" /></linearGradient>
          <linearGradient id={`${id}-wing`} x1="68" y1="80" x2="95" y2="160" gradientUnits="userSpaceOnUse"><stop stopColor="#AE8058" /><stop offset="1" stopColor="#795037" /></linearGradient>
          <radialGradient id={`${id}-iris`}><stop stopColor="#547DA9" /><stop offset="1" stopColor="#31557E" /></radialGradient>
        </defs>
        <g className="decode-owl-idle">
          <path d="M78 153C59 169 66 205 89 215H191C214 201 221 170 201 153Z" fill="#795138" />
          <path d="M105 170Q140 155 175 170L182 211H98Z" fill="#DCC09B" />
          <g ref={pose} className="decode-owl-pose">
            <path d="M57 81 49 25Q69 26 84 39 110 24 140 39 170 24 196 39 212 26 231 25L224 81C244 119 228 166 193 180Q140 202 87 180C52 167 36 120 57 81Z" fill={`url(#${id}-plumage)`} stroke="#674730" strokeWidth="2.5" strokeLinejoin="round" />
            <path d="m59 38 8 31 13-22Z" fill="#D1A477" /><path d="m221 38-8 31-13-22Z" fill="#D1A477" />
            <path d="M140 67C119 41 78 48 66 79 49 122 81 160 121 161L140 176 159 161C199 160 231 122 214 79 202 48 161 41 140 67Z" fill={`url(#${id}-face)`} />
            <path d="m125 43 6 8m9-10v10m15-8-6 8" stroke="#D6AD80" strokeWidth="3" strokeLinecap="round" />
            <g className="decode-owl-brows" stroke="#6C4932" strokeWidth="4.5" strokeLinecap="round"><path d="M80 69Q100 57 119 69" /><path d="M161 69Q180 57 200 69" /></g>
            <g className="decode-owl-eyes">
              <ellipse cx="104" cy="103" rx="29" ry="31" fill="#FFFBF2" stroke="#BF976F" strokeWidth="1.5" />
              <ellipse cx="176" cy="103" rx="29" ry="31" fill="#FFFBF2" stroke="#BF976F" strokeWidth="1.5" />
              <g className="decode-owl-pupils">
                {[104, 176].map((x) => <g key={x}><circle cx={x} cy="105" r="17" fill={`url(#${id}-iris)`} /><circle cx={x} cy="105" r="10.5" fill="#242D37" /><circle cx={x - 4} cy="99" r="4.5" fill="#FFF" /><circle cx={x + 5} cy="110" r="2" fill="#FFF" opacity=".65" /></g>)}
              </g>
              <g ref={lids} className="decode-owl-lids"><ellipse cx="104" cy="103" rx="30" ry="32" fill="#D8B68E" /><ellipse cx="176" cy="103" rx="30" ry="32" fill="#D8B68E" /><path d="M85 119Q104 128 123 119M157 119Q176 128 195 119" stroke="#8A6242" strokeWidth="2" strokeLinecap="round" /></g>
            </g>
            <path d="M130 122Q140 115 150 122 147 135 140 139 133 135 130 122Z" fill="#D99A45" stroke="#B87A32" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="m79 139 4 3m6-2 4 3m94-3 4-3m6 5 4-3" stroke="#BC906A" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M94 170Q140 187 186 170L181 183Q140 198 99 183Z" fill="#537BB8" />
            <path d="m131 178-5 4 5 4m18-8 5 4-5 4m-8-9-2 10" stroke="#E8EFFB" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            {/* Each feathered fan starts at the shoulder (62, 137). Rotation
                keeps that attachment fixed through the whole movement; the
                mirrored right shoulder is at (218, 137). */}
            {[false, true].map((right) => <g key={String(right)} transform={right ? "translate(280 0) scale(-1 1)" : undefined}>
              <g className="decode-owl-wing">
                <path d="M62 137C55 125 59 109 67 93L79 70Q84 61 90 66L85 87 98 61Q104 53 110 60L101 86 116 63Q122 57 127 66L115 94 128 80Q136 76 137 86L134 118Q131 139 111 149L79 158Q66 158 62 137Z" fill={`url(#${id}-wing)`} stroke="#674730" strokeWidth="2" strokeLinejoin="round" />
                <path d="M68 138Q79 119 85 91M77 143Q96 119 101 90M86 146Q113 125 115 98M96 148Q124 135 127 112" stroke="#C79A6E" strokeWidth="2.5" strokeLinecap="round" />
              </g>
            </g>)}
          </g>
        </g>
      </svg>
    </div>
  );
}));
