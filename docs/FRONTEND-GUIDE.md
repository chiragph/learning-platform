# Frontend guide

Reviewed **2026-10-27**, source commit `59614ec`. [Agent entry](../AGENTS.md) · [Architecture](PROJECT-ARCHITECTURE.md) · [Backend contracts](BACKEND-GUIDE.md) · [Feature status](ROLES-AND-FEATURES.md)

All paths below are relative to the repository root unless stated otherwise. `@/*` resolves within `frontend/` through `frontend/tsconfig.json`. Before writing frontend code, follow [frontend/AGENTS.md](../frontend/AGENTS.md) and inspect relevant installed Next documentation. The installed version enables Cache Components, partial prefetching, and experimental agent feedback in `frontend/next.config.ts`.

## App Router structure

`frontend/app/` is the App Router root; there is no `src/app/`, Pages Router, middleware file, or Next API route implementation in the inspected checkout. `next.config.ts` rewrites `/api/:path*` to NestJS. Route wrappers generally choose a view; business rules and browser behavior live under `app/lib/` and `app/components/`.

| URL | Verified route file | Responsibility |
| --- | --- | --- |
| `/` | `frontend/app/page.tsx` | Public landing page |
| `/login` | `frontend/app/login/page.tsx` | Login form |
| `/register` | `frontend/app/register/page.tsx` | Student registration |
| `/login/success` | `frontend/app/login/success/page.tsx` | Server session verification and compatibility role-home redirect |

`frontend/app/layout.tsx` loads global/landing CSS, fonts, metadata and the theme initializer. Most public composition uses landing components, while auth routes reuse `auth-shell.tsx` and `auth-form.tsx`.

### Student route group

`frontend/app/(student)/layout.tsx` protects every student route. `(student)` does **not** add a URL segment. All files in this table are inside that directory.

| URL | Relative route file | Main view under `app/components/student/` |
| --- | --- | --- |
| `/dashboard` | `dashboard/page.tsx` | `dashboard-view.tsx` |
| `/courses` | `courses/page.tsx` | `curriculum-view.tsx` / `learning-overview.tsx` |
| `/courses/[id]` | `courses/[id]/page.tsx` | `remote-activity.tsx` → course curriculum |
| `/lessons` | `lessons/page.tsx` | `lesson-view.tsx` (`LessonsIndex`) |
| `/lessons/[id]` | `lessons/[id]/page.tsx` | `remote-activity.tsx` → `lesson-view.tsx` |
| `/quizzes` | `quizzes/page.tsx` | `quiz-view.tsx` |
| `/quizzes/[id]` | `quizzes/[id]/page.tsx` | `remote-activity.tsx` → `quiz-view.tsx` |
| `/challenges` | `challenges/page.tsx` | `challenge-view.tsx` (coding labs) |
| `/challenges/[id]` | `challenges/[id]/page.tsx` | `remote-activity.tsx` → `challenge-view.tsx` |
| `/projects` | `projects/page.tsx` | `project-view.tsx` (workshops) |
| `/projects/[id]` | `projects/[id]/page.tsx` | `remote-activity.tsx` → `project-view.tsx` |
| `/activities/[id]` | `activities/[id]/page.tsx` | `upcoming-activity-view.tsx`; legacy upcoming-content route, not the connected activity resolver |
| `/playground` | `playground/page.tsx` | `playground-view.tsx` |
| `/progress` | `progress/page.tsx` | `progress-view.tsx` |
| `/profile` | `profile/page.tsx` | `profile-view.tsx` |

Connected course/lesson/quiz/lab/project detail routes accept runtime IDs through `RemoteActivity`, rather than enumerating only old seed IDs. They set `instant = false`; unavailable content displays an unpublished-content state. The legacy upcoming route uses its existing seed lookup, static validation sample, and `notFound()` guard.

### Instructor routes

`frontend/app/instructor/layout.tsx` protects the workspace. Paths in the route-file column below are relative to `frontend/app/instructor/`.

| URL | Route file | Main component under `app/components/instructor/` |
| --- | --- | --- |
| `/instructor` | `page.tsx` | `overview-view.tsx` |
| `/instructor/courses` | `courses/page.tsx` | `courses-view.tsx`, `course-form.tsx` |
| `/instructor/curriculum` | `curriculum/page.tsx` | `curriculum-view.tsx`, `curriculum-form.tsx` |
| `/instructor/theory` | `theory/page.tsx` | `theory-library.tsx` |
| `/instructor/theory/[activityId]` | `theory/[activityId]/page.tsx` | `theory-editor.tsx` |
| `/instructor/quizzes` | `quizzes/page.tsx` | `quiz-library.tsx` |
| `/instructor/quizzes/[activityId]` | `quizzes/[activityId]/page.tsx` | `quiz-editor.tsx` |
| `/instructor/labs` | `labs/page.tsx` | `lab-library.tsx` |
| `/instructor/labs/[activityId]` | `labs/[activityId]/page.tsx` | `lab-editor.tsx` |
| `/instructor/workshops` | `workshops/page.tsx` | `workshop-library.tsx` |
| `/instructor/workshops/[activityId]` | `workshops/[activityId]/page.tsx` | `workshop-editor.tsx` |
| `/instructor/submissions` | `submissions/page.tsx` | `submissions-view.tsx` |
| `/instructor/insights` | `insights/page.tsx` | `insights-view.tsx` |
| `/instructor/settings` | `settings/page.tsx` | Profile information and shared appearance control |

Editor pages resolve async params/search params inside Suspense and decode the activity parameter through the relevant domain helper. Editor preview uses the existing `preview=1` query. Preserve this handling for namespaced/encoded and newly created IDs; avoid double decoding or positional ID generation.

### Admin routes: separate branch only

No `frontend/app/admin/`, `frontend/app/components/admin/`, or `frontend/app/lib/admin/` directory exists in this checkout. Git tree inspection of `feature/admin-dashboard` verifies routes `/admin`, `/admin/users`, `/admin/instructors`, `/admin/courses`, `/admin/analytics`, `/admin/activity`, `/admin/settings`, and `/admin/profile`, plus a layout/loading/error boundary.

These are **branch paths**, not local links: `frontend/app/admin/`, `frontend/app/components/admin/`, `frontend/app/lib/admin/`, `frontend/app/components/auth/admin-session.ts`, and `frontend/app/components/auth/server-admin-session.ts`. Their report describes a completed frontend integration target; live ADMIN authentication/API behavior and real browser QA are not certified. See [Admin status](PROJECT-STATUS.md#deferred-admin-dashboard). Inspect with `git show` / `git ls-tree` without switching branches.

## Layouts, navigation and providers

```text
RootLayout
  StudentLayout: server session check
    StudentProvider: client identity recheck / sign-out
      StudentProfileProvider: local UUID-scoped display preference
        StudentShell: header/sidebar/mobile navigation
          StudentNavigationProvider: document scroll intent
            ProgressProvider: connected catalog/progress and save queue
              ActivityVisitTracker + route view

RootLayout
  InstructorLayout: server session check
    InstructorSessionProvider: client role/session recheck
      InstructorShell: header/sidebar/mobile navigation
        InstructorProvider: RemoteInstructorRepository
          route view/editor
```

- Student sidebar groups Learn and Account. Visible top-level entries are Dashboard, My Learning, Code Playground, My Progress, Profile. Lessons/quizzes/labs/workshops belong under My Learning for active-link purposes, even when visited directly.
- `student-shell.tsx` persists collapse as `decode-sidebar-collapsed`, provides hover/focus tooltips when collapsed, a profile disclosure and logout, mobile focus containment, Escape handling, backdrop, skip link, and inert background.
- Instructor sidebar groups Workspace, Content and Management with the routes listed above. `instructor-shell.tsx` uses Suspense around pathname-dependent navigation/breadcrumbs while keeping editors/providers mounted. Collapse is in component state; its mobile drawer reuses `Modal` from `ui.tsx`.
- Instructor shell text still contains outdated preview/local-storage/identity claims. The layout and session provider enforce real auth regardless of that copy. There is no connected profile-edit form or logout button in the current Instructor shell/settings UI; do not infer them from the session API.
- `page-navigation.tsx` resets **document** scroll for a new link visit and preserves history/hash/reload restoration. Do not reset editor, sidebar, or preview scroll or remount Monaco solely to scroll a page.

## Authentication components

| Files under `frontend/app/components/auth/` | Responsibility |
| --- | --- |
| `auth-form.tsx`, `validation.ts` | Login/register, pending guards, local input feedback; backend still validates |
| `auth-client.ts` | Public `AuthUser`, credentialed JSON requests, no-store, 15-second timeout |
| `auth-shell.tsx`, `auth.css`, `animated-owl.tsx`, `animated-owl.css` | Shared form layout and owl interaction/animation |
| `server-student-session.ts`, `server-instructor-session.ts` | Server-only cookie forwarding to `/auth/me` with scoped session; never expose raw tokens |
| `student-session.ts`, `instructor-session.ts` | Strict public identity parsing, scoped client verification, cross-tab auth-change notification |

`frontend/app/lib/instructor/access.ts` resolves the current account home and designated instructor access. A type containing `ADMIN` does not mean ADMIN is supported by current backend mapping. Google and recovery controls indicate unavailable behavior; no OAuth or recovery flow exists.

Server guards and client revalidation both fail closed. Student identity/profile state is UUID scoped; localStorage auth-change events request backend verification rather than supplying identity. Client workspaces are hidden/inert while checking, yet retain same-account editor state during recoverable rechecks. Instructor revalidation also uses a visible-tab 60-second interval. Preserve stale-response/abort handling.

## Connected data and content editing

`frontend/app/lib/learning/client.ts` is the shared credentialed, no-store learning transport; failures throw `LearningError` with HTTP status. `catalog.ts` maps `PublishedCourse` into existing student data and keeps publication/activity reference maps. `domain.ts` exports the pure rules bundled into the backend. Keep React/browser APIs out of that bundle's dependency graph.

Student activity type names differ from routes/references:

| Authoring type | Student reference kind | URL prefix | Progress field |
| --- | --- | --- | --- |
| `theory` | `lesson` | `/lessons` | `lessons` |
| `quiz` | `quiz` | `/quizzes` | `quizzes`, `quizHistory`, `quizSessions` |
| `lab` | `exercise` | `/challenges` | `challenges`, `labChecks` |
| `workshop` | `project` | `/projects` | `projects`, `workshops` |

New activities can use their authoring ID as the public reference; existing content retains stable legacy references. Shared `repository.ts` is still the pure command engine and historical local repository implementation; the live Instructor provider uses **RemoteInstructorRepository**. Similarly, local student storage/mock-auth modules remain for compatibility/tests, not active dashboard authentication.

Each editor separates structural validity (drafts can be incomplete) from publish readiness. Its matching `*-types.ts` and domain file define the data contract. Theory has heading/paragraph/list/code/callout/resource blocks; Quiz supports ordered questions, 2–6 options, points and a correct option; Lab has starter/solution source, widths and structured checks; Workshop has steps, requirements, deliverables, resources, starter source, submission guidance and private feedback guidance. Editor saves do not publish automatically.

## Code workspace and previews

- `code-workspace.tsx` is shared by lessons, labs, workshops and playground: file tabs, Run/Stop, console messages, viewport controls, explicit draft save/reset, dirty-state handling and accessible textarea mode.
- `monaco-code-editor.tsx`, `monaco-runtime.ts`, `lib/student/editor-session.ts`, `editor-emmet.ts`, and `editor-settings.ts` manage workers, models, completions and lifecycle. `scripts/prepare-monaco.mjs` generates ignored local worker assets during install/dev/build/test hooks.
- Use model identity by verified account, workspace and component instance. Existing tests cover React cached Activity restoration/disposed-editor behavior; preserve these rules when changing wrappers.
- `lib/student/preview.ts` builds restricted iframe documents; `lab-check-runner.tsx` validates fixed-width results, timeouts and obsolete runs. Authored checks use `lib/instructor/lab-preview.ts`; legacy checks use `lib/student/lab-validation.ts`.
- `workspace-images.tsx` and `lib/student/workspace-images.ts` manage raster image validation and local quotas. Image bytes remain local even when their code references are account-saved. No image storage API exists.
- `editor-boundary.tsx` and dynamic loading let users fall back to the accessible editor. Preview isolation is not established by JSDOM alone; verify real browser behavior for changes affecting it.

## Theme, typography and CSS

`globals.css` imports Tailwind 4, declares semantic tokens for light/dark, and maps them into `@theme inline`. `layout.tsx` exposes `--font-geist-sans` / `--font-geist-mono` from `next/font/google`. Use the existing fonts; prose uses Geist, code uses Geist Mono/Monaco defaults where configured.

| Semantic token | Light | Dark |
| --- | --- | --- |
| `--background` | `#FAF9F6` | `#141A21` |
| `--surface` | `#FFFFFF` | `#202934` |
| `--foreground` | `#202A32` | `#F1F3F5` |
| `--secondary` | `#69737B` | `#A5AFBA` |
| `--border` | `#E6E5E0` | `#303B47` |
| `--action` | `#315DB5` | `#7FA5F4` |
| `--error` | `#B42318` | `#FFB4AB` |

Use tokens and existing washes (`--html-wash`, `--css-wash`, `--js-wash`), `--on-action`, muted surfaces and `color-mix()` rather than one-theme literal colors. Subject marks use orange HTML, blue CSS and gold JavaScript. Instructor CSS adds `--ins-*` tokens; Student CSS adds `--student-*` tokens.

`theme-script.ts` sets `<html data-theme>` before paint from `decode-theme`; `theme-toggle.tsx` updates it and syncs storage events. Only explicit light/dark is implemented, defaulting light; no system-theme mode exists. Keep script/toggle keys aligned and storage-failure behavior functional.

Styling combines Tailwind utilities and ordinary scoped CSS, much of it in `@layer components`. Prefixes are `decode-*` for landing/shared controls, `auth-*`, `student-*`, and `ins-*`. There is no universal spacing-token scale: reuse neighboring styles. Common spacing uses 4/8/12/16/24-pixel increments, with component-specific values (for example Student cards use 22px padding). Controls commonly use 8px radii, cards/dialogs 12px, and 44px touch targets. Avoid imposing a new global system on one page.

### Shared components and motion

Reuse `components/landing/wordmark.tsx`, `components/theme-toggle.tsx`, `components/student/student-icon.tsx`, Student heading/progress/activity primitives in `learning-overview.tsx`, breadcrumbs/navigation in `activity-chrome.tsx`, and Instructor `ui.tsx` (`PageHeading`, `Empty`, `Modal`, `Actions`, etc.). Feature CSS stays near feature components.

Landing interactions, logo/code-demo/marquee and owl use CSS keyframes plus targeted state. `landing/interactions.tsx` supplies motion controls; `.decode[data-motion="paused"]` pauses animations. Student disclosures/interactions and Instructor controls use short transitions (often 180–220ms). Respect `prefers-reduced-motion`, keep keyboard focus visible, gate hover transforms to suitable pointer devices, and avoid replacing animation infrastructure with a dependency.

### Responsive behavior

Breakpoints are component-specific: Student navigation switches to a drawer at 760px, Instructor at 860px; Student grids/editor layout also adjust near 1000/1100px and narrow-screen overrides. Landing uses 640/768px breakpoints. Read the relevant CSS before changing them rather than assuming one framework breakpoint governs all views.

Preserve stacked editor/preview modes, constrained horizontal scrolling, mobile text-input sizing, native dialog focus restoration, skip links, keyboard navigation, and reduced motion. Test at narrow and wide widths in both themes; CSS tests with simulated geometry are not a replacement for real layout inspection.

## Loading, error and empty states

- Server session verification uses Suspense. Student displays a checking state; Instructor's outer Suspense fallback is null. Unavailable verification displays recovery UI and never exposes protected content.
- Connected progress gates activity rendering until catalog/progress are ready, shows saving/errors, retains failed work in memory, and exposes retry. Retrying is not a durable offline guarantee; do not leave a page with unsaved work.
- Instructor provider hides the seeded snapshot until connected initialization succeeds; warning/error messages are visible. Remote command conflicts refresh acknowledged state rather than silently overwriting it.
- Editors show invalid/incomplete readiness, dirty-state/conflict warnings, unknown-ID recovery and archive/read-only states. `EditorBoundary` handles Monaco rendering failure.
- `RemoteActivity` displays unpublished/unavailable content. Submissions/insights distinguish loading, empty and request errors. There are no dedicated Student/Instructor `loading.tsx` / `error.tsx` route files in this checkout; most handling is component-level. Admin branch-only boundaries must not be assumed available.

## Where to make changes

| Requested change | Verified starting locations |
| --- | --- |
| Landing page redesign | `frontend/app/page.tsx`, `frontend/app/components/landing/`, `frontend/app/globals.css` |
| Login/register/animated owl | `frontend/app/login/page.tsx`, `frontend/app/register/page.tsx`, `frontend/app/components/auth/auth-form.tsx`, `auth-shell.tsx`, `auth.css`, `animated-owl.tsx` in that auth directory |
| Student course cards | `frontend/app/components/student/learning-overview.tsx` (`CourseCard`), `learning.css`; data projection in `frontend/app/lib/learning/catalog.ts` |
| Student curriculum/dashboard | `frontend/app/components/student/curriculum-view.tsx`, `dashboard-view.tsx`, `continue-learning.tsx`; rules in `frontend/app/lib/student/curriculum.ts` |
| Student lesson reader/practice | `frontend/app/components/student/lesson-view.tsx`, `lesson-outline.tsx`, `lesson.css`; authored blocks from `catalog.ts` |
| Theory lesson editor | `frontend/app/components/instructor/theory-editor.tsx`, `theory-block-fields.tsx`; `frontend/app/lib/instructor/theory.ts`, `theory-types.ts` |
| Student quiz interface | `frontend/app/components/student/quiz-view.tsx`, `activity-progress.ts` under `frontend/app/lib/student/`, `progress-provider.tsx`; grading in backend, not the view |
| Instructor quiz editor | `frontend/app/components/instructor/quiz-editor.tsx`, `quiz-question-fields.tsx`, `quiz-preview.tsx`; `frontend/app/lib/instructor/quiz.ts`, `quiz-types.ts` |
| Coding editor/preview/lab checks | `frontend/app/components/student/code-workspace.tsx`, `monaco-code-editor.tsx`, `lab-check-runner.tsx`; `frontend/app/lib/student/preview.ts`, `lab-validation.ts`; `frontend/app/lib/instructor/lab-preview.ts` |
| Instructor lab editor | `frontend/app/components/instructor/lab-editor.tsx`, `lab-check-fields.tsx`; `frontend/app/lib/instructor/lab.ts`, `lab-types.ts` |
| Curriculum builder/course publishing | `frontend/app/components/instructor/curriculum-view.tsx`, `courses-view.tsx`, `curriculum-form.tsx`; `frontend/app/lib/instructor/repository.ts`, `remote-repository.ts`, `types.ts`; publication in `frontend/app/lib/learning/domain.ts` and backend service |
| Workshop authoring | `frontend/app/components/instructor/workshop-editor.tsx`, `workshop-fields.tsx`, `workshop-entry-list.tsx`; `frontend/app/lib/instructor/workshop.ts`, `workshop-types.ts` |
| Workshop submissions/review | `frontend/app/components/student/project-view.tsx`, `frontend/app/components/instructor/submissions-view.tsx`, `frontend/app/lib/learning/submissions.ts`; backend learning service/controller |
| Student insights | `frontend/app/components/instructor/insights-view.tsx`, `overview-view.tsx`; backend `LearningService.insights()` |
| Dashboard navigation | `frontend/app/components/student/student-shell.tsx`, `sidebar.css`, `page-navigation.tsx`; `frontend/app/components/instructor/instructor-shell.tsx`, `instructor.css` |
| Theme switching/colors | `frontend/app/components/theme-toggle.tsx`, `theme-script.ts`, `theme-toggle.css`, `frontend/app/globals.css` |
| Profile/avatar/preferences | `frontend/app/components/student/profile-view.tsx`, `profile-provider.tsx`, `student-avatar.tsx`; `frontend/app/lib/student/student-profile.ts` (browser-only profile) |
| Admin pages | Absent locally. Inspect **branch-only** `feature/admin-dashboard:frontend/app/admin/`, `frontend/app/components/admin/`, `frontend/app/lib/admin/`; resolve integration via [status](PROJECT-STATUS.md#deferred-admin-dashboard) before editing. |

When a table cell abbreviates neighboring filenames, they belong to the explicitly named directory in that cell. [Workflow testing guidance](DEVELOPMENT-WORKFLOW.md#testing-before-review) maps these changes to relevant checks. Update route maps/contracts/status when behavior changes.
