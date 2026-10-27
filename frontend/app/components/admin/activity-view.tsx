"use client";

import { useCallback, useState } from "react";
import { adminApi } from "../../lib/admin/api";
import { eventTypes, type ActivityQuery } from "../../lib/admin/types";
import { Actor, eventLabels } from "./activity-list";
import { useAdminResource } from "./use-admin-resource";
import { DateText, Empty, Field, Heading, Info, Pagination, Panel, ResourceView } from "./ui";

export function ActivityView() {
  const [query, setQuery] = useState<ActivityQuery>({ page: 1, pageSize: 10 });
  const invalidDates = Boolean(query.from && query.to && query.from > query.to);
  // Invalid date ranges remain visible for correction and never reach the API.
  const load = useCallback((s: AbortSignal) => invalidDates ? Promise.reject(new Error("Invalid date range")) : adminApi.activity(query, s), [query, invalidDates]);
  const resource = useAdminResource(load);
  function filter(next: Partial<ActivityQuery>) { setQuery(current => ({ ...current, ...next, page: 1 })); }
  return <><Heading title="Activity Logs" description="A chronological record of platform and administrative events." /><Info>Only backend-recorded events appear here. Event timestamps and date filters use UTC.</Info><Panel title="Platform audit trail" subtitle="Most recent events first"><div className="adm-filters"><Field label="Search events" className="adm-search"><input type="search" placeholder="Search actor, resource, or description…" value={query.search ?? ""} onChange={e => filter({ search: e.target.value })} /></Field><Field label="Event type"><select value={query.type ?? ""} onChange={e => filter({ type: e.target.value as ActivityQuery["type"] || undefined })}><option value="">All event types</option>{eventTypes.map(type => <option key={type} value={type}>{eventLabels[type]}</option>)}</select></Field><Field label="From (UTC)"><input type="date" value={query.from ?? ""} max={query.to} aria-invalid={invalidDates} aria-describedby={invalidDates ? "adm-date-error" : undefined} onChange={e => filter({ from: e.target.value || undefined })} /></Field><Field label="Through (UTC)"><input type="date" value={query.to ?? ""} min={query.from} aria-invalid={invalidDates} aria-describedby={invalidDates ? "adm-date-error" : undefined} onChange={e => filter({ to: e.target.value || undefined })} /></Field></div>{invalidDates ? <p className="adm-error" id="adm-date-error" role="alert">The start date must be on or before the end date.</p> : <ResourceView resource={resource}>{data => <><div className="adm-table-scroll" tabIndex={0} role="region" aria-label="Administrative events"><table className="adm-table"><caption className="sr-only">Platform activity logs, most recent first</caption><thead><tr>{["Event", "Actor", "Target Resource", "Description", "Timestamp (UTC)"].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{data.items.map(event => <tr key={event.id}><td><span className="adm-event-label">{eventLabels[event.type]}</span></td><td><Actor actor={event.actor} /></td><td>{event.target ? <><strong>{event.target.label}</strong><small className="adm-block adm-muted">{event.target.kind}</small></> : <span className="adm-muted">Not applicable</span>}</td><td className="adm-event-description">{event.description}</td><td><DateText value={event.createdAt} time /></td></tr>)}</tbody></table></div>{!data.items.length && <Empty title="No recorded events found">Try another search, event type, or date range.</Empty>}<Pagination data={data} onPage={page => setQuery({ ...query, page })} /></>}</ResourceView>}</Panel></>;
}
