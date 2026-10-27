# DECODE agent handoff

DECODE is a beginner web-development learning platform for HTML, CSS, and JavaScript. Students learn through theory, quizzes, coding labs, and guided workshops. A designated instructor authors curriculum, publishes courses, and reviews submitted workshop source.

## Start here

1. Read this file and [project status](docs/PROJECT-STATUS.md).
2. Read the relevant [frontend](docs/FRONTEND-GUIDE.md) or [backend](docs/BACKEND-GUIDE.md) guide and inspect the actual implementation before editing.
3. Consult [architecture](docs/PROJECT-ARCHITECTURE.md) for cross-layer changes and [roles and features](docs/ROLES-AND-FEATURES.md) for capability boundaries.
4. Follow [development workflow](docs/DEVELOPMENT-WORKFLOW.md), run relevant checks, and describe changes and their effects.

Review baseline: **2026-10-27**, source commit `59614ec`, on `docs/project-handoff` (same source commit as local `main`). Recheck Git status and code when using this handoff later. The current code is authoritative; historical stage reports are not current specifications.

## Stack and repository layout

| Location | Responsibility |
| --- | --- |
| `frontend/` | Next.js 16.4.2 App Router, React 19.3, TypeScript, Tailwind CSS 4 and scoped CSS, Monaco 0.57 / Emmet |
| `backend/` | NestJS 12, Express, TypeScript, Prisma 7.10 / PostgreSQL, cookie sessions |
| `frontend/app/(student)/` | Protected student routes; route group adds no URL prefix |
| `frontend/app/instructor/` | Protected instructor pages and activity editor routes |
| `frontend/app/components/` | Landing/auth UI, Student and Instructor views, shells, providers, shared theme |
| `frontend/app/lib/` | Student domain helpers, instructor commands/content types, connected learning contracts |
| `backend/src/auth/` | Password verification, sessions, role mapping, origin policy |
| `backend/src/learning/` | Learning controller/service; registered directly in `AppModule` |
| `backend/prisma/` | Active schema and three committed migrations |
| `frontend/tests/`, `backend/src/**/*.spec.ts`, `backend/test/` | Frontend, backend unit/HTTP, live and PostgreSQL integration checks |
| `docs/` | Current project guides linked above |

Root `package.json` is `{}`: this is two npm packages, not a configured npm workspace. Run commands in the stated package directory. Both packages must be installed: backend `learning:build` bundles pure domain code from `frontend/app/lib/learning/domain.ts` using frontend esbuild. Deploy `backend/domain/learning.cjs` alongside `backend/dist/`; do not hand-edit generated bundles or Prisma Client.

## Architectural rules

- Frontend owns rendering, editor lifecycle, local preferences, preview isolation, and client state. Backend owns verified identity, authorization, persisted records, publication, and quiz grading.
- `/api/*` is rewritten by `frontend/next.config.ts` to NestJS. Nest sets the global `api` prefix. There are no Next route-handler APIs in this checkout.
- Instructor workspace documents and student progress use versioned JSONB with relational identities, ownership, immutable publications/quiz attempts, and optimistic revisions. There are no active standalone Lesson, Module, Quiz, or Enrollment tables.
- Authoring changes are drafts. Explicit course publication creates a new immutable snapshot and updates the live pointer. Archive/unpublish affects delivery without deleting history. Stable course/activity/reference IDs must survive edits and reordering.
- `frontend/app/lib/learning/catalog.ts` adapts live snapshots into existing student collections. Preserve this adapter and distinguish authoring activity IDs from student reference IDs.
- Server grades quiz attempts; generic progress saves cannot set scores/history. Lab results are **browser-check evidence**, not trusted server execution. Never execute student code in the API or application origin.
- Workshop completion snapshots saved HTML/CSS/JavaScript for review. ZIP/file upload storage and secure arbitrary-code grading are pending.

## Authentication and authorization

- Registration always creates `STUDENT`. The designated instructor requires both its configured-in-code email identity and stored `INSTRUCTOR` role; see `backend/src/auth/account-access.ts` and `frontend/app/lib/instructor/access.ts`. Do not copy account addresses or credentials into new docs/tests unnecessarily.
- Server layouts verify sessions before admitting a workspace; client providers revalidate cached navigation, focus, and cross-tab changes. Preserve both layers and backend endpoint ownership checks.
- HttpOnly `decode_student_session` and `decode_instructor_session` cookies support simultaneous roles; `decode_session` is a compatibility alias. Auth verification/logout use `scope=student` or `scope=instructor`. Never put tokens in JSON, localStorage, logs, or client props.
- Writes require JSON and enforce the existing origin policy. Cookies use SameSite=Lax and Secure in production. Never bypass authentication, authorization, or origin checks to make a UI work.
- Although the database enum contains `ADMIN`, current public role mapping exposes other stored roles as `STUDENT`. `scope=admin` is unsupported. Admin frontend work is on the **unmerged** `feature/admin-dashboard` branch; its files are absent here. Do not assume `/admin` or `/api/admin/*` works.

## Database and secrets safety

- Never expose credentials, connection strings, API keys, session tokens, or real environment values. Document variable names only; keep local environment files ignored.
- Never reset the database without explicit approval. Ask before destructive operations; do not accept a Prisma reset prompt, drop a database/schema, rewrite applied migrations, or remove history as routine setup.
- Use additive migrations, review SQL and custom constraints/triggers, preserve existing users/sessions/IDs, and test on an approved disposable database. `prisma migrate dev` uses a shadow database; deployment uses committed migrations via `prisma:deploy`.
- `backend/docs/stage-5e/schema.proposed.prisma` is a historical proposal, **not** the active schema. Active source is `backend/prisma/schema.prisma`, plus migration SQL (which contains extra constraints/triggers).
- Provisioning is explicit via `instructor:provision` with a locally supplied `INSTRUCTOR_BOOTSTRAP_PASSWORD`; it is not automatic seeding. Do not run it without an account-provisioning task.

## UI and editing conventions

- Inspect relevant code before editing; reuse existing components, tokens, commands, and providers. Preserve working Student and Instructor functionality. Avoid unrelated refactors and unnecessary dependencies.
- Follow `frontend/AGENTS.md` when working in the frontend: inspect relevant installed Next documentation before writing frontend code. This project enables Cache Components and partial prefetching; preserve Suspense and async route-parameter boundaries.
- Theme is `data-theme` on `<html>`, persisted as `decode-theme`; light/dark tokens live in `frontend/app/globals.css`. Use Geist / Geist Mono and existing `decode-*`, `student-*`, `ins-*` CSS conventions.
- Reuse native dialogs, accessible labels/focus handling, reduced-motion styles, scoped icon systems, `ThemeToggle`, and `Wordmark`. Keep document scrolling separate from Monaco/preview scrolling.
- Keep preview sandbox/CSP, strict message validation, Monaco model ownership, unsaved-change handling, and cached-route lifecycle protections intact.

## Development and checks

See [README setup](README.md#local-setup) for environment setup and the [command matrix](docs/DEVELOPMENT-WORKFLOW.md#command-matrix) for side effects. On Windows, use `npm.cmd` if PowerShell blocks `npm.ps1`.

| Directory | Commands |
| --- | --- |
| `frontend/` | `npm ci`, `npm run dev`, `npm test`, `npm run lint`, `npm run build`, `npm start` |
| `backend/` | `npm ci`, `npm run prisma:generate`, `npm run prisma:validate`, `npm run prisma:status`, `npm run start:dev` |
| `backend/` checks | `npm test`, `npm run test:e2e`, `npm run lint`, `npm run build` |
| `backend/` migrations | `npm run prisma:deploy`; for a new reviewed local change: `npm run prisma:migrate -- --name describe_change` |

Run relevant tests after changes and report what passed, failed, or was not run. Live auth tests create/remove a test user in the configured database; learning integration creates/drops a disposable schema. These are not ordinary read-only checks; use an approved local test database. Frontend builds fetch Google Fonts. Tests do not replace browser layout/isolation checks.

## Git collaboration

- Inspect `git status` and preserve unrelated work. Stay on the current branch unless the developer explicitly requests otherwise.
- **Never automatically commit, push, merge, delete branches, or switch branches.** Provide reviewable changes and validation results to the developer.
- Ask before destructive operations, including hard resets, force pushes, migration resets, and deleting data. Do not discard changes to resolve conflicts.
- Update the relevant current guide when changing routes, API contracts, schema, persistence, role rules, commands, or implementation status. Keep historical reports labeled as historical.

## Known limitations to check before changes

- Admin integration, multiple-instructor access, OAuth, password recovery, binary submissions, platform audit logs, and platform analytics are not implemented here.
- Student display name/avatar, editor preferences, image assets, sidebar/theme preferences remain browser-local. Account code drafts do not synchronize local images.
- Profile reset currently calls the ordinary merge-based save rather than the dedicated reset endpoint; existing completion/draft data can survive despite UI copy. Do not rely on this button for cleanup.
- Instructor shell still contains obsolete development-preview/local-storage copy. Existing stage reports and older AUTH text are superseded where indicated. See [status and evidence](docs/PROJECT-STATUS.md) before claiming a capability is complete.
