<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes - APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Git Conventions
- Commit messages must follow the Conventional Commits specification.
- Do not add `Co-Authored-By` trailers or equivalent AI/assistant attribution to commits, pull requests, or related Git/GitHub content.

# Workspace
- Bun monorepo: `apps/web` (main Next.js frontend), `apps/web-hvn` (alternate frontend), `apps/api` (Hono/PostgreSQL), `apps/og-image` (Bun OG renderer).
- Shared UI, account and catalog behavior belongs in `packages/`; preserve each frontend's presentation.
- Use the root Bun lockfile. Generate API contracts with `bun run contract:generate`; never hand-edit generated clients.
- New installations use `apps/api/drizzle` on an empty PostgreSQL database. There are no legacy content importers.
- Run integration tests from `apps/api` with `bun run test:integration`; the runner creates a separate local database per suite.
- Build sequentially: API, main web (Next + Serwist), then HVN (Next + Serwist). OG runs directly with Bun.
- See `README.md` for installation and `THIRD_PARTY_NOTICES.md` for asset attribution scope.
- Never use production credentials for tests. Do not automate browser testing or deploy without an explicit request.

# Date and Time Conventions
- Use `date-fns` for date parsing, formatting, comparison, arithmetic, intervals, and calendar boundaries. Do not hand-roll date/time logic when `date-fns` supports it.
- If `date-fns` cannot support a required operation, document why and test its date/time edge cases.
- Use `@date-fns/tz` with an explicit time zone for time-zone-dependent logic; never rely on the runtime machine's local time zone.
- Keep absolute instants in the database as `timestamp with time zone`; convert time zones only for explicit calculation or display needs.
- Choose calendar-based and elapsed-time functions deliberately; they are not interchangeable.
