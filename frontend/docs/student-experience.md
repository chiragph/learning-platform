# DECODE student experience

## Run the development demo

Run `npm run dev` (`npm.cmd run dev` from Windows PowerShell), then open `/login`.

- Email: **student@example.test**
- Published demo passphrase: **Decode123!**
- Remember me uses localStorage; otherwise the session uses sessionStorage and survives refresh in that tab.
- Registration accepts a new fictional address such as `learner@example.test`. Aliases must start with a letter and contain 2–25 lowercase letters, digits, or hyphens. Addresses are case-insensitive. Use the same published passphrase in both password fields and enter a fictional full name for form validation.
- Real email domains are rejected. Names and passwords are never persisted. Only fictional aliases are saved; display labels and example.test emails are generated from them. Do not put personal information or secrets into code drafts either.
- Duplicate aliases are detected in this browser. Login to an unknown alias or with an incorrect passphrase shows an error. The built-in student account always exists.
- These are browser-local demo identities, not secure authentication. There are no admin/instructor roles or permissions. Demo login, registration, and restored sessions are disabled unless `NODE_ENV` is `development`; `npm run build && npm start` shows an unavailable notice on student routes and the original authentication-unavailable notice on the auth forms.

## Routes and module checks

| Route | Behavior / manual check |
| --- | --- |
| `/login`, `/register` | Test invalid fields, mismatched confirmation, a duplicate fictional email, wrong passphrase, Remember me, password visibility and the unchanged owl reactions. Submit valid demo values to reach the dashboard. |
| `/dashboard` | Starts with zero actual completions and no quiz score. Complete activities elsewhere, return, and verify totals, current lesson, next recommendation, and recent activity. |
| `/courses` | Three course cards with percentages from shared progress. |
| `/courses/[id]` | IDs: `html`, `css`, `javascript`. Navigate the complete lesson list or course quiz. |
| `/lessons` | All 25 lessons organized by course. |
| `/lessons/[id]` | Examples: `html-introduction`, `css-box-model`, `javascript-events`. Copy a snippet, mark complete, move previous/next, refresh, and verify the completion persists. Visiting a lesson updates the current lesson without marking it complete. |
| `/quizzes` | Three course quizzes with latest and best saved scores. |
| `/quizzes/[id]` | IDs: `html`, `css`, `javascript`. Choose answers, navigate freely, try submitting incomplete answers, then submit all. Explanations appear only after submission. Retry with a lower score and verify the best remains. There are 25 questions covering each lesson topic. |
| `/playground` | Switch among three templates, edit all languages, Run, check logs/errors, change preview width, Stop, Reset, and Save draft. Refresh to restore the saved source. Each template has its own draft. |
| `/challenges` | Six beginner exercises, filterable by subject. |
| `/challenges/[id]` | IDs: `html-heading`, `html-link`, `css-card`, `css-grid`, `javascript-button`, `javascript-list`. The heading, link and button exercises perform basic checks on Run. Other exercises explicitly use self-review. Editing invalidates a pending check/review. |
| `/projects` | Four guided projects with saved-draft and completion status. |
| `/projects/[id]` | IDs: `portfolio`, `landing-page`, `calculator`, `todo-list`. Follow the steps, edit/run, save, refresh, review, and explicitly mark complete. All project completion is self-reviewed. Runtime preview state resets on Run; source drafts persist when saved. |
| `/progress` | Verify course units, lesson/challenge/project counts, latest/best quiz performance, attempts, and activity. |
| `/profile` | View the fictional identity, log out, or intentionally reset this account's progress and drafts through a confirmation. Cancel should preserve data. |

Also test logout followed by a direct student URL: the development guard redirects to `/login` after hydration. Refresh a signed-in tab to restore its session. Register/sign into a second fictional alias and verify the first account's progress/drafts do not appear. Real authorization must be enforced by a future server; this guard is a demo UX boundary only.

## Progress calculation and persistence

Each course has one equally weighted unit per lesson, one quiz unit earned when its **best** score reaches 70%, and one unit per course challenge. HTML and CSS have 11 units each; JavaScript has 12. A course percentage is `round(completed / total * 100)`. Overall course progress uses all 34 units, rather than averaging rounded course percentages. Four cross-course projects are tracked separately.

Storage is versioned and validated on load. Unknown content IDs and malformed records are ignored. Keys are `decode-demo-accounts-v1`, `decode-demo-session-v1`, and `decode-learning-v1-<fictional-alias>`. Learning records contain unique completed IDs, quiz latest/best/attempt counts, current lesson, the most recent 20 activities, and saved source drafts. The existing `decode-theme` key and light-by-default behavior are unchanged. Storage events synchronize learning records and persistent session changes between tabs; simultaneous edits use the last saved record.

Drafts save explicitly with **Save draft**. The editor shows unsaved state and a native unload warning; internal navigation/template changes require saving first. Reset replaces editor contents after confirmation and keeps the previously saved draft until Save is selected. Storage quota/privacy failures show an alert and preserve the last saved record. Reset from Profile deletes learning records/drafts for only the current alias, not the registered alias list or theme.

## Architecture

- `app/lib/student/types.ts`: replaceable content/progress contracts.
- `courses.ts`, `quizzes.ts`, `challenges.ts`, `projects.ts`, `templates.ts`: structured local teaching content.
- `mock-auth.ts`, `storage.ts`: isolated development-only identity and browser storage adapters.
- `progress.ts`: pure normalization, scoring-related progress updates, completion and recommendation calculations.
- `preview.ts`: isolated document builder, preview bridge and message validation.
- `app/components/student/`: shared shell/providers, reusable editor, and module-specific views.
- `app/(student)/`: thin route wrappers and static parameters. Student pages opt out of Next 16 instant-navigation validation because the browser-local session guard intentionally withholds their children during server rendering. This does not disable validation for unrelated public routes.

The playground uses accessible, dependency-free textareas rather than adding an editor package. Learner JavaScript runs only as a script within an iframe with `sandbox="allow-scripts"`, no same-origin permission, and no application storage access. A document CSP blocks connections, external scripts/assets, nested frames, workers, and form submissions. HTML scripts and navigation metadata are removed during parsing; scripts belong in the JavaScript editor. External link clicks are prevented. The parent checks the iframe source, per-run token, message schema and message count. No learner code is evaluated in the parent or uploaded by the application.

This is a local learning tool, not a hardened hostile-code grading service. Browser sandboxes do not provide a reliable CPU/memory timeout; infinite loops may require closing/reloading a tab. Basic checks inspect only the specified conditions and can be bypassed by authored code; they are not trusted grades. Quiz answers necessarily ship with the frontend data, though the interface never reveals them before submission. Browser storage is readable and editable by the browser user, and clearing it loses local records.

## Validation

- `npm test`: focused tests of demo registration/login/errors/logout/production lockout, validation, lesson completion/idempotence, quiz scoring/latest/best, complete-course calculation, per-account draft restoration/reset, corrupt records, preview serialization/message schemas, and preview basic checks/logging/error reporting using a DOM test double.
- `npm run lint`.
- `node node_modules/typescript/bin/tsc --noEmit`.
- `npm run build`.
- HTTP smoke tests covered 25 development URLs, then all 14 student route patterns after the documented instant-navigation opt-out. Sampled production student routes showed the unavailable notice, and production login preserved its authentication-unavailable message.

No browser is connected in the available browser-control environment. Actual client navigation/redirects, interactive login/logout, theme persistence, keyboard focus, owl reactions, iframe enforcement in a browser, and desktop/tablet/mobile rendering have **not** been exercised end-to-end. Logic/runtime-harness tests and HTTP checks do not replace those browser checks. Before acceptance, test at 320px, 768px, and desktop widths, both themes, keyboard-only input, and reduced motion. The existing multiple-lockfile workspace-root warning is unrelated and remains unchanged.

## Future backend integration

Replace the mock adapter with server-verified sessions and server-enforced authorization. Add real registration/password hashing/recovery, verified account ownership and optional OAuth, HTTP-only session cookies, server-side validation/rate limiting, and an authenticated API for progress and draft persistence. Replace content arrays with API repositories that preserve the existing types and stable IDs. Authoritative quiz scoring/attempts and code grading need server-owned answers/tests and an isolated, resource-limited execution service. Define migrations/conflict resolution for optional demo imports; never treat local demo roles, completion claims, or scores as authorization or trusted grades.

## Exact file inventory

Modified existing files:

- `app/components/auth/auth-form.tsx`
- `package.json` (test script only; no dependency changes)

Added files:

```text
app/(student)/layout.tsx
app/(student)/dashboard/page.tsx
app/(student)/courses/page.tsx
app/(student)/courses/[id]/page.tsx
app/(student)/lessons/page.tsx
app/(student)/lessons/[id]/page.tsx
app/(student)/quizzes/page.tsx
app/(student)/quizzes/[id]/page.tsx
app/(student)/playground/page.tsx
app/(student)/challenges/page.tsx
app/(student)/challenges/[id]/page.tsx
app/(student)/projects/page.tsx
app/(student)/projects/[id]/page.tsx
app/(student)/progress/page.tsx
app/(student)/profile/page.tsx
app/components/student/student-provider.tsx
app/components/student/student-shell.tsx
app/components/student/student.css
app/components/student/progress-provider.tsx
app/components/student/learning-overview.tsx
app/components/student/lesson-view.tsx
app/components/student/quiz-view.tsx
app/components/student/code-workspace.tsx
app/components/student/playground-view.tsx
app/components/student/challenge-view.tsx
app/components/student/project-view.tsx
app/components/student/progress-view.tsx
app/lib/student/types.ts
app/lib/student/storage.ts
app/lib/student/mock-auth.ts
app/lib/student/courses.ts
app/lib/student/progress.ts
app/lib/student/quizzes.ts
app/lib/student/templates.ts
app/lib/student/preview.ts
app/lib/student/challenges.ts
app/lib/student/projects.ts
tests/student.test.mjs
docs/student-experience.md
```

The landing page, existing theme implementation, animated logo/owl files, backend, database, environment files, and dependencies are unchanged. Everything remains local and uncommitted on `feature/student-dashboard`.
