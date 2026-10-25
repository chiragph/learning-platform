"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

export function ActivityConfirmDialog({ title, children, confirmLabel, onConfirm, onCancel }: { title: string; children: ReactNode; confirmLabel: string; onConfirm: () => void; onCancel: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const node = dialog.current!, previous = document.activeElement as HTMLElement | null;
    node.showModal(); cancel.current?.focus({ preventScroll: true });
    return () => { node.close(); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  return <dialog ref={dialog} className="student-activity-dialog" aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={event => { event.preventDefault(); onCancel(); }} onClick={event => { if (event.target === event.currentTarget) onCancel(); }}><div><h2 id={titleId}>{title}</h2><div id={descriptionId}>{children}</div><div className="student-activity-dialog-actions"><button ref={cancel} className="student-button secondary" onClick={onCancel}>Keep reviewing</button><button className="student-button" onClick={onConfirm}>{confirmLabel}</button></div></div></dialog>;
}
