"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AdminError } from "../../lib/admin/api";
import { Modal, ReasonField } from "./ui";

export function SensitiveAction({ label, title, description, enabled, unavailableReason, execute, onSuccess, destructive = false }: {
  label: string; title: string; description: string; enabled: boolean; unavailableReason: string;
  execute: (reason: string, signal: AbortSignal) => Promise<void>; onSuccess: () => void; destructive?: boolean;
}) {
  const [open, setOpen] = useState(false), [reason, setReason] = useState(""), [pending, setPending] = useState(false), [error, setError] = useState("");
  const busy = useRef(false), controller = useRef<AbortController | null>(null), descriptionId = useId(), unavailableId = useId();
  useEffect(() => () => controller.current?.abort(), []);
  async function confirm() {
    if (busy.current || !enabled || reason.trim().length < 5 || reason.trim().length > 500) return;
    busy.current = true; setPending(true); setError("");
    const request = new AbortController(); controller.current = request;
    const timeout = window.setTimeout(() => request.abort(), 15_000);
    try { await execute(reason.trim(), request.signal); if (!request.signal.aborted) { setOpen(false); onSuccess(); } }
    catch (e) {
      setError(e instanceof Error ? e.message : "This action could not be confirmed. Refresh before trying again.");
      if (e instanceof AdminError && e.kind === "unauthorized") window.dispatchEvent(new Event("decode-admin-session-expired"));
    } finally { window.clearTimeout(timeout); busy.current = false; setPending(false); }
  }
  return <div className="adm-sensitive"><button className={`adm-button ${destructive ? "adm-danger" : "adm-secondary"}`} disabled={!enabled} aria-describedby={!enabled ? unavailableId : undefined} onClick={() => { setReason(""); setError(""); setOpen(true); }}>{label}</button>{!enabled && <p id={unavailableId} className="adm-muted">{unavailableReason}</p>}{open && <Modal title={title} descriptionId={descriptionId} onClose={() => { if (!busy.current) setOpen(false); }}><form className="adm-dialog-body" onSubmit={e => { e.preventDefault(); void confirm(); }} aria-busy={pending}><p id={descriptionId}>{description}</p><ReasonField value={reason} onChange={setReason} />{error && <p className="adm-error" role="alert">{error}</p>}<div className="adm-dialog-actions"><button type="button" className="adm-button adm-secondary" data-autofocus disabled={pending} onClick={() => setOpen(false)}>Cancel</button><button type="submit" className={`adm-button${destructive ? " adm-danger" : ""}`} disabled={pending || reason.trim().length < 5}>{pending ? "Confirming…" : label}</button></div></form></Modal>}</div>;
}
