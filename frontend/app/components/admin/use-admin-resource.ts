"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminError } from "../../lib/admin/api";
import { useAdmin } from "./admin-provider";

export type Resource<T> = { status: "loading"; data?: never; error?: never } | { status: "ready"; data: T; error?: never } | { status: "error"; error: AdminError; data?: never };
export function useAdminResource<T>(load: (signal: AbortSignal) => Promise<T>) {
  const { ready } = useAdmin();
  const [result, setResult] = useState<{ load: typeof load; revision: number; resource: Resource<T> } | null>(null);
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    if (!ready) return;
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    void load(controller.signal).then(data => {
      if (active) setResult({ load, revision, resource: { status: "ready", data } });
    }).catch((error: unknown) => {
      if (!active) return;
      const problem = error instanceof AdminError ? error : new AdminError("error", "Unable to load this data. Try again.");
      setResult({ load, revision, resource: { status: "error", error: problem } });
      if (problem.kind === "unauthorized") window.dispatchEvent(new Event("decode-admin-session-expired"));
    }).finally(() => window.clearTimeout(timeout));
    return () => { active = false; controller.abort(); window.clearTimeout(timeout); };
  }, [ready, load, revision]);
  const resource: Resource<T> = ready && result?.load === load && result.revision === revision ? result.resource : { status: "loading" };
  return { ...resource, retry };
}
