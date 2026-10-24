"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { clampSplit } from "@/app/lib/student/editor-settings";

export function ResizablePanels({ editor, preview, embedded = false, id }: { editor: ReactNode; preview: ReactNode; embedded?: boolean; id: string }) {
  const root = useRef<HTMLDivElement>(null);
  const [wide, setWide] = useState(false);
  const [split, setSplit] = useState(50);
  const [dragging, setDragging] = useState(false);
  const frame = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (!root.current) return;
    const measure = (width: number) => setWide(!embedded && width >= 720);
    measure(root.current.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => measure(entry.contentRect.width));
    observer.observe(root.current); return () => observer.disconnect();
  }, [embedded]);
  useEffect(() => () => { if (frame.current !== null) cancelAnimationFrame(frame.current); }, []);
  return <div ref={root} className={`student-ide-panels ${wide ? "horizontal" : "stacked"}${dragging ? " resizing" : ""}`} style={{ "--editor-split": `${split}%` } as CSSProperties}>
    <div id={`${id}-editor-panel`} className="student-ide-editor-panel">{editor}</div>
    <div className="student-ide-resizer" role="separator" tabIndex={0} aria-label="Resize editor and preview. Use arrow keys; Home and End set the limits. Double-click to reset." aria-orientation={wide ? "vertical" : "horizontal"} aria-valuemin={30} aria-valuemax={70} aria-valuenow={split} aria-valuetext={`${split}% editor, ${100 - split}% preview`} aria-controls={`${id}-editor-panel ${id}-preview-panel`}
      onPointerDown={(event) => { if (event.button !== 0) return; event.preventDefault(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId); setDragging(true); }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        const rect = root.current?.getBoundingClientRect(); if (!rect) return;
        const value = wide ? (event.clientX - rect.left) / rect.width * 100 : (event.clientY - rect.top) / rect.height * 100;
        if (frame.current !== null) cancelAnimationFrame(frame.current);
        frame.current = requestAnimationFrame(() => { setSplit(clampSplit(value)); frame.current = null; });
      }}
      onLostPointerCapture={() => setDragging(false)} onPointerUp={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); setDragging(false); }} onPointerCancel={() => setDragging(false)} onDoubleClick={() => setSplit(50)}
      onKeyDown={(event) => {
        const decrease = wide ? "ArrowLeft" : "ArrowUp", increase = wide ? "ArrowRight" : "ArrowDown";
        if ([decrease, increase, "Home", "End"].includes(event.key)) { event.preventDefault(); setSplit((s) => event.key === "Home" ? 30 : event.key === "End" ? 70 : clampSplit(s + (event.key === decrease ? -5 : 5))); }
      }}><span aria-hidden="true" /></div>
    <div id={`${id}-preview-panel`} className="student-ide-preview-panel">{preview}</div>
  </div>;
}
