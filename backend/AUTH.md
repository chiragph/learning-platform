# Local login and registration

Authentication is implemented on `feature/database-schema`. The existing login
and registration layouts, styles, and owl animation are preserved. Successful
registration or login opens `/dashboard` for students. The single provisioned
instructor, `decode.instructor@gmail.com`, opens `/instructor`. The legacy
`/login/success` URL forwards to the appropriate dashboard after verifying the
session. An unauthenticated visitor is redirected to `/login`.

## Start locally

Start PostgreSQL and configure `backend/.env` using `.env.example`. Keep real
credentials out of Git. From `backend/`:

```powershell
npm.cmd ci
npm.cmd run prisma:deploy
npm.cmd run start:dev
```

In a second terminal, from `frontend/`:

```powershell
npm.cmd ci
npm.cmd run dev
```

Open `http://localhost:3000/register` and create an account. To test login, open
`http://localhost:3000/login` and enter that account's email and password. No
student demo account or password is created.

## Provision the instructor

The instructor address is reserved and cannot be claimed through registration.
Use the existing PostgreSQL database and migrations; no additional schema
migration is required for this login workflow. From `backend/`, supply the
project owner's instructor password in the local `INSTRUCTOR_BOOTSTRAP_PASSWORD`
environment variable (or ignored `.env`), then run:

```powershell
npm.cmd run instructor:provision
```

This builds the backend and explicitly creates the designated account with the
existing salted-scrypt password helper. It never prints the password. Reruns
verify the existing password and preserve its UUID/hash. An existing reserved
student account is promoted only if that password already matches, revoking its
old sessions. A conflicting password or duplicate normalized email stops the
command without overwriting credentials. Provisioning does not run automatically
on application startup. Remove the bootstrap secret after use; normal login
only needs the stored password hash.

Server and browser session guards protect instructor routes, including production
and cached navigation. Only the designated email with stored `INSTRUCTOR` role
is exposed as an instructor by login and `/auth/me`; other existing role values
are treated as `STUDENT` for this product's dashboard access. An email match alone
never bypasses password/session verification. Instructor layouts, CSS, editor UI,
and local content storage remain intact. Course persistence/publication/submission
integration remains the separate Stage 5E proposal in `docs/stage-5e/`.

The frontend proxies `/api/*` to `http://localhost:4000`. To change this, copy
`frontend/.env.example` to `.env.local`, set `API_URL` without a trailing slash,
and restart the frontend. If the frontend origin changes, set `FRONTEND_URL` in
`backend/.env` and restart the backend. With a local frontend and a non-production
backend, ports 3000, 3001, and 3100 on localhost/127.0.0.1/IPv6 loopback are accepted
so Next's automatic port fallback works. Production allows only `FRONTEND_URL`
and exact additional origins configured in comma-separated `FRONTEND_ORIGINS`.
Origin checks and CORS use the same allowlist; arbitrary ports/hosts and cross-site
submissions remain blocked. `PORT` changes the backend port. Use HTTPS
and `NODE_ENV=production` when deploying so session cookies are marked `Secure`.

For a compiled backend, run `npm.cmd run build` then `npm.cmd run start:prod`.
Prisma generates CommonJS to match NestJS, and the backend build outputs
`dist/main.js`. Database connections use UTC so session expiry stays correct
when the PostgreSQL server uses another timezone.

## API and sessions

| Endpoint                   | Behavior                                                                                                 |
| -------------------------- | -------------------------------------------------------------------------------------------------------- |
| `POST /api/auth/register`  | JSON `{ name, email, password }`; creates a student and session; returns `201` and public user data.     |
| `POST /api/auth/login`     | JSON `{ email, password, remember? }`; verifies the stored password; returns `200` and public user data. |
| `GET /api/auth/me`         | Returns the current public user, or `401` for missing, expired, or revoked sessions.                     |
| `POST /api/auth/logout`    | JSON `{}`; deletes the current session and clears its cookie.                                            |
| `GET /api/health`          | Checks API availability.                                                                                 |
| `GET /api/health/database` | Checks access to the migrated users table.                                                               |

Email addresses are trimmed and lowercased. Passwords are never trimmed and are
stored as salted scrypt hashes. Registration always assigns `STUDENT`; a caller
cannot register as an admin. Wrong passwords and unknown accounts return the
same error. Duplicate emails return `409`; database failures return a generic
`503` without leaking connection details.

Random 256-bit session tokens use an `HttpOnly`, `SameSite=Lax` cookie. Only a
SHA-256 hash of the token is stored in PostgreSQL. Normal sign-ins have a browser
session cookie and a 12-hour server expiry. **Remember me** sets a persistent
cookie and a 30-day server expiry. Tokens are never stored in localStorage or
returned in JSON. Authentication responses use `no-store`. POST endpoints require
JSON and reject requests from an unconfigured origin.

Google authentication and password recovery remain unavailable, as indicated
by their existing controls. Email/password registration and login are functional.

## Verify

From `backend/`:

```powershell
npm.cmd run prisma:validate
npm.cmd run prisma:status
npm.cmd run build
npm.cmd test
npm.cmd run test:e2e
npm.cmd run lint
```

The unit and HTTP suites substitute Prisma test doubles. With both applications
and PostgreSQL running, also run `npm.cmd run test:auth:live`. This checks actual
registration and login through the frontend proxy, the stored password and token
hashes, dashboard routing/access, session expiry, and logout. It creates a
uniquely named temporary account and removes only that account and its sessions
in a `finally` block. It does not reset the database.

When `INSTRUCTOR_BOOTSTRAP_PASSWORD` is supplied to the live check, it also
verifies the real instructor password/session, `/instructor` access, reserved
registration rejection, and student/anonymous exclusion. The existing instructor
account is retained; only the test's login session is revoked. Use an app origin
matching `FRONTEND_URL` so the check also exercises browser-origin validation.

From `frontend/`, run `npm.cmd run lint` and `npm.cmd run build`. The existing
Google Fonts configuration needs network access during the production build.
