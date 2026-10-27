"use client";

import { useId, useState, type FormEvent } from "react";
import type { CourseColor, CourseFields, CourseIcon, Difficulty, InstructorCourse } from "../../lib/instructor/types";
import { useInstructor } from "./instructor-provider";
import { Modal, Status, TimestampMetadata } from "./ui";

export function CourseDetails({ course, onClose }: { course: InstructorCourse; onClose: () => void }) {
  return <Modal title={course.title} onClose={onClose}><div className="ins-details-summary"><Status status={course.status} archived={course.archived} /><code>{course.id}</code><p>{course.description}</p><small>{course.category} · {course.difficulty} · {course.duration || "Duration not set"}</small></div><TimestampMetadata record={course} publication /><p className="ins-footnote">Dates and times use your local timezone. Unavailable historical dates have not been estimated. Publication dates describe this browser-local record.</p><div className="ins-dialog-actions"><button type="button" className="ins-button secondary" onClick={onClose}>Close details</button></div></Modal>;
}

export function CourseForm({ course, onClose }: { course?: InstructorCourse; onClose: () => void }) {
  const { state, execute, writable, error } = useInstructor(), formId = useId();
  const [title, setTitle] = useState(course?.title ?? ""), [id, setId] = useState(course?.id ?? ""), [customId, setCustomId] = useState(!!course), [validation, setValidation] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setValidation("");
    if (!course && state.courses.some(c => c.id === id)) { setValidation("This course identifier is already in use, including archived courses."); return; }
    const data = new FormData(event.currentTarget), fields: CourseFields = {
      title, description: String(data.get("description")).trim(), category: String(data.get("category")).trim(), difficulty: data.get("difficulty") as Difficulty,
      duration: String(data.get("duration")).trim(), objectives: String(data.get("objectives")).split("\n").map(x => x.trim()).filter(Boolean), color: data.get("color") as CourseColor, icon: data.get("icon") as CourseIcon,
    };
    if (!fields.objectives.length) { setValidation("Add at least one learning objective."); return; }
    const result = await execute(course ? { type: "course.update", courseId: course.id, fields } : { type: "course.create", id, fields });
    if (result) onClose();
  }
  return <Modal title={course ? "Edit course" : "Create a course"} onClose={onClose}><p className="ins-dialog-copy">{course ? "Update the course overview. Its identifier remains stable; edits return this course to Draft." : "Start with the essentials. Your new course will be saved as a draft."}</p>
    {course && <TimestampMetadata record={course} publication />}
    <form onSubmit={submit} className="ins-form"><label htmlFor={`${formId}-title`}>Course title <span>*</span></label><input data-autofocus id={`${formId}-title`} name="title" required maxLength={100} placeholder="e.g. Accessible web interfaces" value={title} onChange={e => { setTitle(e.target.value); if (!customId) setId(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80)); }} />
      <label htmlFor={`${formId}-id`}>Stable course identifier <span>*</span></label><input id={`${formId}-id`} name="id" required maxLength={80} pattern="[a-z][a-z0-9]*(-[a-z0-9]+)*" readOnly={!!course} value={id} onChange={e => { setCustomId(true); setId(e.target.value); }} aria-describedby={`${formId}-id-help`} /><small id={`${formId}-id-help`}>Lowercase letters, numbers, and hyphens. This identifier cannot change after creation.</small>
      <label htmlFor={`${formId}-description`}>Short description <span>*</span></label><textarea id={`${formId}-description`} name="description" required maxLength={2000} rows={3} defaultValue={course?.description} placeholder="What will learners be able to do?" />
      <div className="ins-form-grid"><div><label htmlFor={`${formId}-category`}>Category / technology <span>*</span></label><input id={`${formId}-category`} name="category" required maxLength={100} defaultValue={course?.category} placeholder="Web development" /></div><div><label htmlFor={`${formId}-difficulty`}>Difficulty</label><select id={`${formId}-difficulty`} name="difficulty" defaultValue={course?.difficulty ?? "Beginner"}>{["Beginner", "Intermediate", "Advanced"].map(x => <option key={x}>{x}</option>)}</select></div></div>
      <label htmlFor={`${formId}-duration`}>Estimated duration <span>*</span></label><input id={`${formId}-duration`} name="duration" required maxLength={100} defaultValue={course?.duration} placeholder="e.g. 4 hours" />
      <label htmlFor={`${formId}-objectives`}>Learning objectives <span>*</span></label><textarea id={`${formId}-objectives`} name="objectives" required maxLength={6000} rows={3} defaultValue={course?.objectives.join("\n")} placeholder="One objective per line" /><small>One objective per line, up to 20 objectives.</small>
      <div className="ins-form-grid"><div><label htmlFor={`${formId}-icon`}>Course icon</label><select id={`${formId}-icon`} name="icon" defaultValue={course?.icon ?? "code"}>{([["code", "Code </>"], ["braces", "Braces { }"], ["book", "Book"]] as [CourseIcon, string][]).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div><div><label htmlFor={`${formId}-color`}>Accent color</label><select id={`${formId}-color`} name="color" defaultValue={course?.color ?? "blue"}>{(["blue", "orange", "gold", "green"] as CourseColor[]).map(x => <option key={x} value={x}>{x[0].toUpperCase() + x.slice(1)}</option>)}</select></div></div>
      {(validation || error) && <p className="ins-error" role="alert">{validation || error}</p>}
      <div className="ins-dialog-actions"><button type="button" className="ins-button secondary" onClick={onClose}>Cancel</button><button className="ins-button" disabled={!writable}>{course ? "Save course details" : "Create draft course"}</button></div>
    </form></Modal>;
}
