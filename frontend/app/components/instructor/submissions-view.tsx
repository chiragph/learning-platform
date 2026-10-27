"use client";
import { useEffect, useState } from "react";
import { learningRequest } from "../../lib/learning/client";
import type { Submission } from "../../lib/learning/submissions";
import type { ReviewStatus } from "../../lib/instructor/submission-types";
import { reviewStatusLabels } from "../../lib/instructor/submissions";
import { Empty, Icon, Modal, Modified, PageHeading } from "./ui";
import "./theory.css";
import "./submissions.css";
export function SubmissionsView() {
  const [records, setRecords] = useState<Submission[]>([]),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [query, setQuery] = useState(""),
    [course, setCourse] = useState("all"),
    [workshop, setWorkshop] = useState("all"),
    [status, setStatus] = useState("all"),
    [selected, setSelected] = useState<Submission | null>(null);
  useEffect(() => {
    let active = true;
    const load = () =>
      learningRequest<{ records: Submission[] }>("instructor/submissions")
        .then((d) => {
          if (active) {
            setRecords(d.records);
            setReady(true);
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    void load();
    window.addEventListener("focus", load);
    const timer = window.setInterval(load, 30000);
    return () => {
      active = false;
      window.removeEventListener("focus", load);
      window.clearInterval(timer);
    };
  }, []);
  const courses = [
      ...new Map(records.map((r) => [r.courseId, r.courseTitle])).entries(),
    ],
    workshops = [
      ...new Map(records.map((r) => [r.activityId, r.workshopTitle])).entries(),
    ];
  const filtered = records.filter(
    (r) =>
      (course === "all" || r.courseId === course) &&
      (workshop === "all" || r.activityId === workshop) &&
      (status === "all" || r.status === status) &&
      (r.studentName + " " + r.projectTitle)
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        title="Submissions"
        description="Review students' completed workshop projects and share feedback."
      />
      <div className="ins-theory-note">
        <Icon name="book" />
        <p>
          <strong>Student projects.</strong> Completing a workshop submits its
          saved code for review. Final feedback is visible to the student.
        </p>
      </div>
      {error && (
        <p role="alert" className="ins-notice warning">
          {error}
        </p>
      )}
      <div className="ins-stats ins-demo-stats">
        {[
          ["Total submissions", records.length],
          [
            "Pending review",
            records.filter((r) => ["pending", "in-review"].includes(r.status))
              .length,
          ],
          ["Reviewed", records.filter((r) => r.status === "reviewed").length],
          [
            "Changes requested",
            records.filter((r) => r.status === "changes-requested").length,
          ],
        ].map(([label, value]) => (
          <div key={label}>
            <span className="ins-stat-label">{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="ins-toolbar ins-theory-filters">
        <label className="ins-search">
          <input
            aria-label="Search submissions"
            placeholder="Search student or project"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="Course"
          value={course}
          onChange={(e) => setCourse(e.target.value)}
        >
          <option value="all">All courses</option>
          {courses.map(([id, title]) => (
            <option key={id} value={id}>
              {title}
            </option>
          ))}
        </select>
        <select
          aria-label="Workshop"
          value={workshop}
          onChange={(e) => setWorkshop(e.target.value)}
        >
          <option value="all">All workshops</option>
          {workshops.map(([id, title]) => (
            <option key={id} value={id}>
              {title}
            </option>
          ))}
        </select>
        <select
          aria-label="Review status filter"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">All statuses</option>
          {Object.entries(reviewStatusLabels).map(([id, title]) => (
            <option key={id} value={id}>
              {title}
            </option>
          ))}
        </select>
      </div>
      {filtered.length ? (
        <div className="ins-demo-list">
          {filtered.map((record) => (
            <article key={record.id} className="ins-demo-row">
              <span className="ins-demo-avatar" aria-hidden="true">
                <Icon name="project" />
              </span>
              <div className="ins-demo-name">
                <span className="ins-demo-label">STUDENT SUBMISSION</span>
                <h2>{record.projectTitle}</h2>
                <p>{record.studentName}</p>
                <small>
                  {record.courseTitle} / {record.workshopTitle}
                </small>
                <small>
                  Submitted ? <Modified at={record.submittedAt} />
                </small>
              </div>
              <span className={"ins-demo-status " + record.status}>
                {reviewStatusLabels[record.status]}
              </span>
              <button
                type="button"
                className="ins-button secondary"
                onClick={() => setSelected(record)}
              >
                Review
                <Icon name="arrow" />
              </button>
            </article>
          ))}
        </div>
      ) : (
        <Empty title={ready ? "No submissions found" : "Loading submissions"}>
          Completed student workshops will appear here.
        </Empty>
      )}
      {selected && (
        <Review
          key={selected.id}
          record={selected}
          onClose={() => setSelected(null)}
          onSave={(rows) => {
            setRecords(rows);
            setSelected(null);
          }}
        />
      )}
    </>
  );
}
function Review({
  record,
  onClose,
  onSave,
}: {
  record: Submission;
  onClose: () => void;
  onSave: (rows: Submission[]) => void;
}) {
  const [feedback, setFeedback] = useState(record.feedback),
    [status, setStatus] = useState(record.status),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save() {
    setBusy(true);
    try {
      const data = await learningRequest<{ records: Submission[] }>(
        "instructor/reviews",
        { id: record.id, feedback, status, expectedRevision: record.revision },
      );
      onSave(data.records);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }
  async function download() {
    try {
      const code = await learningRequest(
        "instructor/submissions/" + record.id + "/code",
      );
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(code, null, 2)], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "project-code.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed.");
    }
  }
  return (
    <Modal title="Review student submission" onClose={onClose}>
      <div className="ins-demo-review">
        <h3>{record.projectTitle}</h3>
        <p>
          <strong>{record.studentName}</strong>
        </p>
        <p>
          {record.courseTitle} / {record.workshopTitle}
        </p>
        <dl className="ins-demo-dates">
          <div>
            <dt>Submitted</dt>
            <dd>
              <Modified at={record.submittedAt} />
            </dd>
          </div>
          <div>
            <dt>Reviewed</dt>
            <dd>
              <Modified at={record.reviewedAt} />
            </dd>
          </div>
        </dl>
        <div className="ins-demo-file">
          <Icon name="book" />
          <div>
            <strong>Project source code</strong>
            <p>Saved HTML, CSS and JavaScript at submission time.</p>
          </div>
          <button className="ins-button secondary" onClick={download}>
            Download code
          </button>
        </div>
        {error && (
          <p role="alert" className="ins-error">
            {error}
          </p>
        )}
        <fieldset className="ins-theory-fields" disabled={busy}>
          <label>
            Review status
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ReviewStatus)}
            >
              {Object.entries(reviewStatusLabels).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Feedback
            <textarea
              rows={7}
              maxLength={10000}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
            />
          </label>
        </fieldset>
        <div className="ins-dialog-actions">
          <button className="ins-button secondary" onClick={onClose}>
            Close Review
          </button>
          <button
            className="ins-button"
            disabled={
              busy ||
              (["reviewed", "changes-requested"].includes(status) &&
                feedback.trim().length < 3)
            }
            onClick={save}
          >
            Save Review
          </button>
        </div>
      </div>
    </Modal>
  );
}
