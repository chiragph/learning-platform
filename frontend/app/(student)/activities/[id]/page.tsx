import { notFound } from "next/navigation";
import { activityLocations, findCurriculumActivity } from "@/app/lib/student/curriculum";
import { UpcomingActivityView } from "@/app/components/student/upcoming-activity-view";

export const instant = false;
export function generateStaticParams() {
  const upcoming = activityLocations().filter(({ activity }) => activity.availability === "upcoming").map(({ activity }) => ({ id: activity.id }));
  // Cache Components requires a validation sample even for an empty repository.
  // The sample is not content: the normal unknown-ID guard below returns 404.
  return upcoming.length ? upcoming : [{ id: "__placeholder__" }];
}
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const location = findCurriculumActivity(id);
  if (!location || location.activity.availability !== "upcoming") notFound();
  return <UpcomingActivityView {...location} />;
}
