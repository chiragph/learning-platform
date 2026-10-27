# Connected learning workflow

Current handoff: [architecture](../../docs/PROJECT-ARCHITECTURE.md), [API/schema guide](../../docs/BACKEND-GUIDE.md), and [status](../../docs/PROJECT-STATUS.md), reviewed 2026-10-27. Earlier test/migration execution statements below are historical evidence, not a current database readiness check.

Implemented on feature/database-schema. The existing instructor and student layouts and styles are retained; data bindings now use account-backed behavior. Some Instructor shell preview copy remains obsolete.

## Authoring and delivery

The instructor creates a course, adds modules and Theory/Quiz/Lab/Workshop activities, and saves content using the existing editors. Publish course in My Courses validates the entire active curriculum and atomically creates an immutable publication. All registered students can access it. Newly created public IDs work through the existing /courses, /lessons, /quizzes, /challenges and /projects routes.

Edits are working drafts. A previously published snapshot remains available until the instructor publishes a replacement or explicitly unpublishes/archives the course. Republishing preserves student completion history. Student activity pages keep their loaded content while open; quiz submissions reject an obsolete publication and require reloading. Catalog pages refresh on navigation, focus and every 30 seconds. Instructor insights refresh on focus and every 30 seconds.

On the instructor's first connection, an existing valid browser preview with recorded changes is copied into an empty server workspace. New/imported content remains a draft. The original browser storage is never removed. Existing server edits cannot be overwritten by this import. Invalid or conflicting imports report a warning and preserve the original browser backup.

## Persistence and authorization

The additive migration creates instructor_workspaces, learning_courses, learning_publications, learning_progress, learning_quiz_attempts and learning_submissions. Existing users, sessions and IDs are retained. Typed editor documents and immutable published content use JSONB; ownership, course identity, publication references, student identity, revisions and attempts use relational keys. The database enforces same-course publication pointers and immutable publications/quiz attempts.

All endpoints are under /api/learning. The existing HttpOnly session authenticates every request. Instructor endpoints require the designated instructor account. Student identity always comes from that session, never a request body. Mutating requests require JSON and the same origin policy as authentication. Responses use no-store. Instructor saves and student updates use compare-and-swap revisions; outer stale revisions return 409 (inner editor-domain stale errors are currently wrapped as 400). Student writes are queued; failures retain unsaved changes in the open page and show a retry action.

Quiz answer keys and explanations are removed from curriculum responses. Submission validates answers against the requested live publication, calculates weighted points on the server, and atomically records attempt history and best/latest/count aggregates. Idempotency keys prevent duplicate attempts, and reuse with changed answers is rejected. Historical attempt reviews include their original questions. Generic progress saves cannot change quiz scores/history.

Theory completion and workshop steps are self-reviewed. Lab checks run in the existing isolated preview iframe using the instructor's published checks; records are explicitly classified as browser-check evidence, not secure server grading of arbitrary student code. No student code executes in the API process.

Workshop completion snapshots the saved HTML/CSS/JavaScript into a real student submission. The instructor's existing Submissions page lists those records, downloads source as JSON, and saves feedback/status. Draft review feedback stays private; Reviewed and Changes requested publish feedback to the student. The workshop completion area shows that feedback. Changes requested enables resubmission of saved code. Binary ZIP/file upload storage is not introduced: the connected submission is the code from the existing workspace.

Student dashboards, course progress, quiz history and instructor insights read these account records. The dedicated reset endpoint clears working progress/drafts while retaining immutable quiz audit records and delivered submissions. The Profile reset control currently calls ordinary merging persistence instead and can leave data intact; see the [known bug](../../docs/PROJECT-STATUS.md#known-bugs-and-limitations). Profile display/avatar, editor preferences and workspace image assets retain their existing browser-local behavior. Earlier browser-only student demo progress is preserved in its original storage and is not silently converted into verified quiz attempts.

## Development and deployment

Install dependencies in both frontend and backend. The backend learning:build script bundles the shared pure editor/publication rules from frontend/app/lib into backend/domain/learning.cjs with the installed frontend esbuild dependency. Backend build/start/test commands prepare it automatically; deploy this artifact with backend/dist. Rebuild when shared domain code changes.

Run from backend:

- npm run prisma:deploy (additive migration, no reset)
- npm run build
- npm test
- npm run test:learning:integration
- npm run lint

Run from frontend:

- npm test
- npm run lint
- npm run build

The PostgreSQL integration test creates a uniquely named disposable schema, applies every migration there, exercises real authenticated HTTP requests, then removes only that test schema. It covers first-time draft import, role/origin isolation, creation/publication, hidden drafts and answer keys, server scoring, replay/conflict behavior, independent student records, dashboards, history after unpublish, project source delivery, private/public feedback and resubmission. Existing interaction tests use explicit local test doubles for deterministic editor/profile behavior; connected-learning tests exercise the published catalog and remote instructor adapter.

No production user credentials or test accounts are added by this test. On this workspace the additive migration was applied to the configured local PostgreSQL database after the isolated workflow test passed.

## Concurrent instructor and student tabs

Sign-in sets a separate HttpOnly decode_student_session or decode_instructor_session cookie based on the authenticated account. Workspace guards and learning APIs select the cookie for their own role. Auth verification and logout use ?scope=student or ?scope=instructor. Signing out one role revokes and clears only that session and its matching compatibility alias; the other role remains signed in. The old decode_session cookie remains a compatibility alias for login/success and older clients. Existing sessions can still use it; sign in once to each role after this update to populate both role cookies. No role selector or layout changes are needed. Integration coverage uses one browser cookie jar with both login orders and independent logout.
