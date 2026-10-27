# DECODE admin frontend implementation report

Implemented on `feature/admin-dashboard`. No branches were created, switched, merged, or deleted. No commits or pushes were made. No backend service, Prisma schema, migration, or database was modified. No dependencies were added. The existing Student/Instructor dashboards, public landing page, login/registration design, and animated logo are preserved.

**Readiness:** the frontend is implemented as an integration target. It is not a fully operational admin product until teammates implement and test ADMIN authentication and the admin APIs. The current backend maps stored ADMIN roles to STUDENT and rejects `scope=admin`.

## Implemented pages

| Route | Implemented frontend behavior |
|---|---|
| `/admin` | Personalized welcome, six KPI cards, reporting-period selection, registration/activity charts with accessible data tables, course-status distribution, recorded recent events, four quick-action links. Missing metrics are unavailable, never invented zero or trends. |
| `/admin/users` | Search name/email, role/status filters, four sorting options, pagination, details, participation/progress summaries, confirmation/reason dialogs for suspension/reactivation. Self-suspension is disabled. No permanent deletion. |
| `/admin/instructors` | Search, status filter, name/date sorting, pagination, instructor details, assigned courses, draft/published counts, activity metric and recent publications. Provisioning is explicitly unavailable; no public-registration shortcut. |
| `/admin/courses` | Title search, instructor/status filters, pagination, read-only curriculum details, activity breakdown, publication/update dates, participation metrics and confirmed archive/restore flows. No duplication of instructor authoring tools. |
| `/admin/analytics` | Period/course/instructor filters, role distribution, registrations, active users, participation, lesson/course completion, quiz scores, lab completion, learning trends, and workshop metrics. Rates and aggregates come from server responses. |
| `/admin/activity` | Backend audit events, actor/target/description/timestamps, search, event-type and inclusive UTC date filters, invalid-date feedback, pagination. No browser-generated audit history. |
| `/admin/settings` | Existing light/dark theme, verified account information, capability-gated display-name editing, read-only allowlisted platform configuration, sign-out. Unsupported preferences never claim to save. |
| `/admin/profile` | Initials avatar, verified session name/email/ADMIN role, account information, theme preference, settings link, sign-out. |

The shared shell includes grouped navigation, active links, persisted collapsible sidebar, initial compact tablet navigation, mobile modal drawer, collapsed-link tooltips on focus/hover, breadcrumbs, theme toggle, account disclosure, sign-out, skip link, visible focus styles, and reduced-motion support. Tables scroll within their own region at small widths. Dialogs reuse native modality, Escape handling, focus trapping, and focus restoration.

## Fully implemented frontend vs backend dependencies

**Implemented in the frontend:** all routes/components, responsive styling, navigation, appearance persistence, typed/validated HTTP boundaries, query composition and pagination controls, details, capability-gated actions, confirmation/reason flows, loading/empty/unavailable/error/retry/success states, cached-session revalidation, unauthorized-content hiding, and login routing for ADMIN.

**Existing real infrastructure reused:** `/api/auth/login`, `/api/auth/register`, `/api/auth/me`, `/api/auth/logout`, the Next.js API rewrite, server-side `API_URL`, HttpOnly session cookies, scoped-cookie conventions, public AuthUser fields, and cross-tab session-change notifications. ADMIN uses the proposed additional admin scope on those existing auth endpoints. Student and Instructor scopes remain unchanged. The new ADMIN scope is not yet accepted by the backend, so this reuse must not be described as a live working admin session.

**Connected to real live admin data:** none; there are no existing authorized platform-wide admin APIs. The UI issues credentialed no-store requests at explicit backend integration boundaries and handles missing features. It does not repurpose restricted Student/Instructor learning endpoints as admin APIs, fabricate success responses, or present sample records as live data. Test fixtures are confined to `frontend/tests`.

**Awaiting backend implementation:** ADMIN role mapping/provisioning/scope support, authorization guards, account statuses, every `/api/admin/**` data endpoint, status/archive writes and their audit transactions, safe account updates/settings, and trustworthy analytics history/denominators. Capability flags keep writes disabled until support is explicitly returned by the server, which must still enforce permission independently.

The exact endpoint inventory, methods, parameters, examples, model requirements, errors, security expectations, audit rules, metric definitions, and release sequence are in [admin-backend-requirements.md](admin-backend-requirements.md).

## Authentication behavior

- Every admin page uses the shared server-only `AdminWorkspace` guard behind Suspense before rendering any protected shell or view. The layout always renders its child segment so Next.js 16 can validate instant navigation even when session verification is unavailable. Anonymous requests redirect to login. Verified students/instructors are sent to their existing account home; only ADMIN is admitted. See [the instant-navigation fix report](admin-instant-navigation-fix.md).
- Admin cookie is preferred over the legacy alias. Invalid scoped cookies never fall back. Tokens stay server-side and are never placed in component props or browser storage.
- Client verification repeats on route changes, focus, pageshow, visibility, cross-tab auth changes, and a 60-second interval. Cached content stays hidden/inert while verification is pending or fails. Identity changes discard account-specific cached UI. Requests time out and stale responses are ignored.
- Admin logout uses the existing JSON transport with `scope=admin`, deduplicates pending requests, and navigates only after server success. Failure remains visible. Backend scoped logout support is required.
- Existing role-home resolution now returns `/admin` for ADMIN while preserving the designated instructor and Student behavior. Login and the legacy success route share this resolution.
- Successful login now installs a short-lived document-navigation fallback if client routing is interrupted on the login/registration page. The fallback is cleaned up on unmount and addresses the successful-authentication path that otherwise retained its pending state indefinitely. The login UI is unchanged.

## Reused design and components

- Existing global color/surface/border/action tokens, Geist typography, font variables, light/dark root attribute, and `decode-theme` storage preference.
- `Wordmark` with the existing animation; no replacement logo or animation.
- `ThemeToggle`, `StudentIcon`, and Instructor `Modal`/`Actions` primitives. Admin-specific CSS scopes presentation without changing the existing dashboards.
- Existing `authRequest`, `AuthUser`, `authChangeKey`, `announceAuthChange`, and `accountHome` conventions.
- Existing Node test runner, TypeScript transpilation/VM test pattern, React/JSDOM, and esbuild. No chart or UI package was installed; charts use accessible SVG plus exact tabular data.

## Validation

| Check | Result |
|---|---|
| `frontend: npm test` | Passed: **314/314 tests**, including 34 admin tests and the 280 existing tests. |
| `frontend: npm run lint` | Passed, no errors or warnings. No lint rule was disabled. |
| `frontend: node_modules/.bin/tsc --noEmit` | Passed. Production build also passed Next.js TypeScript validation. |
| `frontend: npm run build` | Passed. All eight admin routes generated successfully alongside all existing Student/Instructor/public routes. |
| Production HTTP smoke test | All eight admin routes returned the Next.js streamed login redirect for anonymous requests; none rendered `data-admin-session-workspace`. With Suspense streaming, the HTTP response can be 200 containing the redirect rather than a nonstreamed 307. |
| `git diff --check` | Passed. |
| Real browser visual QA | Not completed. The computer-use browser tool stopped because it could not verify the current Chrome URL reliably. No further browser automation was attempted. |
| Live ADMIN/PostgreSQL integration | Not run: ADMIN role mapping/scoped sessions and admin APIs are absent. Backend integration tests and migrations remain teammates' responsibility. |

Admin tests cover all page components, role checks, server-cookie handling, private-field stripping, denied/expired/unavailable sessions, session timeout/retry, stale auth/data responses, API payload validation and identity matching, no-store credentialed transport, missing routes vs missing records, all management filters, pagination, empty/loading/error/retry states, detail dialogs, cancellation, suspension/reactivation, archive/restore, rejection of unconfirmed server state, self-protection, account-edit rejection, theme sync, shell/mobile navigation, account disclosure/Escape behavior, and the login redirect fallback timer.

Existing regression coverage includes Student curriculum/progress/activity behavior, Instructor content authoring/publishing, connected catalog projection, quizzes/labs/workshops, session isolation, profile/editor lifecycle, and code/content safety. The existing Instructor access assertion was updated only for the requested new ADMIN home; its instructor access restrictions remain tested.

Build warnings about multiple existing workspace lockfiles and inferred workspace root remain. No lockfile or Next configuration change was needed for this implementation.

For optional manual visual inspection after a build, `node tests/admin-preview.mjs` starts a localhost-only, clearly labeled fixture preview at `http://127.0.0.1:4317/admin`. It runs outside the Next application, does not create a real account, and never connects to PostgreSQL. Its generated bundle lives under ignored `.next/admin-qa`. The QA server started during this session was stopped. The temporary production smoke-test server was also stopped.

## Complete file inventory

Modified existing files:

```text
frontend/app/components/auth/auth-client.ts
frontend/app/components/auth/auth-form.tsx
frontend/app/lib/instructor/access.ts
frontend/tests/instructor.test.mjs
```

Created files:

```text
docs/admin-backend-requirements.md
docs/admin-dashboard-implementation.md
docs/admin-instant-navigation-fix.md
frontend/app/admin/layout.tsx
frontend/app/admin/loading.tsx
frontend/app/admin/error.tsx
frontend/app/admin/page.tsx
frontend/app/admin/users/page.tsx
frontend/app/admin/instructors/page.tsx
frontend/app/admin/courses/page.tsx
frontend/app/admin/analytics/page.tsx
frontend/app/admin/activity/page.tsx
frontend/app/admin/settings/page.tsx
frontend/app/admin/profile/page.tsx
frontend/app/components/admin/admin-shell.tsx
frontend/app/components/admin/admin-workspace.tsx
frontend/app/components/admin/admin-provider.tsx
frontend/app/components/admin/admin.css
frontend/app/components/admin/ui.tsx
frontend/app/components/admin/use-admin-resource.ts
frontend/app/components/admin/overview-view.tsx
frontend/app/components/admin/users-view.tsx
frontend/app/components/admin/instructors-view.tsx
frontend/app/components/admin/courses-view.tsx
frontend/app/components/admin/analytics-view.tsx
frontend/app/components/admin/activity-view.tsx
frontend/app/components/admin/activity-list.tsx
frontend/app/components/admin/settings-view.tsx
frontend/app/components/admin/profile-view.tsx
frontend/app/components/admin/account-preferences.tsx
frontend/app/components/admin/appearance.tsx
frontend/app/components/admin/charts.tsx
frontend/app/components/admin/report-filters.tsx
frontend/app/components/admin/sensitive-action.tsx
frontend/app/components/auth/admin-session.ts
frontend/app/components/auth/server-admin-session.ts
frontend/app/lib/admin/types.ts
frontend/app/lib/admin/contracts.ts
frontend/app/lib/admin/api.ts
frontend/tests/admin-test-helpers.mjs
frontend/tests/admin.test.mjs
frontend/tests/admin-views.test.mjs
frontend/tests/admin-preview.mjs
```

## Remaining limitations and recommended integration sequence

1. Implement ADMIN public-account mapping, secure provisioning, admin scoped cookies/logout, and backend role/status guards first. A frontend-only bypass is intentionally absent.
2. Implement the read DTOs in the handoff so management lists, details, overview, filter options, settings, and analytics populate from PostgreSQL. Missing fields/invalid payloads are rejected rather than silently defaulted.
3. Implement authorized mutations, protected admin-account rules, persistence, and audit events transactionally; enable capabilities only afterward. Add server tests for all roles and invalid/stale requests.
4. Define trustworthy historical activity/participation metrics. Current progress snapshots cannot establish historical event trends. Existing workshop `reviewed` does not prove approval; the requested approved metric remains null until semantics are agreed.
5. Validate integrated browser behavior on desktop, tablet, and mobile with real provisioned ADMIN sessions, and run backend/DB integration tests on the teammates' branch. Visual QA and live database authorization cannot be certified by this frontend pass alone.

The computer-use skill was used to attempt local visual QA: [computer-use/SKILL.md](C:/Users/Ankush/.codex/plugins/cache/openai-bundled/computer-use/26.1021.31345/skills/computer-use/SKILL.md). It did not send messages, change account permissions, or alter database records.
