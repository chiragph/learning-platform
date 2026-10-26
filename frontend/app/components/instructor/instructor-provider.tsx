"use client";

import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { instructorStorageKey, LocalInstructorRepository } from "../../lib/instructor/repository";
import type { InstructorCommand, RepositorySnapshot } from "../../lib/instructor/types";

type InstructorContextValue = RepositorySnapshot & { error: string; execute: (command: InstructorCommand) => string | null; readSnapshot: () => RepositorySnapshot };
const InstructorContext = createContext<InstructorContextValue | null>(null);
export function InstructorProvider({ children }: { children: ReactNode }) {
  const [repository] = useState(() => new LocalInstructorRepository());
  const snapshot = useSyncExternalStore(repository.subscribe, repository.getSnapshot, repository.getServerSnapshot);
  const [message, setMessage] = useState("");
  useEffect(() => {
    repository.initialize();
    const refresh = (event: StorageEvent) => { if (event.key === instructorStorageKey || event.key === null) repository.initialize(); };
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, [repository]);
  function execute(command: InstructorCommand) {
    try { const id = repository.execute(command); setMessage(""); return id; }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save this change."); return null; }
  }
  return <InstructorContext.Provider value={{ ...snapshot, error: message, execute, readSnapshot: repository.getSnapshot }}>
    {snapshot.warning && <div className="ins-notice warning" role="status">{snapshot.warning}</div>}
    {message && <div className="ins-notice warning" role="alert">{message}<button type="button" onClick={() => setMessage("")}>Dismiss</button></div>}
    {!snapshot.ready && <div className="ins-empty" role="status">Opening your local content workspace…</div>}
    {/* Render the route during SSR for Next's segment validation; hide the
        seeded snapshot until the browser repository has finished loading. */}
    <div hidden={!snapshot.ready}>{children}</div>
  </InstructorContext.Provider>;
}
export function useInstructor() {
  const context = useContext(InstructorContext);
  if (!context) throw new Error("InstructorProvider is required.");
  return context;
}
