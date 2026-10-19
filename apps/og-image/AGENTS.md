# Scope

This app is the SuicaoDex OG image service inside the Re:Dive monorepo. It runs as a separate Bun process without Next.js. Keep public HTTP contracts with the API and web explicit.

# Conventions

- Use Bun and the root workspace lockfile; install dependencies from the monorepo root.
- Use Conventional Commits; do not add assistant attribution.
- Use date-fns for date arithmetic and expiry calculations.
- Keep public visibility checks, cover host restrictions, byte/pixel limits, bounded caching and concurrency limits when changing rendering.
- Run `bun run typecheck` and `bun test` after non-trivial changes. Do not automate a browser unless requested.
