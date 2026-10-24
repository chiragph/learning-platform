"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { emptyProgress, normalizeProgress, progressKey } from "@/app/lib/student/progress";
import { readStorage, writeStorage } from "@/app/lib/student/storage";
import type { Progress } from "@/app/lib/student/types";
import { useStudent } from "./student-provider";

type Store = { progress: Progress; update: (change: (p: Progress) => Progress) => boolean; reset: () => void; ready: boolean; error: string };
const Context = createContext<Store | null>(null);
export function useProgress() { const store = useContext(Context); if (!store) throw new Error("Progress context missing"); return store; }
export function ProgressProvider({ children }: { children: ReactNode }) {
  const student = useStudent();
  const key = progressKey(student.id);
  const [progress, setProgress] = useState<Progress>(emptyProgress);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const current = useRef(progress);
  useEffect(() => {
    function load() { try { current.current = normalizeProgress(readStorage(localStorage, key, null)); setProgress(current.current); setReady(true); } catch { setError("Storage is unavailable. Changes cannot be saved."); setReady(true); } }
    load();
    const sync = (event: StorageEvent) => { if (event.key === key || event.key === null) load(); };
    window.addEventListener("storage", sync); return () => window.removeEventListener("storage", sync);
  }, [key]);
  const update = useCallback((change: (p: Progress) => Progress) => {
    if (!ready) return false;
    const next = change(current.current);
    try { writeStorage(localStorage, key, next); current.current = next; setProgress(next); setError(""); return true; }
    catch { setError("Unable to save: browser storage is full or disabled. Your last saved progress is unchanged. Copy your code before leaving."); return false; }
  }, [key, ready]);
  function reset() { update(() => emptyProgress()); }
  return <Context value={{ progress, ready, error, update, reset }}>{error && <p role="alert" className="student-notice student-error">{error}</p>}{ready ? children : <p role="status">Loading your learning records…</p>}</Context>;
}
