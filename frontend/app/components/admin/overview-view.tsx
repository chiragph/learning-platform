"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { adminApi } from "../../lib/admin/api";
import type { ReportQuery } from "../../lib/admin/types";
import { useAdmin } from "./admin-provider";
import { useAdminResource } from "./use-admin-resource";
import { Heading, Stat, Panel, Icon, ResourceView, DateText, Loading } from "./ui";
import { TrendChart, Distribution } from "./charts";
import { ReportFilters } from "./report-filters";
import { ActivityList } from "./activity-list";

const quickActions = [
  { href: "/admin/users", title: "Manage Users", detail: "Accounts, roles & access", icon: "profile" as const },
  { href: "/admin/instructors", title: "View Instructors", detail: "People behind the curriculum", icon: "book" as const },
  { href: "/admin/courses", title: "Review Courses", detail: "Content & publication status", icon: "courses" as const },
  { href: "/admin/analytics", title: "View Analytics", detail: "Platform learning outcomes", icon: "progress" as const },
];
export function OverviewView() {
  const { user } = useAdmin();
  const [query, setQuery] = useState<ReportQuery>({ period: "30d" });
  const resource = useAdminResource(useCallback((s: AbortSignal) => adminApi.overview(query, s), [query]));
  const metrics = resource.status === "ready" ? resource.data.metrics : null;
  return <><Heading title={`Welcome back, ${user.name.trim().split(/\s+/)[0]}.`} description="A clear view of your platform, people, and learning outcomes."><ReportFilters value={query} onChange={setQuery} /></Heading>
    <div className="adm-section-label"><span>Platform overview</span><span>Totals across the platform · activity follows the selected period</span></div>
    <div className="adm-stats"><Stat label="Total Students" value={metrics?.students} icon="profile" description="Registered student accounts" loading={resource.status === "loading"} /><Stat label="Total Instructors" value={metrics?.instructors} icon="book" description="Provisioned instructor accounts" loading={resource.status === "loading"} /><Stat label="Total Courses" value={metrics?.courses} icon="courses" description="Across all publication states" loading={resource.status === "loading"} /><Stat label="Published Courses" value={metrics?.publishedCourses} icon="layers" description="Currently available to learners" loading={resource.status === "loading"} /><Stat label="Active Learners" value={metrics?.activeLearners} icon="code" description="With learning activity in this period" loading={resource.status === "loading"} /><Stat label="Course Completion Rate" value={metrics?.completionRate} icon="check" percent description="Server-calculated participation rate" loading={resource.status === "loading"} /></div>
    <ResourceView resource={resource}>{data => <><p className="adm-updated">Report generated <DateText value={data.generatedAt} time /></p><div className="adm-grid-two"><Panel title="Student registrations" subtitle="New student accounts during the reporting period"><TrendChart data={data.registrations} label="Student registrations" /></Panel><Panel title="Learning activity" subtitle="Recorded learning events during the reporting period"><TrendChart data={data.learningActivity} label="Learning activity" /></Panel></div><div className="adm-overview-bottom"><Panel title="Recent activity" subtitle="Events recorded by the platform" action={<Link className="adm-link" href="/admin/activity">View all <Icon name="arrow" /></Link>}><ActivityList events={data.recentActivity} /></Panel><Panel title="Course distribution" subtitle="Current publication states"><Distribution data={data.courseDistribution?.map(item => ({ label: item.status[0].toUpperCase() + item.status.slice(1), count: item.count, tone: item.status })) ?? null} /></Panel></div></>}</ResourceView>
    {resource.status !== "ready" && <div className="adm-grid-two"><Panel title="Student registrations" subtitle="Reporting history">{resource.status === "loading" ? <Loading rows={3} /> : <TrendChart data={null} label="Student registrations" />}</Panel><Panel title="Learning activity" subtitle="Recorded learning events">{resource.status === "loading" ? <Loading rows={3} /> : <TrendChart data={null} label="Learning activity" />}</Panel><Panel title="Recent activity">{resource.status === "loading" ? <Loading rows={3} /> : <ActivityList events={null} />}</Panel><Panel title="Course distribution">{resource.status === "loading" ? <Loading rows={3} /> : <Distribution data={null} />}</Panel></div>}
    <section className="adm-quick-actions" aria-labelledby="adm-quick-title"><div className="adm-section-label"><h2 id="adm-quick-title">Your workspace</h2><span>Go straight to what matters</span></div><div>{quickActions.map(action => <Link href={action.href} key={action.href} className="adm-quick-action"><span className="adm-quick-icon"><Icon name={action.icon} /></span><div><strong>{action.title}</strong><small>{action.detail}</small></div><Icon name="arrow" /></Link>)}</div></section>
  </>;
}
