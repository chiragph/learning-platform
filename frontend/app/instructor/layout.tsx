import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";
import { verifyInstructorSession } from "../components/auth/server-instructor-session";
import { InstructorSessionProvider } from "../components/instructor/instructor-session-provider";
import { InstructorShell } from "../components/instructor/instructor-shell";
import "../components/instructor/instructor.css";

export const metadata = { title: { default: "Instructor workspace | DECODE", template: "%s | DECODE Instructor" }, robots: { index: false, follow: false } };
async function AuthenticatedInstructor({ children }: { children: ReactNode }) {
  const session = await verifyInstructorSession();
  if (session.status === "anonymous") redirect("/login");
  if (session.status === "forbidden") redirect("/dashboard");
  if (session.status !== "authenticated") return <p role="alert">Unable to verify your session. Please refresh to try again.</p>;
  return <InstructorSessionProvider user={session.user}><InstructorShell>{children}</InstructorShell></InstructorSessionProvider>;
}
export default function InstructorLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={null}><AuthenticatedInstructor>{children}</AuthenticatedInstructor></Suspense>;
}
