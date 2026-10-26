import type { ActivityType } from "../student/curriculum-types";
import type { InstructorState } from "./types";

export function instructorActivityLocation(state: InstructorState, id: string, type: ActivityType) {
  for (const course of state.courses) for (const topic of course.modules) {
    const activity = topic.activities.find(a => a.id === id && a.type === type);
    if (activity) return { course, module: topic, activity, archived: course.archived || topic.archived || activity.archived };
  }
  return null;
}
// Next 16.4.2 supplies the encoded URL segment. Decode once at the page
// boundary; repository IDs and saved draft keys always remain exact strings.
export function decodeInstructorActivityParam(segment: string): string {
  try { return decodeURIComponent(segment); } catch { return segment; }
}
export function activityEditorHref(type: "theory" | "quiz" | "lab" | "workshop", id: string, preview = false) {
  return `/instructor/${type === "quiz" ? "quizzes" : type === "lab" ? "labs" : type === "workshop" ? "workshops" : "theory"}/${encodeURIComponent(id)}${preview ? "?preview=1" : ""}`;
}
