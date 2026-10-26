# DECODE - Stage 5C: Quiz Builder and Coding Lab Editor

Date: 26 October 2026

Branch: `feature/instructor-dashboard`

**Stage 5C-1, 5C-2 and 5C-3 are complete. Stop for manual review; Stage 5D has not started.**

## Implementation summary

The reviewed Quiz Builder remains intact. Stage 5C now includes a Coding Labs library, dedicated Lab Editor, deterministic validation builder, isolated student-style execution preview, and curriculum integration for Theory, Quiz and Lab activities. These extend the existing instructor development preview, repository, hierarchy, shell, animated DECODE logo, themes, dialogs, date formatter and navigation guard. No dependencies were added.

The initial catalog still contains exactly HTML, CSS and JavaScript, with the same 9 modules and 38 activities (25 Theory, 3 Quiz, 6 Lab, 4 Workshop). Existing identifiers, relationships, student content and progress are unchanged. Instructor-created courses can contain new labs without adding seeded courses.

## Completed Quiz Builder (Stage 5C-1)

- Library search plus course, module, activity-status, working-draft and archive filters. Course changes reset the module filter. Context, question/point totals, readiness and timestamps come from repository records.
- Dedicated Quiz editor with title, instructions, optional topics/explanations, explicit Save Draft, save feedback, dates, unsaved-change protection, Control/Command S, revision conflict handling and cancellable saved-draft reload.
- Add, edit, duplicate, delete with confirmation and reorder questions. Each question supports 2-6 distinct options, exactly one correct answer and 1-1,000 whole-number points. Duplication allocates new question/option IDs and remaps the correct answer.
- Incomplete drafts remain saveable. Readiness requires meaningful title/instructions and valid questions, options, answer and points. Readiness never publishes content.
- Isolated preview supports answers, navigation, submission, weighted score, correct-answer/explanation review and Restart. Incomplete quizzes can be inspected but not scored. Attempts live only in component memory.
- Three original quizzes import existing student questions lazily with original IDs, ordering, correct answers, explanations and neutral instructions. Published originals remain unchanged while working drafts are edited.

No Quiz editor, question-card, preview or stylesheet behavior was changed during Stage 5C-2/5C-3. Optional question-card collapsing was omitted to preserve the manually reviewed experience.

## Completed Coding Labs (Stage 5C-2)

### Library and editor

- `/instructor/labs` lists the six seeded Lab activities once plus local labs across all courses. It combines title search with course, module, draft/published, saved-working-draft and archive filters; includes context, counts, dates, Edit/Preview links, curriculum links and empty states.
- `/instructor/labs/[activityId]` edits title, learning objective, task instructions, optional hints, three starter-code files, ordered validation checks, test widths and optional solution/expected-output reference.
- One dynamically loaded Monaco editor is mounted for the active HTML/CSS/JavaScript file. It reuses the student Monaco runtime/local workers, owns its model and lifecycle, follows light/dark themes, respects reduced motion and supports keyboard Tab focus mode. A Plain text switch provides an accessible fallback. Starter formatting, indentation and multiline content are not trimmed or normalized.
- Save Draft, last-saved/created dates, explicit unsaved state, Control/Command S, navigation/unload warnings, quota feedback, timestamp/revision conflict detection and cancellable reload follow Theory/Quiz behavior. Unchanged saves do not write, change dates, or increment revisions.
- Archived or unsupported legacy records remain read-only. Missing/deleted/wrong-type activities show recovery navigation and never recreate records.

### Structured validation builder

Checks have stable IDs and descriptions and can be added, edited, reordered, and removed with a cancellable confirmation. Supported types:

| Type | Configuration |
| --- | --- |
| Element count | Selector, minimum count, optional maximum |
| Element text | Selector, exact/contains comparison, expected text |
| Attribute value | Selector, attribute name, expected value |
| Computed CSS value | Selector, CSS property, expected browser-computed value |
| Text after a click | Click selector, target text selector, expected immediate text |
| No JavaScript errors | Trusted runtime error observer |
| Existing DECODE task check | Allowlisted original lab and requirement |

The six originals import their complete existing student requirements and viewport widths. Existing task checks reuse the unchanged student `evaluateLab` validator, including responsive CSS geometry and repeated JavaScript interactions. A task group is evaluated once per viewport, preserving its original interaction sequence even when individual imported requirements are reordered.

New selectors deliberately support a small deterministic subset: tags, IDs, classes, attribute existence/exact values, descendants and direct children. Attribute values cannot contain whitespace or `>`. CSS pseudos, sibling/comma selectors, arbitrary regex and JavaScript validator functions are not supported. Selector parsing is bounded and avoids nested whitespace backtracking.

Readiness requires a meaningful title, objective, instructions, at least one valid described check, at least one selected 320px/800px viewport, and supported format/size limits. Incomplete configurations remain draft-saveable. Limits: 50 checks, 200 title characters, 100,000 per code/reference field, 10,000 per objective/instruction/hint field, 500 per description, 200 per selector and 2,000 per expected value. Counts are whole numbers from 0 to 1,000.

### Isolated student-style preview

- Uses the current editor content, including unsaved changes, with readable instructions, objective, optional hints and requirements.
- Owns a separate editable copy of HTML/CSS/JavaScript. Run Code produces sandboxed output; Check Solution runs fresh fixed-width probes for every selected width; results show each requirement, per-width feedback and completion summary. Reset Code has confirmation and restores only the preview copy.
- Incomplete drafts allow code inspection/execution but cannot run checks or grant preview completion. JavaScript errors block completion even if every configured DOM check passes; errors raised during later interaction checks also update runtime results.
- Uses the existing student preview document builder and its CSP, HTML filtering, script isolation and navigation controls. Every output/probe iframe has `sandbox="allow-scripts"`, no same-origin permission, no-referrer policy and restricted device permissions. Network connections, nested frames, workers and forms are disabled by CSP; no online-image option is enabled.
- Trusted check functions are serialized into the opaque iframe, not evaluated in the parent application. Instructor-authored JavaScript runs only inside that sandbox. No `eval` or authored JavaScript validator is introduced.
- Result delivery checks the exact iframe WindowProxy, per-run/per-width token, channel, result type, ordered check IDs, booleans and runtime state. Cancelled/stale/duplicate/foreign results are ignored; a seven-second timeout grants no completion. Editing code invalidates previous results and cancels obsolete probes.
- Preview code, answers, results and completion are memory-only. They never save starter code, alter original content, update student progress, or claim publication. The optional solution reference is instructor-only and is never executed.

## Curriculum integration and repository (Stage 5C-3)

- Creating a Theory, Quiz or Lab activity persists its unique stable ID at the end of the selected module, updates counts, closes the dialog and opens its matching editor. Workshop records retain existing behavior; no Workshop editor was added.
- Activity titles and three-dot menus expose the matching Edit and Preview routes. Saved working-draft titles/readiness appear compactly in Curriculum Builder. Activity publication status remains separate from working-draft readiness.
- Course/module/activity order and context remain repository-owned. Moving an activity retains its content by ID; archiving/restoring retains drafts. Existing deletion guards continue to protect seeded/previously published content and potential progress dependencies.
- Course duplication creates unpublished/deletable local draft records with fresh course/module/activity IDs, keeps provenance/order/content, and copies saved Lab documents with fresh check IDs, dates and revisions. Eligible activity/module/course deletion cascades associated saved Lab content; refresh cannot resurrect deleted drafts.
- Lab saves and curriculum renames synchronize titles/dates only for never-published local draft activities. Saving an original creates an independent working draft; the entire original course/module/activity snapshot, live reference, dates, flags and student sources remain unchanged.
- Drafts live in optional version-1 `state.theory`, `state.quiz` and `state.lab` dictionaries keyed by the existing activity ID. Documents do not embed another course catalog. Lab commands use the existing provider/repository interface with runtime validation and expected timestamp/revision checks.
- The storage keys remain `decode-instructor-preview-v1` and `decode-instructor-preview-recovery`. Root formats 1, 2 and 3 are readable: legacy records are not automatically rewritten, a real Quiz save crosses to root 2, and a real Lab save crosses to root 3. Later writes never downgrade a lab-bearing snapshot. Older Stage 5A/5B/5C-1 readers reject unsupported roots read-only, protecting new Lab content/history from destructive recovery by old code.
- Malformed extensions recover independently after raw-data backup, preserving valid catalog/Theory/Quiz/Lab records. Unsupported root/store/document formats remain untouched and read-only; failed recovery backups disable editing. Failed writes preserve the previous visible snapshot and open edits.
- Dynamic editor pages await/decode URL parameters exactly once behind Suspense. The existing narrow pathname Suspense boundaries remain intact. Encoded IDs work from library/curriculum, direct navigation and refresh.

**Ready for Publication is readiness only.** Existing local course controls do not publish working drafts or deliver content to students. Actual publication belongs to Stage 5E.

## Files created in Stage 5C

```text
frontend/app/lib/instructor/activity.ts
frontend/app/lib/instructor/content-storage.ts
frontend/app/lib/instructor/quiz-types.ts
frontend/app/lib/instructor/quiz.ts
frontend/app/lib/instructor/lab-types.ts
frontend/app/lib/instructor/lab.ts
frontend/app/lib/instructor/lab-preview.ts
frontend/app/components/instructor/quiz-library.tsx
frontend/app/components/instructor/quiz-editor.tsx
frontend/app/components/instructor/quiz-question-fields.tsx
frontend/app/components/instructor/quiz-preview.tsx
frontend/app/components/instructor/quiz.css
frontend/app/components/instructor/lab-library.tsx
frontend/app/components/instructor/lab-editor.tsx
frontend/app/components/instructor/lab-check-fields.tsx
frontend/app/components/instructor/lab-code-field.tsx
frontend/app/components/instructor/lab-code-editor.tsx
frontend/app/components/instructor/lab-preview.tsx
frontend/app/components/instructor/lab.css
frontend/app/instructor/quizzes/[activityId]/page.tsx
frontend/app/instructor/labs/[activityId]/page.tsx
frontend/tests/instructor-quiz.test.mjs
frontend/tests/instructor-quiz-views.test.mjs
frontend/tests/instructor-lab.test.mjs
frontend/tests/instructor-lab-views.test.mjs
frontend/docs/instructor-dashboard-stage-5c.md
```

## Existing files modified in Stage 5C

```text
frontend/app/lib/instructor/types.ts
frontend/app/lib/instructor/repository.ts
frontend/app/lib/instructor/theory.ts
frontend/app/lib/instructor/theory-navigation.ts
frontend/app/components/instructor/curriculum-form.tsx
frontend/app/components/instructor/curriculum-view.tsx
frontend/app/components/instructor/instructor-shell.tsx
frontend/app/components/instructor/theory-editor.tsx
frontend/app/components/instructor/ui.tsx
frontend/app/instructor/quizzes/page.tsx
frontend/app/instructor/labs/page.tsx
frontend/tests/instructor-views.test.mjs
frontend/tests/instructor.test.mjs
frontend/tests/instructor-theory.test.mjs
frontend/tests/instructor-theory-views.test.mjs
```

This completion session created the Lab files/tests/route above and changed only `activity.ts`, `types.ts`, `repository.ts`, `curriculum-form.tsx`, `curriculum-view.tsx`, `instructor-shell.tsx`, the Labs library page, this report, and the future-root/publication-message assertions in the existing instructor/Quiz repository tests. The working tree already contained uncommitted Stage 5B/5C-1 work; it was preserved.

## Routes and development URLs

Use the existing development server at `http://127.0.0.1:3100`, or run `npm run dev -- --port 3100` from `frontend`.

| Route | Local URL |
| --- | --- |
| Coding Labs library | http://127.0.0.1:3100/instructor/labs |
| HTML lab editor | http://127.0.0.1:3100/instructor/labs/exercise%3Ahtml-heading |
| HTML lab preview | http://127.0.0.1:3100/instructor/labs/exercise%3Ahtml-heading?preview=1 |
| Responsive CSS lab | http://127.0.0.1:3100/instructor/labs/exercise%3Acss-card |
| JavaScript lab | http://127.0.0.1:3100/instructor/labs/exercise%3Ajavascript-button |
| Curriculum Builder | http://127.0.0.1:3100/instructor/curriculum |
| Quiz library | http://127.0.0.1:3100/instructor/quizzes |
| Existing Quiz editor | http://127.0.0.1:3100/instructor/quizzes/quiz%3Ahtml |
| Existing Theory editor | http://127.0.0.1:3100/instructor/theory/lesson%3Ahtml-introduction |

The only new route in this completion session is `/instructor/labs/[activityId]` (including `?preview=1`). `/instructor/labs` now uses the Lab library. Quiz routes were added in 5C-1; Theory and other instructor routes remain available. Instructor access is still development-only. Production builds, including localhost production servers, return 404; no role, cookie, session or authorization policy changed.

## Automated validation

| Check | Result |
| --- | --- |
| `npm test` | **239 passed, 0 failed** (201 existing tests plus 38 Lab/integration regressions: 20 model/sandbox and 18 mounted UI tests) |
| `npm run lint` | Passed, no errors or warnings |
| `npx tsc --noEmit` | Passed |
| `npm run build` | Passed, 77 generated pages including the new Lab editor |
| Development HTTP smoke checks | Eight URLs returned 200 without blocking-route/error markers; encoded Lab props and Preview mode decoded correctly |
| Production access smoke checks | All 16 tested instructor library/editor/preview/settings URLs returned 404 on a temporary localhost production server; server stopped |
| `git diff --check` and changed/new-file whitespace scan | Passed, 52 working-tree files checked including pre-existing work |
| Scope and Git checks | Branch unchanged, index empty, no protected source changes |

The production build retains the existing Next.js workspace-root/multiple-lockfile warnings. No configuration or lockfile was changed to suppress them. The user-owned development server at port 3100 was reused and remains running. No physical browser visual review is claimed.

Two older tests asserted publication copy mentioning Stage 5B; those assertions now match the current Stage 5E boundary. Future-root fixtures now use version 4 because root 3 is the supported Lab format. The final full suite passes after these updates.

Tests cover original imports, creation/editing, check CRUD/order, starter whitespace, readiness/incomplete saves, timestamps/no-ops/revisions, refresh, root migration, corrupt/future formats, quota/conflicts, published-original protection, duplication/deletion cascades, encoded/missing/deleted IDs, all three curriculum creation entry points, library filters/links, hydration, unsaved navigation, external reload, Monaco ownership/themes, safe text, real sandbox result delivery, fixed widths, cancellation/late results, runtime gating, strict message schemas and production minification. Existing Theory, Quiz, student, lab and authentication tests remain in the full suite.

## Manual browser review checklist

- [ ] Review library/editor/preview at desktop, tablet and phone widths, both themes and reduced motion. Check wrapping, aligned controls, no page overflow and readable Monaco contrast.
- [ ] Check animated logo, collapsed/sidebar navigation, mobile drawer, Lab breadcrumb/active indicator, keyboard focus and dialog Cancel/Escape behavior.
- [ ] Search/filter all six originals and a new local lab. Confirm course changes reset module filters, dates remain unknown for unsaved originals, and empty/archive states are clear.
- [ ] Open seeded HTML, CSS and JavaScript labs from both library and curriculum. Verify objective/instructions/starter code and all original requirements, including 320px/800px responsive checks.
- [ ] Create Theory, Quiz and Lab activities in a selected module. Confirm editor opens, stable ID/count/order/context survive refresh, and Workshop still creates only a record.
- [ ] Edit all three starter files in Monaco and Plain text; retain indentation, blank lines and trailing newlines through Save Draft and refresh. Check light/dark themes and tab focus mode.
- [ ] Add/configure/reorder/delete checks, cancel deletion, try invalid selectors/counts and missing required fields. Save incomplete content, then complete readiness without publishing.
- [ ] Preview a failing and passing HTML solution. Exercise JavaScript click checks and CSS responsiveness. Verify per-width results, runtime messages, stale-result warnings, cancellation and reset confirmation.
- [ ] Inspect an incomplete preview: Run remains available while checks/completion are disabled. Try a script error after otherwise passing checks; completion must be blocked.
- [ ] Confirm preview edits never change starter fields/dates/storage or student progress. Return to editor, save, refresh and check the published original remains unchanged.
- [ ] Test dirty links, Back/Forward and reload/close prompts; no-op saves, storage errors, two-tab conflicts and Cancel/Confirm on Reload Draft.
- [ ] Move/archive/restore a local lab and duplicate a course with saved working content. Delete an eligible local activity/module/course and refresh; original seeded/previously published records stay protected.
- [ ] Recheck the manually reviewed Quiz Builder and existing Theory Editor, including preview and direct encoded URLs. Check authenticated student quizzes/labs remain unaffected.
- [ ] Serve a production build locally and confirm all instructor routes remain unavailable.

## Known limitations and deferred Stage 5E requirements

- Physical browser visual/accessibility review remains for the checklist above. DOM/hydration/sandbox tests and HTTP checks do not replace that review; JSDOM does not enforce browser sandbox permissions or perform CSS layout. Responsive geometry continues to use the existing student validator and should be checked in a real browser.
- This is a shared browser-profile development dataset, not authenticated/account-scoped instructor storage. Drafts require explicit saving and cannot synchronize across devices. Preview attempts disappear on leaving Preview or refreshing.
- Browser storage has size limits. Revision checks reject stale saves but do not provide atomic multi-process transactions. Native unload prompts depend on browser policies; cancelled history navigation retains the inherited history-restoration limitations.
- Checks are deterministic DOM/computed-style/immediate-interaction checks at selected fixed widths. They do not prove every design, asynchronous behavior or implementation. Imported task groups preserve original interactions; mixing groups/new interaction checks requires author review. Computed CSS values must match browser-normalized values.
- The sandbox is a learning preview, not a secure high-stakes grading service or resource-limited execution server. Hostile infinite loops can occupy a browser process. Timeouts reject unfinished checks but cannot guarantee preemption; no completion is persisted.
- Stage 5E must add genuine instructor roles/ownership, authenticated APIs and PostgreSQL persistence, server-side validation, durable draft/version history and concurrency, publication review, protected-content/progress-dependency rules, student delivery and account-scoped migration. Existing student content must not be overwritten by browser-local drafts.
- Workshop/project authoring/uploads, real student publishing and Stage 5D are outside this implementation. No backend endpoints were invented.

Backend, authentication/sessions, Prisma, PostgreSQL and Student Dashboard source/functionality were not modified. No staging, commits, pushes, merges or branch switches were performed; Git was used only for read-only inspection and whitespace checks.
