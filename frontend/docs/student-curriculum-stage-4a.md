# DECODE — Stage 4A implementation report

> **Historical stage report.** Current auth, account persistence, Instructor access and submission behavior may supersede this report. Use the [current frontend guide](../../docs/FRONTEND-GUIDE.md), [architecture](../../docs/PROJECT-ARCHITECTURE.md) and [status](../../docs/PROJECT-STATUS.md) for implementation work; retain this report for design rationale and dated validation.

Date: 2026-10-25

Branch: `feature/student-dashboard`

Scope: student curriculum restructuring only. Ready for visual review.

## Delivered behavior

- `/courses` is now **My Learning**: a compact Continue Learning panel, In Progress and Completed tabs, expandable HTML/CSS/JavaScript courses, nested expandable modules, and ordered activity rows.
- Rows show distinct Theory, Quiz, Lab, and Workshop icons, actual Not Started/In Progress/Completed states, Start/Continue/Review actions, and a Last opened marker. Courses and modules show completion percentages and counts from student records.
- In Progress includes courses not yet started. Completed contains only nonempty courses with every curriculum activity complete. Both tabs have stable panel IDs, keyboard arrows/Home/End, and appropriate focus states. Empty courses and modules render safely.
- `/dashboard` is a compact personalized overview: course/module/activity resume context, an aggregate summary, three course progress rows, a playground shortcut, and genuine visit/completion history. The curriculum tree belongs on My Learning.
- Student navigation now has Learn: Dashboard, My Learning, Code Playground; Account: My Progress, Profile. Existing lesson, quiz, challenge, and project routes remain functional and highlight My Learning.
- Lesson outlines include the complete activity sequence. Previous/next navigation follows curriculum activities, including intervening practice, rather than skipping to the next theory lesson.
- Course overview routes reuse the same compact curriculum component. Module hash links expand the corresponding content without forced scroll resets.

## Curriculum architecture

`curriculum-types.ts` defines content independently from student progress:

```text
Web Development path
  → course { id, title, description, order, objectives }
    → module { id, title, description, order }
      → activity { id, type, title, description, order, minutes,
                   availability, href, legacy reference when available }
```

`CurriculumRepository.getPath()` is the read boundary. The current local adapter in `curriculum-repository.ts` supplies seeded content from the existing lesson, challenge, project, and quiz identities. A future repository can supply published content in this shape; the student components do not implement instructor editing or publishing. Explicit ordering is applied at each level without mutating repository data.

The seed preserves all nine existing module IDs and covers all existing content:

| Course | Theory | Quiz | Lab challenges | Workshop projects | Total activities |
| --- | ---: | ---: | ---: | ---: | ---: |
| HTML | 8 | 1 | 2 | 1 | 12 |
| CSS | 8 | 1 | 2 | 1 | 12 |
| JavaScript | 9 | 1 | 2 | 2 | 14 |
| Total | 25 | 3 | 6 | 4 | 38 |

Activity IDs retain the previous curriculum's namespaced keys, avoiding collisions such as the CSS Grid lesson and challenge:

| Type | Stable activity ID | Legacy record and route |
| --- | --- | --- |
| Theory | `lesson:<lesson-id>` | `lessons` completion; `/lessons/<lesson-id>` |
| Quiz | `quiz:<subject>` | Existing latest/best/attempt count; `/quizzes/<subject>` |
| Lab | `exercise:<challenge-id>` | `challenges` completion; `/challenges/<challenge-id>` |
| Workshop | `project:<project-id>` | `projects` completion; `/projects/<project-id>` |

These mappings are explicit and tested. Original lesson IDs, question data, quiz thresholds, draft keys, completion controls, preview isolation, and editor implementation remain intact. Lab rows identify the existing challenges; Workshop rows identify guided projects with self-review. Dedicated Lab/Workshop experiences remain upcoming, outside this stage.

The availability union also supports future unimplemented activities without a legacy reference. The `/activities/[id]` preview renders their metadata with an Upcoming label and no completion action. Such activities can never derive a completed state. All current seeded activities reuse existing implementations; no additional learning content was invented. The empty preview repository uses Next.js's documented `__placeholder__` build parameter, which returns 404 and is never presented as curriculum content.

## Progress, compatibility, and Continue Learning

- The existing `decode-learning-v1-<studentId>` storage key and version remain unchanged. Optional historical absence of `visits` is normalized to an empty array without discarding lessons, quizzes, challenges, projects, history, or saved code.
- Each visit stores `{ activityId, at }`, separately from completion events. The route observer runs only for real curriculum activity routes, including direct navigation and browser history; prefetching, tab selection, and accordion expansion do not award visits or completion. Strict Mode does not duplicate the initial visit.
- Visits retain the latest timestamp per activity. Invalid dates and removed/unknown activities are filtered. Continue Learning selects the most recent valid visit across all four activity types, even when the activity is already complete. Course Continue actions use the most recent visit within that course.
- Old records fall back to the known `currentLesson` without inventing timestamps. Historical completion events are not treated as visit evidence. A new learner gets the first available unfinished activity; an entirely completed curriculum remains reviewable.
- Completion derives from explicit lesson completion, existing quiz best score of at least 70%, existing challenge completion, or existing self-reviewed project completion. Failed quiz attempts and preserved practice drafts can indicate In Progress. Opening an activity never completes it.
- Percentages use completed activities divided by actual curriculum activities. Projects now count in their assigned course, so previously complete core-only courses may show less than 100% until their workshop projects are completed. Empty curricula return 0%, never NaN or automatic completion.
- My Progress uses the same denominator and has updated explanatory text. It otherwise retains its existing scope and functionality.
- Records remain browser-local and student-keyed. There is no server synchronization or instructor visibility. Backend integration will need authenticated student IDs and server-enforced access; it is not implemented here.

## Exact changed files

All paths below are relative to the repository root.

| File | Change |
| --- | --- |
| `frontend/app/(student)/activities/[id]/page.tsx` | Upcoming activity route and unknown-ID guard |
| `frontend/app/components/student/activity-visit-tracker.tsx` | Route-based visit observer |
| `frontend/app/components/student/continue-learning.tsx` | Shared compact resume panel |
| `frontend/app/components/student/curriculum-view.tsx` | My Learning, course and module controls, activity rows |
| `frontend/app/components/student/curriculum.css` | Responsive curriculum and dashboard styling |
| `frontend/app/components/student/dashboard-view.tsx` | Compact personalized overview |
| `frontend/app/components/student/learning-overview.tsx` | Shared progress totals and actual visit history |
| `frontend/app/components/student/lesson-outline.tsx` | Complete ordered activity outline |
| `frontend/app/components/student/lesson-view.tsx` | Curriculum-based context and previous/next navigation |
| `frontend/app/components/student/lesson.css` | Activity type labels in lesson outlines |
| `frontend/app/components/student/progress-view.tsx` | Consistent completion explanation and zero-total guard |
| `frontend/app/components/student/student-shell.tsx` | Simplified navigation, active states, visit tracker |
| `frontend/app/components/student/upcoming-activity-view.tsx` | Non-completable Upcoming preview |
| `frontend/app/lib/student/curriculum-repository.ts` | Seeded repository and explicit legacy mappings |
| `frontend/app/lib/student/curriculum-types.ts` | Typed content, availability, references, ordering, visits |
| `frontend/app/lib/student/curriculum.ts` | Ordering, lookup, status, totals, resume and visit helpers |
| `frontend/app/lib/student/progress.ts` | Additive visit normalization and curriculum totals |
| `frontend/app/lib/student/types.ts` | Student visit records in existing progress shape |
| `frontend/tests/student-views.test.mjs` | Screen, keyboard, accordion, route tracking, empty state and navigation tests |
| `frontend/tests/student.test.mjs` | Mapping, ordering, completion, compatibility and resume tests |
| `frontend/docs/student-curriculum-stage-4a.md` | This implementation and review report |

No backend, database, dependency manifests, lockfiles, authentication source, Monaco runtime/editor source, or preview execution code was changed. No files were staged or committed; no push, merge, or branch switch was performed.

## Validation

- `npm.cmd run lint`: pass, no errors or warnings.
- `npx.cmd tsc --noEmit`: pass.
- `npm.cmd run build`: pass, including production TypeScript and static/partial route generation.
- `npm.cmd test`: 35 passed, 0 failed.
- `git diff --check`: pass after normalizing the changed view files.

Tests cover explicit ordering at all hierarchy levels, every existing route/reference, unique stable IDs, actual activity totals, zero-activity rendering, quiz threshold/best-score behavior, explicit completion, non-completable Upcoming content, new and returning learners, all four visit types, completed-activity resume, invalid/stale visit filtering, legacy storage/drafts, per-course continuation, tab keyboard navigation, valid ARIA control targets, course/module expansion, and theory-to-practice navigation. Existing auth/session, quiz, preview bridge/isolation, saved drafts, account separation, and Monaco lifecycle regressions also pass.

The build emits existing workspace-root warnings about multiple lockfiles and a parent lockfile outside the Git repository. No unrelated configuration or lockfile cleanup was made.

## Browser review and screenshots

The existing development server at `http://localhost:3000` was left running. Browser tooling opened `/courses` in a separate Chrome tab and observed the expected protected-route redirect to `/login`. Further visual review and screenshots were blocked when the native automation helper repeatedly reported Chrome as minimized and could not restore/capture it. Desktop/mobile visual rendering and live browser hydration therefore still need review. No screenshots are represented as completed.

To review:

1. Use the existing development server, or run `npm.cmd run dev` from `frontend`. Demo sign-in intentionally remains development-only; `next start` does not enable demo accounts.
2. Historical browser-demo credentials are omitted. Use the current email/password setup and an approved local test account; preserve existing browser data when reviewing this stage.
3. Open `/dashboard`: verify the compact welcome, resume context, actual progress, course rows, recent records, and My Learning shortcut.
4. Open `/courses`: expand HTML, then each module. Check ordering, type icons, statuses, percentages, Start/Continue/Review, and the last-opened marker. Expand all and Collapse all should not move the page to another position or grant progress.
5. Open a theory lesson, quiz, challenge, and guided project through the curriculum. Return to My Learning or Dashboard after each. Continue Learning should target that exact most recently opened activity, including after reload and when already completed.
6. Open `/lessons/html-text` and verify Next activity leads to `/challenges/html-heading`. Check that lesson outlines also list quiz and workshop activities. Use a module heading link to return to the expanded topic.
7. Complete an activity through its original control. Verify course/module counts change accurately; opening another activity alone should leave the completion counts unchanged. Check the Completed tab when an entire course is complete; the empty Completed state should also be clear.
8. Test Tab/Shift+Tab, Enter/Space for expansion, and arrows/Home/End between tabs. At mobile widths, test navigation focus containment, Escape, active My Learning state on activity routes, and returning focus to the menu button.
9. Check approximately 320px/375px mobile, 768px tablet, and 1280px desktop widths in both themes. Review wrapping, alignment, overflow, scrolling, and browser console hydration errors.
10. Recheck Monaco autocomplete in all three languages, Run/live preview, Save Draft/reload, theme switching, and repeated route navigation. Review a quiz attempt, a challenge, a project, My Progress, Profile, session restoration, and logout. Existing accounts/drafts must remain isolated by student.

## Remaining limitations and stage boundary

Dedicated Lab/Workshop engines, topic-based quiz changes, instructor CRUD/publishing, instructor/student reporting, backend authentication, and persistent server progress are not part of this implementation. Stage 4B and Stage 4C were not started. The report records implemented behavior and automated validation; full browser visual approval remains the next step.
