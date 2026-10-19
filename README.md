![StSuicaoDex](https://github.com/user-attachments/assets/3c8805d1-7a61-49d4-9aa6-4bfae337c550)

<a target="_blank" href="https://discord.gg/z2BsjdTfx4"><img src="https://dcbadge.limes.pink/api/server/z2BsjdTfx4" alt="" /></a>
[![wakatime](https://wakatime.com/badge/github/TNTKien/better-suicaodex.svg?style=for-the-badge)](https://wakatime.com/badge/github/TNTKien/better-suicaodex)

# SuicaoDex

An independent, ad-free manga platform for Vietnamese readers, with two reading
interfaces, publishing tools, and a shared backend.

[Live Website](https://suicaodex.com) · [GitHub](https://github.com/TNTKien/better-suicaodex)

## Features

- Manga discovery, search, tags, rankings, and a customizable chapter reader.
- Accounts, personal libraries, reading history, and notifications.
- Comments, translation groups, and group permissions.
- Manga/chapter publishing, image uploads, and moderation tools.
- Optional avatar frames, Coin, Shop, and Gacha.
- Sitemap, structured data, dynamic manga/group share images, and service-worker caching.
- Main and HVN frontends sharing the same accounts, catalog, and application logic.

## Tech Stack

| Component | Stack |
| --- | --- |
| Main frontend — `apps/web` | Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui and Base UI. |
| Alternate frontend — `apps/web-hvn` | Next.js and React, with its own presentation and the same API. |
| Backend — `apps/api` | Hono on Node.js, Better Auth, Zod, Drizzle ORM, and PostgreSQL. |
| OG images — `apps/og-image` | Bun, Satori, `@napi-rs/image`, and a SQLite image cache. |
| Storage and cache | S3-compatible object storage for images; optional Redis for API caching. |
| Shared packages — `packages/` | UI, account/catalog helpers, and ESLint/TypeScript configuration. |
| Workspace | Bun workspaces and Turborepo. |

PostgreSQL stores application data. Published images use a public asset origin;
pending uploads use a separate private bucket. The main web handles management
and SEO; HVN provides an alternate reading UI and stays out of search indexes.

## Getting Started

Requirements: Bun (use the version in `packageManager`), Node.js **22+**, and
PostgreSQL **17** with UTF-8 encoding. ICU locale `und` is recommended.
The database user must be able to create the schema and the `pgcrypto` extension.
S3-compatible storage is needed for uploads; Redis is optional.

**1. Clone and install.**

```sh
git clone https://github.com/TNTKien/better-suicaodex.git
cd better-suicaodex
bun install --frozen-lockfile

cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp apps/web-hvn/.env.example apps/web-hvn/.env
cp apps/og-image/.env.example apps/og-image/.env
```

**2. Fill in the app configuration.** See [Configuration](#configuration) below.
Create an empty PostgreSQL database and set the connection string, auth secret,
and OAuth credentials in `apps/api/.env`.

**3. Initialize the database and create an administrator.**

```sh
cd apps/api
bun --env-file=.env run db:migrate
bun --env-file=.env run admin:create -- admin@example.test "Administrator"
cd ../..
```

The CLI prompts for a password and confirmation; there is no default account.
Migrations create the schema, integrity checks, System group, 76 tags, and a
closed common chest. Add manga, chapters, groups, and Shop stock through the
management tools. No old database or content import is required.

**4. Start development.**

```sh
bun run dev
```

This starts all four apps. To run one app, use `bun run dev` from its directory.

| App | Local URL |
| --- | --- |
| Main web | http://localhost:3000 |
| API | http://localhost:3001 |
| HVN | http://localhost:3002 |
| OG images | http://localhost:3003 |

Checks from the repository root: `bun run typecheck`, `bun run lint`,
`bun run test`, and `bun run contract:check`. Regenerate API clients with
`bun run contract:generate` after contract changes. Use separate test configuration
and fake credentials for tests.

## Configuration

Each app reads its own `.env`; do not use a shared root `.env`.
The four `.env.example` files contain the complete settings and defaults.
Keep unused optional variables commented.

`NEXT_PUBLIC_*` values are public and bundled into the frontend. Never put secrets
in them. Other credentials below belong only in the relevant server app.
Use complete HTTP(S) origins such as `http://localhost:3001`, without paths,
credentials, query strings, or fragments.

**API — `apps/api/.env`**

| Variable | Purpose |
| --- | --- |
| `NODE_ENV`, `PORT` | Runtime mode and API port; use `development` and `3001` locally. |
| `DATABASE_URL` | PostgreSQL connection string for the application's own database. Create an empty database first. Use the SSL settings required by your database provider. |
| `BETTER_AUTH_SECRET` | Random auth secret of at least 32 characters. Generate your own value and keep it private. |
| `BETTER_AUTH_URL` | API/auth origin, locally `http://localhost:3001`. OAuth callbacks use this origin. |
| `WEB_ORIGIN` | Main frontend origin, locally `http://localhost:3000`. Also used for auth redirects. |
| `WEB_ALLOWED_ORIGINS` | Comma-separated additional frontend origins; include `http://localhost:3002` for HVN. Exact origins only; no wildcards. |
| `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` | Discord OAuth credentials. Both are required by API validation; real credentials are needed for Discord sign-in. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | Additional OAuth credentials, required when `NODE_ENV=production`. Development uses Discord only. |
| `ASSET_BASE_URL` | Public image origin, matching the frontend and OG asset settings. |
| `TEST_DATABASE_URL` | Integration-test database target. Use a separate local PostgreSQL URL whose database name ends in `_test`, never the application database. Not needed to run the apps. |

Register the Discord callback as
`http://localhost:3001/api/auth/callback/discord`. Other providers use
`<BETTER_AUTH_URL>/api/auth/callback/<provider>`. Both frontend origins must be
trusted by the API. Public account registration uses OAuth; the admin CLI shown above
creates an administrator with an email/password login.

To generate a random secret, run
`node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
Generate a separate value if you also enable `INTERNAL_API_KEY`.

**Frontends — `apps/web/.env` and `apps/web-hvn/.env`**

| Variable | Purpose |
| --- | --- |
| `API_URL` | API origin for server-side requests; locally `http://localhost:3001`. |
| `NEXT_PUBLIC_API_URL` | Browser-accessible API origin; locally the same URL. |
| `WEB_URL` | This frontend's own origin: `http://localhost:3000` for web, `http://localhost:3002` for HVN. |
| `NEXT_PUBLIC_WEB_URL` | Main web origin in **both** apps; HVN uses it for links to shared account/publishing pages. |
| `NEXT_PUBLIC_ASSET_URL` | Public image origin in both apps; must match API/OG `ASSET_BASE_URL`. |
| `OG_IMAGE_URL` | Main web only: OG service origin, locally `http://localhost:3003`. |
| `INTERNAL_API_KEY` | Optional server-only credential for allowlisted public API reads. If enabled, use the same random value of at least 32 bytes in the API and both frontends; otherwise leave it commented everywhere. |

Changing `NEXT_PUBLIC_*` values requires restarting development servers or
rebuilding the frontend and its service worker.

**Uploads — optional settings in `apps/api/.env`**

| Variable | Purpose |
| --- | --- |
| `S3_ENDPOINT`, `S3_REGION` | S3-compatible endpoint and signing region; use your storage provider's values. |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Server-only storage credentials with access to the configured buckets. |
| `S3_BUCKET` | Bucket holding published images. Its objects must be reachable through the public asset origin. |
| `S3_STAGING_BUCKET` | Separate private bucket for pending uploads. Setting it enables uploads and requires all other `S3_*` values above. |

Leave all S3 settings commented if uploads are not needed. The example asset origin
`http://localhost:9000` is a placeholder for a storage server/CDN you provide;
this monorepo does not start an asset server. Published object paths include
`/covers/`, `/data/`, `/groups/`, and `/avatar-frames/`. Configure storage CORS
for browser uploads from both frontend origins and image reads from the public origin.

**Optional API features and tuning**

Defaults in the API example are enough for basic local use.

| Variable | Purpose / default |
| --- | --- |
| `REDIS_CACHE_ENABLED`, `REDIS_URL` | Enable shared business caching. Disabled by default; enabling requires a Redis URL. Remote Redis must use `rediss://`. |
| `REDIS_PREFIX` | Cache namespace. Use a separate prefix for each installation/environment. |
| `REDIS_DEFAULT_TTL_SECONDS` | Default cache lifetime: `30` seconds. |
| `REDIS_CONNECT_TIMEOUT_MS`, `REDIS_RECONNECT_RETRY_MS` | Connection timeout (`5000`) and reconnect delay (`15000`), in milliseconds. |
| `REDIS_CACHE_VERSION_REFRESH_MS` | Cache-version refresh interval: `1500` milliseconds. |
| `ENDPOINT_CACHE_HOMEPAGE_TTL_SECONDS`, `ENDPOINT_CACHE_MANGA_LIST_TTL_SECONDS` | Homepage/list cache lifetimes: `45` / `180` seconds. |
| `ENDPOINT_CACHE_MANGA_DETAIL_TTL_SECONDS`, `ENDPOINT_CACHE_CHAPTER_DETAIL_TTL_SECONDS` | Manga/chapter detail cache lifetimes: `300` / `450` seconds. |
| `ENDPOINT_CACHE_MANGA_ROUTE_LOOKUP_TTL_SECONDS`, `ENDPOINT_CACHE_MANGA_RANKING_TTL_SECONDS` | Route lookup/ranking cache lifetimes: `300` / `90` seconds. |
| `INTERNAL_API_RATE_LIMIT_PER_SECOND` | Request limit for authenticated internal public reads: `100` per second. |
| `TRUSTED_PROXY_IPS` | Comma-separated exact proxy IPs allowed to supply forwarded client IPs. Leave empty when accessing the API directly. |
| `HIDE_R18` | Hide adult content from public catalog reads; `true` by default. |
| `HIDDEN_MANGA_IDS`, `HIDDEN_CHAPTER_IDS` | Comma-separated UUIDs to exclude from public reads. Empty by default. |
| `DISCORD_GROUP_REVIEW_WEBHOOK_URL`, `DISCORD_GROUP_REVIEW_MENTION_USER_ID` | Optional group-creation alerts. Set both the Discord webhook URL and a numeric user ID, or leave both blank. |
| `AVATAR_FRAMES_ENABLED` | Allow avatar-frame rendering/equipping; disabled by default. Admin catalog/grant tools remain available. |
| `COIN_ENABLED`, `COIN_EXCLUDED_GROUP_IDS` | Enable SuicaoCoin and optionally exclude comma-separated group UUIDs from rewards. Coin is disabled by default; System is always excluded. |
| `SHOP_ENABLED`, `GACHA_ENABLED` | Independent Shop/gacha switches, disabled by default. Purchases also require coin and avatar frames; gacha additionally requires the Shop. Prepare the catalog and stock before enabling them. |
| `SHOP_MAINTENANCE_DATABASE_URL` | Optional direct PostgreSQL target for `shop:catalog`; falls back to `DATABASE_URL`. |
| `IMAGE_SERVER2_ENABLED`, `IMAGE_SERVER2_UPLOAD_ENABLED`, `IMAGE_SERVER2_READ_ENABLED` | Optional secondary chapter-image storage, upload, and read switches. All disabled by default. |
| `TIKTOK_COOKIE`, `TIKTOK_CSRF_TOKEN` | Credentials for the optional secondary-image worker only. Keep them server-side; basic S3 uploads do not need them. |

**OG images — `apps/og-image/.env`**

| Variable | Purpose / default |
| --- | --- |
| `HOST`, `PORT` | Bind address and port: `127.0.0.1` / `3003`. |
| `API_URL` | API origin used to fetch public manga/group metadata. |
| `WEB_URL` | Main web origin used for site branding. |
| `ASSET_BASE_URL` | Allowed public cover/avatar origin; use the same origin as the frontends and API. |
| `CACHE_DIR` | Writable directory for the SQLite image cache; `.cache` relative to the app directory. |
| `MAX_CONCURRENT_RENDERS` | Maximum simultaneous image renders, from `1` to `8`; defaults to `2`. |

The OG service runs directly with Bun and has no build step.

## License

Project code is [MIT-licensed](LICENSE). Fonts, artwork, logos, and other
third-party assets retain their own terms; see [third-party notices](THIRD_PARTY_NOTICES.md).

## Star History Chart

 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://shieldcn.dev/chart/github/stars/tntkien/better-suicaodex.svg?theme=rose&font=jetbrains-mono&border=false&logo=false&yScale=log" />
   <source media="(prefers-color-scheme: light)" srcset="https://shieldcn.dev/chart/github/stars/tntkien/better-suicaodex.svg?mode=light&theme=rose&font=jetbrains-mono&border=false&logo=false&yScale=log" />
   <img alt="Star History Chart" src="https://shieldcn.dev/chart/github/stars/tntkien/better-suicaodex.svg?theme=rose&font=jetbrains-mono&border=false&logo=false&yScale=log" />
 </picture>
