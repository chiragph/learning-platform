# Current project status

## Review scope and evidence

Documentation review date: **27 October 2026**. Inspected checkout: `docs/project-handoff`, source HEAD `59614ec` (`Merge pull request #12 ... feature/database-schema`), also local `main` at review time. Working tree was clean before documentation changes. This handoff changes documentation only and leaves the branch unchanged.

Primary evidence: actual route/component/provider source, backend controllers/services, package manifests/configuration, active Prisma schema and all three migration SQL files, existing tests/reports, and read-only local Git inspection of the unmerged Admin branch. Local refs were inspected without fetch, checkout, merge or branch mutation; remote hosting/PR state may have moved since those refs were last updated.

**Implemented** below means a source-backed path exists for the stated scope; it does not imply deployed production, completed browser QA or a currently migrated live database. [Roles and features](ROLES-AND-FEATURES.md) gives the detailed matrix. [AGENTS.md](../AGENTS.md) is the agent entry point.

## Verified implemented features

| Area | Source-backed implementation |
| --- | --- |
| Public frontend | Landing page, shared brand/animations, light/dark theme, login/registration forms |
| Email/password authentication | Student registration, password hashing/verification, database sessions/expiry/Remember me, origin checks, public identity responses, scoped logout |
| Workspace protection | Server session verification plus client fail-closed cached-route/session rechecks; backend role and owner/student checks |
| Concurrent roles | Independent Student/Instructor cookies with compatibility alias; scoped verification/logout and integration-test cases for both login orders |
| Student curriculum | Account-loaded published catalog, dynamic IDs mapped to existing course/lesson/quiz/lab/workshop routes, dashboard/continue learning/progress/visits |
| Student theory/code | Authored lesson blocks, contextual HTML/CSS/JavaScript workspace, account source drafts, Monaco workers/Emmet, accessible editor fallback, restricted preview/console |
| Quiz workflow | Partial answer persistence, server weighted scoring, immutable attempts, idempotent retries/conflicts, best/latest/count aggregates and recent original-question reviews |
| Instructor authoring | Account-backed course/module/activity commands, four typed content editors, incomplete draft saves/readiness, duplication, ordering/moves, archive/restore and guarded local-draft deletion |
| Publication | Transactional immutable course snapshots/live pointers, private-field stripping, draft/live separation, unpublish/archive behavior and stable student references |
| Browser draft import | Valid recorded-change instructor backup imports only into revision-zero workspace; original browser storage retained |
| Workshop source delivery | Completion snapshots saved source, real owner-scoped instructor records/source download, private/public feedback distinction, changes-requested resubmission |
| Instructor insights | Current started-learner/completion summaries and Student account count from persisted records |
| Persistence | Eight active models total: User/Session plus six learning models; relational ownership/history and JSONB editor/progress documents; SQL immutability/status/scope constraints |

Implementation evidence is mapped to exact files in [frontend change locations](FRONTEND-GUIDE.md#where-to-make-changes), [backend change locations](BACKEND-GUIDE.md#where-to-make-backend-changes), and [architecture flows](PROJECT-ARCHITECTURE.md).

## Partial implementations and pending integrations

| Area | What works | Missing/limited part |
| --- | --- | --- |
| Coding lab assessment | Browser structured checks, multiple widths, saved passing evidence and explicit completion | No independent server verification or resource-limited execution service; evidence is classified `browser-check` |
| Workshop uploads | Account source code snapshot/review | No binary/ZIP upload storage, upload authorization/finalization, scans, signed downloads or portable local image delivery |
| Submission history | Version-pinned delivery and optimistic review revision | Resubmit overwrites source on the same row; no separate immutable review/resubmission-event history; no explicit approval grade |
| Profile/account settings | Verified identity display and local display name/avatar/theme | No backend account-edit/password-change API; local personalization does not change User record |
| Instructor account UI | Authenticated access and theme/settings information | Shell has obsolete preview/identity text; current shell/settings lack connected profile editing and logout control |
| Reporting | Current progress-derived Instructor insights | No enrollment model, historical platform learning-event/audit system, trustworthy broad analytics denominators or platform analytics APIs |
| Recovery/offline | Failed saves retained/retried in the open page; browser preview backup retained | No durable offline outbox or general student legacy-progress import; closing an unsaved page can lose changes |
| Authentication expansion | Single designated Instructor plus Students | No general multi-instructor/admin provisioning/access; no OAuth, password recovery, email verification, account suspension or rate limiting |
| Deployment | Local build/start scripts | No verified production hosting/configuration, CI release workflow, backup/restore policy or external storage service |

## Known bugs and limitations

These are source-review findings, not claims that all were reproduced in a live browser/database during this task.

1. **Profile reset uses the wrong persistence path.** `LearningDataControls` in `frontend/app/components/student/profile-view.tsx` calls `update(emptyProgress)` and reports reset success. `ProgressProvider.update()` sends `PUT /api/learning/progress`. `LearningService.saveProgress()` unions prior completions, merges drafts/workshop/lab/session maps and preserves quiz aggregates/history; these records can survive the apparent reset. The provider already has `reset()` using `POST /progress/reset`, but the Profile control does not call it. Existing Profile tests use local provider fixtures and do not catch this connected behavior. Do not fix this by clearing the database; a targeted UI/provider regression is future application work.
2. **Instructor shell contradicts connected behavior.** `frontend/app/components/instructor/instructor-shell.tsx` still says changes stay in the browser, publishing awaits integration, and no signed-in identity exists. Server layout/session guards and `RemoteInstructorRepository` actually use the authenticated account/database. This copy needs a future UI correction; it was preserved in this documentation-only task.
3. **Images remain local despite account-saved source.** `decode-image:` references depend on `frontend/app/lib/student/workspace-images.ts` localStorage data. Other devices and downloaded/delivered workshop JSON do not automatically receive those bytes. No cloud asset API exists.
4. **Save notices can precede acknowledgement.** Student view updates enqueue optimistic transformations. A successful local action/notice is not proof of database commit; provider saving/error/retry state is authoritative. The in-memory queue is lost when the page is discarded.
5. **Submission list scaling is limited.** Service lists take at most 500 records; Instructor filtering happens after loading. No server pagination/search API exists, so large histories can be incomplete in the UI.
6. **Insights differ from delivery eligibility.** `LearningService.insights()` filters by owner and nonnull live pointer but not `archived: false`; Student publications do filter archived courses. Archived courses can remain in insights. Metrics describe current started progress, not enrollment or event history.
7. **Error contracts are uneven.** Auth database failures are sanitized as 503; learning persistence has no matching wrapper and can return Nest 500. Inner editor stale errors are wrapped as 400 while workspace/progress conflicts use 409. There is no universal machine-code/field-error DTO.
8. **Seed/readiness compatibility is intentional but narrower than a universal validator.** Baseline initialization publishes bundled seeds with compatibility behavior; `publicationIssue()` skips untouched seeded activity content. Never infer that every delivered seed passed the same readiness path as a newly authored activity.
9. **Client code execution has practical limits.** The sandbox/CSP restrict application access; it is not a resource-limited remote runtime and does not make browser lab evidence tamper-proof. JSDOM tests cannot prove physical-browser layout/isolation. Some previews allow public HTTPS images.
10. **Schema health is not complete readiness.** `/api/health/database` queries only `users`; it can succeed without the learning migration. Prisma connects lazily. Check migration status and required workflows separately.

## Deferred Admin Dashboard

User-provided context says Admin frontend exists on `feature/admin-dashboard` and is unmerged. Local Git evidence corroborates this: branch tip `304b3c5` (`feat: implement admin dashboard frontend`, 2026-10-27) is not an ancestor of local `main`; `git diff --name-status main...feature/admin-dashboard` lists the added frontend/report files. None of its Admin directories/reports is present in this checkout.

Verified **branch-only** paths: `frontend/app/admin/`, `frontend/app/components/admin/`, `frontend/app/lib/admin/`, Admin client/server session helpers, three reports under that branch's `docs/`, and Admin tests. The eight route pages are Overview, Users, Instructors, Courses, Analytics, Activity, Settings and Profile. The branch report describes responsive navigation, validated API boundaries, loading/error/unavailable states, capability-gated confirmations, and local theme reuse.

Read without switching:

```powershell
git show feature/admin-dashboard:docs/admin-dashboard-implementation.md
git show feature/admin-dashboard:docs/admin-backend-requirements.md
git show feature/admin-dashboard:docs/admin-instant-navigation-fix.md
git ls-tree -r --name-only feature/admin-dashboard frontend/app/admin frontend/app/lib/admin
```

Active backend `account-access.ts` maps stored ADMIN to Student, `session-cookies.ts` rejects admin scope, and no Admin controller exists. Required work includes secure ADMIN provisioning/public mapping/scoped cookies, privileged APIs, persisted account status/session revocation, audit events, moderation consistency, safe account/config handling and trustworthy analytics. The active Prisma enum already contains ADMIN; an enum alone does not solve these dependencies.

Branch reports record prior 314-test/lint/type/build validation, anonymous production route checks, unfinished real-browser QA and no live ADMIN/PostgreSQL integration. Those are historical branch-reported results, not checks rerun here. This documentation task did not merge, check out, execute or modify that branch. Its requirements should be re-reviewed against current main before application integration.

## Testing status

Checks run for this documentation review on the current checkout, using installed dependencies and Node 24.17.0 / npm 11.13.0:

| Check | Result on 2026-10-27 | Scope |
| --- | --- | --- |
| `frontend/`: `npm test` | **280 passed, 0 failed** | Existing Node/JSDOM/domain/editor/session suites, including connected catalog/remote adapter tests |
| `frontend/`: `npm run lint` | Passed | ESLint |
| `backend/`: `npm test` | **48 passed across 5 files** | Vitest unit tests; domain preparation runs automatically |
| `backend/`: `npm run test:e2e` | **16 passed** | Nest/Supertest with Prisma test doubles; Client generation runs automatically |
| `backend/`: `npm run lint` | Passed | oxlint |
| `backend/`: `npm run prisma:validate` | Passed | Active selected schema; no migration application |
| Documentation path/link/script/API/model checks | Passed | Relative links/anchors, source references, package scripts, 21 routes, 8 models and 3 migration directories; documented branch/setup exceptions |

Backend test runs emitted Vite notices about future native-config loading/CommonJS syntax and redundant `vite-tsconfig-paths`; checks still passed. The frontend's 280 passing tests include local demo/fixture behavior, which must not be conflated with active account integration or production features.

Not run in this review: application production builds/typecheck, real browser/visual/iframe-isolation checks, live auth script, PostgreSQL learning integration, migration status/deploy or instructor provisioning. This was documentation-only; live data state and credentials were not needed or inspected. The preexisting [connected-workflow report](../backend/docs/learning-workflow.md) records earlier real PostgreSQL integration and local migration application; that historical assertion does not establish this environment's current database state.

### Documentation validation record

Validation passed across 27 created/updated Markdown files: 148 relative links/anchors resolved; 108 unique full source references and abbreviated filenames were checked; all 36 documented `npm run` script names exist in the package manifests; the API inventory exactly matches all 21 controller routes; all eight active models and three migration directories match source. SQL table names, scope/revision/status constraints and immutable-history triggers were cross-checked. A credential-pattern scan and whitespace/diff-scope checks passed.

Explicit exceptions are branch names (not filesystem paths), Admin branch-only files verified through Git, generated/ignored artifacts, glob patterns, and `frontend/.env.local` created during setup rather than present in this checkout. References to absent loading/error route files explicitly describe their absence. No broken local links remain. External documentation links were retained as references without a network availability audit.

## Existing documentation discrepancies

| Existing source | Discrepancy found | Handling in this handoff |
| --- | --- | --- |
| Root | No root README or AGENTS existed | Added current entry points and six linked guides |
| `frontend/README.md` | Starter text said login opens a plain success page and lacked workspace guidance | Updated focused setup/index while retaining app entry/font/build context |
| `backend/README.md` | Mostly Nest starter material and User-only setup context | Replaced boilerplate with current backend setup/checks and links; no production deployment claim from starter links |
| `backend/AUTH.md` | Claimed course/submission integration was still a separate proposal; described legacy single-cookie session behavior | Updated connected-workflow and independent scoped-cookie guidance; retained useful setup/security/live-test instructions |
| `backend/prisma/README.md` | Focused on initial User table and readiness could be read as whole-schema proof | Added active schema/migration reference, limited health-check interpretation, removed datasource example and guarded local environment copying |
| `backend/docs/stage-5e/README.md` and `schema.proposed.prisma` | Historical normalized schema/API proposal says active schema only has User/Session and instructor routes are development-only | Marked proposal historical/unselected at entry; active six-table learning implementation is documented here |
| `frontend/docs/` stage reports | Old browser-only auth/progress, development-only instructor production 404s, demo submissions and old test counts | Added historical banners and current-guide links to all 13 reports; retained design evidence and removed obsolete demo credential examples |
| `backend/docs/learning-workflow.md` | Correct connected narrative says Profile reset clears working progress, but UI is miswired; local migration claim is historical | Flagged here and linked from that report; dedicated endpoint semantics are distinct from current control |
| Instructor shell copy | Describes preview-only state despite real account transport | Recorded as application limitation; no runtime code modified |

No new normalized content tables or proposed API paths have been represented as implemented. Historical reports may still contain their dated findings and plans; use them for rationale, then verify current source before editing.

## Unverified or missing information

- Current remote PR/hosting state, production deployment, runtime availability and backup policy; no network fetch or deployment inspection was performed.
- Actual configured database migration state/data, production account provisioning and environment values. Real secrets were not read into the handoff.
- Current visual/responsive behavior in physical browsers and end-to-end iframe isolation/resource behavior.
- A team-approved CI/branch protection/review policy; workflow recommendations are documented rather than claiming existing automation.
- Future object-storage provider, upload/scan/retention policy, general admin/multi-instructor provisioning, account-status/audit/history schema, enrollment semantics and analytics denominators.
- Live Admin data/auth integration and Admin real-browser QA; branch report/file inventory are evidence of frontend work only.

## Future development priorities

These are recommendations for subsequent approved application tasks, not features implemented by this documentation change.

1. Fix the Profile reset wiring and optimistic completion messaging with a connected provider/API regression; preserve immutable audits and delivered submissions.
2. Correct Instructor preview/identity text and complete appropriate account/logout UI without weakening the existing guards.
3. Preserve the passing baseline and add connected tests for UI actions currently covered mainly through local fixtures; add repeatable real-browser editor/lab/theme checks and CI before relying on stage reports as release evidence.
4. Re-review the unmerged Admin frontend requirements, then implement auth/provisioning, data APIs, moderation/audit and measured analytics in coordinated backend work before integrating the branch.
5. Agree image portability and workshop binary-upload scope before adding storage/scanning. Document whether review/resubmission audit history is required.
6. Improve submission pagination, reporting semantics and consistent safe errors as scale/product requirements demand; evaluate broader Instructor access separately from the single-account restriction.
7. Update guides in the same PR as route/API/schema/auth/persistence changes. Record future review date/source commit and exact check results, archive superseded proposals, and add automated documentation link/contract checks to eventual CI.
