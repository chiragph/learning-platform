"use client";
import { useEffect, useState } from "react";
import { learningRequest } from "../../lib/learning/client";
import { Icon, PageHeading } from "./ui";
export type Insights = {
  registeredStudents: number;
  courses: {
    id: string;
    title: string;
    learners: number;
    completed: number;
    students: {
      id: string;
      name: string;
      completed: number;
      total: number;
      updatedAt: string;
    }[];
  }[];
};
export function useInsights() {
  const [data, setData] = useState<Insights | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const load = () =>
      learningRequest<Insights>("instructor/insights")
        .then((d) => {
          if (active) {
            setData(d);
            setError("");
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
  return { data, error };
}
export function InsightsView() {
  const { data, error } = useInsights();
  return (
    <>
      <PageHeading
        title="Student Insights"
        description="Learning activity and completion across your published courses."
      />
      <section className="ins-insights-placeholder">
        <span className="ins-integration-icon">
          <Icon name="progress" />
        </span>
        <span className="ins-integration-badge">
          {data
            ? data.registeredStudents + " registered students"
            : "Loading learning records"}
        </span>
        <h2>
          {data
            ? data.courses.reduce((s, c) => s + c.learners, 0) +
              " course participations"
            : "Student activity"}
        </h2>
        <p>
          {error ||
            "Progress updates as students work through your published content."}
        </p>
        {data?.courses.map((c) => (
          <div className="ins-panel" key={c.id}>
            <h3>{c.title}</h3>
            <p>
              {c.learners} learners ? {c.completed} completed
            </p>
            {c.students.map((s) => (
              <div className="ins-summary-row" key={s.id}>
                <strong>{s.name}</strong>
                <span>
                  {s.completed}/{s.total} activities
                </span>
                <span>
                  {s.total ? Math.round((s.completed / s.total) * 100) : 0}%
                </span>
              </div>
            ))}
          </div>
        ))}
      </section>
    </>
  );
}
