# DECODE — Stage 5B: Theory Lesson Editor

Date: 26 October 2026

Branch: `feature/instructor-dashboard`

Scope: frontend Theory lesson management, structured editing, preview, and local working drafts.

## Implementation summary

Upgraded Theory Lessons and connected Theory activities in the existing Curriculum Builder to one editor. The implementation extends the Stage 5A instructor repository; it does not introduce another course/module/activity catalog. All existing curriculum and student lesson identifiers remain unchanged. The initial catalog still contains only HTML, CSS, and JavaScript.

The 25 existing theory activities import their content from the student lesson source: explanatory paragraphs, the language and code example, and the practice prompt as a tip. Import is read-only and lazy. Opening a lesson does not create another activity or persist a copy of the catalog. Student rendering, routes, progress, authentication, backend, and database files are unchanged. The shared animated wordmark is unchanged.

An edit to published or previously published content creates a separate browser-local working draft. Saving it does not change the published course/module/activity snapshot, its dates, its content reference, or the student lesson source. The editor and library distinguish activity publication status from the presence of a working draft. **Ready for Publication** is a validation result, not a publication action. Final Theory publication is deferred to Stage 5D.

## Routes

| Route | Behavior |
| --- | --- |
| `/instructor/theory` | Updated library, title search, course/module/status filters, draft dates, editor/preview links, and curriculum context |
| `/instructor/theory/[activityId]` | New editor for the existing stable Theory activity ID |
| `/instructor/theory/[activityId]?preview=1` | Opens the same editor in read-only preview mode |
| `/instructor/curriculum?course=…&module=…&activity=…` | Existing builder with Theory title links and editor/preview actions |

Activity IDs are URL-encoded, for example `/instructor/theory/lesson%3Ahtml-introduction`. Unknown or deleted local activity IDs show a library recovery link. The dynamic editor route uses a Suspense boundary for request parameters, consistent with the installed Next.js Cache Components configuration. Nested editor navigation keeps Theory Lessons active in the sidebar.

## Functional features

- Theory library covers seeded and instructor-created courses without duplicating records. Course changes reset the module filter. Filters distinguish draft activities, published activities, saved working drafts, and archived curriculum.
- Lesson title, context, original publication status, unsaved state, local save time, Save Draft, Preview, and Back to Curriculum controls.
- Structured headings, paragraphs, numbered/bulleted lists, code examples, tip/note callouts, and external resources. Blocks can be added, edited, duplicated, moved up/down, and deleted with confirmation. Reordered blocks receive focus. Blocks have stable local IDs and retain their array order.
- Bold, italic, and inline-code toolbar buttons wrap selected text. Lists use one item per line. This is a small text format; it requires no HTML authoring or rich-text dependency.
- Code blocks support HTML, CSS, JavaScript, and plain text, plus optional titles and explanations. A plain textarea is always available. An optional syntax editor reuses DECODE's bundled Monaco runtime and local workers. Only one selected code block mounts Monaco; switching to preview or another block disposes it. Light/dark themes and reduced motion are respected. Loading failures fall back to the plain field.
- Student-style reading preview uses the existing typography scale, spacing, colors, example framing, and callout style. Desktop/mobile widths use the current edited content, including unsaved edits. Preview contains no editing, completion, or publishing controls.
- Code highlighting renders escaped text tokens. Copy Code uses the clipboard with a manual-copy fallback. No code is evaluated or run; no execution iframe is created.
- Readiness requires a meaningful title, substantive body content, complete required blocks, supported code languages/nonempty code, and valid resource titles/HTTP(S) URLs. Incomplete drafts remain savable. Heading-only or resource-only content does not count as substantive lesson body content.
- Link navigation and browser history traversal ask before discarding unsaved changes. Browser reload/close uses the native unload warning. Returning fields to their saved values clears dirty state. Save Draft also supports Control/Command S.
- Storage failures retain unsaved edits and report failure. External draft changes disable saving until the instructor explicitly reloads the saved draft; reload has a cancellable confirmation. Timestamp plus revision checks reject stale edits, including saves sharing the same millisecond.

## Repository, migration, and protection

`InstructorState.theory` is an optional version-1 extension containing a draft dictionary keyed by activity ID. A document stores its own format version, revision, title, ordered blocks, and ISO creation/update timestamps. It does not embed courses or modules. Stage 5A snapshots without the extension load without a destructive migration or automatic storage write.

`theory.save` is a repository command, with runtime format validation and expected draft timestamp/revision checks. Successful saves append a real Recent Changes entry. Unchanged content returns the original state and performs no write, timestamp change, revision increment, or history update. Published source history remains unknown where it was already unknown; no historical creation/publication dates are invented.

Never-published local draft activities synchronize their title/update metadata when a lesson is saved. Renaming such an activity through Stage 5A also updates the saved draft title and revision. Published working draft titles remain separate from their original activity titles.

Course duplication copies saved working content to the new activity IDs with new block IDs and new local draft dates/revisions. Existing Stage 5A rules still create an unpublished, deletable copy without inherited publication history. Activity moves retain draft association by ID. Archive/restore preserves drafts. Eligible permanent course/module/activity deletion cascades their saved draft documents; refresh cannot resurrect them. Original seeded and previously published curriculum remains protected.

Malformed lesson data is recovered independently of catalog validation. Valid courses and valid drafts are retained; the original raw record is backed up under the existing recovery key before recovered writes are allowed. If that backup fails, the recovered catalog remains visible and read-only. Unsupported repository, lesson-store, or document versions remain read-only and the raw record is preserved. Unrecognized legacy lesson references show an explicit unsupported-import explanation and cannot be overwritten with blank drafts.

Storage remains `decode-instructor-preview-v1`, with recovery at `decode-instructor-preview-recovery`. Student storage keys are never read or written by Theory commands.

## Files changed

Modified:

- `frontend/app/components/instructor/content-view.tsx`
- `frontend/app/components/instructor/curriculum-view.tsx`
- `frontend/app/components/instructor/instructor-provider.tsx`
- `frontend/app/components/instructor/instructor-shell.tsx`
- `frontend/app/instructor/theory/page.tsx`
- `frontend/app/lib/instructor/repository.ts`
- `frontend/app/lib/instructor/types.ts`
- `frontend/tests/instructor-views.test.mjs`

Added:

- `frontend/app/components/instructor/theory-block-fields.tsx`
- `frontend/app/components/instructor/theory-code-editor.tsx`
- `frontend/app/components/instructor/theory-editor.tsx`
- `frontend/app/components/instructor/theory-library.tsx`
- `frontend/app/components/instructor/theory-preview.tsx`
- `frontend/app/components/instructor/theory.css`
- `frontend/app/instructor/theory/[activityId]/page.tsx`
- `frontend/app/lib/instructor/theory-navigation.ts`
- `frontend/app/lib/instructor/theory-types.ts`
- `frontend/app/lib/instructor/theory.ts`
- `frontend/tests/instructor-theory-views.test.mjs`
- `frontend/tests/instructor-theory.test.mjs`
- `frontend/docs/instructor-dashboard-stage-5b.md`

## Validation results

| Check | Result |
| --- | --- |
| `npm test` | **167 passed, 0 failed**: 33 Theory/routing tests plus the existing 134 instructor/student/authentication tests |
| `npm run lint` | Passed; no errors or warnings |
| `npx tsc --noEmit` | Passed |
| `npm run build` | Passed; 75 generated pages, including the new dynamic Theory route |
| Development HTTP smoke test | Library, HTML editor, CSS preview entry, and curriculum returned HTTP 200 without route-error markers |
| Production HTTP smoke test | All 9 existing instructor routes plus the editor and preview entry returned HTTP 404 on localhost; temporary production server stopped |
| `git diff --check` and new-file whitespace scan | Passed; no trailing whitespace or missing final newlines |
| Scope and Git review | 21 intended frontend files; branch unchanged; nothing staged; no protected-area changes |

The build retains the existing Next.js warnings about workspace-root inference and multiple lockfiles. No configuration or lockfiles were changed to suppress them. The existing development server was reused for smoke tests and remains running.

The additional tests cover all seeded imports; activity ID preservation; independent published working drafts; incomplete saves; no-op timestamps; local metadata synchronization; all block operations; readiness; escaping and unsafe links; literal formatting markers; save/reload persistence; quota failures; stale revisions; duplication/deletion cascades; migration/recovery; future versions; archived/unsupported records; filters; preview widths; unsaved links/unload/history; confirmed reload; and selection of only one syntax editor. Monaco is replaced with a lightweight mount stub in interaction tests; actual syntax editor appearance and keyboard behavior remain on the manual checklist.

## Development preview

From `frontend`, run `npm run dev`, then open the URL printed by Next.js followed by `/instructor/theory`. Use the existing development server if one is already running. A seeded example is `/instructor/theory/lesson%3Ahtml-introduction`.

To author a new lesson: create/select a local course in My Courses, add a module and a **Theory** activity in Curriculum Builder, then select its title or **Open Theory Lesson Editor**. Add content blocks, preview them, and choose **Save Draft**. Refresh/reopen to verify the saved working draft.

The inherited instructor layout permits only `NODE_ENV=development`. `npm run build` followed by `npm start` keeps instructor routes unavailable, including on localhost. This is a development UI preview with no instructor identity or granted privileges. Existing real student authentication remains intact.

## Manual browser review checklist

- [ ] Review the library/editor at desktop, tablet, and phone widths in light and dark themes; confirm no horizontal page overflow.
- [ ] Confirm the shared DECODE wordmark animation, hover behavior, sidebar collapse, mobile drawer, breadcrumbs, and active Theory navigation remain intact. Check reduced motion.
- [ ] Check course/module/title/status filtering, archived lessons, empty results, and links back to the correct curriculum context.
- [ ] Open existing HTML, CSS, and JavaScript lessons; compare imported explanations, code, and practice prompts against the student originals.
- [ ] Create a local Theory activity and edit its title. Add all six block kinds. Apply bold/italic/inline code, change list style, and preview the result.
- [ ] Duplicate/reorder blocks with the keyboard. Cancel and confirm block deletion; check focus restoration and visible focus states.
- [ ] Open the syntax editor for a code block, then another. Confirm one editor is active, typing survives mode changes, theme changes work, and the plain code alternative remains usable. Check Tab/Control M behavior and local worker loading.
- [ ] Verify long code scrolls inside the example, Copy Code works (or reports the fallback), and no authored HTML/JavaScript executes.
- [ ] Review desktop/mobile preview widths with unsaved content. Confirm preview is read-only and does not imply live student publication.
- [ ] Save an incomplete draft, then complete the checklist. Confirm Ready for Publication appears without a Publish action.
- [ ] Save, refresh, reopen, and verify title, blocks, order, timestamps, and publication separation. Save unchanged content and confirm dates/history do not change.
- [ ] Make unsaved edits, then test sidebar links, Back to Curriculum, browser Back/Forward, refresh, and close. Cancel and accept the native warnings.
- [ ] Edit the same lesson in another tab. Confirm unsaved text is retained, saving is disabled after a conflicting update, and Reload saved draft can be cancelled or confirmed.
- [ ] Duplicate a course containing an edited theory draft; confirm independent draft content/new IDs. Archive/restore and eligible permanent deletion should preserve/remove the corresponding documents after refresh.
- [ ] Verify the existing authenticated Student Dashboard and lessons still behave normally and show unchanged original content/progress.
- [ ] Serve a production build locally and verify instructor library/editor URLs remain unavailable.

## Deferred features and known limitations

- Final publication/review/version distribution, instructor authorization/APIs, cross-account/device synchronization, and student delivery are deferred to Stage 5D/backend integration. Stage 5A local course publication controls retain their existing meaning; they do not promote Theory working drafts.
- Quiz, Lab, and Workshop content editors are outside this stage. Their record management remains available.
- Drafts are manual saves in a shared development browser profile, not an instructor account store. Clearing browser storage removes them. Storage capacity can limit large lessons; format limits are 200 blocks, 200 title characters, and 100,000 characters per text/code field.
- Formatting intentionally supports simple bold/italic/inline-code spans, without nested rich text, arbitrary HTML, media uploads, or inline Markdown links. External links use dedicated resource blocks. Code highlighting is illustrative rather than full semantic analysis.
- Local storage compare-before-write plus revisions detects stale snapshots, but cannot guarantee atomic simultaneous writes between browser processes. A future API needs server-side concurrency control.
- Native reload/close prompts depend on browser user-interaction policies, especially on mobile. Cancelling a history traversal restores the editor URL and may alter the forward-history stack. Save before closing a browser session.
- Physical visual/accessibility review is pending; automated interaction/rendering tests and HTTP route checks do not replace it.

No files were staged or committed. No push, merge, branch switch, backend, authentication, database, or Student Dashboard change is part of this stage.

## Theory routing regression fix

### Root causes and reproduction

Two separate issues affected `/instructor/theory/lesson%3Ahtml-introduction`:

1. The installed Next.js 16.4.2 server passed the encoded segment `lesson%3Ahtml-introduction` through `params.activityId`. The page forwarded that value unchanged to `TheoryEditor`, while the repository correctly stores and compares the stable ID `lesson:html-introduction`. Chrome reproduced **Theory lesson not found** after local repository hydration. The server's streamed component props confirmed the encoded value. Earlier component tests supplied already-decoded IDs directly, so they did not cover the actual route boundary.
2. With Cache Components enabled, `InstructorShell` read `usePathname()` outside Suspense. A browser-local activity ID is an unknown dynamic parameter during prerendering, so that hook can suspend. The Theory page's existing Suspense boundary was a descendant of the shell and could not catch it. This matches the installed Next.js `usePathname` guidance for unknown dynamic segments.

The provider's readiness guard and stable repository IDs were correct. No storage reset, migration, draft rewrite, or identifier changes are needed.

### Exact changes

- `app/lib/instructor/theory.ts`: added `decodeTheoryActivityParam`, which decodes one URI component at the route boundary. Malformed escape sequences fall back to strict missing-ID lookup rather than throwing. Repository lookup remains an exact comparison. Double-encoded values are not repeatedly decoded into a different existing record.
- `app/instructor/theory/[activityId]/page.tsx`: awaits both parameter promises inside the existing page Suspense boundary, then passes the decoded activity ID and Preview flag to the editor.
- `app/components/instructor/instructor-shell.tsx`: moved pathname reads into `PathnameNavigation` and `PathnameBreadcrumb`, each under a small Suspense boundary. Fallbacks reuse the real navigation and breadcrumb markup with a neutral active state. The outer shell, branding, theme controls, responsive drawer state, child route, and repository provider stay mounted. No layout-wide loading replacement, `force-dynamic`, `connection()`, static-ID list, or Next.js configuration change was introduced.
- `tests/instructor-theory.test.mjs`: checks exactly-once decoding, every seeded Theory ID, a local activity, malformed escapes, double encoding, strict lookup, and unchanged catalog data.
- `tests/instructor-theory-views.test.mjs`: exercises the actual async server page and mounts its resulting editor; covers delayed params, encoded/raw direct URLs, seeded and instructor-created saved drafts, server-markup hydration, refresh, both library/curriculum Edit and Preview links, and missing/deleted/double-encoded IDs. Hydration reports no recoverable errors, and opening/refreshing leaves persisted data unchanged.
- `tests/instructor-views.test.mjs`: simulates pathname suspension during server rendering and client updates; verifies stable shell fallbacks, child route rendering, retained sidebar/editor state, active nested Theory navigation, and unchanged branding/theme controls.
- This report records the diagnosis and validation.

### Verification and remaining limitations

- Full suite: **167 tests passed**. ESLint and TypeScript checks passed.
- Live development HTTP checks returned 200 and verified the actual editor props: encoded and raw HTML URLs resolve to `lesson:html-introduction`; the CSS Preview URL resolves to `lesson:css-introduction` with `initialPreview: true`. A double-encoded colon remains encoded after one decode, and correctly does not alias a seeded lesson.
- Both entry points and refresh of new local lessons are covered by mounted route/hydration regressions. Production build and whitespace results are recorded in the validation table above.
- Chrome reproduced the original hydrated failure. Further native browser automation stopped when the window could not be recaptured after minimization/user activity; final physical browser review remains on the manual checklist. The fix was verified through the running Next.js response and automated route/hydration tests.
- Browser-local persistence, development-only access, and deferred student publication retain their existing limitations. No backend, authentication, database, Student Dashboard, stable identifier, or saved-draft migration was changed by this fix.
