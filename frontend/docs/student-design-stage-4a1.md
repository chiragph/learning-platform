# DECODE — Stage 4A.1: Integrated lessons and UI refinement

Date: 2026-10-25  
Branch: `feature/student-dashboard`  
Status: implemented; ready for visual review.

## Implementation summary

### Theory and practice on the same page

All 25 existing theory lessons now include the shared Monaco workspace, visible by default beneath the lesson content. Explanations, original syntax examples, practice instructions, curriculum outlines, previous/next activity links, quiz links, and explicit lesson completion remain available.

The workspace retains HTML, CSS, and JavaScript files, Run Code, Reset confirmation, Save Draft, the accessible editor alternative, runtime messages, and the existing sandboxed preview. The lesson's subject selects its initial file. Preview execution remains an explicit Run action; opening a lesson or editing/saving code does not complete it.

Each lesson uses `lesson-<existing-lesson-id>` as its draft key. The previous 12 lesson draft keys remain valid; the allowlist now covers all 25 lessons without changing storage version or discarding existing lesson, project, challenge, or playground drafts. Starter code uses each lesson's example plus supporting markup/styles where needed. The links/images starter uses a local inline SVG sample instead of a blocked external image; the original theory example is unchanged.

Read mode hides the workspace while retaining its in-page code state. Returning to Read & practice reuses that mounted workspace. The existing lifecycle owner still disposes owned Monaco instances/models when React Activity hides a cached route, ignores obsolete initialization, and reconstructs the editor safely on return. `editor-session.ts` and `code-workspace.tsx` were not modified.

The editor/preview panel layout now responds to its actual width in embedded workspaces as well as the Playground. Narrow panels stack; sufficiently wide panels sit side by side. The outer lesson practice panel no longer adds a sticky, height-constrained scrollbar. The page document, Monaco editor, and preview retain their separate appropriate scroll responsibilities.

### Built-in VS Code editor appearance

`EDITOR_THEME = "vs-dark"` is supplied through the existing Monaco API. Custom DECODE syntax themes and the website-theme observer were removed from the editor integration. File tabs, breadcrumbs, status bar, loading state, and accessible text area use compatible dark colors in both embedded lessons and the standalone Playground.

Website light/dark appearance remains independent. Local language workers, syntax highlighting, autocomplete settings, line numbers, indentation, bracket matching, diagnostics, Run/Save shortcuts, per-file view handling, and lifecycle safeguards remain in place. Because the shared editor is reused, its appearance is also consistent in existing challenges/projects; their engines and completion behavior are unchanged.

### Student learning profile

The former diagnostic profile has been replaced with:

- A profile header with the saved display name and an original local vector avatar.
- Four local avatar presets: Owl, Fox, Robot, Cat; no external avatar service or uploads.
- An editable fictional demo display name, with validation, Cancel edits, explicit Save profile, success feedback, and storage-failure feedback.
- Real activities/course completion, quiz-attempt, and saved-workspace statistics.
- Overall progress ring, course progress bars, curriculum links, and actual recent learning activity.
- Account/preferences details, the existing website theme control, and logout.
- A separate learning-data section with explicit reset confirmation and a non-destructive cancel action.

Profile records use `decode-profile-v1-<studentId>` and contain only version, display name, and a preset avatar ID. They are separate from auth sessions and `decode-learning-v1-<studentId>`. Identity rendering merges the local display name into the existing student context without changing account IDs, sign-in addresses, sessions, or progress keys. The selected avatar appears in the shared header. Saving a profile does not modify learning records. Resetting learning data keeps the profile and website theme, and affects only the current account's learning data.

Authentication remains the original browser-local development demo. This stage adds no secure authentication claims, password handling, Google sign-in, profile APIs, backend synchronization, or instructor access.

### Interaction and scrolling

- Course/module panels animate with CSS grid expansion, opacity, and visibility. Collapsed panels are immediately `inert` and hidden from assistive technology. Existing control IDs and expansion state remain intact.
- Tabs retain their existing keyboard behavior and stable panel relationships, with subtle visual transitions.
- Buttons have restrained hover/press feedback and stronger focus indicators. Progress bars transition smoothly, and explicit lesson completion has a small announced success message.
- Motion effects and progress transitions respect `prefers-reduced-motion`. The destructive button retains readable contrast in both website themes.

Installed Next.js guidance explains that new Link navigations can retain document scroll position when the new page is already visible. A shared navigation provider now observes plain internal-link intent and `popstate`; it does not patch browser history or change Next.js routing.

Dashboard, My Learning/course overviews, theory pages, Playground, and Profile use shared page-entry handling. New link visits start at the document top, including a new link to a cached Activity page. Back/forward traversal, reload restoration, and explicit hash targets remain with Next.js/the browser. Theme changes, profile edits, language tabs, template changes, and normal local rerenders do not reset page position. The handler never writes editor, preview, or sidebar scroll offsets. Mobile menu focus restoration uses `preventScroll`.

## Preserved Stage 4A architecture and scope

- Same Web Development → Course → Module → Activity hierarchy, nine modules, and 38 stable activity IDs.
- No course content, curriculum order, activity route/reference, quiz scoring, visit tracking, or completion formula changes.
- No locks or prerequisites.
- No new Lab/Workshop engines or topic-based quizzes; existing challenge/project adapters remain unchanged.
- No backend/database, dependency manifests/lockfiles, or teammate code changes.
- No staging, commits, pushes, merges, or branch switching.

Stage 4A changes were already present and uncommitted when this stage began. They have been retained. The list below identifies files changed specifically for Stage 4A.1, rather than presenting the combined worktree as entirely new work.

## Exact Stage 4A.1 files

All paths are relative to the repository root.

| File | Purpose |
| --- | --- |
| `frontend/app/(student)/profile/page.tsx` | Route to the redesigned profile |
| `frontend/app/components/student/animated-disclosure.tsx` | Accessible animated expansion wrapper |
| `frontend/app/components/student/code-workspace.css` | Consistent VS Code dark editor surfaces |
| `frontend/app/components/student/curriculum-view.tsx` | Animated course/module panels and page entry |
| `frontend/app/components/student/dashboard-view.tsx` | Shared document scroll handling |
| `frontend/app/components/student/lesson-view.tsx` | Default integrated practice on every theory lesson |
| `frontend/app/components/student/lesson.css` | Workspace below lesson content; outer scrollbar removal |
| `frontend/app/components/student/monaco-code-editor.tsx` | Built-in vs-dark configuration; lifecycle owner retained |
| `frontend/app/components/student/monaco-runtime.ts` | Remove custom themes; preserve local Monaco runtime/workers |
| `frontend/app/components/student/page-navigation.tsx` | New-link versus history-aware document scroll handling |
| `frontend/app/components/student/playground-view.tsx` | Shared page entry instead of a route-specific scroll effect |
| `frontend/app/components/student/profile-provider.tsx` | Local profile loading, persistence, and account scoping |
| `frontend/app/components/student/profile-view.tsx` | Redesigned profile, preferences, statistics, reset controls |
| `frontend/app/components/student/profile.css` | Responsive profile layout and visual styling |
| `frontend/app/components/student/progress-view.tsx` | Remove the old Profile component; retain My Progress |
| `frontend/app/components/student/resizable-panels.tsx` | Width-based layout for embedded panels |
| `frontend/app/components/student/student-avatar.tsx` | Original local vector avatar presets |
| `frontend/app/components/student/student-interactions.css` | Expansion, tabs, feedback, focus, reduced-motion rules |
| `frontend/app/components/student/student-provider.tsx` | Render local profile labels without changing auth identity |
| `frontend/app/components/student/student-shell.tsx` | Saved header avatar, navigation provider, stable focus |
| `frontend/app/lib/student/editor-settings.ts` | Shared built-in editor theme constant |
| `frontend/app/lib/student/lesson-practice.ts` | Contextual starters and draft support for all 25 lessons |
| `frontend/app/lib/student/student-profile.ts` | Typed profile data, presets, validation, storage adapter |
| `frontend/tests/editor-lifecycle.test.mjs` | Embedded editor/cache/draft and scroll/history regressions |
| `frontend/tests/profile-lifecycle.test.mjs` | Real auth/profile/progress provider integration and hydration |
| `frontend/tests/student-views.test.mjs` | Every theory workspace and animated disclosure semantics |
| `frontend/tests/student.test.mjs` | Starter, profile storage, isolation, and progress consistency |
| `frontend/docs/student-design-stage-4a1.md` | This report and visual review checklist |

## Validation results

| Check | Result |
| --- | --- |
| `npm.cmd run lint` | Passed; no errors or warnings |
| `npx.cmd tsc --noEmit` | Passed |
| `npm.cmd run build` | Passed, including production type checking and all existing routes |
| `npm.cmd test` | 45 passed, 0 failed |
| `git diff --check` | Passed |
| Branch/staging audit | Still `feature/student-dashboard`; staging area unchanged/empty |

The tests exercise actual React effects, Strict Mode, and cached Activity visibility. Embedded editor tests use the real LessonView, CodeWorkspace, and lifecycle owner with Monaco's DOM/canvas API replaced by a strict fake that rejects use after disposal. They cover default mounting, reading-view retention, route hiding/resuming, both lesson draft keys, Run's sandbox attributes, Reset preserving the saved draft until Save, unchanged quiz/completion records, theme independence, and model/listener cleanup. Existing late initialization, stale callbacks, file-tab isolation, oversize edits, and disposal regressions still pass.

Profile tests use the real auth, profile, progress providers, and storage adapters in a disposable JSDOM origin. They cover editing and reload persistence, shared display identity, real statistics, invalid names, quota errors, protected routes, account separation, cancellation and confirmation of reset, retained profile/theme/other-account data, logout, and protected-markup hydration without recoverable errors.

Navigation tests cover fresh and cached link visits, history traversal, reload/back-forward document restoration, hash targets, and retention of nested editor scroll offsets. Curriculum tests still verify ordering, mappings, 38 activities, completion totals, Continue Learning, and safe empty/upcoming states.

The production build retains the pre-existing warnings about multiple lockfiles/workspace-root inference. No unrelated lockfile/configuration cleanup was made.

## Browser verification limitation

Native browser tooling was attempted. It returned Chrome's accessibility tree, then failed input with `coordinate input geometry is unavailable`. A fresh combined state/screenshot capture returned Chrome accessibility information alongside a VS Code screenshot. Because those surfaces did not match, further UI input was stopped. No unrelated terminal/app content was operated on, and no screenshot is presented as a verified DECODE page.

Real browser rendering, responsive geometry, animation timing, pointer interactions, actual Monaco autocomplete/worker rendering, live preview behavior, and native browser scroll restoration still need visual verification. Automated tests and the JSDOM hydration check do not replace those checks.

## Visual review checklist

Use the existing development server at `http://localhost:3000`, or run `npm.cmd run dev` from `frontend`. Demo sign-in remains development-only: `student@example.test` / `Decode123!`. Do not clear existing site data to review this stage.

1. Open Dashboard → My Learning → a theory lesson. Check that each new link visit starts at its heading. Scroll, navigate elsewhere, then use browser Back/Forward; verify normal position restoration. Check a direct module hash link as well.
2. Review `/lessons/html-introduction`, `/lessons/css-introduction`, and `/lessons/javascript-events`, then sample other theory pages. Confirm explanations and syntax examples appear above the integrated workspace, and the correct initial file and task instructions are present.
3. Type in each file and inspect real syntax highlighting, autocomplete, line numbers, indentation, bracket matching, and keyboard shortcuts. The editor should remain VS Code dark when the website theme changes.
4. Run code and interact with the isolated preview. Check runtime messages, Stop, preview width controls, and Reset confirmation. Opening, editing, running, or saving must not mark the theory activity complete.
5. Save distinct drafts in two lessons and one Playground template. Reload and revisit them; each should restore independently. Toggle Read and Read & practice before saving, and verify the in-page edits are retained. Navigate away/back repeatedly and check for disposed-editor errors, duplicate models, or incorrect file content.
6. Explicitly complete a lesson. Check the short success message and actual module/course progress. My Learning must still expose the same 38 activities and original routes.
7. Open Profile. Choose each preset, edit a fictional display name, cancel edits, then save. Verify the header/avatar and Dashboard welcome update, reload restores them, and learning counts/drafts are unchanged.
8. Verify profile statistics/course bars against My Learning and My Progress. Check both genuine recent activity and the new-learner empty state.
9. Test site appearance in Account & preferences, and logout/session restoration. Check that another demo account has its own profile and learning records.
10. Check reset cancellation without deleting existing work. If testing the final destructive reset, use a disposable demo account and retain any code you need first. Confirm the reset affects learning data only, retaining that account's profile and site theme.
11. Review approximately 320px/375px, 768px, 1280px, and wider desktop layouts in both themes. Check editor/preview stacking, profile/avatar layout, long names, text wrapping, keyboard focus, and absence of unnecessary outer scrollbars.
12. Use keyboard navigation for course/module expansion, tabs, avatar radio choices, profile forms, and mobile navigation. Enable reduced motion and verify expansion, tabs, progress, and completion feedback become immediate. Check the browser console for hydration or Monaco lifecycle errors.

## Remaining boundaries

Saved drafts still require explicit Save Draft. In-page/cached state is not a substitute for persisted storage, and browser cache eviction can discard unsaved edits. Existing preview network/resource restrictions and execution limits remain unchanged.

Profiles are local demo preferences, not backend account records. Dedicated Lab/Workshop engines, quiz redesign, instructor/admin features, database changes, and Stage 4B/4C remain outside this implementation. Stop here for visual review.
