import { notFound } from "next/navigation";
import { courses, findCourse } from "@/app/lib/student/courses";
import { CourseView } from "@/app/components/student/curriculum-view";
export const instant = false;
export function generateStaticParams() { return courses.map((c) => ({ id: c.id })); }
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; const course = findCourse(id); if (!course) notFound(); return <CourseView key={course.id} course={course} />; }
