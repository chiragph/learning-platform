# DECODE — Stage 4B lab validation fix

> **Historical stage report.** Current auth, account persistence, Instructor access and submission behavior may supersede this report. Use the [current frontend guide](../../docs/FRONTEND-GUIDE.md), [architecture](../../docs/PROJECT-ARCHITECTURE.md) and [status](../../docs/PROJECT-STATUS.md) for implementation work; retain this report for design rationale and dated validation.

Date: 2026-10-25. Scope: the shared Check Solution pipeline only, on feature/student-dashboard. No backend, database, authentication, curriculum IDs, Monaco lifecycle, or progress semantics changed. No Git staging, commit, push, merge, or branch switch.

## Root cause and evidence

The visible Run Code preview and Check Solution use separate iframe documents. Check Solution creates fixed-width probes inside a fully clipped, inert container. The probe bootstrap waited for two nested requestAnimationFrame callbacks before evaluating any requirement. Browsers can suspend rendering callbacks for invisible cross-origin frames; sandbox="allow-scripts" deliberately gives these probes an opaque origin. The DOM could be correct while evaluation never started, so no lab-result message reached the parent and its existing 7,000ms watchdog expired.

This matches [Chromium’s invisible-frame rendering throttling](https://codereview.chromium.org/1246173002) and [Chrome’s visibility-dependent animation scheduling](https://developer.chrome.com/blog/timer-throttling-in-chrome-88). A regression reproduced the missing-result failure before the fix by withholding rendering callbacks while executing the actual generated document with the supplied HTML. It passes after the fix. Existing development and production output was also inspected: the serialized evaluator was self-contained, rather than depending on missing bundle variables.

A secondary reporting defect was that an exception inside the evaluator produced a generic error message that the parent ignored. This also appeared to users as a timeout. Such failures now use a distinct, fail-closed lab-error response.

## Pipeline after the fix

1. Check Solution invalidates any earlier verified result and snapshots the current code, images, and unique job token.
2. A commit-time layout effect installs the parent message listener before a fast srcDoc can return. The existing 7-second watchdog remains unchanged.
3. Each fixed-width probe remains sandboxed with allow-scripts only, without allow-same-origin. The restrictive CSP and image policy are unchanged. Student JavaScript and all DOM checks run inside the probe.
4. After DOMContentLoaded, the next task runs the existing evaluator. This lets student DOM-ready handlers finish without depending on a repaint. Computed-style and geometry reads synchronously resolve layout at the probe viewport.
5. The iframe sends a tokenized lab-result containing each requirement, or lab-error if the checker itself throws. Student script errors still fail the runtime requirement while the other requirements are evaluated.
6. The parent requires the exact probe window source, current token, ordered requirement IDs, and Boolean results. CSS labs must return results for both 320px and 800px; a requirement passes only at every configured width.
7. Individual results retain Passed / Needs work feedback and requirement-specific guidance. Checker errors stop promptly; timeout, cancellation, edits, unmounts, malformed messages, and stale messages cannot enable completion.
8. A passing check saves the check record and enables the existing Complete lab action. That explicit action records completion through the existing per-student progress provider. Dashboard, My Learning, and My Progress consume that same record. Visits, drafts, checks, and completion remain separate.

## HTML heading requirements

| Requirement | Validation | Regression coverage |
| --- | --- | --- |
| Exactly one main heading | Exactly one h1 | Extra h1 fails independently |
| Heading says Hello, DECODE! | Exact trimmed h1 text | Different text fails independently |
| A paragraph with meaningful text | At least one nonempty trimmed p | Blank/missing paragraph fails independently |
| Code runs without JavaScript errors | No captured script/interaction errors | Throwing script fails independently |

The supplied h1 and paragraph pass all four. Checks remain deterministic and task-specific; simply rendering or running code does not grant completion.

## Other five labs

The same scheduling and error-handling fix applies to html-link, css-card, css-grid, javascript-button, and javascript-list. Their existing validators and requirements are unchanged. All six labs execute in tests with animation callbacks withheld. HTML checks exercise semantic structure; JavaScript checks exercise repeated clicks and runtime errors. CSS tests cover both configured widths using explicit geometry/style fixtures because JSDOM has no layout engine.

## Exact files changed for this fix

- app/lib/student/preview.ts — DOM-ready task scheduling and distinct checker-error protocol.
- app/components/student/lab-check-runner.tsx — commit-time subscription and source/token-validated checker failure handling.
- tests/learning-activities.test.mjs — suspended-rendering regression, independent heading requirements, DOM-ready handlers, and evaluator-error handling; existing six-lab cases now run without animation callbacks.
- tests/learning-activity-views.test.mjs — execute generated probe documents through real result handling; invalid/passing feedback, explicit completion, reloads, draft preservation, three progress views, account isolation, checker failures, and late results after timeout.
- docs/student-lab-validation-fix.md — this report.

Existing unstaged work from earlier stages was preserved. No dependencies were added.

## Validation

- ESLint: passed, no errors or warnings.
- TypeScript (npx tsc --noEmit): passed.
- Full frontend suite (npm test): 74/74 passed, including seven additional tests. Existing Monaco lifecycle, Emmet, uploads, authentication, profile, quizzes, workshops, and curriculum tests passed.
- Production build (npm run build): passed; all 64 static pages generated. Existing Next.js workspace-root / multiple-lockfile warnings remain unchanged.

## Browser review and limitations

Automated runtime/UI tests use JSDOM and controlled window-message bridging, not a physical browser. They do not enforce iframe origin isolation or perform real CSS layout. The iframe sandbox/CSP attributes are preserved and checked. Computer-use tooling could read the embedded localhost app, but navigation was blocked by its input guard; no successful browser interaction verification or lab screenshot is claimed.

1. Sign in with a demo student and open /challenges/html-heading. In a fresh or incomplete lab, enter the supplied HTML, leaving JavaScript empty. Click Check Solution: expect four Passed rows without a timeout.
2. Click Complete lab. Confirm the completed activity in /courses, updated HTML and overall progress in /dashboard and /progress, then reload and verify persistence. Confirm Continue Learning still targets this lab. Save Draft separately to retain editable code.
3. With an incomplete lab/account, add an extra h1, change the title, empty the paragraph, and add a throwing JavaScript statement one at a time. Each corresponding requirement should fail; Complete lab must stay disabled. A later failed experiment must not revoke an already earned completion.
4. Repeat checks, edit during a check, cancel, and navigate away/back. Earlier results must not complete changed code. Confirm a genuine timeout leaves completion disabled and a subsequent check can run.
5. Review all five other labs, especially CSS results at both 320px and 800px and repeated JavaScript interactions. Verify valid and invalid outcomes against the published requirements.
6. Confirm iframe access to parent DOM/storage remains blocked in the browser. Review desktop/mobile layouts, light/dark themes, code drafts, Emmet, uploads, and normal Run Code behavior.

Stop after this fix for visual and functional review. No additional stages or engines implemented.
