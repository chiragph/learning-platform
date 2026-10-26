"use client";

import { useId, type FormEvent } from "react";
import type { ActivityType } from "../../lib/student/curriculum-types";
import type { InstructorActivity, InstructorCourse, InstructorModule } from "../../lib/instructor/types";
import { useInstructor } from "./instructor-provider";
import { Modal, TimestampMetadata } from "./ui";

export type CurriculumFormTarget = { kind: "module"; module?: InstructorModule } | { kind: "activity"; moduleId?: string; activity?: InstructorActivity } | { kind: "move"; moduleId: string; activity: InstructorActivity };
export function CurriculumForm({ course, target, onClose }: { course: InstructorCourse; target: CurriculumFormTarget; onClose: () => void }) {
  const { execute, writable, error } = useInstructor(), id = useId();
  const entry = target.kind === "module" ? target.module : target.activity;
  const title = target.kind === "move" ? "Move activity" : `${entry ? "Edit" : "Add"} ${target.kind === "module" ? "module" : "curriculum item"}`;
  const modules = course.modules.filter(m => !m.archived && (target.kind !== "move" || m.id !== target.moduleId));
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    const base = { courseId: course.id, title: String(data.get("title") ?? ""), description: String(data.get("description") ?? "") };
    let result: string | null;
    if (target.kind === "move") result = execute({ type: "activity.move", courseId: course.id, moduleId: target.moduleId, activityId: target.activity.id, targetModuleId: String(data.get("module")) });
    else if (target.kind === "module") result = execute(target.module ? { type: "module.update", ...base, moduleId: target.module.id } : { type: "module.create", ...base });
    else {
      const moduleId = target.activity ? target.moduleId! : String(data.get("module"));
      result = execute(target.activity ? { type: "activity.update", ...base, moduleId, activityId: target.activity.id } : { type: "activity.create", ...base, moduleId, activityType: data.get("type") as ActivityType });
    }
    if (result) onClose();
  }
  return <Modal title={title} onClose={onClose}><p className="ins-dialog-copy">{target.kind === "move" ? `Move “${target.activity.title}” to another module in ${course.title}. Its identifier is preserved.` : target.kind === "activity" ? "Set up the activity record. Detailed content editing arrives in Stage 5B; new activities remain drafts." : "Group related activities into a clear learning sequence."} Curriculum changes return the local course to Draft.</p>{entry && <TimestampMetadata record={entry} publication={target.kind !== "module"} />}<form className="ins-form" onSubmit={submit}>
    {(target.kind === "move" || target.kind === "activity" && !target.activity) && <><label htmlFor={`${id}-module`}>Destination module</label><select data-autofocus id={`${id}-module`} name="module" required defaultValue={target.moduleId}>{modules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}</select></>}
    {target.kind === "activity" && !target.activity && <><label htmlFor={`${id}-type`}>Activity type</label><select id={`${id}-type`} name="type" defaultValue="theory"><option value="theory">Theory</option><option value="quiz">Quiz</option><option value="lab">Lab</option><option value="workshop">Workshop</option></select></>}
    {target.kind !== "move" && <><label htmlFor={`${id}-title`}>Title <span>*</span></label><input data-autofocus id={`${id}-title`} name="title" required maxLength={200} defaultValue={entry?.title} placeholder={target.kind === "module" ? "e.g. Getting started" : "e.g. Your first component"} /><label htmlFor={`${id}-description`}>Description <span>*</span></label><textarea id={`${id}-description`} name="description" rows={4} required maxLength={2000} defaultValue={entry?.description} placeholder="Give this part of the curriculum a clear purpose." /></>}
    {error && <p className="ins-error" role="alert">{error}</p>}<div className="ins-dialog-actions"><button type="button" className="ins-button secondary" onClick={onClose}>Cancel</button><button className="ins-button" disabled={!writable}>{target.kind === "move" ? "Move activity" : entry ? "Save details" : target.kind === "module" ? "Create module" : "Create draft activity"}</button></div></form></Modal>;
}
