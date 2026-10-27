# Backend guide

Reviewed **2026-10-27**, source commit `59614ec`. [Agent entry](../AGENTS.md) · [Architecture](PROJECT-ARCHITECTURE.md) · [Frontend adapters](FRONTEND-GUIDE.md) · [Development workflow](DEVELOPMENT-WORKFLOW.md) · [Status](PROJECT-STATUS.md)

Paths are repository-relative. This guide inventories **implemented** controllers/services/schema. It does not turn the Stage 5E proposal or Admin branch requirements into available APIs.

## NestJS structure

| File/directory | Responsibility |
| --- | --- |
| `backend/src/main.ts` | Nest bootstrap; Express JSON parser (2 MiB), credentialed CORS, global `/api`, shutdown hooks, listener |
| `backend/src/app.module.ts` | Imports Prisma/Auth modules; registers root, health and learning controllers plus app/learning services |
| `backend/src/app.controller.ts`, `app.service.ts` | Starter `GET /api` response |
| `backend/src/prisma/prisma.module.ts`, `prisma.service.ts` | Global injectable Prisma Client with pg adapter and connection lifecycle |
| `backend/src/auth/auth.module.ts` | Auth controller/service; exports `AuthService` |
| `backend/src/auth/auth.controller.ts` | JSON/origin checks, scoped verification/logout, cookies and no-store |
| `backend/src/auth/auth.service.ts` | Manual input validation, registration, password login, session hashing/expiry and public identity |
| `backend/src/auth/password.ts` | Salted scrypt hashing and constant-time verification helper |
| `backend/src/auth/account-access.ts` | Reserved instructor identity and restricted public-role mapping |
| `backend/src/auth/session-cookies.ts`, `frontend-origins.ts` | Scope/cookie selection and exact-origin allowlist |
| `backend/src/health/health.controller.ts` | Liveness and database readiness |
| `backend/src/learning/learning.controller.ts` | Authenticated role-specific learning transport; JSON/origin checks on writes |
| `backend/src/learning/learning.service.ts` | Workspace initialization/import/commands, catalog, progress, grading, submissions/reviews/insights |

There is no `LearningModule`, class-based DTO layer, global `ValidationPipe`, generic authentication/roles guard, admin module, or Swagger-generated API reference. Request bodies are `unknown` in controllers and validated manually in services/shared domain rules. Do not document decorators or endpoints that are not present.

## Authentication, cookies and authorization

Registration normalizes email (trim/lowercase) and name, never trims passwords, and always assigns `STUDENT`. Valid name length is 2–100, email at most 254 with a basic email pattern, registration password 8–1024 characters; login allows nonempty passwords up to 1024. `remember`, when supplied, must be boolean. Extra role input cannot grant privilege. Reserved instructor registration returns 409.

`password.ts` uses salted scrypt. Login treats unknown user and incorrect password the same. A random 32-byte token is sent only through cookies; only its SHA-256 hash is stored. `AuthService.me()` joins the session/user and rejects expired/missing tokens. Logout removes the token's session row. Public auth user fields are exactly `id`, `name`, `email`, `role`; no password hash or token is included.

Normal sessions have 12-hour server expiry with a browser-session cookie; Remember me uses 30 days and persistent cookie age. All session cookies are HttpOnly, SameSite=Lax, path `/`, Secure when `NODE_ENV` is production.

| Cookie/scope | Purpose |
| --- | --- |
| `decode_student_session`, `scope=student` | Student verification/logout and learning APIs |
| `decode_instructor_session`, `scope=instructor` | Instructor verification/logout and learning APIs |
| `decode_session`, no scope | Legacy alias and compatibility clients |

Sign-in writes the appropriate role cookie and alias. Scoped reads prefer their role cookie, use the alias only if it is absent, and validate a 64-character lowercase hex token. Invalid present scoped cookies do not fall back. Scoped logout checks actual role, revokes only that token, and clears matching cookie aliases; independent role sessions remain intact. Invalid scope values, including `admin`, return 400.

The backend currently recognizes only the reserved identity **with stored `INSTRUCTOR` role** as public Instructor. Every other stored role maps to Student, including `ADMIN`. This logic is in `account-access.ts`, mirrored for UI routing in `frontend/app/lib/instructor/access.ts`. Adding another instructor/admin requires an explicit coordinated auth change, not just an enum assignment.

`LearningController.user()` authenticates the expected workspace cookie via `AuthService`, requires the exact public role, and returns the session-derived user ID. Service queries filter by owner/student ID; clients cannot select another student identity. Auth and learning mutations require JSON and reject disallowed supplied Origin or `Sec-Fetch-Site: cross-site`. CORS uses the same allowlist. Requests without Origin are accepted when otherwise valid; do not claim a separate CSRF-token system exists.

`FRONTEND_URL` sets the primary exact origin; `FRONTEND_ORIGINS` adds comma-separated origins. Development loopback primary origins also permit explicit ports 3000/3001/3100 on localhost, IPv4 and IPv6 loopback. Production allows configured exact origins only. Invalid origin configuration fails rather than widening access.

## Implemented API endpoints

All paths below include the global `/api` prefix. Auth and learning handlers declare `Cache-Control: no-store`. GET/PUT success is 200. Auth registration is 201; auth login/logout explicitly use 200. **Learning POST handlers retain Nest's default 201**; none overrides it to 200. Clients accept any successful HTTP status.

### Root, health and authentication

| Method/path | Authorization and request | Success body |
| --- | --- | --- |
| `GET /api` | Public | Text `Hello World!` |
| `GET /api/health` | Public; no database query | `{status: "ok"}` |
| `GET /api/health/database` | Public; queries `users` through Prisma | `{status: "ok", database: "connected"}`; generic 503 if query fails |
| `POST /api/auth/register` | Public JSON `{name, email, password}` | `{user: AuthUser}` plus cookies; always Student |
| `POST /api/auth/login` | Public JSON `{email, password, remember?}` | `{user: AuthUser}` plus cookies |
| `GET /api/auth/me` | Session; optional `scope=student` or `scope=instructor` | `{user: AuthUser}` |
| `POST /api/auth/logout` | JSON `{}`; optional same scope; safe when no valid session | `{message: "Signed out successfully."}`; clears matching cookies |

Health/database checks `users`, not all learning tables, migration status or production readiness. No registration-role override, password recovery, OAuth, account editing or public instructor-provisioning endpoint exists.

### Instructor learning endpoints

All require the verified designated Instructor.

| Method/path | Request | Response |
| --- | --- | --- |
| `GET /api/learning/instructor` | No body | `{state: InstructorState, revision}`; initializes baseline workspace/courses if absent |
| `POST /api/learning/instructor/import-drafts` | `{raw: string}`: serialized valid legacy instructor backup | `{state, revision: 1}`; only succeeds at workspace revision zero |
| `POST /api/learning/instructor/commands` | `{expectedRevision: integer, command: InstructorCommand}` | `{state, id, revision}`; ID identifies affected/created item |
| `GET /api/learning/instructor/insights` | No filters/paging | `{courses, registeredStudents}`; per-course started-student/completion summaries |
| `GET /api/learning/instructor/submissions` | No filters/paging | `{records: Submission[]}`; only owned-course records, newest first, maximum 500 |
| `GET /api/learning/instructor/submissions/:id/code` | Submission ID | Raw `Code` object `{html, css, javascript}`; owner-only, 404 if missing/out of scope |
| `POST /api/learning/instructor/reviews` | `{id, status, feedback, expectedRevision}` | Refreshed `{records: Submission[]}` for that instructor |

### Student learning endpoints

All require public Student role and derive student ID from the verified session.

| Method/path | Request | Response |
| --- | --- | --- |
| `GET /api/learning/curriculum` | No filters/paging | `{courses: (PublishedCourse & {publicationId})[]}`; live nonarchived snapshots with private fields removed |
| `GET /api/learning/progress` | No body | `{progress: Progress, revision}`; creates an empty account record if needed |
| `PUT /api/learning/progress` | `{expectedRevision, progress, publicationIds?}` | `{progress, revision}` after validated merge |
| `POST /api/learning/progress/reset` | `{expectedRevision}` | `{progress: emptyProgress(), revision}`; audit attempts/submissions remain |
| `POST /api/learning/quiz-attempts` | `{activityId, publicationId, requestKey, answers}` | `{attempt, questions, progress, revision}`; server-graded review and current progress |
| `GET /api/learning/submissions` | No filters/paging | `{records: Submission[]}`; current student's records, maximum 500, public feedback only |
| `POST /api/learning/submissions/resubmit` | `{id}` | `{ok: true}`; only own changes-requested record with saved project draft |

There are no REST course/module CRUD paths, upload/finalize/download-ticket APIs, generic `/api/admin/*` routes, enrollment endpoints, or standalone lab-grading endpoint in the current controllers. Instructor edits use the command endpoint; project completion delivers source through progress persistence. Branch-only Admin requirements are a future integration contract.

## Request/response contracts and validation

Canonical TypeScript contracts currently live in the frontend's pure domain layer and are bundled for the backend:

| Contract | Exact source |
| --- | --- |
| `InstructorCommand`, `InstructorState`, course/module/activity metadata | `frontend/app/lib/instructor/types.ts` |
| Theory/Quiz/Lab/Workshop content/draft shapes | `frontend/app/lib/instructor/theory-types.ts`, `quiz-types.ts`, `lab-types.ts`, `workshop-types.ts` |
| `PublishedCourse`, `PublishedActivity`, private-field projection | `frontend/app/lib/learning/domain.ts` |
| `Progress`, `Code`, quiz aggregates/attempts/sessions, lab/workshop records | `frontend/app/lib/student/types.ts` |
| Frontend `Submission` projection | `frontend/app/lib/learning/submissions.ts` |
| Runtime request validation and response construction | `backend/src/auth/auth.service.ts`, `backend/src/learning/learning.service.ts` |

### Instructor commands

Outer `expectedRevision` is the **workspace** revision from the last GET/acknowledged command. Some commands carry their own **activity draft** `expectedRevision` and `expectedUpdatedAt`; they are different counters. Inspect the discriminated union before changing transport.

| Command family | Implemented operations / important fields |
| --- | --- |
| Course | `course.create` (`id`, `fields`), `.update`, `.duplicate`, `.status` (`draft`/`published`), `.archive` (boolean), `.delete` |
| Module | `module.create`, `.update`, `.reorder` (direction -1/1), `.archive`, `.delete`; course/module IDs as appropriate |
| Activity | `activity.create` (`activityType`, title/description), `.update`, `.reorder`, `.move` (`targetModuleId`), `.archive`, `.delete` |
| Content | `theory.save`, `quiz.save`, `lab.save`, `workshop.save`: course/module/activity IDs, typed `content`, expected activity timestamp/revision |
| Workshop copy | `workshop.duplicate`: course/module/activity IDs |

The service validates the envelope/action shape; shared `applyInstructorCommand()` enforces fields, readiness, protection and content limits. Incomplete structurally valid drafts are saveable. Publication requires ready active content except preserved seed compatibility rules. Seed and previously published identities cannot be hard-deleted by the domain; eligible never-published local drafts can be removed from working state. This does not imply database history rows are physically removed.

Command errors normally become 400; outer compare-and-swap mismatches become 409. Activity-level stale errors thrown by the shared domain are currently wrapped as 400, not a distinct 409 DTO. Do not assume one uniform error code for every editor conflict.

### Progress and grading

`Progress.version` is 1. Required document members come from `emptyProgress()`: `lessons`, `quizzes`, `challenges`, `projects`, `currentLesson`, `visits`, `activity`, `drafts`, `quizHistory`, `quizSessions`, `labChecks`, `workshops`. New empty arrays/maps are represented explicitly by that helper. Optional fields in the TypeScript type preserve older browser formats.

- Generic save validates completion IDs and merges only currently published allowed references, retaining old completions. It accepts `Code` strings up to 100,000 characters per HTML/CSS/JavaScript field; workspaces match activity prefixes or `playground-`.
- `publicationIds` maps course IDs to loaded publication IDs. When supplied, every entry must still match live content or the save conflicts.
- Quiz sessions store selected zero-based option indices and an in-range question index. Submitted `answers` must cover exactly all questions with valid option indices.
- Generic saves preserve existing quiz aggregates/history; server quiz submission owns them. Quiz idempotency is unique per `(studentId, requestKey)` with a canonical payload hash. Replay with changed answers/activity/publication returns 409.
- Quiz percent is rounded weighted points earned / available points. A result includes `attempt` (`id`, `answers`, `correct`, `total`, `percent`, `at`, `publicationId`, original-question `review`), `questions` (`id`, correct option index, explanation), full progress, and new revision.
- Historical quiz reviews are capped to 20 per quiz in the progress document; immutable relational attempts are retained. Visits cap at 1,000 and recent activity at 20. There is no API to list all immutable attempt rows.
- Lab records validate check identities/count and boolean results, recompute `passed`, and set `verification: "browser-check"`. Client declarations cannot be considered secure independent grading. Explicit completion requires an accepted passing record.
- Workshop steps must match published step IDs; initial completion requires all steps and transactionally creates a source submission. Theory/workshop completion is self-reviewed.
- Ordinary saves merge prior records and are not a reset operation. Dedicated reset replaces only working progress; delivered submissions and attempt audit records survive.

### Submission projection and reviews

`GET` list results include `id`, `studentName`, `referenceId`, `courseId`, `activityId`, `courseTitle`, `workshopTitle`, `projectTitle` (alias of workshop title), `status`, `feedback`, `revision`, `createdAt`, `submittedAt` (alias of creation), `updatedAt`, and nullable `reviewedAt`. They omit source; source has a separate owner-only instructor endpoint. Date objects serialize as ISO strings.

Review status is one of `pending`, `in-review`, `reviewed`, `changes-requested`. Feedback is a string of at most 10,000 characters; final statuses require at least three trimmed characters. Saves check submission revision and publication-course ownership. Final states copy feedback to `publishedFeedback` and stamp `reviewedAt`; nonfinal saves change only private draft feedback/status and preserve previous published feedback. Student projection reads only published feedback.

Resubmit requires an own `changes-requested` submission and a saved `project-<referenceId>` draft. It replaces code on the same row, clears private feedback, sets pending and advances revision. It preserves published feedback/reviewedAt and the original pinned publication; it does not create a separate resubmission attempt/audit event. No file bytes or ZIP metadata are persisted through these APIs.

### Insights contract

`courses[]` has `id`, `title`, `students[]`, `learners`, `completed`. Student entries include `id`, `name`, `completed`, `total`, `started`, `updatedAt`. Started means a matching recorded visit or completion; quiz completion means best percent >=70. `registeredStudents` counts stored `STUDENT` roles. This is current progress-based visibility, not enrollment or historical analytics. The current query selects owned courses with a live pointer without excluding archived courses; do not assume insights exactly equals the student catalog.

## Errors and boundary limitations

Nest exceptions normally serialize `{statusCode, message, error}`. `LearningError` preserves status on the client, but there is no stable custom machine-code/field-error standard.

| Status | Actual uses |
| --- | --- |
| 400 | Invalid auth/body/scope/editor/content/progress/answers/review |
| 401 | Missing, expired or revoked session; generic invalid credentials |
| 403 | Disallowed origin or wrong role |
| 404 | Quiz absent within publication; missing/out-of-scope source record |
| 409 | Duplicate/reserved registration, workspace/progress/review conflicts, stale publication, idempotency mismatch, unavailable resubmit |
| 415 | Auth/learning write lacks JSON content type |
| 503 | Sanitized auth database failure or failed database-health query |

The 2 MiB Express body limit can reject larger payloads before handlers; no project-specific parser-error contract exists. Learning service has no equivalent generic sanitized database-error wrapper; unhandled Prisma/domain failures can surface as Nest 500s. Rate limiting, account suspension, email verification and general audit-event storage are absent. Treat these as implementation limits, not already enforced policy.

## Prisma models and relationships

Active source: [schema.prisma](../backend/prisma/schema.prisma), [Prisma configuration](../backend/prisma.config.ts), and [migration directory](../backend/prisma/migrations/).

| Model → SQL table | Identity/data | Relationships |
| --- | --- | --- |
| `User` → `users` | UUID, name, unique email, mapped password hash, `UserRole`, timestamptz creation/update | Sessions, optional workspace/progress, owned courses, quiz attempts, submissions |
| `Session` → `sessions` | UUID, unique mapped token hash, user UUID, expiry/creation | User FK uses `CASCADE`; indexes on user and expiry |
| `InstructorWorkspace` → `instructor_workspaces` | Owner UUID PK, revision, JSONB document, updated timestamp | One per owner; User deletion restricted |
| `LearningCourse` → `learning_courses` | Stable text ID, owner UUID, optional unique live-publication UUID, archive flag | Owner, many versions, optional live version |
| `LearningPublication` → `learning_publications` | UUID, text course ID, immutable JSONB document, creation | Course, attempts, submissions; optional live-course backlink |
| `LearningProgress` → `learning_progress` | Student UUID PK, revision, JSONB document, update | One per student; deletion restricted |
| `LearningQuizAttempt` → `learning_quiz_attempts` | UUID, student/publication UUIDs, activity text ID, request key, payload hash, JSON result, creation | Immutable; unique student/request key, index student/activity |
| `LearningSubmission` → `learning_submissions` | UUID, student/publication UUIDs, activity/reference/course text IDs, title snapshots, source JSON, status/private+published feedback, revision and timestamps | Student and publication references; indexes student/reference and course/status |

`UserRole` has `ADMIN`, `INSTRUCTOR`, `STUDENT`, but public access is narrower as described above. IDs inside JSON documents are not separate SQL Module/Activity/Lesson/Quiz/Workshop tables. `LearningSubmission.courseId` is a snapshot scalar, not an extra Prisma FK; ownership is checked through its publication/course relation.

The initial/auth tables use explicit snake_case column maps. New learning columns mostly retain Prisma camelCase names while tables use snake_case; write SQL using actual names rather than guessing mappings. Prisma declares learning FKs `RESTRICT`; migration SQL additionally provides:

- Unique publication `(id, courseId)` and composite live-pointer FK preventing cross-course snapshots.
- Nonnegative workspace/progress revisions.
- Allowed submission statuses.
- `preserve_learning_history()` and triggers preventing publication/quiz-attempt updates or deletion.

These constraints are not all represented in Prisma's declarative schema. Never remove them through a generated migration without reviewing the effect.

## Migrations and seeding

| Committed migration directory under `backend/prisma/migrations/` | Effect |
| --- | --- |
| `20261022000000_init` | Public schema, UserRole and users |
| `20261024000000_auth_sessions` | Sessions, indexes and cascading user relation |
| `20261027000100_learning_workflow` | Six learning tables, ownership/history references, indexes, checks and immutable-history triggers |

Prisma config selects only `backend/prisma/schema.prisma`. `backend/docs/stage-5e/schema.proposed.prisma` is unselected historical design. No standard seed script/configuration exists.

Instructor provisioning is an explicit `scripts/provision-instructor.cjs` transaction through `instructor:provision`, using the owner-provided local bootstrap variable and the existing password helper. It verifies existing password/UUID/hash rather than overwriting credentials; matching reserved student account promotion revokes old sessions. Conflicting normalized identities/passwords abort. The `--check` mode reports readiness/counts without provisioning. This is an account operation, not a migration hook.

`LearningService.initialize()` lazily seeds baseline workspace/courses/publications under an owner advisory lock, both on instructor workspace access and during catalog loading when the instructor exists. Valid legacy browser drafts can import only before server edits (revision zero); originals are retained. Historical student demo progress is not imported as verified quiz attempts.

Run commands in `backend/`:

```powershell
npm run prisma:validate
npm run prisma:generate
npm run prisma:status
# Apply reviewed, committed migrations to the confirmed target:
npm run prisma:deploy
# Create a new local schema migration only for an intentional schema change:
npm run prisma:migrate -- --name describe_change
```

Review target database, backups, SQL and data compatibility before applying. `migrate dev` needs shadow-database privileges and must not target production. Stop at reset/destructive prompts; explicit developer approval is required. Do not rewrite old applied migrations, disable history triggers for routine edits, seed real credentials, or use reset to fix drift. Regenerate Client after schema changes and include schema/migration/contract tests in review.

## Builds and tests

`scripts/build-learning.cjs` resolves frontend esbuild and bundles `frontend/app/lib/learning/domain.ts` into ignored `backend/domain/learning.cjs`. Build/start/dev/debug hooks prepare it and Prisma Client; unit tests prepare the domain, and HTTP tests also generate Client. Production startup runs `node dist/main` with no prehook: prepare and deploy both `dist/` and `domain/learning.cjs`.

| Command in `backend/` | Meaning/side effects |
| --- | --- |
| `npm test` | Vitest `*.spec.ts`; auth/service/controller/origin/provision tests with doubles; prepares domain bundle |
| `npm run test:e2e` | Vitest `*.e2e-spec.ts`, Supertest/Nest with mocked Prisma; no live DB proof |
| `npm run test:watch`, `npm run test:cov`, `npm run test:debug` | Watch, coverage or debug modes; see package hooks rather than assuming all prepare artifacts |
| `npm run lint` | oxlint on `src/` and `test/` |
| `npm run build` | Shared-domain bundle, Prisma generation, Nest TypeScript build |
| `npm run test:auth:live` | Uses running frontend/API/database; verifies proxy/auth/routing/hash/expiry/logout, cleans its temporary user; optional instructor check if bootstrap variable supplied |
| `npm run test:learning:integration` | Builds, then tests real authenticated HTTP/SQL in a uniquely named `workflow_test_...` schema; applies every committed migration and drops only that test schema in cleanup |

Use an approved local test database and schema privileges before integration scripts. They mutate/delete test data and are not read-only schema validation. No learning-specific unit spec exists in `src/learning/`; the PostgreSQL workflow script is the main backend learning regression coverage. See [review-time test results](PROJECT-STATUS.md#testing-status); historical reports are not a current test run.

## Where to make backend changes

| Task | Controllers/services/contracts/schema/tests to inspect |
| --- | --- |
| Register/login/password/session behavior | `backend/src/auth/auth.controller.ts`, `auth.service.ts`, `password.ts`, `session-cookies.ts`; `auth.controller.spec.ts`, `auth.service.spec.ts`, `backend/test/app.e2e-spec.ts`, `backend/test/auth.live.cjs` |
| Role/provisioning changes | `backend/src/auth/account-access.ts`, `session-cookies.ts`, `backend/scripts/provision-instructor.cjs`, `backend/src/auth/provision-instructor.spec.ts`; coordinate frontend guards/access helper |
| CORS/origin policy | `backend/src/auth/frontend-origins.ts`, `frontend-origins.spec.ts`, `backend/src/main.ts`, auth/learning controller write checks |
| Add/change a learning endpoint | `backend/src/learning/learning.controller.ts`, `learning.service.ts`, registration in `backend/src/app.module.ts`; frontend `learning/client.ts` and relevant provider/adapter |
| Course/module/activity commands | `LearningService.command()`, `frontend/app/lib/instructor/types.ts`, `repository.ts`, relevant content `*-types.ts`/validator; `backend/test/learning.integration.cjs`, `frontend/tests/instructor*.test.mjs` |
| Publish/private content projection | `LearningService.command()/curriculum()`, `frontend/app/lib/learning/domain.ts`, content readiness helpers, `frontend/app/lib/learning/catalog.ts`; `frontend/tests/connected-learning.test.mjs`, workflow integration |
| Progress/reset/draft persistence | `LearningService.progress()/saveProgress()/resetProgress()`, `frontend/app/lib/student/types.ts`, `progress.ts`, Student `progress-provider.tsx`; workflow integration and student activity tests |
| Quiz grading/retry/history | `LearningService.quiz()`, quiz content types, `LearningQuizAttempt`/`LearningProgress`, workflow integration; `frontend/tests/connected-learning.test.mjs`, quiz/activity suites |
| Browser lab validation | API record validation in `saveProgress()`; actual preview/check rules in frontend `lib/instructor/lab-preview.ts`, `lib/student/lab-validation.ts`; do not add API code execution casually |
| Workshop delivery/review/source | `saveProgress()/submissions()/review()/submissionCode()/resubmit()`, `LearningSubmission`, `frontend/app/lib/learning/submissions.ts`; workflow integration and workshop view tests |
| Instructor insights | `LearningService.insights()`, progress/publication relationships, frontend `components/instructor/insights-view.tsx`; workflow integration |
| Database model/index/invariant | `backend/prisma/schema.prisma`, `prisma.config.ts`, migration SQL, `backend/src/prisma/prisma.service.ts`; real PostgreSQL integration for SQL-only constraints |
| Liveness/readiness | `backend/src/health/health.controller.ts`, `backend/test/app.e2e-spec.ts` |
| Admin backend | No implementation exists. Read branch-only `feature/admin-dashboard:docs/admin-backend-requirements.md` and [Admin status](PROJECT-STATUS.md#deferred-admin-dashboard); agree auth/contracts/migrations before implementation. |

Abbreviated neighbor files in a cell belong to the named directory. Keep contracts, client projections and tests synchronized with backend behavior; do not edit generated Client/domain bundles as source.
