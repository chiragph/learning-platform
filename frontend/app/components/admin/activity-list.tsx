import type { AuditEvent } from "../../lib/admin/types";
import { Avatar, DateText, Empty, Icon } from "./ui";

export const eventLabels: Record<AuditEvent["type"], string> = {
  "user.registered": "User registered", "course.published": "Course published", "course.archived": "Course archived", "course.restored": "Course restored",
  "account.suspended": "Account suspended", "account.reactivated": "Account reactivated", "settings.changed": "Setting changed",
};
export function ActivityList({ events }: { events: AuditEvent[] | null }) {
  if (events === null) return <Empty title="Activity feed unavailable">Recorded platform events will appear when the audit API is connected.</Empty>;
  if (events.length === 0) return <Empty title="No recorded events">There are no events for this reporting period.</Empty>;
  return <ol className="adm-activity-list">{events.map(event => <li key={event.id}><span className="adm-event-icon"><Icon name={event.type === "user.registered" ? "profile" : event.type.startsWith("course.") ? "courses" : "clock"} /></span><div><div className="adm-event-title"><strong>{eventLabels[event.type]}</strong><DateText value={event.createdAt} time /></div><p>{event.description}</p><small>{event.actor?.name ?? "System"}{event.target ? ` · ${event.target.label}` : ""}</small></div></li>)}</ol>;
}
export function Actor({ actor }: { actor: AuditEvent["actor"] }) {
  return actor ? <div className="adm-person"><Avatar name={actor.name} /><div><strong>{actor.name}</strong><small>{actor.email}</small></div></div> : <span className="adm-muted">System</span>;
}
