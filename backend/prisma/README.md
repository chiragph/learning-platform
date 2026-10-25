# Local PostgreSQL and Prisma setup

Prisma is configured in `backend/`. The `User` model maps to the PostgreSQL
`users` table and has a UUID ID, name, unique email, password hash, role, and
creation/update timestamps. Roles are `ADMIN`, `INSTRUCTOR`, and `STUDENT`;
new users default to `STUDENT`. Authentication code must hash passwords before
storing them and enforce role permissions separately.

## Create the local database in pgAdmin4

Do this after the Prisma setup is in place on `feature/database-schema`.
The migration is already prepared; this is the remaining local setup step.

1. Start your local PostgreSQL server and open pgAdmin4.
2. Connect to your local server (usually `localhost`, port `5432`, user `postgres`).
3. Right-click **Databases**, then choose **Create > Database**.
4. Enter `learning_platform` as the database name and select `postgres` as owner.
5. Save. Leave the database empty; Prisma migrations create the tables.

If PostgreSQL is not installed, install the Windows server first using the
[official PostgreSQL download page](https://www.postgresql.org/download/windows/).
pgAdmin4 is a management application and needs a running PostgreSQL server.

## Configure credentials and apply the first migration

Run commands from `backend/`. A local `.env` template is included in this
workspace but is ignored by Git. Teammates should copy `.env.example` to `.env`:

```powershell
Copy-Item .env.example .env
```

Edit `.env` and replace `YOUR_PASSWORD` with your local PostgreSQL password:

```dotenv
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/learning_platform?schema=public"
```

Adjust the host, port, or username if your PostgreSQL server uses different
settings. URL-encode special characters in credentials, such as `%40` for `@`.
Keep actual credentials out of Git and chat.

```powershell
npm.cmd ci
npm.cmd run prisma:validate
npm.cmd run prisma:deploy
npm.cmd run prisma:generate
npm.cmd run prisma:status
npm.cmd run start:dev
```

The initial SQL migration can be prepared without a running database. Its
presence in this repository does not mean it has been applied locally.
`prisma:deploy` applies the committed migration without requiring a shadow
database. Use `prisma:migrate -- --name describe_your_change` when the
schema changes. The local PostgreSQL user needs permission to create the shadow
database used by `prisma migrate dev` (the default local `postgres` user has it).
If Prisma proposes resetting an existing database containing data, stop and
investigate before accepting.

To view the resulting table, refresh **Schemas > public > Tables** in pgAdmin4,
or run `npm.cmd run prisma:studio`.

## Verify the connection

The API listens on port `4000` by default (override it with `PORT`). Once it is
running, check it from a second PowerShell terminal:

```powershell
Invoke-RestMethod http://localhost:4000/api/health
Invoke-RestMethod http://localhost:4000/api/health/database
```

`/api/health` checks that the API is running. `/api/health/database` returns
`{ "status": "ok", "database": "connected" }` only when Prisma can query the
`users` table, even if it has no rows. It returns HTTP `503` if PostgreSQL is
unreachable, credentials are wrong, or the migration has not been applied.
Database connections and queries have five-second timeouts.

The backend connects lazily, so a successful build or an HTTP `200` from
`/api/health` does not prove that the database is ready.

## Checks that do not require PostgreSQL

```powershell
npm.cmd run prisma:validate
npm.cmd run build
npm.cmd test
npm.cmd run test:e2e
npm.cmd run lint
```

Copy `.env.example` to `.env` first if needed; the placeholder is sufficient for
these checks. The end-to-end suite substitutes the database provider to verify
HTTP behavior, including readiness failures. It does not apply migrations or
prove a real PostgreSQL connection; use `/api/health/database` for that final check.

## Working with teammates

- Commit `schema.prisma`, `prisma.config.ts`, migration SQL, the migration lock
  file, dependency manifests, and `.env.example`.
- Each teammate creates their own local database and sets their own `.env`.
- Generated Prisma Client files are ignored; run `prisma:generate` after schema
  changes. Backend builds and development startup generate the client as well.
- Inject `PrismaService` into NestJS services to access `prisma.user` queries.
  The service connects on the first query and disconnects on application shutdown.
- `npm.cmd run prisma:deploy` applies committed migrations in deployment
  environments; do not use `migrate dev` against a production database.

See the [official Prisma NestJS guide](https://www.prisma.io/docs/guides/v7/frameworks/nestjs)
for the adapter and client setup.
