"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DEMO_ENABLED, restoreSession, logoutDemo, type DemoStudent } from "@/app/lib/student/mock-auth";
import { StudentProfileProvider, useOptionalStudentProfile } from "./profile-provider";

const Context = createContext<DemoStudent | null>(null);
export function useStudent() {
  const student = useContext(Context);
  const profile = useOptionalStudentProfile();
  if (!student) throw new Error("Student context missing");
  return profile?.studentId === student.id ? { ...student, label: profile.profile.displayName } : student;
}
export function StudentProvider({ children }: { children: ReactNode }) {
  const [student, setStudent] = useState<DemoStudent | null>(null);
  const [error, setError] = useState("");
  const router = useRouter();
  useEffect(() => {
    function restore() {
      try { const current = restoreSession(); setStudent(current); if (DEMO_ENABLED && !current) router.replace("/login"); }
      catch { setError("Browser storage is unavailable. Enable storage to use the local demo."); }
    }
    restore(); window.addEventListener("storage", restore);
    return () => window.removeEventListener("storage", restore);
  }, [router]);
  if (!DEMO_ENABLED) return <div className="student-empty"><h1>Student demo is unavailable</h1><p>Demo accounts and sessions run only with the development server. Production authentication is not connected.</p><Link href="/">Return home</Link></div>;
  if (!student) return <div className="student-empty" role="status">{error || "Restoring your local demo session…"}</div>;
  return <Context value={student}><StudentProfileProvider key={student.id} studentId={student.id}>{children}</StudentProfileProvider></Context>;
}
export function LogoutButton() {
  const router = useRouter();
  const [error, setError] = useState("");
  return <><button className="student-button secondary" onClick={() => { try { logoutDemo(); router.replace("/login"); router.refresh(); } catch { setError("Unable to clear browser storage. Clear site data to end the demo session."); } }}>Log out</button>{error && <p role="alert">{error}</p>}</>;
}
