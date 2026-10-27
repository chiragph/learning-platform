# Development workflow

Reviewed **2026-10-27**, source commit `59614ec`. [Agent rules](../AGENTS.md) · [Setup](../README.md#local-setup) · [Frontend](FRONTEND-GUIDE.md) · [Backend](BACKEND-GUIDE.md) · [Status](PROJECT-STATUS.md)

## Branches and collaboration

Existing names use `feature/<topic>` (for example Student, Instructor, database, Admin work). This documentation work uses `docs/project-handoff`. For new work, use a short lowercase topic with a suitable `feature/`, `fix/`, `docs/` or `chore/` prefix. These are recommended conventions; no repository branch policy, PR template, CODEOWNERS, or CI workflow was found in the inspected tree.

AI agents must **never automatically commit, push, merge, delete branches, or switch branches**. The developer owns those actions unless explicitly requesting a particular action. Agents inspect status and work on the current approved checkout, preserve unrelated changes, and supply reviewable diffs. Do not create/switch a branch merely because a task suggests a branch name.

Useful read-only context commands from the repository root:

```powershell
git status --short
git branch --show-current
git log -5 --oneline
git diff --stat
git diff --check
```

### Feature branch and PR process

1. Agree scope, role/persistence requirements and acceptance checks. Inspect the current code and [feature status](ROLES-AND-FEATURES.md), including deferred branch work.
2. The developer selects/creates the feature branch from the agreed base. Keep focused work together; do not mix API/schema/UI redesigns that are unrelated to the goal.
3. Implement through existing patterns, update contracts/docs, run relevant tests, and review the diff for unrelated files, generated outputs and secrets.
4. The developer commits/pushes and opens a PR. Describe the concrete trigger/problem and resulting behavior, affected roles/contracts/migrations, validation results and material limitations. Use the repository's eventual template if one is added.
5. Reviewers inspect runtime behavior, role/ownership checks, source/contract compatibility, publication/history safety, accessibility/themes and appropriate tests. For schema changes, review actual SQL and preservation of old IDs/data, including SQL-only constraints.
6. Resolve review feedback and run checks affected by the changes. Record unrun live/browser checks accurately. The developer decides merge timing and performs merge/branch cleanup.

Closing a pull request **does not itself delete its branch**. Unfinished work can remain on a separate feature branch for later continuation. Deleting a branch is a separate action, sometimes offered by hosting settings/UI after merge. The unmerged Admin branch is existing work to preserve, not a reason to automatically merge or remove it.

### Keeping work updated and resolving conflicts

The developer can fetch updated refs and choose merge or rebase according to team agreement. Agents may compare available local refs and inspect other branches with `git show` / `git ls-tree`; never assume remote-tracking refs are fresh. Do not automatically pull, rebase, force-push, reset, merge or switch branches to get unstuck.

Before an approved integration, confirm clean/saved work and identify the intended base. For conflicts, read both versions and their callers/contracts; preserve both intended behaviors rather than selecting an entire side blindly. Resolve route/layout conflicts with the project's Next/Suspense requirements, API conflicts with both adapters, and schema conflicts through additive migration review. Never rewrite already applied migrations to make two branches appear consistent. Run targeted regressions plus relevant cross-role checks after resolution. If intent is unclear, preserve work and ask with a concrete conflict explanation.

## Local development and environment

There is no root workspace script. Install dependencies in `frontend/` and `backend/` using their committed npm lockfiles. Backend commands need the frontend tree and installed esbuild to build shared domain rules. See [README](../README.md#local-setup) for two-terminal startup and variable names; do not paste environment values into issues, docs or logs.

`frontend/next.config.ts` proxies browser APIs; server session helpers call the same `API_URL` backend directly. Coordinate frontend origin/backend allowlist changes. Keep production HTTPS/Secure-cookie behavior and exact origins intact; do not broaden CORS or bypass guards to work around local setup.

## Command matrix

All commands below are verified package scripts except the explicitly labeled direct Git checks. Windows may require `npm.cmd` in place of `npm`.

| Directory | Command | Notes/side effects |
| --- | --- | --- |
| `frontend/` | `npm ci` | Lockfile install; postinstall prepares ignored Monaco workers |
| `frontend/` | `npm run dev` | Predev prepares workers, then Next dev; default port 3000 |
| `frontend/` | `npm run build` | Prebuild prepares workers, then Next production build; Google Fonts needs network |
| `frontend/` | `npm start` | Runs an existing Next production build |
| `frontend/` | `npm test` | Pretest prepares workers; Node runner on `tests/*.test.mjs` |
| `frontend/` | `npm run lint` | ESLint |
| `backend/` | `npm ci` | Backend lockfile install; run Prisma generation before checks that import generated Client if absent |
| `backend/` | `npm run start:dev` | Prehook builds shared domain/generates Client, then Nest watch; default port 4000 |
| `backend/` | `npm start`, `npm run start:debug` | Equivalent artifact prehooks; regular/debug Nest startup |
| `backend/` | `npm run build` | Domain build + Prisma generation + Nest build |
| `backend/` | `npm run start:prod` | `node dist/main`; requires built `dist/` and sibling `domain/learning.cjs` |
| `backend/` | `npm test` | Domain pretest, Vitest unit specs; Prisma is mocked, but generated module may need preparation on a fresh install |
| `backend/` | `npm run test:e2e` | Domain/Client prehook, mocked Prisma HTTP tests via Vitest/Supertest |
| `backend/` | `npm run test:watch`, `npm run test:cov`, `npm run test:debug` | Vitest alternate modes; not the same pretest lifecycle as `npm test` |
| `backend/` | `npm run lint` | oxlint on source/tests |
| `backend/` | `npm run format` | Prettier writes source/tests; not a read-only check or documentation-only operation |
| `backend/` | `npm run learning:build` | Bundles pure frontend domain into ignored backend artifact |
| `backend/` | `npm run prisma:generate`, `npm run prisma:validate` | Generate ignored Client / validate selected schema; neither applies migrations |
| `backend/` | `npm run prisma:status` | Queries configured database migration state |
| `backend/` | `npm run prisma:deploy` | Applies committed migrations to confirmed target; no reset/shadow DB |
| `backend/` | `npm run prisma:migrate -- --name describe_change` | Local schema development, creates/applies migration and uses shadow DB; stop if reset requested |
| `backend/` | `npm run prisma:studio` | Database browser/editor; edits can change real data |
| `backend/` | `npm run instructor:provision` | Prebuild, then explicit account provisioning; requires local bootstrap secret; not routine server startup |
| `backend/` | `npm run test:auth:live` | Running frontend/API/database required; creates/removes uniquely named temporary account; optional real instructor login check |
| `backend/` | `npm run test:learning:integration` | Builds, creates/migrates/tests/drops a disposable schema in configured PostgreSQL; requires approved test DB/privileges |
| Repository root | `git diff --check` | Direct read-only whitespace check; not a package script |

`backend` also contains `npm run deploy` (`nest deploy`), but no project-specific deployment configuration/process was verified. Do not treat the starter command as an approved production-release workflow. There is no frontend `typecheck` script; production build performs Next's type validation. Do not invent root `npm run dev`, Jest commands, seed commands, or a monorepo task runner.

## Testing before review

| Change type | Minimum relevant evidence |
| --- | --- |
| Documentation | Referenced local paths, relative Markdown links/anchors, package commands, controller routes/schema claims, consistency, secret scan and `git diff --check` |
| Student views/domain | Relevant `frontend/tests/student*.test.mjs`, learning-activity suites, connected catalog tests and lint; build when route/types/SSR change |
| Monaco/preview/lab lifecycle | Editor/workspace/learning-activity suites, relevant Instructor Lab suites, both themes/widths and real-browser preview/layout check |
| Instructor authoring | Relevant `frontend/tests/instructor*.test.mjs`, `connected-learning.test.mjs`, lint/build; PostgreSQL workflow coverage when persistence/publication changes |
| Auth/session/roles | Backend unit and HTTP tests, `frontend/tests/auth-session.test.mjs`, role isolation/cached navigation; live proxy/database auth test on approved local DB for integration changes |
| Backend learning/schema | Build/lint, unit/HTTP suites as applicable, real PostgreSQL `test:learning:integration`, reviewed migration SQL and cross-account/publication preservation |

Tests often use local repository/provider doubles for deterministic editor/profile interaction. A passing UI reset test does not establish connected API reset semantics; current Profile reset is a documented example. JSDOM simulates DOM and explicit geometry, not browser layout or origin isolation. The HTTP e2e suite mocks Prisma; it is not the real PostgreSQL workflow test. Report the scope of each check, failures and unrun checks.

For documentation-only work, application builds and mutating database checks are not automatically necessary. Do not run write-oriented format/provision/migration/live scripts merely to document their existence. No automatic CI enforcement is configured in the inspected repository, so PRs need explicit recorded validation.

## Frontend/backend contract handoffs

Before changing a connected feature, agree method/path, role and owner scope, JSON shape/limits, revision semantics, success/error behavior, private fields, loading/retry/empty states, and whether data is account-backed or local. Update the [implemented API inventory](BACKEND-GUIDE.md#implemented-api-endpoints) and relevant feature/status rows together.

For this codebase specifically:

- Instructor uses commands, not per-course REST CRUD. Outer workspace and inner content revisions are distinct. Keep typed union/domain validation/provider acknowledgement aligned.
- Publication creates immutable versions; catalogs must exclude private quiz keys, lab solutions and workshop review guidance. Existing student reference IDs cannot change just because content is renamed/moved.
- Quiz retry keys belong to a student and payload; scores/history are server-owned. Lab evidence is browser-generated. Workshop submission is saved source rather than upload metadata.
- Error envelopes currently follow Nest, without a universal custom code/field-error DTO. Learning POST success is 201. Ensure client tests match actual controllers.
- Auth changes must preserve independent Student/Instructor cookies, scoped logout, origin checks, server/client fail-closed guards and cross-tab isolation.
- Changes to pure shared rules require rebuilding the backend domain artifact and running both affected frontend tests and backend workflow tests. Keep browser-only dependencies out of the backend bundle.

Admin branch requirements are a separate unimplemented contract. Read the branch-only `docs/admin-backend-requirements.md`, confirm it still fits current code, and coordinate auth/schema/API changes through review. Do not advertise proposed paths as implemented or merge the branch automatically.

## Safe database migrations

Use an additive migration strategy and preserve users, sessions, stable IDs, publications, quiz audit records and deliveries. Review both Prisma and SQL-only constraints/triggers. Do not select the historical proposed schema, apply destructive SQL, drop a database, reset migrations or disable history protection without explicit approval.

Use developer-owned disposable data for schema development and integration tests. Confirm target environment, backup/recovery expectations, compatibility with old/new app versions and rollback/forward-fix approach before applying. `migrate dev` is local development; deploy committed SQL using `prisma:deploy`. Commit schema, new SQL and relevant lock/config changes through the normal developer-controlled PR process. Generated Client/domain/worker/build outputs stay ignored.

## AI agent working checklist

1. Read [AGENTS.md](../AGENTS.md), current status and applicable nested instructions; inspect status/relevant code before editing.
2. Locate the actual file using the frontend/backend change maps. Confirm live vs historical/branch-only behavior.
3. Reuse existing components/domain/transport; preserve working Student and Instructor functionality and avoid unrelated refactors/dependencies.
4. Protect credentials, role checks, ownership, revisions, stable IDs and database history. Ask before destructive actions; never bypass auth to resolve a UI issue.
5. Run relevant checks, update documentation for changed contracts/behavior and inspect the final diff.
6. Report modifications, effects, validation and material limits. Leave commits/pushes/merges/branch changes to the developer unless explicitly requested.
