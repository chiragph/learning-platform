import type { ReactNode } from "react";
import { StudentProvider } from "../components/student/student-provider";
import { StudentShell } from "../components/student/student-shell";
import "../components/student/student.css";

export const metadata = { title: { default: "Student workspace | DECODE", template: "%s | DECODE" }, robots: { index: false, follow: false } };
export default function StudentLayout({ children }: { children: ReactNode }) {
  return <StudentProvider><StudentShell>{children}</StudentShell></StudentProvider>;
}
