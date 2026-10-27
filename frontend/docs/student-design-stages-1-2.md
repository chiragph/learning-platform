# DECODE student redesign — Stages 1–2 review

> **Historical stage report.** Current auth, account persistence, Instructor access and submission behavior may supersede this report. Use the [current frontend guide](../../docs/FRONTEND-GUIDE.md), [architecture](../../docs/PROJECT-ARCHITECTURE.md) and [status](../../docs/PROJECT-STATUS.md) for implementation work; retain this report for design rationale and dated validation.

## Scope delivered

This iteration changes the shared student application shell/design primitives, `/dashboard`, `/courses`, and `/courses/[id]`. It preserves the existing local student implementation rather than rebuilding it. No new routes or dependencies were introduced.

Monaco, lesson workspaces, quiz/challenge/project-specific redesigns, creative profile, editable content repository, and instructor tools are intentionally deferred until this design is approved. The existing modules remain usable through the redesigned shell. Shared buttons, course cards and activity lists inherit the new design where already reused; their existing workflows remain intact.

## Design and behavior

- Shared shell: restrained workspace colors derived from the existing light/dark tokens; compact sticky header; grouped Learn / Build / Your journey navigation with icons and active states; profile dropdown; local-demo notice; existing theme toggle and animated wordmark.
- Mobile shell: navigation drawer with a backdrop, explicit close control, Escape handling, focus containment, inert background, body scroll locking and desktop-resize cleanup. The profile dropdown closes on Escape or an outside pointer action.
- Dashboard: personalized welcome, Continue Learning or clearly labeled suggested starting point, one statistics strip, an ordered HTML → CSS → JavaScript roadmap, recent activity, playground/challenge shortcuts and a suggested next theory lesson. New learners see an actual empty activity state and no invented quiz average.
- Suggestions: resume an unfinished last-viewed lesson; otherwise select the next unfinished core activity in the last-viewed course; otherwise follow the suggested HTML/CSS/JavaScript path. Completion of all core units leads to projects. Every course remains available in any order.
- Course catalog: course overview and a module preview with direct links into the syllabus, actual course progress and a Start/Continue action.
- Course detail: objectives, progress ring, study estimates, native buttons controlling expandable modules, Expand all/Collapse all, module hash links, activity-type icons, last-viewed indication, completion states and links to existing activities.
- Motion: small hover/press feedback, progress transitions and an opening animation for syllabus panels, disabled or simplified for reduced motion.

## Curriculum data and persistence compatibility

`app/lib/student/curriculum.ts` adds read-only typed metadata: `Curriculum → LearningModule → LearningItem`. Item kinds are `lesson`, `quiz`, `exercise`, and `project`. Stable references resolve to the existing lesson, quiz, challenge and project definitions; content text and content IDs are unchanged. `itemKey()` includes both kind and ID because `css-grid` is an existing lesson and exercise ID.

Each course has three ordered modules. These are a suggested reading order, not prerequisites or locks. There are 25 theory lessons, three course quizzes, six exercises, and four optional project references. Durations are editorial study estimates, not claims about time spent.

The current progress schema, storage keys, auth adapter, draft handling and calculation stay unchanged: one unit per lesson, passed quiz (best score ≥ 70%), and exercise. HTML/CSS each have 11 core units and JavaScript has 12. Optional projects do not change those percentages. No migration or reset is needed for existing local records.

This is presentation metadata, not the Stage 6 editable/published repository. Future API contracts should retain stable course/module/item IDs, item kind/reference, objectives, explicit ordering, optional-item semantics and estimated minutes. Instructor authorization and publishing remain future server responsibilities.

## Visual review

The existing development server is available at `http://localhost:3000`; this iteration did not stop or replace that server. If it is no longer running, start `npm.cmd run dev` from the frontend directory.

Historical browser-demo credentials are omitted. Use the current email/password setup and an approved local test account; preserve existing browser data when reviewing this stage.

1. `/dashboard` — inspect the welcome/continue composition, statistics, roadmap, empty/populated activity and practice shortcuts. Complete an activity or open a lesson and return to verify the resume target and actual counters.
2. `/courses` — inspect all three course overviews, module previews, Start/Continue actions and progress. Follow a module link.
3. `/courses/html`, `/courses/css`, `/courses/javascript` — expand/collapse individual modules and all modules, follow all activity types, inspect objectives and progress. Refresh a module hash URL. Opening a syllabus item does not itself mark it complete.
4. Review 320px, 768px and desktop widths at 100% zoom in both themes. Check the drawer, profile dropdown, long labels, visible focus, overflow, Tab/Shift+Tab, Escape, reduced motion and restoring desktop width while the drawer is open.
5. Spot-check `/lessons`, `/quizzes`, `/playground`, `/challenges`, `/projects`, `/progress`, `/profile` and logout to confirm existing actions continue to work within the shared shell.

## Validation and limits

- TypeScript check: `node node_modules/typescript/bin/tsc --noEmit`.
- ESLint: `npm.cmd run lint`.
- Tests: `npm.cmd test` — 17 focused logic/component-render tests, including the previous auth, persistence, quiz and preview tests. New checks cover curriculum coverage, reference resolution, core percentages, first-visit/resume/course suggestions, empty/populated dashboard rendering, syllabus controls and nested navigation active state.
- Production build: `npm.cmd run build`.
- HTTP smoke checks: 15 URLs covering the landing/auth pages, redesigned routes and existing student modules returned 200 from the existing dev server.
- A read-only file-hash baseline checks that the existing landing/auth/branding/theme files, content, progress/storage/auth logic, and sandbox/editor implementation are unchanged during this iteration.

No browser is connected in the available browser-control environment. Component rendering checks validate generated markup, not interactive events or layout. Actual light/dark appearance, mobile overflow, focus containment, keyboard interactions, accordion/hash scrolling, theme refresh and student click flows still require browser review. No reference screenshot attachment was available in this turn; the implementation follows the written visual feedback.

The existing Next.js multiple-lockfile/workspace-root warning remains outside this scope. Mock student access remains development-only; this stage does not create production authorization or instructor access.

## Files changed in this iteration

Modified (prior local work retained):

```text
app/components/student/student-shell.tsx
app/components/student/student.css
app/components/student/learning-overview.tsx
app/(student)/dashboard/page.tsx
app/(student)/courses/page.tsx
app/(student)/courses/[id]/page.tsx
tests/student.test.mjs
```

Added:

```text
app/components/student/student-icon.tsx
app/components/student/dashboard-view.tsx
app/components/student/curriculum-view.tsx
app/components/student/learning.css
app/lib/student/curriculum.ts
tests/student-views.test.mjs
docs/student-design-stages-1-2.md
```

The earlier local implementation and its report remain in place. All work is local and uncommitted on `feature/student-dashboard`; no files were staged and no Git mutation was performed.
