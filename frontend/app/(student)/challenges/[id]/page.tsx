import { notFound } from "next/navigation";
import { challenges } from "@/app/lib/student/challenges";
import { ChallengeView } from "@/app/components/student/challenge-view";
export const instant = false;
export function generateStaticParams() { return challenges.map((c) => ({ id: c.id })); }
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; const challenge = challenges.find((c) => c.id === id); if (!challenge) notFound(); return <ChallengeView key={id} challenge={challenge} />; }
