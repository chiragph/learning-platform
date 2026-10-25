import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";
import { verifyStudentSession } from "../components/auth/server-student-session";
import { StudentProvider, StudentSessionNotice } from "../components/student/student-provider";
import { StudentShell } from "../components/student/student-shell";
import "../components/student/student.css";

export const metadata = { title: { default: "Student workspace | DECODE", template: "%s | DECODE" }, robots: { index: false, follow: false } };
async function AuthenticatedWorkspace({ children }: { children: ReactNode }) {
  const session = await verifyStudentSession();
  if (session.status === "anonymous") redirect("/login");
  if (session.status !== "authenticated") return <StudentSessionNotice status={session.status} />;
  return <StudentProvider user={session.user}><StudentShell>{children}</StudentShell></StudentProvider>;
}
export default function StudentLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<p className="student-empty" role="status">Checking your session…</p>}><AuthenticatedWorkspace>{children}</AuthenticatedWorkspace></Suspense>;
}
