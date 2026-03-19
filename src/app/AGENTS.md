# AGENTS.md

## Scope

- This directory owns the Next.js App Router tree: pages, layouts, error boundaries, metadata, and API routes.
- Route groups such as `(suicaodex)` and `(reader)` are organizational only; they do not affect URLs.

## Structure Rules

- Keep route files on Next conventions: `page.tsx`, `layout.tsx`, `route.ts`, `error.tsx`, `global-error.tsx`, `not-found.tsx`.
- Keep route-specific client components in nearby `_components/` folders.
- Shared cross-route UI should usually move to `src/components` instead of growing `_components` everywhere.

## Server vs Client

- Default to server components.
- Add `"use client"` only when the file uses hooks, browser APIs, local state, refs, or client-only libraries.
- Many pages are async server components. Follow the local pattern of `await params` and `await searchParams`.
- Do not import server-only modules into client components. For auth, use `getAuthSession()` on the server and `authClient` on the client.

## Existing Patterns

- Invalid legacy MangaDex UUID routes often return `ErrorPage` with a custom message instead of throwing.
- Search/query state frequently uses `nuqs` in client components and warm-up helpers in server pages.
- Layout-level providers live in `src/app/layout.tsx`; feature layouts like `src/app/(suicaodex)/layout.tsx` should stay focused on layout composition.

## API Routes

- `api/auth/[...all]/route.ts` is the Better Auth catch-all handler. Do not split it into custom auth endpoints unless the auth integration itself changes.
- `api/comments/[[...route]]/route.ts` delegates to the Hono app and exports all HTTP verbs plus `runtime = "nodejs"`.
- Keep API handler wiring thin in `src/app/api`; put business logic in `src/lib`.

## Performance and Safety

- Follow `.github/skills/vercel-react-best-practices/AGENTS.md` when changing data fetching or large client surfaces.
- Prefer parallel fetch starts and Suspense/composition over avoidable server waterfalls.
- Be careful with hydration-sensitive UI. The root layout already uses an inline script to avoid theme flicker.

## When Editing Here

- Update nearby metadata/layout files when route behavior changes.
- Preserve Vietnamese copy/tone where the surrounding route already uses it.
- Keep redirects, not-found handling, and `ErrorPage` behavior consistent with neighboring routes.
