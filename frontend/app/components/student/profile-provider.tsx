"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { defaultProfile, profileKey, readProfile, saveProfile, type StudentProfile } from "@/app/lib/student/student-profile";

type Store = { studentId: string; profile: StudentProfile; updateProfile: (profile: StudentProfile) => { ok: boolean; error?: string } };
const Context = createContext<Store | null>(null);
export function useOptionalStudentProfile() { return useContext(Context); }
export function useStudentProfile() { const store = useContext(Context); if (!store) throw new Error("Student profile context missing"); return store; }

export function StudentProfileProvider({ studentId, children }: { studentId: string; children: ReactNode }) {
  const [profile, setProfile] = useState(() => defaultProfile(studentId));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const load = () => { setProfile(readProfile(localStorage, studentId)); setReady(true); };
    load();
    const sync = (event: StorageEvent) => { if (event.key === profileKey(studentId) || event.key === null) load(); };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [studentId]);
  const updateProfile = useCallback((next: StudentProfile) => {
    try { setProfile(saveProfile(localStorage, studentId, next)); return { ok: true }; }
    catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Profile could not be saved. Browser storage may be unavailable." }; }
  }, [studentId]);
  return <Context value={{ studentId, profile, updateProfile }}>{ready ? children : <p className="student-empty" role="status">Loading your workspace…</p>}</Context>;
}
