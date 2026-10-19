import { and, asc, count, desc, eq, ilike, or, sql } from "drizzle-orm"

import type { Database } from "../../db/client.js"
import {
  effectiveAvatarFrames,
  type FrameProjection,
} from "../avatar-frames/projection.js"
import type { AvatarFrameSummary } from "../../shared/contract.js"
import {
  account,
  moderationAction,
  session,
  user,
  userProfile,
} from "../../db/schema.js"
import { formatTimestamp } from "../../shared/timestamp.js"
import {
  groupFailure,
  hasAdminRole,
  requireGroupAdmin,
} from "../groups/service.js"

type AccountStatus = typeof userProfile.$inferSelect.status

type AccountRow = {
  id: string
  name: string
  email: string
  image: string | null
  emailVerified: boolean
  role: string | null
  banned: boolean | null
  status: AccountStatus
  version: number
  createdAt: Date
  updatedAt: Date
  moderatedAt: Date | null
  isPublic?: boolean
  bio?: string | null
  moderatedByUserId?: string | null
  moderationReason?: string | null
}

const columns = {
  id: user.id,
  name: user.name,
  email: user.email,
  image: user.image,
  emailVerified: user.emailVerified,
  role: user.role,
  banned: user.banned,
  status: userProfile.status,
  version: userProfile.version,
  createdAt: user.createdAt,
  updatedAt: userProfile.updatedAt,
  moderatedAt: userProfile.moderatedAt,
}

function requireConsistentBan(row: AccountRow) {
  if ((row.status === "banned") !== (row.banned === true))
    throw new Error(`Account ban state is inconsistent for user ${row.id}`)
}

function summary(
  row: AccountRow,
  avatarFrame: AvatarFrameSummary | null = null
) {
  requireConsistentBan(row)
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    image: row.image,
    avatarFrame,
    emailVerified: row.emailVerified,
    status: row.status,
    isAdmin: hasAdminRole(row.role),
    version: row.version,
    createdAt: formatTimestamp(row.createdAt),
    updatedAt: formatTimestamp(row.updatedAt),
    moderatedAt: row.moderatedAt ? formatTimestamp(row.moderatedAt) : null,
  }
}

export async function listModerationUsers(
  database: Database,
  input: {
    page: number
    limit: number
    q?: string
    status?: AccountStatus
  },
  frames: Omit<FrameProjection, "database"> = {}
) {
  const where = and(
    input.q
      ? or(
          ilike(user.name, `%${input.q}%`),
          ilike(user.email, `%${input.q}%`),
          eq(user.id, input.q)
        )
      : undefined,
    input.status ? eq(userProfile.status, input.status) : undefined
  )
  const [[totalRow], rows] = await Promise.all([
    database
      .select({ total: count() })
      .from(user)
      .innerJoin(userProfile, eq(userProfile.userId, user.id))
      .where(where),
    database
      .select(columns)
      .from(user)
      .innerJoin(userProfile, eq(userProfile.userId, user.id))
      .where(where)
      .orderBy(desc(user.createdAt), desc(user.id))
      .limit(input.limit)
      .offset((input.page - 1) * input.limit),
  ])
  const total = Number(totalRow?.total ?? 0)
  const projections = await effectiveAvatarFrames(
    { database, ...frames },
    rows.map((row) => row.id)
  )
  return {
    data: rows.map((row) => summary(row, projections.get(row.id) ?? null)),
    meta: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / input.limit),
    },
  }
}

export async function moderationUserDetail(
  database: Database,
  id: string,
  frames: Omit<FrameProjection, "database"> = {}
) {
  const [[row], providers] = await Promise.all([
    database
      .select({
        ...columns,
        isPublic: userProfile.isPublic,
        bio: userProfile.bio,
        moderatedByUserId: userProfile.moderatedByUserId,
        moderationReason: userProfile.moderationReason,
      })
      .from(user)
      .innerJoin(userProfile, eq(userProfile.userId, user.id))
      .where(eq(user.id, id))
      .limit(1),
    database
      .selectDistinct({ id: account.providerId })
      .from(account)
      .where(eq(account.userId, id))
      .orderBy(asc(account.providerId)),
  ])
  if (!row) groupFailure(404, "NOT_FOUND", "User not found")
  return {
    ...summary(
      row,
      (await effectiveAvatarFrames({ database, ...frames }, [id])).get(id) ??
        null
    ),
    isPublic: row.isPublic,
    bio: row.bio,
    moderatedByUserId: row.moderatedByUserId,
    moderationReason: row.moderationReason,
    linkedProviders: providers.map(({ id: providerId }) => providerId),
  }
}

export async function listModerationUserSessions(
  database: Database,
  id: string
) {
  const [[target], sessions] = await Promise.all([
    database
      .select({ id: user.id })
      .from(user)
      .innerJoin(userProfile, eq(userProfile.userId, user.id))
      .where(eq(user.id, id))
      .limit(1),
    database
      .select({
        id: session.id,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
      })
      .from(session)
      .where(and(eq(session.userId, id), sql`${session.expiresAt} > now()`))
      .orderBy(desc(session.createdAt), desc(session.id))
      // ponytail: cap the admin view at 100; paginate if real accounts reach it.
      .limit(100),
  ])
  if (!target) groupFailure(404, "NOT_FOUND", "User not found")
  return {
    data: sessions.map((item) => ({
      ...item,
      createdAt: formatTimestamp(item.createdAt),
      expiresAt: formatTimestamp(item.expiresAt),
    })),
  }
}

const reasons: Record<AccountStatus, string> = {
  active: "account restored by administrator",
  suspended: "account suspended by administrator",
  banned: "account banned by administrator",
}

export async function setModerationUserStatus(
  database: Database,
  actor: string,
  id: string,
  input: { status: AccountStatus; expectedVersion: number },
  frames: Omit<FrameProjection, "database"> = {}
) {
  await database.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext('redive:admin-bootstrap'))`
    )
    await requireGroupAdmin(tx, actor)
    const [current] = await tx
      .select({
        ...columns,
        moderatedByUserId: userProfile.moderatedByUserId,
        moderationReason: userProfile.moderationReason,
      })
      .from(user)
      .innerJoin(userProfile, eq(userProfile.userId, user.id))
      .where(eq(user.id, id))
      .for("update")
    if (!current) groupFailure(404, "NOT_FOUND", "User not found")
    requireConsistentBan(current)
    if (current.version !== input.expectedVersion)
      groupFailure(
        409,
        "VERSION_CONFLICT",
        "Account changed since it was loaded",
        [
          {
            path: "expectedVersion",
            message: `Current version is ${current.version}`,
          },
        ]
      )
    if (current.status === input.status)
      groupFailure(409, "STATE_UNCHANGED", "Account status is unchanged")
    if (id === actor && input.status !== "active")
      groupFailure(
        409,
        "SELF_RESTRICTION",
        "Administrators cannot restrict their own account"
      )

    const isAdmin = hasAdminRole(current.role)
    if (
      isAdmin &&
      current.status === "active" &&
      current.banned !== true &&
      input.status !== "active"
    ) {
      const [activeAdmins] = await tx
        .select({ total: count() })
        .from(user)
        .innerJoin(userProfile, eq(userProfile.userId, user.id))
        .where(
          and(
            sql`(',' || coalesce(${user.role}, '') || ',') like '%,admin,%'`,
            eq(userProfile.status, "active"),
            sql`${user.banned} is not true`
          )
        )
      if (Number(activeAdmins?.total ?? 0) <= 1)
        groupFailure(
          409,
          "LAST_ACTIVE_ADMIN",
          "Cannot restrict the last active administrator"
        )
    }

    const now = new Date()
    const betterAuthBanned = input.status === "banned"
    await tx
      .update(user)
      .set({
        banned: betterAuthBanned,
        banReason: betterAuthBanned ? reasons.banned : null,
        banExpires: null,
        updatedAt: now,
      })
      .where(eq(user.id, id))
    const [updated] = await tx
      .update(userProfile)
      .set({
        status: input.status,
        version: sql`${userProfile.version} + 1`,
        moderatedAt: input.status === "active" ? null : now,
        moderatedByUserId: input.status === "active" ? null : actor,
        moderationReason:
          input.status === "active" ? null : reasons[input.status],
        updatedAt: now,
      })
      .where(
        and(
          eq(userProfile.userId, id),
          eq(userProfile.version, input.expectedVersion)
        )
      )
      .returning({ version: userProfile.version })
    if (!updated)
      groupFailure(
        409,
        "VERSION_CONFLICT",
        "Account changed since it was loaded"
      )

    const revokedSessions =
      input.status === "active"
        ? []
        : await tx
            .delete(session)
            .where(eq(session.userId, id))
            .returning({ id: session.id })
    const action =
      input.status === "active"
        ? "restored"
        : input.status === "suspended"
          ? "suspended"
          : "banned"
    await tx.insert(moderationAction).values({
      actorUserId: actor,
      action: `account.status.${action}`,
      targetKind: "user",
      targetId: id,
      reason: reasons[input.status],
      before: {
        status: current.status,
        version: current.version,
        isAdmin,
        betterAuthBanned: current.banned === true,
        moderatedAt: current.moderatedAt
          ? formatTimestamp(current.moderatedAt)
          : null,
        revokedSessionCount: 0,
      },
      after: {
        status: input.status,
        version: updated.version,
        isAdmin,
        betterAuthBanned,
        moderatedAt: input.status === "active" ? null : formatTimestamp(now),
        revokedSessionCount: revokedSessions.length,
      },
      createdAt: now,
    })
  })
  return moderationUserDetail(database, id, frames)
}
