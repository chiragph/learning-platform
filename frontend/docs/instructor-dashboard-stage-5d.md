# DECODE - Stage 5D: Workshop Builder and Local Demo Submissions

> **Historical stage report.** Current auth, account persistence, Instructor access and submission behavior may supersede this report. Use the [current frontend guide](../../docs/FRONTEND-GUIDE.md), [architecture](../../docs/PROJECT-ARCHITECTURE.md) and [status](../../docs/PROJECT-STATUS.md) for implementation work; retain this report for design rationale and dated validation.

Date: 26 October 2026

Branch: `feature/instructor-dashboard`

**Stage 5D is complete. Stop for manual review. Stage 5E has not been implemented.**

## Features delivered

The Workshop Builder extends the existing Course -> Module -> Activity hierarchy and instructor repository. It reuses the shell, animated logo, themes, UI components, date formatter, unsaved-navigation guard and the Lab Monaco field. Theory, Quiz and Lab editor behavior remains intact. No dependencies were added. The original catalog still contains only HTML, CSS and JavaScript, with all course/module/activity and student project/step identifiers preserved.

### Workshop library and editor

- `/instructor/workshops` lists the four original project activities and local workshops. It combines title search with course, module, activity-publication, working-draft and archive filters; displays course/module context, status, counts and updated dates; and links to Edit, Preview and the curriculum module. Changing course resets the module filter.
- `/instructor/workshops/[activityId]` edits title, learning objectives, description, estimated completion minutes, structured steps, requirements, deliverables, hints, optional HTTP(S) resources, submission instructions, accepted extensions, maximum per-file size guidance, evaluation criteria and instructor-only feedback guidance.
- Steps, requirements and deliverables support add, edit, duplicate, reorder and delete with confirmation. Duplicated entries get new stable IDs. Keyboard add/reorder focus, native dialogs, field labels and visible readiness messages reuse existing patterns.
- Existing project objectives, overview, ordered steps with original IDs and starter HTML/CSS/JavaScript import lazily without writes. The original student projects have no upload/submission policy: new requirements/deliverables/submission settings remain unconfigured until the instructor supplies them. Historical dates are not invented.
- Optional starter-file editing reuses one active-file Monaco instance, loaded only after Show Starter Files. Plain text fallback, themes, reduced motion and read-only archive inspection are inherited from the Lab field. Formatting, indentation and trailing newlines persist unchanged. The Workshop editor never executes this code.
- Explicit Save Draft, Control/Command S, last-saved/created timestamps, unsaved warnings, revision/timestamp conflict checks, visible quota errors and cancellable saved-draft reload follow the existing editors. No-op saves do not write or change dates/history.
- Readiness requires a meaningful title, complete objectives and description, at least one complete step/requirement/deliverable, valid optional links, estimated time of 1-10,080 minutes, submission instructions, at least one supported extension and 1-50 MB per-file guidance. Incomplete content remains saveable within format limits. Readiness never publishes or enables uploads.
- Limits: 50 entries per structured section, 30 objectives (1,000 characters each), 20 resources, 200 title characters, 10,000 per instruction/hint/evaluation field, 2,000 per resource URL and 100,000 per starter-code file. Supported guidance extensions: `.zip`, `.html`, `.css`, `.js`, `.json`, `.md`, `.txt`, `.pdf`, `.png`, `.jpg`, `.jpeg`, `.webp`. This is not server file validation.

### Student-style Workshop preview

Preview renders the current content, including unsaved changes, using existing typography/theme conventions. It shows objectives, project description, selectable ordered guide steps, requirements, deliverables, hints, safe resources, evaluation criteria, read-only starter files and submission guidance. Instructor feedback guidance is omitted.

Guide navigation, review marks and Restart are memory-only and never call student progress operations. Incomplete workshops remain inspectable but cannot mark steps reviewed. Authored text/code is escaped by React; invalid/credentialed/non-HTTP(S) resource links are disabled. No authored scripts execute in this preview.

The file chooser is disabled and clearly labeled DEMONSTRATION ONLY. Try Submission Demonstration displays a local message stating that nothing was selected or delivered. There is no FileReader, byte storage, upload call, real submission creation or working download. The demonstration also does not create a demo review record; that workflow is separate.

### Curriculum integration and original protection

- Creating any activity type, including Workshop, appends its unique ID in the chosen module and opens its editor after successful local persistence. Counts and ordering remain repository-derived.
- Workshop titles and activity menus provide Edit and Preview actions. Saved draft titles/readiness appear compactly in curriculum rows. Sidebar navigation includes Workshops and Submissions, with matching breadcrumbs and active states; existing Suspense boundaries and responsive navigation remain intact.
- Duplicate Workshop creates an adjacent unpublished local draft with a new activity ID and new content-entry IDs. It copies the saved working content, or compatible imported original, without inheriting a live progress reference, publication dates or previously-published flags. Copy provenance remains read-only source information. The original is unchanged; the local parent curriculum returns to Draft as with other structural changes.
- Existing course duplication also copies Workshop drafts to new activity IDs and rekeys all structured content. Move/reorder keeps associations by ID. Archive/restore preserves drafts. Permanent deletion remains restricted to eligible local never-published content, and cascades saved Workshop documents. Original seeded and previously-published content retains its protections.

### Local demo submissions management

- `/instructor/submissions` starts with an honest empty state and zero demo-derived counts. Load Local Demo Records explicitly generates up to four fictional examples from active workshops. New Local Demo can associate a fictional record with any active seeded or instructor-created workshop.
- Names, project titles and simulated submission dates are clearly labeled LOCAL DEMO. These records are not authenticated student submissions. Sample dates record when the local demo was generated, not historical student events.
- Overview counts show total local demos, pending review (pending + in-review), reviewed and changes-requested. Counts cover all local demos; course/workshop/status filters and search by fictional student or project control the matching list independently.
- Review details show fictional identity, workshop association, dates, a disabled illustrative file placeholder, current local evaluation/feedback guidance, a feedback editor and review-status controls. There are no real file bytes, object keys, URLs or downloadable files.
- Save Demo Review explicitly persists feedback/status locally. Final reviewed/changes-requested states require feedback. Revisions reject stale edits; unchanged saves are no-ops. Unsaved close/navigation warnings, visible save errors and cancellable conflict reload protect feedback. Returning to pending clears the current reviewed timestamp.
- Archived/deleted workshop associations do not erase fictional review records. Snapshot titles remain readable; unavailable workshop links are replaced with a clear message. Demo records never create real curriculum/progress dependencies or block eligible deletion.

## Data architecture and compatibility

Workshop documents use an optional version-1 `state.workshop.drafts` dictionary keyed by the existing activity ID. They contain no second course catalog. `workshop.save` and `workshop.duplicate` are strongly typed immutable repository commands with runtime validation, local persistence, recent-change entries and original-content protections.

The main storage key remains `decode-instructor-preview-v1`, with recovery at `decode-instructor-preview-recovery`. Root versions 1-4 load without automatic writes. A meaningful Workshop save/duplication writes root 4; later Lab/Quiz writes cannot downgrade it. Older Stage 5A-5C clients already reject unknown roots read-only, protecting the new command history and content from old recovery logic. Unsupported future roots/documents/stores remain untouched and read-only. Broken Workshop drafts recover independently after raw backup, preserving valid catalog/Theory/Quiz/Lab content; backup failures disable recovered writes.

Demo reviews intentionally use a separate repository and key: `decode-instructor-submissions-demo-v1` (version 1), recovery `decode-instructor-submissions-demo-recovery`. Initialization is read-only until an explicit demo creation/review action. Format validation requires a `local-demo` marker, prefixed demo ID, fictional-name field and a strict metadata-only shape. There is no student ID, email, file body, object key or download URL. Malformed records are isolated after raw backup; valid records survive. Future versions and unavailable storage are read-only. Quota and stale-tab failures never pretend to save.

Demo and real transport types are distinct in `submission-types.ts`. `ProjectSubmissionMetadata`, file metadata, upload/download ticket DTOs and the unimplemented `FutureSubmissionGateway` describe proposed Stage 5E contracts; no real adapter, request, API route or authorization is implemented. No automatic migration of fictional reviews into future authenticated data is appropriate.

## Routes and local review URLs

Use the existing development server at `http://127.0.0.1:3100`, or run `npm run dev -- --port 3100` in `frontend`.

| Route | URL |
| --- | --- |
| Workshop library (updated) | http://127.0.0.1:3100/instructor/workshops |
| Workshop editor (new dynamic route) | http://127.0.0.1:3100/instructor/workshops/project%3Aportfolio |
| Workshop preview | http://127.0.0.1:3100/instructor/workshops/project%3Aportfolio?preview=1 |
| JavaScript Workshop | http://127.0.0.1:3100/instructor/workshops/project%3Acalculator |
| Local demo submissions (new) | http://127.0.0.1:3100/instructor/submissions |
| Curriculum integration | http://127.0.0.1:3100/instructor/curriculum |
| Existing Theory regression | http://127.0.0.1:3100/instructor/theory/lesson%3Ahtml-introduction |
| Existing Quiz regression | http://127.0.0.1:3100/instructor/quizzes/quiz%3Ahtml |
| Existing Lab regression | http://127.0.0.1:3100/instructor/labs/exercise%3Ahtml-heading |

Dynamic URL segments are decoded exactly once at the existing Suspense-protected page boundary. Browser-local records load after hydration. Missing/deleted/wrong-type IDs show recovery navigation rather than creating replacements. The inherited instructor layout remains development-only: production builds, including localhost production servers, reject all instructor routes. Authentication/roles/cookies/sessions were not changed.

## Exact files created in Stage 5D

```text
frontend/app/lib/instructor/workshop-types.ts
frontend/app/lib/instructor/workshop.ts
frontend/app/lib/instructor/submission-types.ts
frontend/app/lib/instructor/submissions.ts
frontend/app/components/instructor/workshop-library.tsx
frontend/app/components/instructor/workshop-editor.tsx
frontend/app/components/instructor/workshop-entry-list.tsx
frontend/app/components/instructor/workshop-fields.tsx
frontend/app/components/instructor/workshop-preview.tsx
frontend/app/components/instructor/workshop.css
frontend/app/components/instructor/submissions-view.tsx
frontend/app/components/instructor/submissions.css
frontend/app/instructor/workshops/[activityId]/page.tsx
frontend/app/instructor/submissions/page.tsx
frontend/tests/instructor-workshop.test.mjs
frontend/tests/instructor-workshop-views.test.mjs
frontend/docs/instructor-dashboard-stage-5d.md
```

## Exact existing files modified in Stage 5D

```text
frontend/app/lib/instructor/types.ts
frontend/app/lib/instructor/repository.ts
frontend/app/lib/instructor/activity.ts
frontend/app/components/instructor/curriculum-form.tsx
frontend/app/components/instructor/curriculum-view.tsx
frontend/app/components/instructor/instructor-shell.tsx
frontend/app/instructor/workshops/page.tsx
frontend/tests/instructor-views.test.mjs
frontend/tests/instructor.test.mjs
frontend/tests/instructor-quiz.test.mjs
frontend/tests/instructor-lab.test.mjs
```

Existing tests update future-root fixtures from 4 to 5 and navigation expectations from nine to ten links, and replace the obsolete Workshop-editor-later message. Reviewed Theory/Quiz/Lab editor components, student sources, authentication, backend and lockfiles were not edited. The working tree already contained uncommitted Stage 5B/5C work; it was preserved.

## Automated validation

| Check | Result |
| --- | --- |
| `npm test` | **274 passed, 0 failed**: 239 existing regressions plus 35 Stage 5D tests (18 model/repository and 17 mounted UI/route tests) |
| `npm run lint` | Passed, no errors or warnings |
| `npx tsc --noEmit` | Passed |
| `npm run build` | Passed, 79 generated pages including Workshop editor and Submissions |
| Development HTTP smoke tests | Nine URLs returned 200 without blocking-route errors; Workshop IDs and preview parameters were correctly decoded |
| Production HTTP access tests | All 19 tested instructor URLs returned 404, including Workshop editor/preview/local ID and Submissions; temporary production server stopped |
| Git whitespace and changed/new-file scan | Passed across 70 working-tree files, including preserved pre-existing work |
| Scope/branch/index review | No protected source changes, branch unchanged and nothing staged |

The build retains the existing Next.js multiple-lockfile/workspace-root warnings. Configuration and lockfiles were not changed to suppress them. The existing development server at port 3100 remains running. Physical visual review is left to the checklist below.

The new tests exercise four original imports and stable IDs, original protection, incomplete/complete drafts, every structured-entry operation, code whitespace, timestamps/no-ops/revisions, root migration, independent recovery/future formats, course/activity duplication, move/archive/delete cascades, encoded/direct/refresh/missing routes, dirty navigation, errors/conflicts, safe rendering/resources, disabled file preview, guide isolation, curriculum creation/counts, demo listing/filtering/creation, review states/counts/dates, feedback refresh, metadata-only separation, quota/stale recovery and navigation/branding.

## Proposed Stage 5E data and storage architecture (not implemented)

### Proposed entities

| Entity | Required metadata and relationships |
| --- | --- |
| WorkshopVersion | Immutable published content/policy version; stable course/module/activity IDs; author/owner; publication history |
| ProjectSubmission | Server UUID; verified student ID; course/module/activity IDs; WorkshopVersion ID; attempt number; submitted/updated timestamps; review status; revision |
| SubmissionFile | Server UUID; submission ID; private object key (server-only); safe original display name; actual byte count; detected media type; checksum; scan state; retention/deletion metadata |
| SubmissionReview | Submission ID; verified instructor/reviewer ID; feedback; review status; reviewed/updated dates; revision/history; student visibility |

Store metadata in PostgreSQL, file bodies in private object storage, and credentials/object keys only on the server. Pin each attempt to a published WorkshopVersion so later instructor drafts do not silently change its rubric or submission policy. Keep immutable attempt/history records and enforce ownership/role/course access for every operation.

### Proposed API contracts

These describe future contracts only. The paths are illustrative and **do not exist in this implementation**. Final route names, database schema and storage provider require backend design.

| Operation | Proposed request | Proposed response / guarantees |
| --- | --- | --- |
| Initialize upload (`POST /submissions/uploads`) | Activity/version ID, intended filename/size/type, idempotency key; verified student session | Short-lived scoped upload ticket, file ID, expiry and authoritative policy; server derives student/course association and validates eligibility |
| Finalize attempt (`POST /submissions`) | Activity/version ID, completed upload ticket/file IDs, idempotency key | Submission metadata after verifying object existence, size/checksum and scan status; no browser-supplied ownership or review flags trusted |
| List own attempts (`GET /me/submissions`) | Pagination/filter cursor; verified student session | Only that student's attempts and visible feedback; safe file metadata |
| Instructor list/detail (`GET /instructor/submissions[/:id]`) | Course/workshop/status filters, search, pagination; verified instructor session | Only authorized owned/assigned courses, versioned content context, review metadata; no object keys or unrestricted file URLs |
| Save review (`PATCH /instructor/submissions/:id/review`) | Feedback, supported status, expected revision | Saved review/revision and server timestamps; stale updates return a conflict instead of overwriting |
| Authorized download (`POST /submissions/:id/files/:fileId/download`) | Verified session, submission/file identifiers | Short-lived private download ticket or authorized streamed attachment; checks owner/authorized instructor and clean scan state on every request |

Upload tickets must be bound to the verified student, permitted workshop version, file, size policy and expiry. Finalization must be idempotent and reject reused/foreign/expired tickets. Pagination and typed not-found/forbidden/validation/conflict errors are necessary; list endpoints must not leak other students' records.

### File and review security requirements

- Revalidate extension, detected content/media type, size, file count and archive contents on the server; never trust the browser accept attribute or declared MIME type. Apply decompression/resource limits and scanning/quarantine before a file becomes downloadable.
- Use generated private object keys, sanitized display filenames, restricted upload capabilities, encryption, retention/cleanup and audited access. Do not put file bytes, session tokens, permanent signed URLs or private object keys in browser-local storage.
- Serve potentially active HTML/JavaScript/SVG/archive content as downloads with safe attachment headers and isolated delivery; never inject submitted content into the application origin or instructor DOM. Downloads must be authorized and short-lived.
- Authenticate using the existing real session infrastructure and add genuine instructor role/course ownership enforcement in Stage 5E. Client navigation, demo markers and UI filters are not authorization. Students can access only their own files/feedback; instructors only permitted course submissions.
- Persist review history and expected-revision concurrency on the server. Define permitted review-state transitions, resubmissions, draft/public feedback visibility, retention and audit policies. Do not silently expose instructor-only rubric notes or feedback drafts to students.
- Replace the demo adapter with a separately authenticated API adapter and explicitly separate demo mode. Do not import fictional demo reviews into real student records or treat local readiness as publication. Existing student progress/content IDs must remain stable.

## Manual browser review checklist

- [ ] Inspect Workshop library/editor/preview and Submissions at desktop/tablet/mobile widths in both themes; check long text, control alignment, no page overflow, keyboard focus and reduced motion.
- [ ] Verify animated DECODE branding, sidebar collapse, mobile drawer, active Workshop/Submissions links and breadcrumbs survive navigation/refresh.
- [ ] Open all four original Workshops from library and curriculum. Compare original objectives, ordered step IDs/instructions and starter files with student projects; confirm submission policy is unconfigured and dates remain unknown.
- [ ] Search/filter by course/module/publication/working draft/archive, check empty results and curriculum links. Create a Workshop in a selected module; confirm editor opens and IDs/count/order/context survive refresh.
- [ ] Edit objectives, description, time and all guidance fields; add/duplicate/reorder/delete steps, requirements and deliverables, including Cancel. Try invalid links/file settings and save incomplete content before completing readiness.
- [ ] Open starter files, switch Monaco/Plain text and all languages, save and refresh; verify indentation/blank lines/trailing newlines, theme changes and read-only archive inspection.
- [ ] Preview unsaved content, navigate/review steps, restart and inspect requirements/resources/notes. Confirm instructor feedback guidance is hidden, unsafe links disabled and authored HTML/code remains text.
- [ ] Confirm the file chooser is disabled; Try Submission Demonstration must explicitly report no file delivery and create neither a real nor demo submission record.
- [ ] Exercise dirty navigation/unload, quota failures, no-op saves and conflicting tabs with Cancel/Confirm reload. Confirm originals/progress and other editor drafts remain unchanged.
- [ ] Duplicate a Workshop and a course containing saved Workshop drafts; verify fresh IDs, Draft status, ordering and copied content. Move/archive/restore/reorder and delete only eligible local copies; refresh and verify original protections remain.
- [ ] Open Submissions: zero records initially, clear LOCAL DEMO labels. Load fictional samples, verify derived counts, filters/search and simulated dates, then create a demo for a new local Workshop.
- [ ] Review a demo, edit feedback/status, save and refresh; verify reviewed/changes-requested require feedback, pending clears the current review date, counts update, and no feedback is delivered to a student.
- [ ] Test unsaved review close/unload, visible quota errors and two-tab stale review reload. Confirm the file placeholder has no functional download or file content.
- [ ] Archive/delete a local workshop with a fictional review and verify readable orphan metadata without a misleading editor link. Check unchanged authenticated student projects, quizzes, labs and Theory routes.
- [ ] Serve a production build locally and confirm Workshop, Submissions and all other instructor URLs return 404.

## Known limitations

- Physical browser visual/accessibility review remains pending. Mounted React/hydration tests and HTTP checks do not replace the checklist above; no real upload, delivery, grading, scan or download was tested because none exists.
- All content/reviews are development-only in one shared browser profile, not authenticated instructor/account-scoped persistence. Explicit saves are required. Storage quotas and near-simultaneous cross-tab writes remain browser-local constraints, not transactional API guarantees.
- The inherited unload/history guard depends on browser policies and may alter forward-history entries after cancelled traversal. Demo creation dialogs are metadata-only; closing an unsaved review asks before discarding feedback.
- Workshop preview is a reading/guide/submission demonstration, not the full student coding workspace or an automated assessment. Original starter files are preserved and editable but are not executed there.
- New fields absent from original published projects remain unconfigured; readiness intentionally requires local requirements/deliverables/submission guidance. Readiness does not prove a policy is safe for real uploads or publish to students.
- Up to 100 metadata-only demo reviews are supported; sample loading is explicit, produces at most four records and does not append duplicate samples when records already exist. No authenticated users, student data or actual files are imported.
- All backend, PostgreSQL/Prisma, real authorization, private file storage, safe downloads, student feedback delivery and publishing work above is deferred to Stage 5E. No Stage 5E implementation was started.

Backend, authentication/sessions, database, Prisma and Student Dashboard source/functionality were not modified. No staging, commits, pushes, merges or branch switches were performed; Git use was read-only inspection and whitespace checks.
