"use client";

import type { FilterOptions, ReportQuery } from "../../lib/admin/types";
import type { Resource } from "./use-admin-resource";
import { Field } from "./ui";

export function ReportFilters({ value, onChange, options }: { value: ReportQuery; onChange: (value: ReportQuery) => void; options?: Resource<FilterOptions> }) {
  return <div className="adm-filters adm-report-filters"><Field label="Reporting period"><select value={value.period} onChange={e => onChange({ ...value, period: e.target.value as ReportQuery["period"] })}><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="90d">Last 90 days</option><option value="all">All time</option></select></Field>{options && <><Field label="Course"><select value={value.courseId ?? ""} onChange={e => onChange({ ...value, courseId: e.target.value || undefined })} disabled={options.status !== "ready"}><option value="">All courses</option>{options.status === "ready" && options.data.courses.map(option => <option value={option.id} key={option.id}>{option.label}</option>)}</select></Field><Field label="Instructor"><select value={value.instructorId ?? ""} onChange={e => onChange({ ...value, instructorId: e.target.value || undefined })} disabled={options.status !== "ready"}><option value="">All instructors</option>{options.status === "ready" && options.data.instructors.map(option => <option value={option.id} key={option.id}>{option.label}</option>)}</select></Field>{options.status === "error" && <p className="adm-filter-note">Course and instructor filters require backend filter options.</p>}</>}</div>;
}
