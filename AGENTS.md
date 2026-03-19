# AGENTS.md

<!-- BEGIN:nextjs-agent-rules -->
 
# Next.js: ALWAYS read docs before coding
 
Before any Next.js work, find and read the relevant doc in `node_modules/next/dist/docs/`. Your training data is outdated — the docs are the source of truth.
 
<!-- END:nextjs-agent-rules -->

## Overview

- `better-suicaodex` is a single-app Bun + Next.js 16 repository.
- Main stack: React 19, App Router, TypeScript, Tailwind 4, shadcn-style UI, Better Auth, Drizzle ORM, PostgreSQL, Hono, Orval-generated WeebDex client.
- Package manager is Bun. Prefer `bun run <script>` and `bunx <tool>`.
- Root app code lives in `src/`. Static assets live in `public/`. Operational scripts live in `scripts/`.

## Important Directories

```text
.
|- src/app                Next.js routes, layouts, route groups, API handlers
|- src/components         shared UI, layout, comments, theme, search
|- src/components/ui      shadcn-style primitives and large UI composites
|- src/hooks              reusable client hooks
|- src/lib                auth, db, Hono app, utilities, WeebDex client
|- src/lib/weebdex        generated API hooks/models plus a few handwritten helpers
|- scripts                migration, DB smoke, Orval patch helpers
|- public                 images, icons, static files
|- deprecated             archived code; do not treat as active implementation
|- temp                   exports, backups, experiments; not normal app code
|- .github/skills         repo-local agent/reference skills
|- .agents                internal agent skill material and references
```

## Existing Agent Guidance

- No root `AGENTS.md` existed before this file.
- No `.cursor/rules/`, `.cursorrules`, or `.github/copilot-instructions.md` were found.
- Existing AGENTS-like material is under internal skill/reference folders such as `.github/skills/vercel-react-best-practices/AGENTS.md` and `.agents/...`.
- When touching React or Next code, also consult `.github/skills/vercel-react-best-practices/AGENTS.md` for performance-oriented guidance.

## Child AGENTS Files

- `src/app/AGENTS.md` - App Router, route groups, server/client boundaries, API route patterns.
- `src/lib/weebdex/AGENTS.md` - generated client workflow, safe edit boundaries, Orval patch process.
- `src/components/ui/AGENTS.md` - UI primitive/composite extension rules and local style differences.

## Commands

### Setup

```bash
bun install
bun run gen:api
```

### Development

```bash
bun dev
bun run db:drizzle:studio
```

### Build and Start

```bash
bun run build
bun run start
```

### Lint

```bash
bun run lint
bun run lint:fix
```

### Database / Migration Helpers

```bash
bun run db:drizzle:pull
bun run db:drizzle:generate
bun run db:drizzle:push
bun run db:smoke
bun run db:export:mysql
bun run db:import:mysql-export
bun run migrate:weebdex
bun run migrate:weebdex:execute
bun run verify:auth-migration
```

## Tests

- There is currently no `test` script in `package.json`.
- No Jest, Vitest, Playwright, or other repo-level test config was found.
- Single-test command: not available because no test runner is configured.
- If you add tests later, add both a full-suite command and a single-file command to `package.json`, then update this file.

## Code Style

### Formatting

- TypeScript runs in `strict` mode; keep new code type-safe.
- `eslint.config.mjs` is the main enforcement point.
- `.prettierrc` is empty, so Prettier defaults apply.
- Most handwritten app/lib code uses semicolons and double quotes.
- Do not normalize `src/components/ui/*` to that style blindly; many of those files intentionally keep upstream shadcn formatting.

### Imports

- Use `@/*` for `src/*` imports and `#/*` for `public/*` imports, per `tsconfig.json`.
- Prefer `import type` for type-only imports when the file already follows that pattern.
- Keep framework/library imports near the top, then internal alias imports.
- Avoid inventing new alias schemes.

### Naming

- React components, exported types, and Drizzle row types use PascalCase.
- Functions, hooks, variables, and helpers use camelCase.
- Hooks use the `use-` / `use` naming pattern already present in `src/hooks`.
- Route files follow Next conventions: `page.tsx`, `layout.tsx`, `route.ts`, `error.tsx`, `not-found.tsx`.
- Constants that model enums or fixed options often use `as const` tuples, for example in `src/lib/db/schema.ts` and `src/types`.

### Types and State

- Prefer explicit prop types and typed helper returns in exported code.
- Use `as const` for literal option sets that also drive TypeScript unions.
- Preserve App Router server/client boundaries; add `"use client"` only when hooks, browser APIs, or client-side state are required.
- Many pages are async server components; follow the existing `await params` / `await searchParams` pattern used across `src/app`.

### Error Handling

- Fail fast for required env vars and impossible states. Existing code throws for missing `BETTER_AUTH_SECRET` and `DATABASE_URL`.
- In UI routes, prefer returning `ErrorPage` or a controlled fallback over uncaught render crashes.
- In server utilities and scripts, log useful context before rethrowing or returning an error response.
- Do not swallow migration/auth safety checks from the docs.

## Project-Specific Rules

- Treat `deprecated/` as archive/reference code unless the task is explicitly about migration history.
- Treat `temp/` as disposable artifacts and backups, not active app code.
- `src/lib/weebdex/hooks/**` and `src/lib/weebdex/model/**` are generated outputs; do not hand-edit them unless the task is specifically about generator patches.
- If generated WeebDex output is wrong, fix `orval.config.ts`, `scripts/patch-orval.mjs`, or handwritten wrappers instead of mass-editing generated files.
- Do not remove Better Auth compatibility mappings or legacy-safe migration behavior without updating the migration docs and verification steps.
- Do not point Prisma commands at archived MySQL migrations under `deprecated/prisma`.

## Auth and DB Gotchas

- `BETTER_AUTH_URL` must match the browser origin exactly.
- `BETTER_AUTH_SECRET` is required.
- `DATABASE_URL` is required for runtime and Drizzle config.
- `SHADOW_DATABASE_URL` is expected for the documented PostgreSQL migration workflow.
- Better Auth uses Drizzle field remapping in `src/auth.ts`; preserve those mappings unless you are intentionally migrating schema and runtime together.

## Where To Edit

- New routes, pages, layouts, route handlers: `src/app`
- Shared presentation components: `src/components`
- UI primitives and large design-system composites: `src/components/ui`
- Auth runtime config: `src/auth.ts`, `src/lib/auth-client.ts`
- Database schema and connection: `src/lib/db`
- API client generation inputs and wrappers: `src/lib/weebdex`, `orval.config.ts`, `scripts/patch-orval.mjs`
- Operational scripts: `scripts`

## Workflow Expectations For Agents

- Read the nearest child `AGENTS.md` before changing `src/app`, `src/lib/weebdex`, or `src/components/ui`.
- Prefer the repo scripts in `package.json` over ad-hoc commands.
- Keep docs in sync when changing auth or database workflows, especially `MIGRATE_TO_BETTER_AUTH.md` and `MIGRATE_TO_POSTGRES.md`.
- If you add a test runner, lint rule, or local instruction file, update `AGENTS.md` so later agents do not need to rediscover it.