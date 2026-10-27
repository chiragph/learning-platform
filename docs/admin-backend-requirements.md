# DECODE admin backend handoff

Status: frontend contract proposal, 27 October 2026. The admin UI is implemented on `feature/admin-dashboard`. **No admin endpoints are implemented in the inspected backend. ADMIN authentication is not currently usable.** Backend teammates should implement and validate this work on their own branch, for example `feature/admin-backend`. This frontend change does not change NestJS, Prisma, migrations, or PostgreSQL.

## Current repository findings

- Prisma `UserRole` already contains `ADMIN`, `INSTRUCTOR`, and `STUDENT`.
- `backend/src/auth/account-access.ts::publicAccount` currently maps every account other than the designated instructor to `STUDENT`, including a stored ADMIN. Login and `/auth/me` therefore never return ADMIN.
- `backend/src/auth/session-cookies.ts` accepts only `student` and `instructor` scopes. Requests with `scope=admin` currently return 400. `AuthController.setSession` and scoped logout also only distinguish those two roles.
- `AuthUser` exposes only `{id,name,email,role}`. Do not add private account fields to session responses. Registration dates and account status are requested from the separate admin account/detail APIs.
- There is no account-status field, audit model, platform settings model, or admin controller/guard in the inspected backend.
- Learning data is held in `InstructorWorkspace`, `LearningCourse`, `LearningPublication`, `LearningProgress`, `LearningQuizAttempt`, and `LearningSubmission`. Modules and activities live inside versioned JSON documents; there are no standalone Module or Activity Prisma models.
- `LearningCourse.archived` already exists. Publication timestamps exist on `LearningPublication.createdAt`. Draft/content timestamps are in typed workspace documents; inspect those rather than inventing database columns.
- Existing workshop review statuses are `pending`, `in-review`, `reviewed`, and `changes-requested` (hyphenated). There is no existing `approved` status; publishing review feedback is not necessarily approval.
- The existing instructor deployment has an email restriction. Preserve that workflow while implementing separate ADMIN access. Do not broaden existing instructor endpoints implicitly.

## Shared transport and security

All paths below include `/api`, as configured by NestJS. The browser uses the existing Next.js `/api/:path*` rewrite to `API_URL`, defaulting to `http://localhost:4000`. No browser tokens, second authentication provider, public environment secrets, or local management records are introduced.

1. Every `/api/admin/**` route independently verifies a live, non-suspended session and `user.role === ADMIN` at the server, including read-only routes and filter options. Frontend guards and returned capability flags are conveniences, never security controls.
2. Add `admin` to session scope handling and `decode_admin_session` to the existing role cookie map. Login sets the legacy `decode_session` alias plus the correct scoped role cookie. `GET /api/auth/me?scope=admin` prefers the admin cookie and otherwise accepts the legacy alias. An invalid scoped cookie must not fall back to another cookie. Preserve parallel Student and Instructor sessions.
3. Return the real authorized ADMIN role in login and `/me`. Public registration must continue forcing STUDENT regardless of supplied role fields. Provision admins through a controlled server-side operation; never provide default or hardcoded credentials. Provisioning implementation and tests belong to the backend team.
4. `POST /api/auth/logout?scope=admin`, body `{}`, revokes the admin token and clears its cookie plus aliases for that exact token, preserving unrelated workspace cookies. Retain HttpOnly, SameSite, Secure-in-production, expiry, and no-store behavior.
5. All writes require JSON and the existing origin/CSRF checks. Recheck role and account status on every operation. Suspension revokes the target's active sessions. Reject self-suspension and actions that remove the last active administrator.
6. Return `Cache-Control: no-store` on authenticated responses. Never return password hashes, session tokens/hashes, environment variables, private storage keys, or submission code through these admin summary endpoints.
7. The frontend permits only authenticated ADMIN sessions. Every admin page uses a server-only `AdminWorkspace` guard behind Suspense; the layout always renders its child segment for Next.js 16 instant-navigation validation. Anonymous users go to `/login`; non-admin sessions go to their existing `accountHome`. Scope/service failures fail closed with a retry state, rather than being mistaken for anonymous access. Client session checks repeat on navigation, focus, visibility, pageshow, cross-tab auth changes, and every 60 seconds.

## Common response and query contracts

The exact TypeScript source of truth is `frontend/app/lib/admin/types.ts`; runtime validators are in `contracts.ts`; endpoint usage is in `api.ts`. Successful GETs and PATCHes use **200 with JSON**, not 204 or a `{data: ...}` envelope. Required keys must be present. Extra keys are ignored, but private fields should still never be sent.

- All IDs are nonempty opaque strings. Account IDs currently use UUIDs; course/content IDs may not.
- Timestamps are ISO 8601 UTC strings, or `null` where the schema explicitly permits unavailable dates. Series dates should use `YYYY-MM-DDT00:00:00.000Z`.
- Counts are nonnegative safe integers or `null` when unavailable. Percentage metrics are numbers in **0–100**, or `null` if the denominator or source is unavailable. Zero is measured zero, not a fallback for missing data.
- Series/distribution arrays use `null` for unavailable data and `[]` for successfully queried empty data.
- Account status: `active | suspended | unknown`. Use `unknown` only while status cannot be measured. Capability flags must be false when support or authorization is missing.
- Course status: `draft | published | archived`. Archived takes precedence over publication status. Do not count historical snapshots as separate courses.
- Lists use one-based `page` (default 1), `pageSize` (frontend sends 10; suggested allowed range 1–100), `total` after filtering, and `items` for that page. Use stable secondary ID ordering, preserve filters while paging, and return the requested page metadata. A page beyond the result range may return empty items; previous-page navigation must remain usable. Do not silently clamp metadata to a different query.
- `search` is trimmed, case-insensitive substring matching; impose a sensible maximum (for example 200 characters). Missing or empty filters mean all records. Parameterize database queries. Validate enum/date/ID combinations and reject invalid input with 400.
- A period is `7d | 30d | 90d | all`. Use a single server report cutoff. Rolling-day periods include the current UTC day and the preceding N−1 UTC dates; `all` removes the lower bound. Include ascending, zero-filled UTC buckets for the complete requested period when history is complete. For all-time reports, choose daily/weekly/monthly bucket size appropriate to the history and document it.
- Date filters `from` and `to` use `YYYY-MM-DD` UTC, both inclusive by calendar date (`>= fromT00:00Z` and `< dayAfter(to)T00:00Z`). Reject `from > to`.

```json
{
  "items": [],
  "page": 1,
  "pageSize": 10,
  "total": 0
}
```

## Endpoint inventory

All new endpoints below require ADMIN. Responses marked “example” are illustrative contract examples only; the frontend never loads these as production data.

| Method | Endpoint | Query/body | Required response | Backend status |
|---|---|---|---|---|
| GET | `/api/auth/me?scope=admin` | Existing session cookie | `{ "user": AuthUser }` with true ADMIN | Extend existing auth |
| POST | `/api/auth/login` | Existing `{email,password,remember}` | Existing `{user}`, correct scoped cookies | Extend role handling |
| POST | `/api/auth/logout?scope=admin` | `{}` | Existing successful JSON message | Extend existing logout |
| GET | `/api/admin/overview` | `period` | Overview below | Missing |
| GET | `/api/admin/users` | `search,role,status,sort,page,pageSize` | `Page<User>` | Missing |
| GET | `/api/admin/users/:id` | User ID | `UserDetail` | Missing |
| PATCH | `/api/admin/users/:id/status` | `{status,reason}` | Updated `UserDetail` | Missing |
| GET | `/api/admin/instructors` | `search,status,sort,page,pageSize` | `Page<Instructor>` | Missing |
| GET | `/api/admin/instructors/:id` | Instructor ID | `InstructorDetail` | Missing |
| GET | `/api/admin/courses` | `search,instructorId,status,page,pageSize` | `Page<Course>` | Missing |
| GET | `/api/admin/courses/:id` | Course ID | `CourseDetail` | Missing |
| PATCH | `/api/admin/courses/:id/archive` | `{archived,reason}` | Updated `CourseDetail` | Missing |
| GET | `/api/admin/analytics` | `period,courseId,instructorId` | Analytics below | Missing |
| GET | `/api/admin/activity` | `search,type,from,to,page,pageSize` | `Page<AuditEvent>` | Missing |
| GET | `/api/admin/filter-options` | None | `{courses:[{id,label}],instructors:[{id,label}]}` | Missing |
| GET | `/api/admin/account` | Session identity only | `{user:User,capabilities:{editName:boolean}}` | Missing |
| PATCH | `/api/admin/account` | `{name}` | Updated account response above | Missing |
| GET | `/api/admin/settings` | None | `{uploadLimitBytes:number|null,accountPolicy:string|null}` | Missing |

No frontend create-instructor, assign-course, edit-curriculum, delete-user, publication-write, or platform-settings-write requests exist. These require a future separately reviewed contract and UI; disabled provisioning and assignment explanations are intentional. Do not route admin writes through instructor commands.

## Overview

`GET /api/admin/overview?period=30d`. Global totals reflect current accounts and unique courses; period applies to active learners, new registrations, learning events, and recent recorded events. Completion rate uses server-defined eligible participations and the same period convention as analytics.

Example:

```json
{
  "generatedAt": "2026-10-27T12:00:00.000Z",
  "metrics": {"students": 24, "instructors": 2, "courses": 6, "publishedCourses": 3, "activeLearners": null, "completionRate": null},
  "registrations": [{"date":"2026-10-27T00:00:00.000Z","value":2}],
  "learningActivity": null,
  "courseDistribution": [{"status":"published","count":3},{"status":"draft","count":2},{"status":"archived","count":1}],
  "recentActivity": []
}
```

Do not use current account counts to invent historical trends. Registration history can come from `User.createdAt`; publishing history must come from actual persisted publications or audit events. Active history must come from recorded learning events, not session creation or current progress totals.

## Users and account actions

`GET /api/admin/users?search=alex&role=STUDENT&status=active&sort=createdAt:desc&page=1&pageSize=10`.

- `sort`: `name:asc | name:desc | createdAt:asc | createdAt:desc`.
- `role`: `ADMIN | INSTRUCTOR | STUDENT`.
- Match search across name and email.

Example list item:

```json
{"id":"user-id","name":"Alex Learner","email":"alex@example.test","role":"STUDENT","status":"active","createdAt":"2026-10-01T09:00:00.000Z"}
```

`GET /api/admin/users/:id` returns that item plus:

```json
{
  "participation": {"courses": 2, "completedCourses": 1, "completedActivities": 8, "completionRate": 50},
  "capabilities": {"changeStatus": true}
}
```

The example is an extension of the full user object, not a standalone response. Define participation consistently with analytics; if the existing progress model cannot reliably provide an enrollment/denominator, return null.

`PATCH /api/admin/users/:id/status` body:

```json
{"status":"suspended","reason":"Account access restricted after administrator review."}
```

Only active/suspended are writable. `reason` is trimmed, 5–500 characters. Persist status, revoke sessions on suspension, and append the audit event in one transaction. Reactivation allows future login; it does not resurrect revoked sessions. Do not delete learning history. Return the entire updated user-detail object after commit. The UI confirms success only if ID and desired status match. Enforce self/last-admin restrictions server-side. Make repeated requests for the same target state idempotent; uncertain network outcomes should be reconcilable through GET.

## Instructors

`GET /api/admin/instructors` accepts the users' search, account-status, sort, and pagination parameters, and always restricts results to INSTRUCTOR. The UI does not send a role filter.

Each instructor item extends User:

```json
{"publishedCourses":3,"draftCourses":1,"activeStudents":null}
```

Counts exclude archived courses. `activeStudents` means distinct students with recorded learning activity on the instructor's courses during the past 30 UTC days. Use null if history is insufficient; do not substitute enrollment counts.

`GET /api/admin/instructors/:id` returns the full instructor object plus:

```json
{
  "courses": [],
  "recentPublications": [{"courseId":"html","title":"HTML foundations","publishedAt":"2026-10-25T09:00:00.000Z"}]
}
```

`courses` contains complete Course objects as defined below, including assigned archived courses where relevant. Recent publications are actual publications, most recent first. Missing/non-instructor IDs return 404. Provisioning and course assignment remain managed outside this frontend version.

## Courses and moderation

`GET /api/admin/courses` searches course title, optionally filtering by instructor owner ID and status. Order by last update descending with stable ID tie-breaking. Read the authoritative owner workspace for drafts and actual live publications for published content; do not limit results to the designated instructor.

Example Course (also used in instructor details):

```json
{
  "id":"html","title":"HTML foundations","description":"Build semantic web pages.",
  "instructor":{"id":"instructor-id","name":"Taylor Instructor","email":"taylor@example.test"},
  "moduleCount":3,"activityCount":12,"status":"published",
  "updatedAt":"2026-10-25T09:00:00.000Z","publishedAt":"2026-10-25T09:00:00.000Z"
}
```

`instructor` can be null for unassigned content. Counts and dates can be null if unavailable.

`GET /api/admin/courses/:id` returns that full Course plus:

```json
{
  "modules": [{"id":"module-1","title":"Getting started","activities":[{"id":"activity-1","title":"Your first page","type":"theory"}]}],
  "participation":{"learners":null,"completed":null,"completionRate":null},
  "capabilities":{"archive":true,"restore":false}
}
```

Activities are `theory | quiz | lab | workshop`. Return the entire inspectable curriculum, not a truncated page: the UI derives its type breakdown from this array. Document whether the reviewed version is the published snapshot or latest draft, and keep reported counts consistent with that version. Exclude archived modules/activities from the active curriculum counts.

`PATCH /api/admin/courses/:id/archive` body:

```json
{"archived":true,"reason":"Archived after curriculum review."}
```

Use existing `LearningCourse.archived` and synchronize any authoritative workspace/archive representations atomically. Preserve version history, progress, attempts, and submissions. Restore to the prior publication state without silently publishing drafts. Return full CourseDetail after commit. Audit archive/restore events. Do not overwrite instructor content. Existing instructor publishing and student curriculum delivery must continue to respect archiving. The frontend verifies returned ID and archive state before success feedback.

## Analytics

`GET /api/admin/analytics?period=30d&courseId=html&instructorId=instructor-id`.

Example:

```json
{
  "generatedAt":"2026-10-27T12:00:00.000Z",
  "users":{"byRole":[{"role":"STUDENT","count":24},{"role":"INSTRUCTOR","count":2},{"role":"ADMIN","count":1}],"active":null,"registrations":[]},
  "learning":{"participants":null,"lessonsCompleted":null,"courseCompletionRate":null,"averageQuizScore":null,"labsCompleted":null,"activity":null},
  "workshops":{"total":0,"pending":0,"approved":null,"changesRequested":0}
}
```

- User totals and registrations remain platform-wide; course and instructor filters apply to learning/workshop sections only. Both course and instructor constraints apply when present; incompatible selections return empty/zero measured data with null rates, rather than ignoring one filter.
- `users.active`: distinct users with actual recorded activity in the selected period. If events only cover students, do not label their count as active users of all roles; return null until measurable.
- `learning.participants`: distinct participating students matching filters and period. Do not count a student's multiple activity records as multiple learners.
- `lessonsCompleted` and `labsCompleted`: distinct accepted student/activity completions recorded in the period, rather than visits or code saves.
- `courseCompletionRate`: completed eligible student/course participations divided by eligible participations × 100. Backend must define eligibility, versioning, and time cohort. With no trustworthy denominator, use null. Rate denominator zero also yields null.
- `averageQuizScore`: mean server-graded attempt percentages in the period. Never use frontend scores; exclude ungraded/invalidated attempts. No valid attempts yields null.
- `activity`: recorded learning events, ascending by UTC bucket, matching period/course/instructor. Current JSON progress snapshots alone do not establish historical event counts. If history is unavailable, use null.
- Workshop counts use current submission records created in the selected period and filtered by course/instructor. Count `pending` plus `in-review` as `pending` reviews, and the existing hyphenated `changes-requested` status as `changesRequested`. There is no existing approval status: return `approved: null` until the team defines explicit approval semantics. Do not silently treat `reviewed` (published feedback) as approval. Count submissions, not resubmission revisions. Total includes all matching records, including `reviewed`; these three displayed outcome categories therefore need not sum to total. If the backend later adds approval, agree its schema and semantics before returning a measured approved count.

`GET /api/admin/filter-options` returns complete ID/label lookup lists so filters do not depend on whichever management page was loaded. Include courses in every state and all instructors. For large deployments, replace with a separately agreed searchable/paged lookup contract. Until then, do not silently truncate options.

```json
{"courses":[{"id":"html","label":"HTML foundations"}],"instructors":[{"id":"instructor-id","label":"Taylor Instructor"}]}
```

## Activity logs and audit persistence

`GET /api/admin/activity?type=course.published&from=2026-10-01&to=2026-10-27&search=html&page=1&pageSize=10`.

Filter `type`: `user.registered | course.published | course.archived | course.restored | account.suspended | account.reactivated | settings.changed`.

Search across actor name/email, target label, and event description. Order by timestamp descending, then stable ID descending. Return Page<AuditEvent>.

Example event:

```json
{
  "id":"event-id","type":"course.archived",
  "actor":{"id":"admin-id","name":"Morgan Admin","email":"morgan@example.test"},
  "target":{"id":"html","label":"HTML foundations","kind":"course"},
  "description":"Archived after curriculum review.",
  "createdAt":"2026-10-27T12:00:00.000Z"
}
```

Actor and target can be null for genuine system or nontargeted events. Keep human-readable resource and actor snapshots if identities are later renamed. Audit events should be immutable and appended in the same transaction as a successful mutation. Record registration and publication at the actual workflow, including instructor publications; do not synthesize historical events from browser state. Existing histories can be explicitly backfilled only if evidence supports type, actor, target, and timestamp. Never pretend the absence of an audit system means zero historical actions.

Store at least: ID, event type, actor reference and display snapshot, target kind/ID/label snapshot, safe description/reason, createdAt, and optional request correlation/idempotency metadata. Index timestamp/ID, event type/timestamp, actor, and target. Redact secrets, password material, session tokens, raw headers, and sensitive submission content. No public create/update/delete log API is needed.

## Account and platform settings

`GET /api/admin/account` derives identity solely from the verified session. Return:

```json
{
  "user":{"id":"admin-id","name":"Morgan Admin","email":"morgan@example.test","role":"ADMIN","status":"active","createdAt":"2026-10-01T09:00:00.000Z"},
  "capabilities":{"editName":true}
}
```

`PATCH /api/admin/account` accepts only `{ "name": "Morgan Admin" }`, trimmed, 2–100 characters. No email, role, password, or arbitrary account ID mutation is exposed. Return the committed full account response. The frontend refreshes verified session identity after success; it never saves names to a local profile as if server-persisted.

`GET /api/admin/settings` is a minimal read-only allowlist:

```json
{"uploadLimitBytes":null,"accountPolicy":null}
```

Provide a nonnegative integer byte limit and public policy description when known. Never return an environment/config object. No write UI exists for platform configuration. Appearance persists only to the existing browser `decode-theme` preference and needs no backend endpoint; the existing theme supports light/dark only.

## Prisma / persistence work for backend teammates

These are requirements to evaluate, not migrations made by this frontend change:

1. **No new role enum needed.** Preserve ADMIN in public account mapping and add secure provisioning and scoped cookie authorization tests.
2. Add a persisted account status (suggested enum ACTIVE/SUSPENDED with active default), plus suspension metadata if needed. Enforce status during login and every session authorization; revoke sessions transactionally on suspension.
3. Add durable administrative AuditEvent persistence with the fields/indexes above. Add event hooks to registrations, publications, moderation, account-status changes, and supported setting writes.
4. Reuse existing relational course ownership, archive flag, immutable publication records, progress, quiz attempts, and submissions. Standalone Module/Activity tables are not required by this frontend. If normalization is needed, the backend team owns schema design and data migration.
5. Reliable historical learning trends/active-user reports may require a durable LearningEvent model (actor, course/publication/activity references, type, timestamp, unique request key). Existing current progress JSON alone is insufficient. Deduplicate completion events across retries/resets according to an agreed policy.
6. Reliable enrollment/completion denominators may require enrollment/participation records. Until those semantics are agreed and implemented, return null for ambiguous rates rather than inventing enrollment counts.
7. A settings table is optional for read-only configuration if there is already a safe source. Any future persisted settings require an explicit allowlist and auditing; do not expose server environment variables.
8. Plan required indexes for case-insensitive searches, role/status/date list filtering, ownership, review statuses, and reporting aggregates. Database changes and integration tests belong on the backend branch.

## Errors and frontend behavior

Use existing NestJS JSON conventions, for example:

```json
{"statusCode":403,"message":"Admin access is required.","error":"Forbidden"}
```

- 400/422: invalid filters/input; frontend shows a safe request error.
- 401: missing/expired/revoked session; frontend rechecks session and redirects to login when confirmed anonymous.
- 403: signed-in account lacks ADMIN or action permission; never return privileged data. Frontend reports denied permission, without claiming an endpoint is merely missing.
- 404: missing detail record. Missing collection routes (or Nest's `Cannot GET/PATCH ...` route message) show “Awaiting backend integration.” For incomplete deployments, prefer 501 for an unsupported endpoint rather than ambiguous 404.
- 409: stale state/conflict/protected self or last-admin action. No frontend success; reload/reconcile before retry.
- 429: rate limit, with Retry-After where available.
- 501: intentionally unimplemented feature. Capability flags false must also disable its writes.
- 5xx / network / timeout: retryable service error. Do not return success if a transaction failed. Frontend requests abort after 15 seconds and never substitute sample records.
- Malformed 2xx payloads fail runtime validation. All response fields above, including nullable metrics and capability objects, are required.

## Existing APIs that can be reused

- `POST /api/auth/login`, `POST /api/auth/register`, `GET /api/auth/me`, and `POST /api/auth/logout`: existing transport, session database, cookie mechanism, and origin checks. ADMIN mapping/scopes still need the changes above. Registration UI remains Student-only.
- Existing Next.js API rewrite and server-side `API_URL` configuration: reused without a new proxy or token system.
- Existing learning service/domain logic may be reused **inside the backend** to calculate safe admin DTOs, but the frontend must not call student/instructor endpoints as platform APIs. `/api/learning/curriculum`, `/progress`, `/quiz-attempts`, `/submissions`, `/instructor`, `/instructor/commands`, `/instructor/insights`, `/instructor/submissions`, `/instructor/reviews`, and submission-code routes are currently scoped to STUDENT or INSTRUCTOR. They are not authorized or complete admin views.

## Integration and release checklist for teammates

1. Implement/test ADMIN role mapping, controlled provisioning, three independent role cookie scopes, scoped logout, and suspended-session enforcement. Keep existing Student/Instructor behavior intact.
2. Implement read APIs with these exact DTOs and no-store headers; connect a real provisioned admin to every frontend route. Exercise empty, partial-null, paginated, forbidden, missing-route, and outage cases.
3. Implement status/archive writes with authorization, origin checks, transactionally recorded audit events, idempotent behavior, self/last-admin protections, and full committed response DTOs. Return capabilities true only when the action is supported and allowed.
4. Validate metric definitions and history coverage against PostgreSQL records. Return null until reliable. Verify quiz grading and workshop statuses from authoritative server data.
5. Add backend integration tests for anonymous, STUDENT, INSTRUCTOR, ADMIN, expired, suspended, and forged-role cases on every privileged endpoint. Verify pagination/filter composition, date boundaries, report denominators, last-admin protection, and preservation of course/student records.
6. Run real browser and database integration checks after merging frontend/backend through the team's normal review process. This frontend pass has no live ADMIN session or live admin API against which to certify those checks.

The frontend is complete as an integration target, but the Admin Dashboard must not be described as fully operational until these authentication, API, and database checks pass together.
