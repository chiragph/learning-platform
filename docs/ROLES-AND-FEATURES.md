# Roles and features

Reviewed **2026-10-27**, source commit `59614ec`. [Agent entry](../AGENTS.md) · [Architecture](PROJECT-ARCHITECTURE.md) · [Frontend locations](FRONTEND-GUIDE.md) · [Current status](PROJECT-STATUS.md)

## Status terminology

- **Implemented:** an actual UI/domain/API path exists for the stated scope, with source and relevant automated coverage. This does not certify production deployment or real-browser QA.
- **Partial:** a working path exists, but named parts are missing or have known limitations.
- **Browser-only:** implemented through local browser state; not an account-backed backend feature.
- **Branch frontend:** UI exists on `feature/admin-dashboard`, outside this checkout, awaiting backend integration.
- **Planned:** no active implementation of the stated capability.

Role enum values alone do not establish access. Current registration is Student-only; Instructor access requires the designated identity and stored role; stored ADMIN currently maps to public Student. See [authentication](BACKEND-GUIDE.md#authentication-cookies-and-authorization).

## Student

All active student routes are protected by server layout checks, client session revalidation and backend Student authorization. Published courses are accessible to every registered student without enrollment/assignment records.

| Capability | Status | Actual behavior and limits | Main evidence |
| --- | --- | --- | --- |
| Dashboard | Implemented | Personalized welcome, continue learning, curriculum/course completion, recent activity and playground link; calculated from connected catalog/account progress | `frontend/app/components/student/dashboard-view.tsx`, `continue-learning.tsx`, `progress-provider.tsx` |
| Courses / My Learning | Implemented | Published course/module/activity navigation, completion states, active/completed views, stable dynamic IDs; no paid access or enrollment management | `frontend/app/components/student/curriculum-view.tsx`, `frontend/app/lib/learning/catalog.ts` |
| Theory lessons | Implemented | Authored blocks, lesson outline, embedded practice workspace, explicit self-reviewed completion, curriculum navigation | `frontend/app/components/student/lesson-view.tsx`, `lesson-outline.tsx` |
| Quizzes | Implemented | Resume partial answers; submit all questions to server; weighted scoring, explanations, latest/best/count and up to 20 recent reviews; quiz completion uses best >=70% | `quiz-view.tsx`, `progress-provider.tsx` in Student components; `LearningService.quiz()` |
| Coding labs | Partial | Published structured checks, multiple widths, per-requirement results and explicit completion; results persist as browser-check evidence, with no independent server grading or execution service | `frontend/app/components/student/challenge-view.tsx`, `lab-check-runner.tsx`; backend `saveProgress()` |
| Workshops/projects | Implemented for source workflow; file uploads planned | Guided self-reviewed steps, saved code delivery on completion, status/published feedback, resubmit after changes requested. Source is HTML/CSS/JavaScript JSON; no ZIP uploads, scan pipeline or immutable review-event history | `frontend/app/components/student/project-view.tsx`; backend progress/submission/review methods |
| Playground | Implemented | Template-based HTML/CSS/JavaScript workspace, preview/console, account-backed explicit source drafts; no backend execution | `frontend/app/components/student/playground-view.tsx`, `code-workspace.tsx` |
| Progress | Implemented with reset limitation | Account-persisted completions, visits, drafts, quiz aggregates/history and activity summaries; completion survives republishing by stable reference. Profile reset is currently miswired; see status | `frontend/app/components/student/progress-view.tsx`, `progress-provider.tsx`; backend `LearningProgress` |
| Profile | Partial / browser-only personalization | Verified account identity displayed; display name/avatar saved locally per verified UUID, without changing User name/email/password. Profile progress summary is connected | `frontend/app/components/student/profile-view.tsx`, `profile-provider.tsx`, `frontend/app/lib/student/student-profile.ts` |
| Images/editor appearance | Browser-only | Raster image assets, editor preferences, sidebar collapse and site light/dark preference are local. Image references in saved source are not portable delivery assets | `frontend/app/lib/student/workspace-images.ts`, `editor-session.ts`; `theme-toggle.tsx` |
| Authentication | Implemented for email/password | Register/login/Remember me/scoped logout and expiry; independent Student/Instructor cookie sessions | `frontend/app/components/auth/`, `backend/src/auth/` |
| Google sign-in / password recovery / account editing | Planned | Controls do not imply these backend workflows exist | `frontend/app/components/auth/auth-form.tsx`, backend endpoint inventory |

Saving source/learning updates is asynchronous and optimistic in the view. Treat the provider's saving/error state and server acknowledgement as authoritative; a local success notice alone does not prove persistence. Failed save queues survive only in the open page, not as durable offline storage.

## Instructor

The active workspace is authenticated and account-backed, despite remaining preview text in its shell. Public registration does not create Instructors. There is one designated instructor, explicitly provisioned with the existing script.

| Capability | Status | Actual behavior and limits | Main evidence |
| --- | --- | --- | --- |
| Dashboard/overview | Implemented | Curriculum summaries and connected student insight data; shell identity/copy remains partly obsolete | `frontend/app/components/instructor/overview-view.tsx`, `insights-view.tsx`, `instructor-shell.tsx` |
| Course/curriculum management | Implemented | Course metadata and duplication; module/activity creation/edit/reordering/moving; archive/restore and guarded deletion of eligible local drafts. Stable seeded/published identities remain protected | `courses-view.tsx`, `curriculum-view.tsx`; `frontend/app/lib/instructor/repository.ts`, `types.ts` |
| Theory editor | Implemented | Ordered structured blocks, safe resources/code examples, preview, incomplete draft saves, readiness and stale-draft protection | `frontend/app/components/instructor/theory-editor.tsx`; `frontend/app/lib/instructor/theory.ts`, `theory-types.ts` |
| Quiz editor | Implemented | Questions/options/points/correct answer/explanation; add/edit/duplicate/reorder/delete, draft/readiness checks and isolated weighted preview | `frontend/app/components/instructor/quiz-editor.tsx`, `quiz-preview.tsx`; `frontend/app/lib/instructor/quiz.ts` |
| Coding lab editor | Implemented for browser checks | Starter source, private solution, hints/objective, widths, structured DOM/style/click/runtime checks and isolated preview. Does not create secure server execution | `frontend/app/components/instructor/lab-editor.tsx`, `lab-check-fields.tsx`; `frontend/app/lib/instructor/lab-preview.ts` |
| Workshop management | Partial | Step/requirements/deliverables/resources/source/guidance editing, preview and publishing are connected. Upload-related content configuration does not supply actual file storage | `frontend/app/components/instructor/workshop-editor.tsx`; `frontend/app/lib/instructor/workshop-types.ts` |
| Publishing | Implemented | Course-level explicit publication validates active content, creates immutable snapshots and changes live pointer; edits remain draft, unpublish/archive suppress delivery without deleting history | `RemoteInstructorRepository`, `LearningService.command()`, `frontend/app/lib/learning/domain.ts` |
| Legacy draft import | Implemented, constrained | Valid recorded-change browser backup can import into untouched server workspace; preserves browser original and reports conflicts | `frontend/app/lib/instructor/remote-repository.ts`, backend `importDrafts()` |
| Student insights | Partial | Real started-student activity/completion per owned live course and registered Student count; no enrollment cohorts or reliable historical analytics, and archived live courses are not excluded by the current query | `frontend/app/components/instructor/insights-view.tsx`, backend `insights()` |
| Submission review | Implemented for source workflow | Filter loaded records, inspect/download saved JSON source, save private feedback, publish feedback using Reviewed/Changes requested, and review resubmissions. Lists cap at 500 with client-side filters | `frontend/app/components/instructor/submissions-view.tsx`, backend submission/review methods |
| Profile/settings/sign-out UI | Partial | Connected-workspace explanatory information and shared theme toggle; no account-edit form or Instructor logout control in current shell/settings, although scoped logout API exists | `frontend/app/instructor/settings/page.tsx`, `instructor-shell.tsx`, `instructor-session-provider.tsx` |
| Multiple instructor accounts / assignment | Planned | Single-identity mapping and initialization do not implement a general instructor-management platform | `backend/src/auth/account-access.ts`, `LearningService.initialize()/publications()` |

`reviewed` means feedback was published; no separate approval grade exists. Resubmission updates the same delivered-source row and revision, preserving prior published feedback. Historical local demo submission helpers are not the real runtime review store.

## Admin

**The Admin Dashboard frontend exists on `feature/admin-dashboard` and has not merged into local `main`. Its files do not exist in this working tree. Admin backend integration remains pending.** Read-only Git metadata/tree/report inspection verified this; no branch was switched or merged.

The following behavior is documented in branch reports and visible in its file inventory. It is a frontend integration target, not an operational admin service.

| Capability / branch route | Status | Frontend scope described by branch report | Backend dependency |
| --- | --- | --- | --- |
| Overview `/admin` | Branch frontend | KPI cards, period filter, registration/activity charts and accessible tables, course distribution, recent events | Platform overview aggregates and trustworthy history |
| Users `/admin/users` | Branch frontend | Search/filter/sort/paging/details and capability-gated suspension/reactivation confirmation | Secure users API, persisted status/session revocation, audit transactions and self/last-admin protection |
| Instructors `/admin/instructors` | Branch frontend | Search/filter/paging/details, assigned courses and publication summaries; provisioning is unavailable | General instructor queries, ownership/assignment decisions and provisioning policy |
| Courses `/admin/courses` | Branch frontend | Search/filter/paging, curriculum inspection and confirmed archive/restore actions | Admin-scoped course reads/moderation synchronized with Instructor state and audit |
| Analytics `/admin/analytics` | Branch frontend | Period/course/instructor filters and report displays; missing data represented as unavailable | Valid metric definitions, denominators, history and aggregated APIs |
| Activity logs `/admin/activity` | Branch frontend | Event search/type/date filters/pagination and actor/target display | Durable authoritative audit events; none exists in active schema |
| Settings `/admin/settings` | Branch frontend; local theme supported | Light/dark preference, account display, capability-gated name update and read-only safe platform settings | Admin account/config APIs; no arbitrary environment/settings write contract |
| Profile `/admin/profile` | Branch frontend | Verified ADMIN identity/initials, theme, settings link and sign-out controls | Real ADMIN session/provisioning/scope/logout support |

Current backend rejects `scope=admin`, maps stored ADMIN to Student, and has no admin controllers, account suspension field, audit table or platform reporting layer. Do not create a pretend Admin session by changing browser state, granting public role input, or reusing restricted Student/Instructor endpoints.

Branch-only references (use Git, not local file links):

```powershell
git show feature/admin-dashboard:docs/admin-dashboard-implementation.md
git show feature/admin-dashboard:docs/admin-backend-requirements.md
git show feature/admin-dashboard:docs/admin-instant-navigation-fix.md
git ls-tree -r --name-only feature/admin-dashboard frontend/app/admin frontend/app/lib/admin
```

The report records 314 branch frontend tests and prior production checks, with real browser/live admin integration incomplete. These were not rerun on that branch during this review; the checked-out frontend has 280 tests. See [test evidence](PROJECT-STATUS.md#testing-status) and [future priorities](PROJECT-STATUS.md#future-development-priorities).
