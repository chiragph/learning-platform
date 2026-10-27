# DECODE backend

NestJS API for PostgreSQL-backed authentication, course authoring/publication, Student learning records, quiz grading, workshop source submissions/reviews, and Instructor insights. See the [root setup](../README.md), [backend/API guide](../docs/BACKEND-GUIDE.md), [architecture](../docs/PROJECT-ARCHITECTURE.md), and [status](../docs/PROJECT-STATUS.md).

## Setup and development

Install dependencies in both packages (frontend first), because the backend bundles shared pure learning rules using frontend esbuild. In `backend/`, run `npm ci`, configure an ignored local `.env` from `.env.example`, and use the [database setup guide](prisma/README.md) for pgAdmin4 and migration safety. Variable names and purposes are in the [root environment table](../README.md#environment-configuration); never commit connection strings or credentials.

From `backend/`:

```powershell
npm run prisma:validate
npm run prisma:generate
npm run prisma:status
# Apply reviewed committed migrations to your confirmed local target:
npm run prisma:deploy
npm run start:dev
```

Do not accept a database-reset prompt. The [authentication guide](AUTH.md) explains explicit instructor provisioning, sessions, and live verification. Provisioning does not run automatically on startup; there is no ordinary seed command.

The default API port is 4000. `GET /api/health` checks liveness; `GET /api/health/database` verifies a query against `users` and returns a safe 503 if unavailable. It does not validate all learning migrations. Connections are lazy and use UTC with five-second timeouts.

## Build and checks

- `npm start`: regular Nest startup; `npm run start:dev` enables watch mode.
- `npm run build`, then `npm run start:prod`: compiled operation.
- `npm test`: Vitest unit tests.
- `npm run test:e2e`: mocked Prisma HTTP tests.
- `npm run test:cov`: Vitest coverage mode.
- `npm run lint`: oxlint.
- `npm run test:auth:live`: running apps and approved local database required; creates/cleans a temporary user.
- `npm run test:learning:integration`: real SQL/HTTP workflow in a disposable schema; creates and drops only its own schema in an approved local test database.

Build/start hooks generate Prisma Client and `domain/learning.cjs`; production startup has no artifact-preparation hook. Deploy the domain bundle alongside `dist/`. Neither generated artifact should be hand-edited or committed. The repository has no verified production pipeline; bundled Nest deploy tooling is not an approved release procedure.

The backend began with the Nest starter; [official Nest documentation](https://docs.nestjs.com/) remains the framework reference. DECODE-specific commands, implemented endpoints and schema are documented in the [backend guide](../docs/BACKEND-GUIDE.md), not generic starter deployment/observability examples.
