import Link from "next/link";
import type { ActivityLocation } from "@/app/lib/student/curriculum-types";
import { StudentIcon } from "./student-icon";

// No completion control or engine. Unimplemented content remains honest and
// discoverable without allowing visits to award completion.
export function UpcomingActivityView({ activity, course, module }: ActivityLocation) {
  return <div className="student-lesson"><Link className="student-back-link" href={`/courses/${course.id}#${module.id}`}><StudentIcon name="arrow" />Back to curriculum</Link><p className="student-kicker">{course.title} / {module.title}</p><section className="student-card"><span className="student-tag">Upcoming {activity.type}</span><h1 className="student-section-title">{activity.title}</h1><p>{activity.description}</p><p className="student-muted">This activity is a preview. It is not available to complete yet. You can explore every other activity in your curriculum.</p><Link className="student-button secondary" href="/courses">My Learning<StudentIcon name="arrow" /></Link></section></div>;
}
