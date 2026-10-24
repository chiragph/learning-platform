import { notFound } from "next/navigation";
import { allLessons, findLesson } from "@/app/lib/student/courses";
import { LessonView } from "@/app/components/student/lesson-view";
export const instant = false;
export function generateStaticParams() { return allLessons.map((l) => ({ id: l.id })); }
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; const lesson = findLesson(id); if (!lesson) notFound(); return <LessonView key={id} lesson={lesson} />; }
