import { notFound } from "next/navigation";
import { projects } from "@/app/lib/student/projects";
import { ProjectView } from "@/app/components/student/project-view";
export const instant = false;
export function generateStaticParams() { return projects.map((p) => ({ id: p.id })); }
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; const project = projects.find((p) => p.id === id); if (!project) notFound(); return <ProjectView key={id} project={project} />; }
