import { notFound } from "next/navigation";
import { courses, findCourse } from "@/app/lib/student/courses";
import { QuizView } from "@/app/components/student/quiz-view";
export const instant = false;
export function generateStaticParams() { return courses.map((c) => ({ id: c.id })); }
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; const course = findCourse(id); if (!course) notFound(); return <QuizView key={id} subject={course.id} />; }
