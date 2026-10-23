"use client";

import { useEffect, useRef, useState } from "react";
import "./back-to-top.css";

function focusTop() {
  document.getElementById("main-content")?.focus({ preventScroll: true });
}

function coversAction(button: HTMLButtonElement | null) {
  if (!button) return false;
  const { left, top, width, height } = button.getBoundingClientRect();
  if (!width || !height) return false;
  const points = [[left + 8, top + 8], [left + width - 8, top + 8], [left + 8, top + height - 8], [left + width - 8, top + height - 8], [left + width / 2, top + height / 2]];
  return points.some(([x, y]) => document.elementsFromPoint(x, y).some((element) =>
    !button.contains(element) && element.closest("a, button, input, select, textarea, [role='button'], [role='link']")
  ));
}

export function BackToTop() {
  const [visible, setVisible] = useState(false);
  const showing = useRef(false);
  const pastThreshold = useRef(false);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let frame = 0;
    const mobile = window.matchMedia("(max-width: 767px)");
    const update = () => {
      frame = 0;
      // Separate thresholds keep the control stable near its reveal point.
      pastThreshold.current = pastThreshold.current ? window.scrollY > 400 : window.scrollY >= 480;
      const focused = document.activeElement === button.current;
      // Yield to existing mobile actions, without stealing keyboard focus.
      const next = pastThreshold.current && (focused || !mobile.matches || !coversAction(button.current));
      if (next === showing.current) return;
      if (!next && document.activeElement === button.current) focusTop();
      showing.current = next;
      setVisible(next);
    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(update); };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("pageshow", schedule);
    mobile.addEventListener("change", schedule);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("pageshow", schedule);
      mobile.removeEventListener("change", schedule);
    };
  }, []);

  function backToTop() {
    focusTop();
    window.scrollTo({ top: 0, left: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }

  return (
    <button ref={button} type="button" className="decode-back-to-top" data-visible={visible} aria-label="Back to top" aria-hidden={!visible} tabIndex={visible ? 0 : -1} onClick={backToTop}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6" /></svg>
    </button>
  );
}
