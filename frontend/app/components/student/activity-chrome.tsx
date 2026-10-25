import Link from "next/link";
import { activityLocations, findCurriculumActivity } from "@/app/lib/student/curriculum";
import { StudentIcon } from "./student-icon";

export function ActivityBreadcrumb({ activityId }: { activityId: string }) {
  const location = findCurriculumActivity(activityId);
  return <nav className="student-activity-breadcrumb" aria-label="Activity breadcrumb"><Link href="/courses">My Learning</Link>{location && <><StudentIcon name="chevron" /><Link href={`/courses/${location.course.id}#${location.module.id}`}>{location.course.title} · {location.module.title}</Link></>}</nav>;
}
export function ActivityNavigation({ activityId }: { activityId: string }) {
  const locations = activityLocations(), index = locations.findIndex(entry => entry.activity.id === activityId);
  const previous = locations[index - 1]?.activity, next = locations[index + 1]?.activity;
  return <nav className="student-activity-navigation" aria-label="Curriculum activity navigation"><Link href={previous?.href ?? "/courses"}><span>← {previous ? "Previous activity" : "My Learning"}</span><strong>{previous?.title ?? "Back to your curriculum"}</strong></Link><Link href={next?.href ?? "/courses"}><span>{next ? "Next activity" : "My Learning"} →</span><strong>{next?.title ?? "Back to your curriculum"}</strong></Link></nav>;
}
