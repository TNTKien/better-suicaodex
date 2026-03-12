# Migrate Auth.js to Better Auth (Data-Safe Guide)

This guide documents a safe migration path from Auth.js to Better Auth in this project.

It is written for production safety first:

- no destructive schema change during migration
- keep legacy auth data available
- verify data integrity after deploy

---

## 1) Preconditions

Before touching production:

1. Confirm you have a full DB backup.
2. Test restore of that backup on a staging database.
3. Ensure env vars are ready:

```bash
BETTER_AUTH_SECRET=<32+ random chars>
BETTER_AUTH_URL=https://your-domain.com

AUTH_DISCORD_ID=...
AUTH_DISCORD_SECRET=...
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
AUTH_GITHUB_ID=...
AUTH_GITHUB_SECRET=...
```

Notes:

- `BETTER_AUTH_URL` must exactly match the browser origin (protocol + host + port).
- This project uses `BETTER_AUTH_SECRET` as the only auth secret.

---

## 2) Dependency migration

Remove Auth.js packages and use Better Auth adapter:

```bash
bun add @better-auth/prisma-adapter@1.5.3
bun remove next-auth @auth/prisma-adapter
```

---

## 3) App integration changes

### Server auth config

Main auth config lives in `src/auth.ts`.

Current structure:

- export Better Auth instance as `auth`
- use Prisma adapter
- map Better Auth fields to legacy Auth.js columns
- provide `getAuthSession()` helper for server routes/pages

### Route handler

Use Better Auth Next.js handler in `src/app/api/auth/[...all]/route.ts`:

```ts
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/auth";

export const { GET, POST } = toNextJsHandler(auth);
```

### Client usage

Use `createAuthClient` in `src/lib/auth-client.ts`, then replace old `next-auth/react` calls:

- `useSession` -> `authClient.useSession()`
- `signIn` -> `authClient.signIn.social(...)`
- `signOut` -> `authClient.signOut()`

---

## 4) Database migration strategy (safe)

Do additive changes first. Do not drop legacy Auth.js fields/tables during cutover.

Implemented migrations:

1. `prisma/mysql-migrations-archive/20260307000000_authjs_to_better_auth_safe/`
   - add compatibility columns
   - backfill data
   - create `Verification` table
   - copy legacy `VerificationToken` rows to `Verification`

2. `prisma/mysql-migrations-archive/20260307000001_fix_verification_value_length/`
   - set `Verification.value` to `TEXT`
   - remove composite unique index that depends on short varchar
   - keep index on `identifier`

Why migration #2 matters:

- Better Auth stores OAuth state payload in `Verification.value`.
- If this column is too short (for example `VARCHAR(191)`), OAuth can fail with:
  `error=please_restart_the_process`.

---

## 5) Field mapping (legacy compatibility)

Configured in `src/auth.ts`:

- User
  - Better Auth `name` -> DB `displayName`
  - Better Auth `emailVerified` -> DB `betterEmailVerified`

- Session
  - Better Auth `token` -> DB `sessionToken`
  - Better Auth `expiresAt` -> DB `expires`

- Account
  - Better Auth `providerId` -> DB `provider`
  - Better Auth `accountId` -> DB `providerAccountId`
  - Better Auth `accessToken` -> DB `access_token`
  - Better Auth `refreshToken` -> DB `refresh_token`
  - Better Auth `idToken` -> DB `id_token`
  - Better Auth `accessTokenExpiresAt` -> DB `accessTokenExpiresAt`
  - Better Auth `refreshTokenExpiresAt` -> DB `refreshTokenExpiresAt`

This mapping lets existing Auth.js data remain usable while moving runtime auth to Better Auth.

---

## 6) Production deploy order

1. Deploy code changes.
2. Apply migrations:

```bash
bunx prisma migrate deploy
```

3. Run integrity check:

```bash
bun run verify:auth-migration
```

4. Run smoke tests:

- login with each social provider
- open protected routes (`/user`, `/settings`)
- sign out

---

## 7) Data integrity verification

Use script: `scripts/verify-auth-migration-safety.mjs`

Command:

```bash
bun run verify:auth-migration
```

The script checks:

- users with empty `displayName`
- verified-user mapping correctness
- verification token preservation
- account expiry timestamp migration

If this script fails, stop rollout and investigate before continuing.

---

## 8) Troubleshooting

### Error: `please_restart_the_process`

Most common causes:

1. `BETTER_AUTH_URL` mismatch with actual browser origin.
2. Stale auth cookies after config/schema changes.
3. Too-short `Verification.value` column.

Recovery steps:

1. Verify `BETTER_AUTH_URL` exactly matches origin.
2. Clear browser cookies (`better-auth.*`).
3. Restart app process.
4. Confirm `Verification.value` is `TEXT`.

### OAuth callback loops or random callback failure

Check provider callback URL config:

- `https://your-domain.com/api/auth/callback/<provider>`

---

## 9) Post-cutover cleanup policy

Do not remove legacy fields immediately.

Recommended:

1. Run with compatibility mapping for a stabilization window.
2. Monitor auth errors and sign-in metrics.
3. Plan a separate, explicit cleanup migration later (optional), only after stable production behavior.

---

## 10) Quick command checklist

```bash
# migrate schema
bunx prisma migrate deploy

# validate schema
bunx prisma validate

# regenerate prisma client
bun prisma generate

# verify migrated auth data
bun run verify:auth-migration
```
