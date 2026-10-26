import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { instructorPreviewEnabled } from "../lib/instructor/access";
import { InstructorShell } from "../components/instructor/instructor-shell";
import "../components/instructor/instructor.css";

export const metadata = { title: { default: "Instructor workspace | DECODE", template: "%s | DECODE Instructor" }, robots: { index: false, follow: false } };
export default function InstructorLayout({ children }: { children: ReactNode }) {
  if (!instructorPreviewEnabled()) notFound();
  return <InstructorShell>{children}</InstructorShell>;
}
