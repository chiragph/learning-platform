# DECODE — Stage 3 review

## Delivered scope

Stage 3 adds Monaco to the shared code workspace, redesigns `/playground`, and redesigns the theory library and lesson reading/practice views. No new routes were added. Quiz, challenge/project-specific redesigns, creative profile, instructor tools and content publishing remain deferred.

The shared editor is also used by the existing challenges and projects. Their instructions, checking/completion rules and surrounding page implementations remain unchanged.

## Monaco and local assets

- `@monaco-editor/react` 4.7.0 with `monaco-editor` 0.57.0, imported through a client component using `next/dynamic` with `ssr: false`.
- Bundled ESM runtime supplied to `loader.config({ monaco })`; Monaco is not loaded from the integration's default CDN. HTML/CSS/JavaScript syntax, completion providers, line numbers, automatic indentation, formatting-on-type/paste, bracket matching, diagnostics and per-file view/undo state are enabled.
- Custom DECODE light/dark editor themes follow the existing HTML `data-theme` attribute through a MutationObserver-backed external store. No changes were made to theme persistence or the before-paint script. Reduced motion disables smooth caret movement and cursor blinking.
- `scripts/prepare-monaco.mjs` uses esbuild 0.28.2 to bundle four local workers: editor, HTML, CSS and TypeScript/JavaScript. `postinstall`, `predev`, `prebuild` and `pretest` prepare/cache the assets in ignored `public/monaco-workers/`. The app serves them at `/monaco-workers/*.worker.js`.
- Worker assets are generated, not source-controlled. Build with development dependencies installed, and include the generated public directory in deployment artifacts. Runtime source and language workers come from the same pinned Monaco version.
- Monaco 0.57.0 pins DOMPurify 3.4.15. A targeted npm override pins the available patch 3.4.17; the resulting dependency audit reports zero vulnerabilities. No unrelated dependency versions were changed.
- Model URIs contain the fictional account, workspace, and mounted instance. Inactive as well as active models are disposed on unmount. Reset remounts the editor to clear all three file models, including cached inactive tabs.

Implementation guidance: [Monaco React loader and multi-model documentation](https://github.com/suren-atoyan/monaco-react#loader-config), [Monaco release notes](https://github.com/microsoft/monaco-editor/blob/main/CHANGELOG.md). The installed Next.js lazy-loading guide was read before implementation.

## Coding workspace behavior

- HTML, CSS and JavaScript file tabs with roving keyboard focus, unsaved indicators, Run Code, Reset confirmation, Save Draft, preview width toggle, Stop and console messages.
- Side-by-side panels when the workspace is wide enough; stacked panels when narrow or embedded in a lesson. The divider supports pointer/touch dragging, arrow keys, Home/End and double-click reset. Panel height is resizable from the lower corner.
- Ctrl/Cmd+Enter runs code; Ctrl/Cmd+S saves. Tab indents in Monaco. Ctrl+M on Windows/Linux or Ctrl+Shift+M on macOS changes Tab focus mode, as defined by Monaco. A labeled accessible textarea alternative is available for assistive input, constrained devices or editor-loading failures; Monaco remains the default editor.
- Each file retains the existing 100,000-character limit. Load/worker failures and delayed loading have visible feedback. Unsaved code stays in the parent workspace state if the editor fails.
- Preview updates only when Run is selected. It is interactive after running; there is no automatic execution on every keystroke.
- Existing playground/challenge/project draft IDs and explicit Save Draft semantics are unchanged. Template switching with unsaved edits requires canceling or explicitly discarding; the previous saved draft remains intact.

## Theory workspace behavior

- `/lessons`: searchable theory library grouped by course, actual completion counts and direct lesson/curriculum links.
- `/lessons/[id]`: course/module context, course contents, readable concept sections, line-numbered examples, Copy Code, practice instructions, lesson completion, quiz link and previous/next navigation.
- Optional integrated practice on 12 lessons: HTML text/lists/forms; CSS selectors/box model/Flexbox/Grid/responsive design; JavaScript conditions/functions/DOM/events.
- Practice starts from the actual lesson example with supporting HTML/CSS where needed. Reading remains the default, so Monaco is not mounted merely to read a lesson. Wider desktops can show reading and practice alongside each other; smaller screens stack them.
- Returning to reading hides rather than discards an already-open practice workspace. Save Draft persists its code before leaving the lesson. Like the existing workspaces, internal route changes require saving first; the native unload warning covers reload/tab closure with unsaved changes.
- Lesson practice uses `lesson-<existing-lesson-id>` drafts in the existing per-account progress record. Normalization adds only those known practice IDs to its allowlist. Storage version, lesson completion, quiz scores and course percentage calculations are unchanged; practice does not automatically complete a lesson.

## Sandbox preservation

`app/lib/student/preview.ts` is byte-for-byte unchanged. Learner JavaScript executes only in its sandboxed iframe with `sandbox="allow-scripts"`, no same-origin permission, the existing CSP/resource restrictions, disabled native form submission/external link clicks, source checking, per-run tokens, schema validation and message limits.

Monaco parses source for editing/diagnostics; it does not execute learner JavaScript in the application. Trusted local language workers are separate from the learner-code preview. No learner source is uploaded by the application.

Existing limits remain: preview code can consume browser CPU/memory, browser-local state is not secure authentication or trusted grading, and basic challenge checks are a learning aid rather than authoritative grading.

## Review locally

The existing development server at `http://localhost:3000` was used without being stopped or replaced. On a fresh checkout, run `npm ci` and `npm.cmd run dev`. The package hooks generate the worker files.

Development demo: `student@example.test` / `Decode123!`.

1. Open `/playground`. Confirm Monaco replaces the loading message. Type HTML tags, CSS properties and JavaScript expressions to check completion, colors, indentation, line numbers and bracket matching. Switch all three files, including cursor/undo state.
2. Edit all files, Run, interact with the result, introduce a syntax error and check runtime messages. Stop and rerun. Verify code never has access to parent application storage from the iframe.
3. Save a draft and refresh. Confirm all file contents restore. Reset, switch every file and rerun; confirm all models contain starter code. Reset alone must not overwrite the saved draft. Test the template-switch cancel/discard flow.
4. Toggle DECODE themes while Monaco is open. Resize the divider with pointer and keyboard, change preview width, test 320px/tablet/desktop layouts, and test the accessible editor and Tab-focus escape shortcuts.
5. Open `/lessons/html-introduction`: reading-only by default. Check the outline, Copy Code, completion and previous/next links.
6. Open `/lessons/html-forms`, `/lessons/css-grid` or `/lessons/javascript-events`; choose Read & practice. Edit/run/save, return to reading and reopen practice, then refresh and verify the saved draft. Completion remains a separate explicit action.
7. Recheck `/quizzes/html`, a challenge and a project; the shared Monaco workspace should preserve their previous behavior. Sign into another fictional account and verify drafts do not appear there.

## Validation and verification boundary

- ESLint, standalone TypeScript and production build checks are run for the completed Stage 3 sources.
- `npm.cmd test`: 21 tests covering existing auth, quizzes, progress, persistence, sandbox checks and Stage 1–2 UI, plus local worker syntax/routing, per-account model identity, resize bounds, lesson practice/draft restoration, client-only editor props and reading-first lesson markup.
- Development HTTP checks: eight routes (`/playground`, `/lessons`, three practical lesson URLs, quiz, project and challenge) returned 200. All four worker URLs returned 200 with JavaScript MIME types and nonempty bundled source.
- The preservation baseline confirms 63 existing application files are unchanged, including landing/auth/branding/theme, approved shell/dashboard/curriculum UI, lesson content, quiz logic/UI and preview builder. Only the explicitly listed Stage 3 files changed.
- Runtime dependency audit: zero vulnerabilities after the targeted DOMPurify patch override.

No browser is connected. Creating a browser tab was also attempted and returned “Browser is not available: iab.” Consequently the actual Monaco mount, completion popup/worker interaction, keyboard shortcuts, drag behavior, theme appearance, mobile layout and browser-enforced sandbox behavior are **not verified end-to-end**. Build, worker HTTP and component-render tests do not establish those interactive checks. These are the visual review items before approval.

The existing Next.js multiple-lockfile/workspace-root warning is unchanged and outside Stage 3.

## Exact files changed this iteration

Modified:

```text
.gitignore
eslint.config.mjs
package.json
package-lock.json
app/components/student/code-workspace.tsx
app/components/student/playground-view.tsx
app/components/student/lesson-view.tsx
app/lib/student/progress.ts
tests/student.test.mjs
tests/student-views.test.mjs
```

Added:

```text
scripts/prepare-monaco.mjs
app/lib/student/editor-settings.ts
app/lib/student/lesson-practice.ts
app/components/student/monaco-runtime.ts
app/components/student/monaco-code-editor.tsx
app/components/student/resizable-panels.tsx
app/components/student/editor-boundary.tsx
app/components/student/code-workspace.css
app/components/student/lesson-outline.tsx
app/components/student/lesson.css
docs/student-design-stage-3.md
```

Generated/ignored: four worker bundles, their license and version marker under `public/monaco-workers/`. The prior local work remains in place. No backend/database/environment files, branch, staging area or commits were changed. Stage 4 and later remain pending approval.

## Stage 3 stability follow-up

The installed `@monaco-editor/react` 4.7.0 `<Editor>` disposes its editor during effect cleanup but retains its editor ref, creation guard and ready state. This is unsafe when effects reconnect while React state survives. With this app's `cacheComponents: true`, Next.js 16.4.2 uses React Activity to hide and restore visited routes. On restoration the wrapper's model/update/onMount effects can operate on the disposed editor. Fast Refresh also replays effects while retaining refs/state. Monaco's editor owns a registered child instantiation service, so reusing the disposed editor can reach the disposed service. The additional DECODE cleanup independently disposed all models under the workspace URI prefix, giving models competing cleanup owners.

The new characterization test mounts the **actual installed wrapper** with real React DOM, Strict Mode and Activity in jsdom. A small Monaco double throws on access after disposal; hiding then restoring the wrapper reproduces that invalid access. The corrected adapter passes the same effect lifecycle. This verifies the lifecycle cause without claiming that jsdom renders the real Monaco DOM, completion UI or workers.

The adapter retains `@monaco-editor/react`'s configured loader and the existing bundled ESM runtime. It replaces the wrapper's editor lifecycle with one effect-owned session:

- Every setup creates a fresh editor; cleanup clears the exposed ref before releasing the session. Late loader resolutions from cleaned-up setups are ignored without cancelling shared runtime initialization.
- A session owns its exact models, actions, marker subscription and per-file view states. Tabs reuse the live editor and owned models. Cleanup unsubscribes, disposes the editor, then disposes active and inactive models, once. No global model-prefix disposal remains.
- Current callbacks are read from a committed ref, programmatic changes do not fire user edits, and oversized edits roll back. Initialization errors still reach the existing error boundary; no disposed-service error is caught and ignored.
- HTML/CSS/JavaScript language registrations, local worker configuration, editor options, theme synchronization, draft IDs, parent workspace code state, Run/Reset/Save behavior and iframe sandbox are retained. Activity resume rehydrates the active model from preserved workspace state.

The playground scrolls instantly to its heading on its first component entry, excluding explicit hash targets. A retained ref prevents later editor loading, theme/template updates, Strict Mode replay, Fast Refresh or cached Activity restoration from scrolling again. No global history/scroll-restoration setting or other route is changed.

Validation for this follow-up:

- `npm.cmd run lint`: passed, no warnings.
- `node node_modules/typescript/bin/tsc --noEmit`: passed.
- `npm.cmd run build`: passed, 62 pages generated. Existing multiple-lockfile/workspace-root warning remains.
- `npm.cmd test`: **26/26 passed**. Five new tests cover the original wrapper defect, repeated Strict Mode/Activity navigation, 24 tab changes, theme changes, model/view state, action callbacks, diagnostics, late initialization, oversized-edit rollback, reset cleanup and route-local entry scrolling.
- HTTP checks: playground, practical lesson, quiz and project routes plus all four local worker URLs returned 200; worker responses use JavaScript MIME types.
- A pre-edit hash baseline confirms **74 existing application files unchanged**, including the landing/auth UI, shell, lessons, quiz/progress logic, language runtime/worker setup, CodeWorkspace and preview security builder. Only the two intended existing application components changed; the session module is new.
- jsdom 30.1.3 is a development-only test dependency. Installation reported zero vulnerabilities.

No browser is connected (`apps: [], browsers: []`). Actual Monaco rendering/autocomplete, worker interaction, visual scroll placement, browser reload persistence and Fast Refresh must still be checked in a real browser. Review at `http://localhost:3000` using the existing development demo account, then repeatedly switch all three files, navigate playground → lesson → playground, toggle themes, use Reset and the accessible-editor switch, save/reload a draft, and trigger Fast Refresh with the editor open. The heading and primary controls should be visible on first entry; returning through cached history should retain the restored position. Recheck HTML autocomplete, CSS suggestions, JavaScript diagnostics and Run/Save keyboard shortcuts. Sandbox enforcement remains a browser check in addition to the existing passing security tests.

Exact files modified by this follow-up:

```text
app/components/student/monaco-code-editor.tsx
app/components/student/playground-view.tsx
package.json
package-lock.json
docs/student-design-stage-3.md
```

Exact files added by this follow-up:

```text
app/lib/student/editor-session.ts
tests/editor-lifecycle.test.mjs
```

All changes remain local on `feature/student-dashboard`. No Git mutation or Stage 4 work was performed.
