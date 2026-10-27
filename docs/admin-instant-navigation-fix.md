# Admin instant-navigation diagnostic

## Root cause

The diagnostic originates in Next.js 16.4.2's segment validation, not in the overview component or an admin API call. `cacheComponents` and `partialPrefetching` are enabled. The former `app/admin/layout.tsx` wrapped its child route in an async `AuthenticatedAdmin` component. When the auth backend rejected the unsupported admin session scope or could not verify the session, that component returned the expected “Unable to verify admin access” notice **instead of its children**.

Consequently, the `/admin/page.tsx` segment never entered the render tree during that validation pass. Next.js's `allRequiredBoundariesRendered` check failed, producing `createUnrenderedSegmentError` and naming the dropped page. Anonymous/forbidden early exits also belonged to the ancestor layout rather than the child page.

The existing outer Suspense fallback covered the runtime cookie read, but did not repair this omission after it resolved. Likewise, `app/admin/loading.tsx` sits below the layout; its fallback cannot make the parent render an omitted route segment. Adding another loading skeleton or changing the overview UI would not address the cause.

This matches the framework's documented [dropped-segment diagnostic and page-level guard pattern](https://nextjs.org/docs/messages/instant-unrendered-segment).

## Changes

- `frontend/app/admin/layout.tsx`: retains metadata and shared CSS, and unconditionally returns `children`. It performs no session I/O and no conditional route omission.
- `frontend/app/components/admin/admin-workspace.tsx`: new server-only shared wrapper containing the same session verifier, anonymous/role redirects, unavailable-access notice, and authorized `AdminProvider` / `AdminShell` composition. The runtime check remains inside an explicit Suspense boundary with the same “Checking your admin session…” fallback.
- All eight page entry points (`/admin`, `/admin/users`, `/admin/instructors`, `/admin/courses`, `/admin/analytics`, `/admin/activity`, `/admin/settings`, `/admin/profile`): wrap their existing view in `AdminWorkspace`. Next.js reaches each page's segment before its auth-dependent subtree suspends, redirects, or displays the access notice.
- `frontend/tests/admin.test.mjs`: adds a regression for retaining the child segment, updates the original boundary test for its new owner, and enumerates all eight page files to verify each uses the real shared guard. Every page is exercised against anonymous, STUDENT, INSTRUCTOR, unavailable, and ADMIN session responses. It also checks that page-level validation has not been opted out.
- `frontend/tests/admin-test-helpers.mjs`: isolated browser-view tests substitute the server wrapper with a passthrough; `realProvider: true` tests execute the actual server guard for every route. This is only a test double, not application behavior.
- Existing implementation and backend handoff documentation now identifies the page-level boundary rather than the former layout guard.

The overview and the seven other view components, their styles, navigation, filters, dialogs, and settings have not been redesigned. `loading.tsx` and `error.tsx` remain in place. The shared shell is composed by each page after authorization; each navigation verifies the server session anew, while the existing browser sidebar/theme preferences retain their persistence.

## Security and configuration

There is no client-only authorization substitution: the server verifier must return an authenticated ADMIN before `AdminProvider`, `AdminShell`, or the protected view is rendered. Missing sessions still redirect to `/login`; other roles still go to their existing account homes; unavailable verification still returns the access notice without protected content. The existing client session rechecks and independently authorized API boundaries remain intact.

No `instant = false`, validation suppression, cache disablement, session caching, credentials, new packages, backend changes, or migrations were added. `next.config.ts` remains unchanged. All current admin entry points are included in the guard-enumeration regression; any future admin page must use the same wrapper.

## Validation

- The new layout regression was run before the fix and failed against the original auth-gated layout.
- Focused admin/view/shared-session tests: **52/52 passed** after the fix.
- Standalone TypeScript `tsc --noEmit`: passed.
- Live Next.js development `compile_route` for `/admin`: no compilation issues.
- Anonymous HTTP requests to all eight real development admin routes: login redirects present and protected workspaces absent. The `/admin` response contained no dropped-segment diagnostic. No credentials or cookies were supplied. The development diagnostic endpoint returned empty configuration/session error lists.
- Production build and ESLint: both passed. The build includes all eight admin routes; the existing workspace-lockfile warnings remain unchanged.
- Full frontend regression suite: **314/314 passed**, including 34 admin tests and the 280 existing tests.

The live backend still lacks ADMIN session support. The access-unavailable notice remains expected and is not an instant-navigation error. ADMIN access and non-admin denial are exercised at the real frontend guard boundary with isolated test responses; no real administrator account was provisioned or bypassed. Browser-overlay validation is not claimed from the HTTP smoke test alone.
