"use client";

import { useEffect, useRef, useState } from "react";
import { AdminError, adminApi } from "../../lib/admin/api";
import { announceAuthChange } from "../auth/student-session";
import { useAdminResource } from "./use-admin-resource";
import { useAdmin } from "./admin-provider";
import { DateText, DetailGrid, Field, Info } from "./ui";

export function AccountPreferences() {
  const { user } = useAdmin();
  const resource = useAdminResource(adminApi.account);
  const [name, setName] = useState(user.name), [pending, setPending] = useState(false), [error, setError] = useState("");
  const busy = useRef(false), request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const supported = resource.status === "ready" && resource.data.user.id === user.id && resource.data.user.role === "ADMIN" && resource.data.capabilities.editName;
  async function save() {
    if (!supported || busy.current || name.trim().length < 2 || name.trim().length > 100) return;
    busy.current = true; setPending(true); setError("");
    const controller = new AbortController(); request.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    try {
      const result = await adminApi.updateName(name.trim(), controller.signal);
      if (result.user.id !== user.id || result.user.role !== "ADMIN" || result.user.name !== name.trim()) throw new AdminError("conflict", "The server did not confirm your profile update. Refresh before trying again.");
      announceAuthChange(); window.location.reload();
    } catch (e) { setError(e instanceof Error ? e.message : "Your name could not be updated."); }
    finally { window.clearTimeout(timeout); busy.current = false; setPending(false); }
  }
  return <div className="adm-account-preferences"><DetailGrid items={[{ label: "Email", value: user.email }, { label: "Role", value: "Administrator" }, { label: "Account ID", value: <code>{user.id}</code> }, { label: "Joined", value: <DateText value={resource.status === "ready" && resource.data.user.id === user.id ? resource.data.user.createdAt : null} /> }]} /><form onSubmit={e => { e.preventDefault(); void save(); }}><Field label="Display name"><input value={name} minLength={2} maxLength={100} required disabled={!supported || pending} onChange={e => setName(e.target.value)} aria-describedby={!supported ? "adm-name-support" : undefined} autoComplete="name" /></Field><button className="adm-button" type="submit" disabled={!supported || pending || name.trim() === user.name || name.trim().length < 2}>{pending ? "Saving…" : "Save display name"}</button>{error && <p className="adm-error" role="alert">{error}</p>}</form>{!supported && <Info><span id="adm-name-support">{resource.status === "loading" ? "Checking whether account editing is supported…" : resource.status === "error" && resource.error.kind !== "unavailable" ? resource.error.message : "Display-name changes require the authorized admin account API. Your current session information is shown above."}</span></Info>}{resource.status === "error" && <button className="adm-text-button" onClick={resource.retry}>Retry account information</button>}</div>;
}
