# DECODE — Stage 4B: Interactive Student Learning Activities

Implemented on `feature/student-dashboard`, building on the manually reviewed Stage 4A.2 workspace. Stage 4B covers the existing three quizzes, six labs and four guided workshops. The 38 curriculum activity IDs, nine modules, existing routes and draft keys are preserved. No backend, database, Prisma, authentication contract, instructor/admin dashboard, or Stage 4C implementation was added. No branch switch, staging, commit, push or merge was performed.

## Completed functionality

### Quizzes

The existing HTML, CSS and JavaScript question sets retain their IDs, answer keys and explanations. Each quiz shows one question, native answer radios, previous/next buttons, numbered question navigation and an answered-count progress bar. Students can change answers and revisit any question. Answers and the current question are saved as an unfinished session for the current demo account. Missing answers return the student to the first unanswered question without submitting.

Review & submit opens a labeled native confirmation dialog. Cancellation preserves answers. Confirmed submission scores the complete set, saves an attempt, and shows every selected answer, correct answer and explanation. Retrying starts a new session while keeping previous attempts and the best score. A lower retry score never revokes an earned passing completion. A passing attempt is at least 70%, matching the existing curriculum rule. The interface separately identifies an attempted/non-passing result, a passing result, and the activity’s earned curriculum completion.

Detailed answer history is retained for the latest 20 submissions per subject. Aggregate attempt counts, latest score and best score remain available beyond that limit. Old demo aggregates are preserved; answer histories for earlier submissions are not fabricated. A failed storage write leaves the visible result available and offers retry-save for the same attempt ID, avoiding double counting. In-memory unfinished answers are preserved when returning from answer-history review.

### Coding labs

All six existing `/challenges/[id]` routes now provide a dedicated lab experience: title, objective, instructions, expected outcome, explicit requirement descriptions, hints, the reusable Monaco workspace, live preview, Reset, Save Draft, Check Solution, and an explicit Complete lab action.

| Existing lab ID | Supported checks | Probe widths |
| --- | --- | --- |
| `html-heading` | Exactly one h1, exact greeting text, nonempty paragraph, no runtime errors | 800px |
| `html-link` | Unique main#learning, nonempty main heading, correctly labeled nav link and target, no runtime errors | 800px |
| `css-card` | Card content, padding, visible borders, paragraph line height, constrained centered width, viewport fit, no runtime errors | 320px and 800px |
| `css-grid` | Three cards, Grid display, one narrow/multiple wide columns, gaps, viewport fit, no runtime errors | 320px and 800px |
| `javascript-button` | Required elements, greeting update on first and repeated clicks, no runtime errors | 800px |
| `javascript-list` | Three initial nonempty goals, add button, exactly one appended goal on each of two clicks while retaining earlier items, no runtime errors | 800px |

The listed thresholds and hints are visible in the activity before checking. CSS checks use computed styles and actual element/viewport geometry in fixed-width sandboxed probes, independently of the workspace divider position. JavaScript checks exercise DOM behavior; merely running code or hardcoding a final greeting does not pass the interaction checks.

Check Solution runs fresh probes, aggregates each requirement across every required width, reports passed/needs-work feedback and saves the aggregate check record. The UI also shows which CSS viewport needs work. Code/image edits, a new check, cancellation or timeout cannot reuse an earlier pass to complete the current check. Completion requires a successful saved check for the current workspace and an explicit Complete lab action. Existing legacy completions remain earned. Code is saved only through Save Draft.

### Guided workshops

The existing Personal Portfolio, Responsive Landing Page, JavaScript Calculator and To-Do List content is reused on `/projects/[id]`. Each workshop includes its overview, objectives, expected outcome in the existing instructions, numbered guide, one selected step, a coding workspace, preview, saved draft, reviewed-step progress, and a final self-review/completion section.

Each of the 20 existing instructions now has a stable step ID, short title and display order. Every step is available immediately. Students can jump to any step, mark it reviewed, reopen it before completion, and resume the saved current step after reload. Marking a step saves its progress and moves to the next unreviewed step; it does not complete the project. Final completion requires all steps reviewed, a final self-review confirmation, and no unsaved code changes. The interface prompts Save Draft when needed.

Legacy completed projects remain completed without inventing reviewed-step records. Their guide and workspace remain available. Workshop completion is explicitly self-reviewed and is not presented as automatic grading. Preview runtime values, tasks and form state restart on Run; DECODE saves source drafts and guide progress.

### Shared workspace and navigation

Labs and workshops reuse CodeWorkspace, the owned Monaco lifecycle, Emmet, local workers, built-in `vs-dark`, three code tabs, accessible textarea alternative, responsive/resizable panels, console, explicit Run and draft/reset protections. They do not introduce another editor implementation or change standalone Playground templates/default restrictions.

The image controls now label their lesson, lab or workshop context and use the corresponding existing workspace ID. Saved image references, per-account/workspace isolation, raster validation, persistence, confirmed removal, and existing 256 KiB/file, four-image/workspace and encoded storage budgets are retained. HTTPS image previews are enabled for the new activity workspaces. Existing image storage keys are unchanged.

Activity breadcrumbs and previous/next links follow the same complete curriculum sequence. The student sidebar, collapse preference, profile customization, site themes and authentication are unchanged. The activity pages use the existing document-scroll navigation hook; explicit question/step focus respects the sticky header and uses instant scrolling. No prerequisites or activity locks were added.

## Progress data and compatibility

The version-1 progress record and `decode-learning-v1-<student-id>` key remain in use. Optional additive maps provide typed detail:

```text
quizSessions[subject] -> answers by question ID, current index, timestamp
quizHistory[subject] -> attempt ID, answers, correct/total/percent, timestamp
labChecks[labId] -> check count, aggregate requirement booleans, passed, timestamp
workshops[projectId] -> reviewed stable step IDs, current step ID, timestamp
```

Normalization validates known subjects, question answer indices, lab requirement schemas, step IDs, timestamps and counts. Detailed quiz scores are derived from the answer records. Unknown/corrupt additions cannot grant completion. Old lessons, quiz aggregates, challenge/project completions, visits, activity history and draft contents are preserved. No old submission answers, step checkmarks or check outcomes are invented.

Existing completion fields remain authoritative: lessons require their explicit action, quizzes require a saved best score of at least 70%, labs require explicit checked completion, and workshops require final self-review/completion. Workshop step percentage is a guide-progress measure; it does not increment the course activity denominator. The course/overall denominator remains the actual 38 activities.

My Learning recognizes new in-progress records and shows attempted/passed quiz detail. Dashboard, My Progress and Profile continue to derive their counts from the same typed progress and curriculum functions. Recent activity records quiz submissions, lab check outcomes, workshop step review/reopen actions and final completions. Same-millisecond actions receive distinct recent-event IDs. Activity visits stay separate and Continue Learning still resumes the most recently opened valid curriculum route.

ProgressProvider remains the storage boundary, scoped by the current demo student ID. These typed records can be served by a future authenticated, authorized repository behind that boundary. This stage implements no instructor access, production authentication change, backend endpoint or server synchronization.

## Exact files changed in Stage 4B

The list below was compared with a content snapshot taken at the start of this stage. Earlier Stage 4A/4A.1/4A.2 changes already present in the working tree are not relisted as new Stage 4B changes. Paths are repository-relative.

| File | Stage 4B action | Purpose |
| --- | --- | --- |
| `frontend/app/components/student/activities.css` | Added | Responsive quiz, lab, workshop, dialog, feedback, and focus styling. |
| `frontend/app/components/student/activity-chrome.tsx` | Added | Curriculum breadcrumbs and previous/next activity navigation. |
| `frontend/app/components/student/activity-confirm-dialog.tsx` | Added | Accessible native quiz submission dialog with focus restoration. |
| `frontend/app/components/student/challenge-view.tsx` | Updated | Six interactive labs and explicit checked completion. |
| `frontend/app/components/student/code-workspace.tsx` | Updated | Reuse the editor for lab checks, workspace invalidation, and scoped images. |
| `frontend/app/components/student/curriculum-view.tsx` | Updated | Current lab/workshop descriptions and attempted/passed quiz detail. |
| `frontend/app/components/student/lab-check-runner.tsx` | Added | Fixed-width sandbox probes, validated result aggregation, cancellation and feedback. |
| `frontend/app/components/student/progress-view.tsx` | Updated | Accurate activity terminology and quiz/progress explanations. |
| `frontend/app/components/student/project-view.tsx` | Updated | Guided workshop steps, resume, draft awareness, and final self-review. |
| `frontend/app/components/student/quiz-view.tsx` | Updated | Answer navigation/autosave, confirmation, scoring, explanation review, history and retries. |
| `frontend/app/components/student/workspace-images.tsx` | Updated | Context-aware image controls for lessons, labs and workshops. |
| `frontend/app/lib/student/activity-progress.ts` | Added | Pure quiz, lab check, workshop step and final completion updates. |
| `frontend/app/lib/student/activity-records.ts` | Added | Validated normalization of additive records without fabricating legacy history. |
| `frontend/app/lib/student/challenges.ts` | Updated | Goal-list instructions and recommended Add a goal button ID. |
| `frontend/app/lib/student/curriculum.ts` | Updated | In-progress recognition for saved quiz sessions, lab checks and workshop steps. |
| `frontend/app/lib/student/lab-validation.ts` | Added | Self-contained DOM, computed-style and interaction checks executed inside the iframe. |
| `frontend/app/lib/student/labs.ts` | Added | Typed definitions and explicit rubrics for the six existing lab IDs. |
| `frontend/app/lib/student/preview.ts` | Updated | Isolated lab validation bootstrap, typed message validation, and generic image feedback. |
| `frontend/app/lib/student/progress.ts` | Updated | Additive local record defaults/normalization, unique recent event IDs, and completion labels. |
| `frontend/app/lib/student/projects.ts` | Updated | Stable IDs, titles and display order for the 20 existing workshop instructions. |
| `frontend/app/lib/student/types.ts` | Updated | Typed attempts, unfinished sessions, lab results, workshop steps and progress. |
| `frontend/app/lib/student/workspace-images.ts` | Updated | Workspace-neutral storage-limit messages; storage keys and limits unchanged. |
| `frontend/tests/learning-activities.test.mjs` | Added | Scoring/history, progress compatibility, six lab validators, message schemas and minified bootstrap. |
| `frontend/tests/learning-activity-views.test.mjs` | Added | Real React/provider quiz, lab and workshop interaction, persistence, failure and isolation tests. |
| `frontend/tests/student-views.test.mjs` | Updated | Updated expectations for the implemented curriculum activity labels. |
| `frontend/tests/workspace-refinements.test.mjs` | Updated | Updated image-budget wording expectation; existing image regressions retained. |
| `frontend/docs/student-learning-stage-4b.md` | Added | Implementation, architecture, validation and manual review report. |

Total: 27 files. No dependency manifests changed in this stage and no dependencies were added.

## Validation results

- `npm run lint`: passed with zero errors and warnings.
- `npx tsc --noEmit`: passed.
- `npm test`: all 67 tests passed, including the existing 52 Stage 4A regressions and 15 new activity tests.
- `node --test tests/workspace-refinements.test.mjs`: all 4 focused regressions passed after the final terminology update. The rebuilt production bundle was also checked for the final wording.
- `npm run build`: passed, including Next TypeScript validation and all 64 generated pages.
- `git diff --check`: passed (also checked without automatic CRLF normalization).
- Read-only Git checks confirmed `feature/student-dashboard`, an empty staging area and no backend diff.

Coverage includes scoring and retry best scores; unfinished quiz restoration; confirmed submission/cancel; saved answer explanations; duplicate submit/save; storage failure; account isolation; lab requirement logic; hardcoded outcomes and repeated event behavior; exact message tokens/schema/source windows; aggregation across viewports; edits/cancellation/timeout/unmount; workshop review, reopening, resume, dirty drafts and final completion; legacy compatibility; actual curriculum percentages; and minified serialization of the self-contained sandbox validator. Existing authentication, Monaco ownership/lifecycle, draft, image, Emmet, theme and protected hydration tests continue to pass.

The existing Next.js multiple-lockfile/workspace-root warnings remain. Unrelated configuration and lockfiles were preserved.

## Known limitations and browser status

Browser verification could not be completed. CUA reports no browser-tab provider, and requesting a native Chrome screenshot returned VS Code instead. I stopped UI interaction rather than operating against the mismatched surface. No Stage 4B browser screenshot, physical keyboard run, responsive geometry pass or native dialog focus-trap pass is claimed.

The UI tests use actual React effects/Strict Mode and the real local ProgressProvider in disposable JSDOM storage. Monaco’s existing ownership tests use its API double. The new UI lab tests inject validated probe messages to exercise aggregation and lifecycle. The sandbox tests execute the actual generated HTML/JavaScript runtime in separate JSDOM realms. JSDOM does not lay out CSS, so the CSS validator tests supply explicit computed-style/geometry fixtures; actual rendering at both widths remains a manual check. Dialog open/close is polyfilled in JSDOM, so native top-layer behavior remains a manual check. A separate test bundles/minifies the validator before executing its serialized preview.

Lab checks cover the six published rubrics and observed DOM/style/interaction requirements. They are not a general code grader, do not prove implementation choices such as array usage, and are not secure assessments against a student modifying their own client or storage. CSS checks sample the declared fixed widths; they do not assess every viewport, visual design, delayed external asset or asynchronous application behavior. Workshops remain self-reviewed.

All records and images are browser-local for this demo account/origin. Quotas or cleared site data can prevent/remove persistence; failures are reported. Only the most recent 20 detailed quiz submissions are retained per subject, while aggregate counts and best/latest scores continue. Source drafts require Save Draft. A seven-second lab check timeout can report a missing result, but an iframe sandbox cannot guarantee a CPU timeout for infinite learner loops. The iframe remains opaque with `allow-scripts` only, no same-origin permission, blocked network fetches/external scripts, and the existing constrained image policy.

## Manual visual and functional review

Use an existing foreground development server, or run `npm run dev` from `frontend` in a foreground terminal and open `http://localhost:3000`. Development demo login remains `student@example.test` / `Decode123!`; use a separate fictional demo account to avoid disturbing existing reviewed progress. Production demo login is still disabled by the existing auth implementation.

- [ ] Open My Learning and confirm the original 38 activities, course/module expansion, route links, sidebar collapse preference and active navigation. Check light/dark themes and desktop/tablet/mobile widths.
- [ ] Open `/quizzes/html`, `/quizzes/css` and `/quizzes/javascript`. Change answers, use radio-key navigation and numbered question controls, and verify the answered count. Attempt incomplete submission and verify first-unanswered focus beneath the sticky header.
- [ ] Open submission confirmation; test Cancel, Escape, keyboard focus trapping and focus restoration. Confirm submission and check exact correct/total/percentage, selected answers, correct answers and explanations.
- [ ] Retry with a lower score and verify best score and earned completion remain. Review older answers, resume an unfinished attempt, reload midway, and test a second account. Simulate storage failure and retry-save without duplicating the attempt count.
- [ ] Open every `/challenges/[id]` lab. Run the starter and use Check Solution; incomplete starters must not earn completion. Read all requirement feedback and check that Run Code alone never completes the lab.
- [ ] For `html-heading`, supply exactly one `<h1>Hello, DECODE!</h1>` plus a nonempty paragraph; test an extra h1/empty paragraph. For `html-link`, test a nav link to `#learning` labeled Start learning and a matching main with an h1; then remove one requirement.
- [ ] For `css-card`, try `.card { max-width:28rem; margin-inline:auto; padding:1.5rem; border:1px solid #cbd5e1; line-height:1.6; box-sizing:border-box; }`. Verify both probe widths pass, then remove padding/border/line-height or cause horizontal overflow and check the specific feedback.
- [ ] For `css-grid`, try `.gallery { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,12rem),1fr)); gap:1rem; }`. Verify one column at 320px and multiple at 800px. Force three columns at 320px and confirm failure.
- [ ] For `javascript-button`, implement a persistent click listener that sets the greeting. Hardcoded initial text and a once-only listener must fail. For `javascript-list`, render three goals and append exactly one per click; a fixed four-item replacement must fail the repeated-click check.
- [ ] Start a lab check, edit code, cancel, navigate away, or leave a nonresponding preview. Confirm stale or incomplete checks cannot enable Complete lab. After a full pass, explicitly complete the lab and inspect My Learning, Dashboard and My Progress.
- [ ] Open `/projects/portfolio`, `/projects/landing-page`, `/projects/calculator` and `/projects/todo-list`. Jump directly to the last step, return, mark/reopen steps, save a code draft and reload. Verify both current step and code resume for the correct account.
- [ ] Review every workshop step and confirm the project remains incomplete until final self-review and Complete workshop. Edit after final review to clear that confirmation; Save Draft should be required for unsaved changes. Revisit a legacy completed project and confirm completion is preserved without invented step history.
- [ ] Use Emmet with physical Tab, Run, Reset/cancel, Save Draft, file tabs, split resizing and accessible editor in both a lab and workshop. Upload a local image, insert its tag at the HTML cursor, try a public direct HTTPS image, reload, and test removal/missing-image behavior. Inspect `sandbox=allow-scripts` with no same-origin permission.
- [ ] Confirm browser Back/Forward behavior, sticky-header focus, reduced motion, visible focus indicators, mobile layouts and no horizontal overflow. Check the console for hydration, Monaco lifecycle and runtime errors.
- [ ] Confirm visits and drafts do not grant completion, final activities count once, Continue Learning resumes the latest activity, recent actions are meaningful, and a second demo account has isolated answers/checks/steps/drafts/progress/images.

Stage 4B stops here for visual and functional review.
