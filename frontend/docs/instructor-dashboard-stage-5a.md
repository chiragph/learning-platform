# DECODE — Stage 5A implementation report

> **Historical stage report.** Current auth, account persistence, Instructor access and submission behavior may supersede this report. Use the [current frontend guide](../../docs/FRONTEND-GUIDE.md), [architecture](../../docs/PROJECT-ARCHITECTURE.md) and [status](../../docs/PROJECT-STATUS.md) for implementation work; retain this report for design rationale and dated validation.

Date: 26 October 2026

Branch: `feature/instructor-dashboard`

Scope: instructor frontend foundation and local course/curriculum management.

## Implementation summary

Added an isolated instructor workspace using DECODE's existing typography, color tokens, wordmark, icons, and theme toggle. The student route group, authentication implementation, backend, database, and student curriculum/progress stores were not changed.

The initial instructor catalog is adapted directly from the existing student curriculum repository: **HTML, CSS, and JavaScript only**. This currently yields 9 modules and 38 activities: 25 Theory lessons, 3 Quizzes, 6 Labs, and 4 Workshops. Course, module, activity, and referenced content identifiers are preserved. These values are calculated from repository records in the UI.

The workspace is a development-only preview, with no signed-in instructor identity or instructor privileges. All nine instructor routes return HTTP 404 in a production build, including one served on localhost.

## Architecture and persistence

- `types.ts` adapts the student's `ActivityType` and `ContentReference` into instructor course, module, activity, publication, change-log, command, and repository contracts. Course IDs are strings so future instructor-created technologies do not require changing the student `Subject` union.
- `repository.ts` owns seeding, validation, counts, publication checks, immutable commands, and browser persistence. React components do not directly edit or write course records.
- `InstructorRepository` separates the snapshot/subscription/command contract from the local adapter. Future API integration must implement authenticated storage and publishing explicitly; the student repository remains its own adapter.
- Course → Module → Activity is the only curriculum hierarchy. Array positions define order. Seeded content references remain intact when records are renamed, reordered, moved, archived, or restored.
- New identifiers use `crypto.randomUUID()` with collision checks. Course identifiers are validated stable slugs, unique across active and archived records. Editing cannot change an identifier.
- Browser content is stored under `decode-instructor-preview-v1`, independent of student account storage. It is a shared development dataset for this browser profile, not an account-scoped instructor database.
- Records use schema version 1. Invalid/truncated snapshots recover to the source curriculum only after preserving the raw data under `decode-instructor-preview-recovery`. Recovery is disclosed in the UI. No recovered snapshot is automatically written over the original record.
- Unsupported schema versions remain untouched and read-only. A compatible future version or separate browser profile is required; unknown versions are not blindly migrated.
- Unavailable storage is read-only. Failed writes never update the visible snapshot as though saved. Storage events refresh other tabs; a stale snapshot is rejected before writing. Local storage is not a transactional multi-user system and near-simultaneous writes are not an API-level concurrency guarantee.
- Archive preserves records for restoration. A separate Delete action permanently removes eligible instructor-created drafts and their eligible draft descendants. Published/previously published records, original seeded IDs, and existing content references are protected, including archived descendants. Counts exclude archived and deleted records.
- Seeded creation, update and publication dates remain `null` until an actual supported action supplies a known date; unknown historical dates display “Unavailable”. New records and changes produce actual ISO timestamps and repository history.

## Routes created

| Route | Purpose |
| --- | --- |
| `/instructor` | Overview, derived statistics, course summary, local change history, attention queue, quick actions |
| `/instructor/courses` | Searchable course catalog; create, edit, duplicate, archive, restore, local publication state |
| `/instructor/curriculum` | Course selector, module hierarchy, activity records and ordering |
| `/instructor/theory` | Theory records with course/status/search filters |
| `/instructor/quizzes` | Quiz records with course/status/search filters |
| `/instructor/labs` | Lab records with course/status/search filters |
| `/instructor/workshops` | Workshop records with course/status/search filters |
| `/instructor/insights` | Explicit awaiting-integration state; no fabricated student analytics |
| `/instructor/settings` | Preview identity, appearance toggle, storage and access boundaries |

Curriculum links accept `?course=<id>&activity=<id>` to select the course and highlight an activity. Archived content links include `&archived=1` to reveal archived records.

## Functional features and deferred work

| Functional in Stage 5A | Deferred |
| --- | --- |
| Desktop sidebar collapse, mobile navigation dialog, breadcrumbs, active routes, profile disclosure, shared theme | Real instructor authentication and authorization |
| Course form with title, stable identifier, description, category, difficulty, duration, objectives, icon and color | Server persistence, account isolation, collaborative editing |
| Required-field/slug validation, duplicate prevention, immediate updates and persistence after refresh | Student-visible catalog integration and cross-device publication |
| Course metadata editing, duplication, archive/restore, guarded draft deletion, confirmed local publish/unpublish | Full Theory, Quiz, Lab, Workshop content editors |
| Module creation, rename/description editing, move up/down, archive/restore, guarded cascading deletion | New activity publication after detailed content validation |
| Typed draft activity creation, metadata editing, move up/down, move between modules, archive/restore, guarded draft deletion | Enrollment, performance, completion and student activity analytics |
| Search, status/course filters, creation/update date sorting; links back to curriculum | Instructor account profile editing |
| Repository-derived totals, attention checks, timestamp metadata and actual local changes | Export/import, server migrations and durable audit history |

Course metadata and curriculum edits return the local course to Draft. Local course publication is functional for courses with complete existing content references and published activities. Empty modules, empty courses, and new draft activities prevent publication and display a reason. Stage 5A does not provide a control that pretends to finish or publish new detailed activity content. Archiving a course retains its previous publication state for restoration.

All publication-changing course actions and archive actions use confirmation dialogs. New records are drafts. Native dialog modality, initial focus, focus restoration, Escape handling, labeled controls, native disclosure actions, and reduced-motion CSS are included. Menus use standard Tab navigation rather than claiming an incomplete ARIA menu implementation.

## Draft deletion update

Delete and Archive are separate actions in course, module, and activity three-dot menus, including archived records. Delete uses a red label and trash icon; its confirmation button uses the same destructive treatment. Confirmations focus Cancel, identify permanent browser-local removal, state “This cannot be undone”, and offer Archive as the reversible alternative. Course deletion explicitly includes all modules and draft activities; module deletion explicitly includes its draft activities. Both cascades include archived descendants.

Shared repository guards run both when displaying the menu and when executing the confirmed command. Original seeded course/module/activity IDs remain protected regardless of labels, archival state, movement, or changing a course back to Draft. Published and previously published items are protected. Activities with live content references, and containers holding protected descendants, are also protected to avoid potential student-progress dependencies. Older copies retaining those bindings/history remain protected. Newly duplicated drafts now retain source references only as copy provenance, with new record identifiers and no live publication/progress binding, so eligible new copies can be deleted. Protected Delete actions are disabled and explain “Use Archive instead.” Safe new drafts added to a formerly published course remain independently deletable.

Publication-history flags and module provenance/status fields are additive and compatible with existing version-1 snapshots. Older snapshots retain ID/reference/status checks; their legacy draft modules do not require resetting storage. Publication history is retained when editing or unpublishing. Neither archiving nor unpublishing removes dependency protection. No backend progress lookup is attempted in this frontend-only stage.

Confirmed deletion removes the actual record/subtree through the existing immutable repository transaction, persists the new snapshot, then notifies subscribers. Counts update immediately and removed local records are not reseeded on refresh. Storage failures keep the record and confirmation visible with an error. Stale-tab writes are rejected. Course deletion remains in local change history as text without a navigation link to the removed course.

Files changed for this update:

```text
frontend/app/lib/instructor/types.ts
frontend/app/lib/instructor/repository.ts
frontend/app/components/instructor/ui.tsx
frontend/app/components/instructor/courses-view.tsx
frontend/app/components/instructor/curriculum-view.tsx
frontend/app/components/instructor/overview-view.tsx
frontend/app/components/instructor/instructor.css
frontend/tests/instructor.test.mjs
frontend/tests/instructor-views.test.mjs
frontend/docs/instructor-dashboard-stage-5a.md
```

## Timestamp and sorting update

Courses, modules and activities now have explicit `createdAt` and `updatedAt` fields (`string | null`); courses and activities also have `publishedAt`. All newly recorded timestamps are canonical ISO 8601 UTC strings. `null` means the historical date is unknown, never the current time. Version-1 snapshots migrate additively in memory: missing fields become `null`, known dates are preserved, and known ISO offsets are normalized to the same UTC instant. Reading storage does not write a fabricated history back to it. Existing identifiers, content references, deletion protections and student records remain unchanged.

Timestamp rules:

| Action | Timestamp behavior |
| --- | --- |
| Create course/module/activity | Set Created and Last updated to the same operation instant; new course/activity publication date is unknown/not yet published |
| Edit metadata | Preserve Created and Last published; update the edited record and its containing module/course |
| Reorder | Update both swapped records and their containing module/course; preserve creation/publication dates |
| Move activity | Update the moved activity, source and destination modules, and containing course |
| Publish course | On an actual transition to Published, record the latest `publishedAt` and `updatedAt`; update module timestamps if their publication status changes |
| Unpublish course | Update `updatedAt` and history; retain the previous `publishedAt` as Last published |
| Reapply the same publication state | No timestamp or history change |
| Duplicate course | Give every new copied record its own Created/Last updated date; clear copied publication dates; preserve source records and references |
| Archive/restore/delete | Update affected surviving parent records and local history without rewriting their creation/publication dates |

Course publication changes the local course container. Existing published activity records are not newly published by that action, so their unknown historical publication dates stay unknown. Stage 5A still has no detailed activity editor or individual activity publication control; activity `publishedAt` is preserved/displayed when known and remains `null` when unknown. No publication date is manufactured for seeded content or copied from a different record. Published timestamps also count as evidence for existing permanent-deletion protections.

My Courses retains Catalog order and adds **Newest Created**, **Oldest Created**, and **Recently Updated**. Date sorting is non-mutating, stable for ties, and always puts unknown dates last. Search and status filters compose with sorting. Course cards show two compact date rows; View course details and Edit course include creation/update/last-publication metadata. Module/activity menus and details show their dates without adding timestamp columns to curriculum rows. Metadata is read-only. Content lists and the Overview summary label their last-update date.

All management dates use one formatter: `26 Oct 2026, 2:35 PM`, resolved in the instructor browser's local timezone. The exact ISO value stays in the semantic `time` element and the timezone is available in its tooltip. Unknown historical dates show **Unavailable**; a never-published local draft shows **Not published**. Recent Changes remains compact and now stores structured action/affected-record metadata alongside its readable action/title and ISO event time. It displays the latest six entries by event date, retaining older legacy entries without inventing metadata.

Files added/updated for this request:

```text
frontend/app/lib/instructor/types.ts
frontend/app/lib/instructor/repository.ts
frontend/app/lib/instructor/dates.ts (new)
frontend/app/components/instructor/ui.tsx
frontend/app/components/instructor/course-form.tsx
frontend/app/components/instructor/courses-view.tsx
frontend/app/components/instructor/curriculum-form.tsx
frontend/app/components/instructor/curriculum-view.tsx
frontend/app/components/instructor/overview-view.tsx
frontend/app/components/instructor/content-view.tsx
frontend/app/components/instructor/instructor.css
frontend/tests/instructor.test.mjs
frontend/tests/instructor-views.test.mjs
frontend/docs/instructor-dashboard-stage-5a.md
```

## Duplication and animated logo refinement

Duplicating a course now explicitly constructs a new local Draft course with new module/activity identifiers, preserving copied titles, descriptions, type, duration, objectives, styling, activity minutes, ordering, and child archival states. Every copied module and activity is also Draft. All inherited `hasBeenPublished` flags are cleared, course/activity `publishedAt` values are `null`, and creation/update dates describe the new records. The source course, original IDs, source content, and student records are untouched. No copied records are published automatically.

A new activity's `copiedFrom` contains the source activity ID and source content reference when available. It is provenance for a future editor, not a live student-content/progress association. The new record does not carry `reference`. This keeps source content identifiable without triggering dependency protection for an independently identified, never-published local draft. Copies of copies retain the content origin as well. `duplication` records the source course and copy format version. These fields are additive to version 1; no migration silently resets old status/history. Genuine publication evidence and seeded IDs still block deletion even if copy metadata exists. Detailed editing/publication of new draft activities remains deferred to Stage 5B.

Safe recovery for already-created copies:

1. Open the older protected local course's three-dot menu in My Courses. Choose **Create clean draft copy**.
2. Review the confirmation. Cancel leaves the saved dataset unchanged. Confirm creates a separately identified unpublished Draft course and curriculum, with no inherited publication history.
3. The older course is retained with its original status, timestamps, flags, references, and deletion protections. Archive it separately if it is no longer needed. Archive/Restore retains its existing behavior.
4. The fresh copy can be edited, archived/restored, or permanently deleted while it remains an eligible unpublished local draft. Its IDs and Draft state survive refresh; confirmed deletion also survives refresh.

Recovery is offered for protected local records without the new copy marker. It does not infer publication safety from a “copy” title or the absence of entries in the bounded change log. Even a legacy copy that currently shows Published is never silently converted or unlocked. A record with genuine or uncertain publication history can always be retained/archived and used as the source for a fresh draft, rather than erasing that evidence.

The instructor sidebar now renders the existing shared `Wordmark` with its animation enabled, matching the Student Dashboard. Its link reuses `decode-logo-link` feedback from the main interface. The shared stylesheet supplies the same seven-second glyph/bracket animation, easing, colors, and motion rules; no animation code was copied and no additional dashboard animation was added. The instructor's existing 150 × 32 size, alignment, padding, collapse behavior and `/instructor` destination are retained. Theme colors still use `currentColor`/DECODE tokens. Existing shared reduced-motion rules keep letters visible and static, while instructor reduced-motion rules suppress animation. Declarative markup works after navigation and refresh without a separate animation timer.

Files changed for these refinements:

```text
frontend/app/lib/instructor/types.ts
frontend/app/lib/instructor/repository.ts
frontend/app/components/instructor/courses-view.tsx
frontend/app/components/instructor/instructor-shell.tsx
frontend/tests/instructor.test.mjs
frontend/tests/instructor-views.test.mjs
frontend/docs/instructor-dashboard-stage-5a.md
```

## Exact files added

No existing application source or configuration file was intentionally changed. No dependencies were added.

```text
frontend/app/lib/instructor/access.ts
frontend/app/lib/instructor/types.ts
frontend/app/lib/instructor/repository.ts
frontend/app/lib/instructor/dates.ts
frontend/app/components/instructor/instructor-provider.tsx
frontend/app/components/instructor/instructor-shell.tsx
frontend/app/components/instructor/instructor.css
frontend/app/components/instructor/ui.tsx
frontend/app/components/instructor/course-form.tsx
frontend/app/components/instructor/courses-view.tsx
frontend/app/components/instructor/overview-view.tsx
frontend/app/components/instructor/curriculum-form.tsx
frontend/app/components/instructor/curriculum-view.tsx
frontend/app/components/instructor/content-view.tsx
frontend/app/instructor/layout.tsx
frontend/app/instructor/page.tsx
frontend/app/instructor/courses/page.tsx
frontend/app/instructor/curriculum/page.tsx
frontend/app/instructor/theory/page.tsx
frontend/app/instructor/quizzes/page.tsx
frontend/app/instructor/labs/page.tsx
frontend/app/instructor/workshops/page.tsx
frontend/app/instructor/insights/page.tsx
frontend/app/instructor/settings/page.tsx
frontend/tests/instructor.test.mjs
frontend/tests/instructor-views.test.mjs
frontend/docs/instructor-dashboard-stage-5a.md
```

## Validation results

Commands run from `frontend/` unless stated otherwise.

| Check | Result |
| --- | --- |
| `npm run lint` | Passed, no warnings/errors |
| `npx tsc --noEmit` | Passed |
| `npm test` | **134 passed, 0 failed**; includes 48 instructor tests and all existing student/auth/editor regressions |
| `npm run build` | Passed, 74 static pages generated; existing student routes retained |
| Production HTTP smoke check | All 9 instructor routes returned **404** on `127.0.0.1:3101`; `/` returned **200** |
| Development HTTP smoke check | All 9 instructor routes returned **200** on `127.0.0.1:3100` |
| `git diff --check` and added-file trailing-whitespace scan | Passed |

New tests exercise actual repository operations and mounted React views: course creation/editing, duplicate validation, publication confirmation/cancellation, module and activity management, all activity types, archive/restore, ordering, moving seeded activities, stable identifiers/references, provider remount persistence, filters, counts, change-state isolation, malformed/future storage, blocked/quota storage, stale-tab rejection, development-only access, real server-layout production rejection, navigation/drawer/Escape/focus behavior, and existing student route independence.

The deletion update adds 11 regression tests: direct deletion at every hierarchy level; cascading active/archived descendants; count changes; protection of every seeded item after unpublishing/movement; publication-history/reference protection; legacy snapshot compatibility; persistence after repository/provider remounts; Cancel/Escape; separate Archive/Delete actions and trash icons; disabled protected controls with reasons; deleted-course history links; and failed/stale writes that retain saved content.

The timestamp update adds 12 regression tests for creation/editing/reorder/move/archive timestamps, publication transitions, unknown seed dates, legacy migration without backfilling, duplication dates, ISO persistence, malformed date rejection, immutable metadata, stable date sorting, local timezone formatting and day boundaries, course details, activity/module menu metadata, and chronologically ordered Recent Changes.

These refinements add 8 regression tests covering whole-hierarchy Draft/reset behavior, content/order preservation, distinct IDs, duplicate → Draft → Delete and refresh persistence, copies of copies, legacy Draft/Published recovery with and without known history, publication/dependency protections, unchanged Archive/Restore, recovery cancellation, source/student isolation, and shared animated SVG persistence through navigation/theme changes/remount. Existing dependency tests now explicitly distinguish live references from copy provenance.

JSDOM stubs the native dialog top layer. It cannot verify actual browser focus trapping, CSS, animation, responsive layout, or visual contrast. Browser automation was stopped with the physical Escape key before the instructor pages were visually inspected, so **visual review remains pending**. No browser screenshots or visual pass are claimed.

Next.js emitted its existing multiple-lockfile/workspace-root warning during dev/build/start. The build succeeded; configuration and lockfiles were left unchanged.

An initial Next.js development segment-validation diagnostic was resolved by rendering child routes inside the provider's server loading state while keeping seed content hidden until browser storage is ready. A server-render regression test covers this boundary; the development HTTP checks no longer emitted the diagnostic.

## Safe development preview instructions

From PowerShell:

```powershell
Set-Location C:\learning-platform\learning-platform\frontend
npm run dev -- --hostname 127.0.0.1 --port 3100
```

Open `http://127.0.0.1:3100/instructor`. A login or backend server is not required for this explicitly labeled development UI preview. Use a local development environment; this is not an instructor account and grants no role or backend access.

Only `NODE_ENV === "development"` enables the preview. There is no query-string, browser-storage, cookie, or role override. `npm run build` followed by `npm run start` blocks it even on localhost. Do not set `NODE_ENV=development` to run a production deployment. Existing student routes retain their normal real-session checks.

Use the same origin and browser profile to retain local courses. Different ports/hosts and private browser sessions have separate storage. Clearing site data removes instructor-local changes. Do not use genuine student information in this development dataset.

## Manual browser review checklist

- [ ] Review Overview and My Courses at desktop, tablet and approximately 390px mobile width. Check wrapping, card density, sidebar/header alignment and horizontal overflow.
- [ ] Collapse/expand the desktop sidebar. Confirm icon labels/tooltips, breadcrumbs, current-page indicators and all nine destinations.
- [ ] Open the mobile drawer; test navigation, Escape, backdrop dismissal and keyboard focus restoration. Resize to desktop with the drawer open.
- [ ] Review light and dark themes, focus visibility, contrast and the reduced-motion preference.
- [ ] Create a course with complete metadata, verify it is Draft, reload, then edit it. Try a blank/invalid title, invalid slug, duplicate `html`, and an archived duplicate identifier.
- [ ] Check Created and Last updated on course cards and View course details. Edit a course and confirm Created stays fixed while Last updated changes. Check Last published after publish/unpublish; a repeated request for the same publication state must not change its date.
- [ ] Try Newest Created, Oldest Created and Recently Updated with search and status filters. Unknown dates must remain last in every date sort; ties must retain catalog order. Sorting must not change saved curriculum order.
- [ ] Inspect activity/module menu dates and details dialogs. Seed historical dates must be Unavailable; new drafts must show their real creation/update times and Not published. Curriculum title rows should not gain date columns.
- [ ] Verify Recent Changes includes affected content, action and a date/time such as `26 Oct 2026, 2:35 PM`. Check local timezone conversion, refresh persistence, and dates around midnight.
- [ ] Search/filter courses. Duplicate a seeded course and confirm the original is unchanged. Archive/restore with confirmation and inspect the archive filter.
- [ ] Duplicate a published seeded course. Verify the course, modules and activities are Draft with new stable IDs and no publication dates/history; reload, then permanently delete the copy and reload again. Original courses and student data must remain unchanged.
- [ ] For an older protected local copy, use Create clean draft copy. Cancel first, then confirm; check the new copy is deletable and the older record retains all publication evidence. Archive/restore the older record independently.
- [ ] Unpublish and republish a seeded course locally, including Cancel. Confirm the UI explains the browser-local scope. Verify an empty or draft-content course cannot publish.
- [ ] Select each seeded course in Curriculum Builder. Verify original module/activity titles, order and all four activity types.
- [ ] Add/rename/describe modules; move them up/down; confirm boundary actions disable correctly. Archive/restore a module and verify its activities survive.
- [ ] Create each draft activity type, edit metadata, reorder it, move it to another module, archive/restore it. Confirm no full editor or pretend content-publication action appears.
- [ ] Create a draft course with draft modules/activities. Check separate red Delete and Archive actions and trash icons. Cancel each Delete dialog and verify content is unchanged; then confirm deletion, check cascading counts, and refresh to verify removed records stay absent.
- [ ] Verify course deletion warns that modules and draft activities will also be deleted, and module deletion warns that draft activities will also be deleted. Check “cannot be undone”, Cancel focus, Escape/backdrop dismissal, and the red confirmation button in both themes.
- [ ] Verify Delete is disabled for all seeded courses/curriculum, published or previously published records, older copies retaining live references/history, and containers with protected archived descendants. Archive must remain available. New unpublished copies using provenance-only source references must remain deletable.
- [ ] Review the sidebar logo's shared animation and link feedback after navigation/refresh in light/dark themes and collapsed/expanded states. With reduced motion enabled, verify a complete static logo remains visible. Size and alignment must remain unchanged.
- [ ] Expand/collapse modules and check menus near the bottom of the viewport for clipping. Use Tab/Enter/Space/Escape throughout.
- [ ] Filter each content page by course, status and search. Follow curriculum links, including archived records, and verify the highlighted activity.
- [ ] Inspect Insights and Settings: no invented analytics, instructor identity, student access or synchronization claims.
- [ ] Open two development tabs and verify refresh/conflict messaging. Test blocked storage, storage quota failures, malformed records and unsupported schema versions in a disposable browser profile.
- [ ] Verify real browser dialog focus trapping and restoration, long content, touch targets, mobile form keyboards and zoom to 200%.
- [ ] Confirm authenticated Student Dashboard, learning routes, Monaco workspaces, progress and theme behavior remain normal. Instructor edits must not change student curriculum or progress.
- [ ] Repeat the production-localhost route check: every `/instructor` route must return 404 while `/` and normal student authentication behavior remain available.

## Known limitations and handoff

This stage intentionally stops before Stage 5B. All new content is browser-local and can be lost when site storage is cleared. It is not a secure instructor datastore or publishing service. Local publication states do not synchronize to students, accounts, or other devices. New activity bodies and assessments are not editable or publishable yet. Analytics are unavailable. Native browser rendering and accessibility require the visual checklist above.

No branch switch, staging, commit, push, merge, backend change, database change, Prisma change, authentication change, or student-source edit was performed.
