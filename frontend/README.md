# DECODE frontend

Next.js App Router frontend for DECODE's public site and protected Student/Instructor workspaces. Start with the [root README](../README.md), [agent rules](../AGENTS.md), and [frontend guide](../docs/FRONTEND-GUIDE.md).

## Local development

Install dependencies here with `npm ci`. Copy `.env.example` to `.env.local` only if it does not already exist, and configure `API_URL` for a nondefault backend. See [environment configuration](../README.md#environment-configuration) for variable names and origin policy. Start PostgreSQL and the Nest API first; [authentication setup](../backend/AUTH.md) retains focused checks.

Run `npm run dev` from `frontend/`, then open the frontend on port 3000. Students land on `/dashboard`; the authenticated designated instructor lands on `/instructor`. `/login/success` is now a compatibility redirect, not a separate signed-in product page. The frontend proxies `/api/*` to NestJS.

## Commands and source

- `npm test`: existing Node/JSDOM behavior suite.
- `npm run lint`: ESLint.
- `npm run build`: Next production build and type validation.
- `npm start`: serve an existing production build.

Install/dev/build/test hooks prepare local Monaco workers under ignored `public/monaco-workers/`. Landing composition begins in `app/page.tsx`; route/view change locations are in the [frontend guide](../docs/FRONTEND-GUIDE.md#where-to-make-changes). `next/font/google` loads Geist/Geist Mono and requires network access at build time.

This project began with create-next-app. Official [Next.js documentation](https://nextjs.org/docs) and [learning material](https://nextjs.org/learn) remain useful, but follow [local Next agent instructions](AGENTS.md) and the installed version's guides before coding. The starter's [Vercel deployment guidance](https://nextjs.org/docs/app/building-your-application/deploying) is a reference, not evidence of configured DECODE hosting.

## Current documentation

See [architecture](../docs/PROJECT-ARCHITECTURE.md), [roles/features](../docs/ROLES-AND-FEATURES.md), [workflow](../docs/DEVELOPMENT-WORKFLOW.md), and [status](../docs/PROJECT-STATUS.md). Files in `frontend/docs/` are historical stage reports; old demo-auth/storage/production-gate claims are superseded. Admin frontend is on the separate unmerged branch and absent here.
