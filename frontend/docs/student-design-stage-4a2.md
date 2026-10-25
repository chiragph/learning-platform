# DECODE — Student Workspace Refinements, Stage 4A.2

Implemented on `feature/student-dashboard`. This report describes only the Stage 4A.2 changes; the working tree also contains the earlier Stage 4A and 4A.1 implementation. All work remains unstaged and uncommitted. No branch switch, commit, push, merge, backend/database change, or Stage 4B/4C/instructor work was performed.

## Implementation

The Profile now offers 14 original local SVG presets: Owl, Fox, Robot, Cat, Panda, Bear, Penguin, Frog, Rabbit, Koala, Astronaut, Dinosaur, Otter, and Tiger. The ten new IDs extend the existing version-1 demo profile schema. The same avatar renderer and profile context drive the header and Profile. The picker uses native radio controls, a responsive grid, focus rings and restrained selection/save feedback that respects reduced motion. Existing names, avatar IDs and stored profiles remain valid.

Desktop navigation collapses from 228 px (206 px at narrower desktop widths) to 76 px. A persistent, labeled toggle stays available; icon links retain accessible names, active-route dots, and keyboard/mouse tooltips. The preference lives in `decode-sidebar-collapsed`; storage failure keeps the control usable for the current visit. The mobile off-canvas navigation retains its labels, modal semantics, focus trap, Escape/backdrop dismissal and body-scroll handling. Desktop collapse styling does not apply below 761 px. Main content can use up to 1440 px when collapsed. Existing Monaco automatic layout and the responsive editor split react to the available width.

“Practice this lesson” first shows the workspace, then uses its imperative handle to request focus. The owned Monaco session fulfills the request when ready, lays out and focuses the editor, and scrolls the stable editor panel to the top with an 88 px desktop / 80 px mobile sticky-header offset. Reduced motion uses instant scrolling. Repeated clicks generate fresh requests. Pending focus is cleared when a cached lesson is hidden/unmounted so route restoration does not replay it. There are no focus/scroll timing guesses or arbitrary timeouts; existing loader/runtime timeout safeguards remain. The accessible textarea also supports the reveal interaction.

All 25 theory lessons now begin with only these comments when no saved draft exists:

```html
<!-- Write your HTML code here -->
```

```css
/* Write your CSS code here */
```

```javascript
// Write your JavaScript code here
```

CodeWorkspace still gives an existing per-lesson draft priority. No storage migration or automatic write occurs. Reset restores the blank comments after confirmation; its saved draft stays intact until Save Draft is explicitly used. The read-only theory examples, instructions and full curriculum sequence remain present. Standalone Playground templates and its image/network policy remain unchanged.

## Emmet choice and lifecycle

I inspected the [maintainer’s Monaco integration and API](https://github.com/troy351/emmet-monaco-es) and the [Emmet core API](https://github.com/emmetio/emmet), then pinned `emmet-monaco-es@5.7.0`. It supports the installed Monaco version and uses the maintained Emmet core. The adapter uses its HTML provider for both suggestions and explicit Tab expansion, rather than maintaining a separate abbreviation parser.

Each Monaco runtime has one reference-counted provider. Each owned editor has a disposable Tab action. Native suggestions, snippet navigation and Tab-focus mode keep their normal key handling; unexpandable text falls back to Monaco indentation. Expansion checks the current model, selection and version before applying a snippet, and cancels edits after disposal/model changes. Provider and action registrations are released with their final owner. HTML, CSS and JavaScript models, completion workers, maximum file length, per-file view state, Strict Mode/Activity ownership and `vs-dark` remain in place. HTML is the relevant markup language in this curriculum; plain `script.js` is not treated as JSX.

## Lesson images and persistence

The “Images for this lesson” section contains Upload Image and Insert `<img>` controls. PNG, JPEG, WebP and GIF files are checked for MIME type, file signature and size. SVG uploads are excluded. Insert switches to the HTML model and inserts an escaped tag at its saved cursor; Run Code is still required to refresh the preview. Image removal requires an inline confirmation.

Images are saved separately from code/progress under `decode-images-v1-<encoded-student-id>/<encoded-workspace-id>`. A draft stores a short `decode-image:<uuid>` reference, not a base64 payload. Limits are 256 KiB per original file, four images per lesson, 768 KiB of serialized/encoded image characters per lesson, and 1.5 MiB of serialized/encoded image characters across all demo accounts/lessons in this browser. These are application limits; browser quota can still fail, and that failure is reported without discarding previous images or code. Images persist across reloads in this origin; clearing site data/browser storage removes them. Reset progress and drafts retains this separate image collection; individual images can be removed from their lesson.

Only the current account/lesson’s image list is passed to the preview. References are resolved inside its standalone document. Missing/deleted images lose their unusable src, gain explanatory alternate text and produce a console message. HTTPS online images are permitted for embedded lessons; the helper explains that URLs must be direct and public. Hotlink restrictions, authentication, remote server failures, and mixed-content HTTP images can prevent loading. Image references are local to DECODE and are not portable as standalone HTML without replacing their src values.

The iframe retains `sandbox="allow-scripts"` with no same-origin access. HTTPS is added only to the lesson’s image CSP directive; network fetches, external scripts, frames, workers, form submissions and external navigation keep their existing restrictions. Student code runs only in the iframe. Uploads use FileReader data URLs, so no temporary object URLs are created. Pending readers are aborted on workspace hide/unmount/scope change, stale callbacks are ignored, and storage listeners are cleaned up. No backend or image service was added.

## Exact files changed in Stage 4A.2

Paths are relative to the repository root. Files already untracked from earlier stages are described as updated here when applicable.

| File | Change |
| --- | --- |
| `frontend/app/components/student/avatar-illustrations.tsx` | New local illustrations for ten additional avatars. |
| `frontend/app/components/student/student-avatar.tsx` | Shared SVG renderer for header and Profile; stable preset marker. |
| `frontend/app/components/student/profile.css` | Responsive avatar grid and motion-aware selection/save feedback. |
| `frontend/app/components/student/student-shell.tsx` | Persistent desktop collapse control, labeled icon links, keyboard tooltips; existing mobile dialog retained. |
| `frontend/app/components/student/sidebar.css` | Desktop width transition, compact sidebar, tooltip and mobile/reduced-motion rules. |
| `frontend/app/components/student/lesson-view.tsx` | Stable practice workspace handle and repeatable readiness-based focus requests. |
| `frontend/app/components/student/code-workspace.tsx` | Editor controls, queued HTML insertion, scoped images, practice reveal and preview configuration. |
| `frontend/app/components/student/code-workspace.css` | Sticky-header scroll offset and responsive image controls. |
| `frontend/app/components/student/monaco-code-editor.tsx` | Expose controls from the owned session after Monaco initialization. |
| `frontend/app/components/student/workspace-images.tsx` | Validated local upload UI, persistence, insertion and confirmed deletion. |
| `frontend/app/lib/student/student-profile.ts` | Four legacy presets plus ten additional stable avatar IDs. |
| `frontend/app/lib/student/lesson-practice.ts` | Blank starters for all 25 theory lessons; existing draft priority unchanged. |
| `frontend/app/lib/student/editor-session.ts` | Owned focus/insert controls and disposable Emmet Tab action. |
| `frontend/app/lib/student/editor-emmet.ts` | Maintained HTML Emmet provider, explicit Tab expansion and reference-counted registration. |
| `frontend/app/lib/student/workspace-images.ts` | Scoped image storage, validation, budget enforcement and escaped HTML references. |
| `frontend/app/lib/student/preview.ts` | Optional HTTPS image policy and local-reference resolution inside the isolated iframe. |
| `frontend/package.json` | Pin emmet-monaco-es 5.7.0. |
| `frontend/package-lock.json` | Lock Emmet and its dependencies. |
| `frontend/tests/editor-lifecycle.test.mjs` | Practice readiness/repeated clicks/history, blank reset, insertion at HTML cursor and lifecycle regressions. |
| `frontend/tests/profile-lifecycle.test.mjs` | 14 presets, new-avatar persistence and actual header/Profile propagation. |
| `frontend/tests/student-views.test.mjs` | Sidebar persistence, accessible tooltip, active route and mobile dialog regressions. |
| `frontend/tests/student.test.mjs` | Blank starters, legacy draft preservation and expanded preset expectations. |
| `frontend/tests/workspace-refinements.test.mjs` | Real Emmet provider/action tests; image validation, persistence, deletion, cancellation and preview resolution. |
| `frontend/docs/student-design-stage-4a2.md` | Implementation report and visual-review checklist. |

## Validation

- `npm run lint`: passed with zero errors/warnings after the final source changes.
- `npx tsc --noEmit`: passed.
- `npm test`: all 52 tests passed.
- `node --test tests/profile-lifecycle.test.mjs`: all 5 passed again after strengthening coverage to use the actual application header.
- `npm run build`: passed, including Next TypeScript validation and generation of all 64 pages.
- `git diff --check`: passed; Git printed its existing LF/CRLF conversion notices.
- Dependency installation audit: 0 vulnerabilities reported.

Existing Next.js warnings about multiple workspace lockfiles remain; configuration and unrelated lockfiles were preserved. The regression suite continues to cover the 38 activity IDs, ordering, real completion calculations, quiz scoring, Continue Learning, isolated drafts/progress, authentication restoration/protection, hydration, and Monaco model ownership. New tests exercise practice requests before readiness and across repeated/cached navigation, reduced motion, sidebar/mobile behavior, expanded profile selection, image persistence/limits/preview resolution/cursor insertion, and all requested Emmet abbreviations.

The Emmet tests invoke the actual installed provider and the registered Tab action using a Monaco API/tokenizer double. UI tests use real React effects/Strict Mode/Activity and disposable JSDOM storage. They do not establish physical keyboard dispatch or rendered browser geometry.

## Browser verification status and review checklist

Browser verification is incomplete. CUA had no browser-tab provider, and its selected native Chrome window returned a screenshot of VS Code. I stopped UI input after that mismatch. No DECODE browser screenshot or physical Tab/layout/scroll verification is claimed.

Run `npm run dev` in `frontend` in a foreground terminal, then open `http://localhost:3000`. The development demo uses `student@example.test` with `Decode123!`; existing demo registration is also available. Demo sign-in remains disabled in the production build by the existing auth implementation. Use disposable test accounts for reset/removal checks.

- [ ] On `/profile`, inspect all 14 avatars at desktop, tablet and 360 px mobile widths. Select a new character by mouse and keyboard, save, confirm both header and Profile update, reload, and verify persistence. Cancel edits and confirm no profile change.
- [ ] Collapse/expand the desktop sidebar by mouse and keyboard. Check visible tooltips on hover/focus, Escape dismissal, active My Learning state on every activity route, increased editor width, no horizontal overflow, and preference after reload.
- [ ] At 760 px and below, verify the expanded-label mobile dialog, focus trap, Escape/backdrop close, restored menu focus and normal scrolling after close. A saved desktop collapsed preference must not shrink this dialog.
- [ ] On `/lessons/html-introduction`, choose Read, then Practice this lesson. Check that the editor opens visibly below the sticky header and receives the caret. Repeat the click, repeat after another lesson, and repeat while Monaco is still loading. Check normal browser Back/Forward scroll restoration and the reduced-motion setting.
- [ ] In a lesson with no draft, confirm all three files contain only their blank comments. The theory example must remain visible. Edit/save/reload, navigate to another lesson and back, then confirm Reset/cancel/Reset/Save semantics and per-lesson isolation. Existing saved code must remain unchanged.
- [ ] In index.html on a new line outside the starter comment, type and physically press Tab after each: `h2`, `p`, `div`, `ul>li*3`, `.container`, `lorem`, `lorem10`. Inspect the actual expansion and snippet caret. Verify blank-line indentation, normal HTML autocomplete, comments/attributes, Tab-focus mode, and CSS/JavaScript completion. Repeat in standalone Playground.
- [ ] In a lesson, upload small PNG/JPEG/WebP/GIF images; test rejected types, mismatched contents, 256 KiB and collection limits. Place the HTML cursor, switch to CSS, then Insert `<img>`; verify the tag is placed in HTML and other files stay intact. Run and check the actual image.
- [ ] Save/reload and run the image again. Confirm another lesson/account cannot resolve the same reference. Cancel/confirm deletion, run again, and inspect the missing-image message. Test denied/full browser storage and leaving during file reading.
- [ ] Try a known public direct HTTPS image URL. Inspect the opaque iframe sandbox, confirm parent application/storage isolation, and verify Playground keeps its previous preview restrictions.
- [ ] Inspect light/dark themes, keyboard focus, reduced motion, split resizing, sidebar-width transition, Monaco remounts after route changes, and browser console for hydration/lifecycle errors. Confirm lesson completion, quiz results and real profile/course percentages remain consistent.

Stage 4A.2 is ready for visual review.
