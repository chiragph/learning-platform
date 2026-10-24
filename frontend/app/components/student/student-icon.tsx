import type { SVGProps } from "react";
import type { Subject } from "@/app/lib/student/types";

const paths = {
  dashboard: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  courses: "M3 5c3-1 6-1 9 1 3-2 6-2 9-1v15c-3-1-6-1-9 1-3-2-6-2-9-1zM12 6v15",
  lesson: "M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h5",
  book: "M3 5c3-1 6-1 9 1 3-2 6-2 9-1v15c-3-1-6-1-9 1-3-2-6-2-9-1zM12 6v15",
  quiz: "M8 3h8v4H8zM8 5H5v16h14V5h-3M9 13l2 2 4-4",
  code: "m8 6-6 6 6 6m8-12 6 6-6 6M14 3l-4 18",
  challenge: "m12 3-9 9 9 9 9-9zM8 12l3 3 5-6",
  project: "M3 7h7l2 2h9v11H3zM3 7V4h7l2 3",
  progress: "M4 3v18h17M8 16v-4M13 16V8M18 16V5",
  profile: "M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8M4 21v-2a8 6 0 0 1 16 0v2",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  chevron: "m9 5 7 7-7 7",
  menu: "M4 6h16M4 12h16M4 18h16",
  close: "m6 6 12 12M18 6 6 18",
  check: "m5 12 4 4L19 6",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 7v5l3 2",
  layers: "m12 3 10 5-10 5L2 8zm-10 9 10 5 10-5M2 16l10 5 10-5",
  spark: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z",
} as const;
export type StudentIconName = keyof typeof paths;
export function StudentIcon({ name, ...props }: { name: StudentIconName } & SVGProps<SVGSVGElement>) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}><path d={paths[name]} /></svg>;
}
export function SubjectMark({ subject, small = false }: { subject: Subject; small?: boolean }) {
  return <span className={`student-subject-mark ${subject}${small ? " small" : ""}`} aria-hidden="true">{subject === "html" ? "</>" : subject === "css" ? "{ }" : "JS"}</span>;
}
