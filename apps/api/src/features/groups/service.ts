import { randomUUID } from "node:crypto"
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm"
import slugify from "slugify"

import type { Database } from "../../db/client.js"
import {
  member as members,
  moderationAction,
  organization as groups,
  translationGroupApplication as applications,
  translationGroupMemberProfile as memberProfiles,
  translationGroupProfile as groupProfiles,
  user,
  userProfile,
} from "../../db/schema.js"
import { formatTimestamp } from "../../shared/timestamp.js"
import type {
  GroupInput,
  GroupManagement,
  GroupMembership,
  GroupPermissions,
} from "./contract.js"

export type GroupTransaction = Parameters<
  Parameters<Database["transaction"]>[0]
>[0]
type Reader = Pick<Database, "select">
export type GroupRow = {
  id: string
  name: string
  slug: string
  avatarUrl: string | null
  bannerUrl: string | null
  description: string | null
  links: Record<string, string>
  inactive: boolean
  approvalStatus: "pending" | "approved" | "rejected"
  createdByUserId: string | null
  reviewedAt: Date | null
  reviewedByUserId: string | null
  publicationState: "draft" | "published" | "hidden"
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
  deletedByUserId: string | null
  deleteReason: string | null
}
export type MemberRow = {
  id: string
  groupId: string
  userId: string
  role: "leader" | "member"
  createdAt: Date
} & GroupPermissions

export const groupColumns = {
  id: groups.id,
  name: groups.name,
  slug: groups.slug,
  avatarUrl: groups.logo,
  bannerUrl: groupProfiles.bannerUrl,
  description: groupProfiles.description,
  links: groupProfiles.links,
  inactive: groupProfiles.inactive,
  approvalStatus: groupProfiles.approvalStatus,
  createdByUserId: groupProfiles.createdByUserId,
  reviewedAt: groupProfiles.reviewedAt,
  reviewedByUserId: groupProfiles.reviewedByUserId,
  publicationState: groupProfiles.publicationState,
  createdAt: groupProfiles.createdAt,
  updatedAt: groupProfiles.updatedAt,
  deletedAt: groupProfiles.deletedAt,
  deletedByUserId: groupProfiles.deletedByUserId,
  deleteReason: groupProfiles.deleteReason,
}
export const memberColumns = {
  id: members.id,
  groupId: members.organizationId,
  userId: members.userId,
  role: members.role,
  createdAt: members.createdAt,
  canAddManga: memberProfiles.canAddManga,
  canEditManga: memberProfiles.canEditManga,
  canDeleteManga: memberProfiles.canDeleteManga,
  canAddChapter: memberProfiles.canAddChapter,
  canEditChapter: memberProfiles.canEditChapter,
  canDeleteChapter: memberProfiles.canDeleteChapter,
}

export const noPermissions: GroupPermissions = {
  canAddManga: false,
  canEditManga: false,
  canDeleteManga: false,
  canAddChapter: false,
  canEditChapter: false,
  canDeleteChapter: false,
}
export const memberDefaults: GroupPermissions = {
  ...noPermissions,
  canAddChapter: true,
  canEditChapter: true,
  canDeleteChapter: true,
}
const leaderPermissions: GroupPermissions = {
  canAddManga: true,
  canEditManga: true,
  canDeleteManga: true,
  canAddChapter: true,
  canEditChapter: true,
  canDeleteChapter: true,
}

export class GroupError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 429 | 503,
    readonly code: string,
    message: string,
    readonly details?: Array<{ path: string; message: string }>
  ) {
    super(message)
  }
}
export function groupFailure(
  status: GroupError["status"],
  code: string,
  message: string,
  details?: Array<{ path: string; message: string }>
): never {
  throw new GroupError(status, code, message, details)
}
export const hasAdminRole = (role: string | null) =>
  role?.split(",").some((value) => value.trim() === "admin") ?? false

export async function isApplicationAdmin(db: Reader, userId: string) {
  const [row] = await db
    .select({ role: user.role })
    .from(user)
    .innerJoin(userProfile, eq(userProfile.userId, user.id))
    .where(
      and(
        eq(user.id, userId),
        eq(userProfile.status, "active"),
        sql`${user.banned} is not true`
      )
    )
    .limit(1)
    .for("share")
  return hasAdminRole(row?.role ?? null)
}
export async function requireGroupAdmin(db: Reader, userId: string) {
  if (!(await isApplicationAdmin(db, userId)))
    groupFailure(403, "FORBIDDEN", "Administrator access is required")
}
export async function requireActiveAccount(
  tx: GroupTransaction,
  userId: string
) {
  const [row] = await tx
    .select({ status: userProfile.status })
    .from(userProfile)
    .where(eq(userProfile.userId, userId))
    .for("share")
  if (row?.status !== "active")
    groupFailure(403, "ACCOUNT_RESTRICTED", "This account cannot contribute")
}
export async function lockGroupUser(tx: GroupTransaction, userId: string) {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext('redive:group-user:' || ${userId}))`
  )
  const [row] = await tx
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, userId))
    .for("update")
  if (!row) groupFailure(404, "NOT_FOUND", "User not found")
  await requireActiveAccount(tx, userId)
}
export async function requireAvailableUser(
  tx: GroupTransaction,
  userId: string
) {
  await lockGroupUser(tx, userId)
  const [membership] = await tx
    .select({ id: members.id })
    .from(members)
    .where(eq(members.userId, userId))
    .limit(1)
  const [application] = await tx
    .select({ id: applications.id })
    .from(applications)
    .where(
      and(eq(applications.userId, userId), eq(applications.status, "pending"))
    )
    .limit(1)
  if (membership || application)
    groupFailure(
      409,
      "GROUP_MEMBERSHIP_EXISTS",
      "This user already belongs to a group or has a pending request"
    )
}
export async function lockGroup(tx: GroupTransaction, groupId: string) {
  const [group] = await tx
    .select(groupColumns)
    .from(groups)
    .innerJoin(groupProfiles, eq(groupProfiles.organizationId, groups.id))
    .where(and(eq(groups.id, groupId), isNull(groupProfiles.deletedAt)))
    .for("update")
  if (!group) groupFailure(404, "NOT_FOUND", "Group not found")
  return group as GroupRow
}
export function requireOrdinaryGroup(group: GroupRow) {
  if (group.slug === "system")
    groupFailure(
      403,
      "SYSTEM_GROUP_PROTECTED",
      "System is reserved for imported content"
    )
}
export function requireApprovedGroup(group: GroupRow) {
  if (
    group.approvalStatus !== "approved" ||
    group.publicationState !== "published"
  )
    groupFailure(404, "NOT_FOUND", "Approved group not found")
}

export async function contributionGroupIds(
  tx: GroupTransaction,
  ownerGroupId: string,
  requestedGroupIds: string[]
) {
  const selectedIds = [...new Set(requestedGroupIds)]
    .filter((id) => id !== ownerGroupId)
    .sort()
  if (!selectedIds.length) return [ownerGroupId]

  const selected = (await tx
    .select(groupColumns)
    .from(groups)
    .innerJoin(groupProfiles, eq(groupProfiles.organizationId, groups.id))
    .where(
      and(inArray(groups.id, selectedIds), isNull(groupProfiles.deletedAt))
    )
    .orderBy(asc(groups.id))
    .for("share")) as GroupRow[]
  if (selected.length !== selectedIds.length)
    groupFailure(400, "INVALID_GROUPS", "One or more groups do not exist", [
      { path: "groupIds", message: "All groups must exist" },
    ])

  for (const group of selected) {
    requireOrdinaryGroup(group)
    requireApprovedGroup(group)
    if (group.inactive)
      groupFailure(403, "GROUP_INACTIVE", "Inactive groups cannot be added")
  }
  return [ownerGroupId, ...selectedIds]
}
export async function membershipFor(
  db: Reader,
  groupId: string,
  userId: string
) {
  const [row] = await db
    .select(memberColumns)
    .from(members)
    .innerJoin(memberProfiles, eq(memberProfiles.memberId, members.id))
    .where(and(eq(members.organizationId, groupId), eq(members.userId, userId)))
    .limit(1)
  if (!row) return undefined
  return {
    ...row,
    role: row.role === "owner" ? "leader" : "member",
  } as MemberRow
}
export async function applicationFor(
  db: Reader,
  groupId: string,
  userId: string
) {
  const [row] = await db
    .select()
    .from(applications)
    .where(
      and(
        eq(applications.organizationId, groupId),
        eq(applications.userId, userId)
      )
    )
    .limit(1)
  return row
}
export async function requireGroupManager(
  db: Reader,
  group: GroupRow,
  actor: string
) {
  requireOrdinaryGroup(group)
  requireApprovedGroup(group)
  if (await isApplicationAdmin(db, actor)) return
  const row = await membershipFor(db, group.id, actor)
  const [profile] = await db
    .select({ status: userProfile.status })
    .from(userProfile)
    .where(eq(userProfile.userId, actor))
    .limit(1)
  if (profile?.status !== "active")
    groupFailure(403, "ACCOUNT_RESTRICTED", "This account cannot manage groups")
  if (row?.role !== "leader")
    groupFailure(403, "FORBIDDEN", "Group leader access is required")
}
export async function requireGroupSettingsManager(
  db: Reader,
  group: GroupRow,
  actor: string
) {
  const admin = await isApplicationAdmin(db, actor)
  if (group.slug === "system") {
    if (!admin)
      groupFailure(
        403,
        "SYSTEM_GROUP_PROTECTED",
        "System identity is protected"
      )
    return
  }
  if (!admin) await requireGroupManager(db, group, actor)
}
export function permissionsFor(
  group: GroupRow,
  member: MemberRow | undefined
): GroupPermissions {
  if (
    !member ||
    group.approvalStatus !== "approved" ||
    group.publicationState !== "published" ||
    group.inactive ||
    group.deletedAt ||
    group.slug === "system"
  )
    return { ...noPermissions }
  if (member.role === "leader") return { ...leaderPermissions }
  return Object.fromEntries(
    Object.keys(noPermissions).map((key) => [
      key,
      member[key as keyof GroupPermissions],
    ])
  ) as GroupPermissions
}
export function groupDto(group: GroupRow): GroupManagement {
  return {
    id: group.id,
    name: group.name,
    slug: group.slug,
    avatarUrl: group.avatarUrl,
    bannerUrl: group.bannerUrl,
    description: group.description,
    links: group.links,
    inactive: group.inactive,
    approvalStatus: group.approvalStatus,
    publicationState: group.publicationState,
    createdAt: formatTimestamp(group.createdAt),
    updatedAt: formatTimestamp(group.updatedAt),
  }
}
export function memberDto(
  group: GroupRow,
  row: MemberRow,
  name: string
): GroupMembership {
  return {
    userId: row.userId,
    name,
    avatarFrame: null,
    role: row.role,
    status: "approved",
    permissions: permissionsFor(group, row),
    createdAt: formatTimestamp(row.createdAt),
  }
}
export function applicationDto(
  row: typeof applications.$inferSelect,
  name: string
): GroupMembership {
  return {
    userId: row.userId,
    name,
    avatarFrame: null,
    role: row.type === "create" ? "leader" : "member",
    status: row.status,
    permissions: { ...noPermissions },
    createdAt: formatTimestamp(row.createdAt),
  }
}
export async function auditGroup(
  tx: GroupTransaction,
  actor: string,
  groupId: string,
  action: string,
  reason: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null
) {
  await tx.insert(moderationAction).values({
    actorUserId: actor,
    targetKind: "group",
    targetId: groupId,
    action: `group.${action}`,
    reason,
    before,
    after,
  })
}
export function groupSlug(name: string) {
  return (
    slugify(name, { lower: true, strict: true, locale: "vi", trim: true })
      .slice(0, 60)
      .replace(/-+$/g, "") || "untitled"
  )
}
export async function createGroup(
  tx: GroupTransaction,
  actor: string,
  input: GroupInput,
  leaderUserId = actor,
  approved = false,
  reason = "User requested a group"
) {
  await requireAvailableUser(tx, leaderUserId)
  const base = groupSlug(input.name)
  if (base === "system")
    groupFailure(
      403,
      "SYSTEM_GROUP_PROTECTED",
      "System is reserved for imported content"
    )
  for (let attempt = 0; attempt < 200; attempt++) {
    const id = randomUUID()
    const slug = attempt ? `${base}-${attempt + 1}` : base
    const [identity] = await tx
      .insert(groups)
      .values({ id, name: input.name, slug, createdAt: new Date() })
      .onConflictDoNothing({ target: groups.slug })
      .returning({ id: groups.id })
    if (!identity) continue
    await tx.insert(groupProfiles).values({
      organizationId: id,
      description: input.description,
      links: input.links,
      createdByUserId: actor,
      approvalStatus: approved ? "approved" : "pending",
      publicationState: approved ? "published" : "draft",
      reviewedAt: approved ? new Date() : null,
      reviewedByUserId: approved ? actor : null,
    })
    const memberId = randomUUID()
    await tx.insert(members).values({
      id: memberId,
      organizationId: id,
      userId: leaderUserId,
      role: "owner",
      createdAt: new Date(),
    })
    await tx.insert(memberProfiles).values({ memberId, ...memberDefaults })
    if (!approved)
      await tx.insert(applications).values({
        organizationId: id,
        userId: leaderUserId,
        type: "create",
      })
    const group = await lockGroup(tx, id)
    await auditGroup(
      tx,
      actor,
      id,
      approved ? "created" : "requested",
      reason,
      null,
      { ...groupDto(group), leaderUserId }
    )
    return groupDto(group)
  }
  return groupFailure(
    409,
    "GROUP_SLUG_CONFLICT",
    "Choose a different group name"
  )
}

export async function groupWrite<T>(
  database: Database,
  actor: string,
  operation: (tx: GroupTransaction) => Promise<T>
) {
  return database.transaction(async (tx) => {
    await requireActiveAccount(tx, actor)
    return operation(tx)
  })
}

export async function setAdministrator(
  database: Database,
  targetUserId: string,
  action: "grant" | "revoke",
  actorUserId?: string
) {
  if (!targetUserId.trim()) throw new Error("User ID is required")
  return database.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext('redive:admin-bootstrap'))`
    )
    const activeAdmins = await tx
      .select({ id: user.id })
      .from(user)
      .innerJoin(userProfile, eq(userProfile.userId, user.id))
      .where(
        and(
          sql`(',' || coalesce(${user.role}, '') || ',') like '%,admin,%'`,
          eq(userProfile.status, "active"),
          sql`${user.banned} is not true`
        )
      )
    if (activeAdmins.length || action === "revoke") {
      if (!actorUserId)
        groupFailure(403, "FORBIDDEN", "An existing administrator is required")
      await requireGroupAdmin(tx, actorUserId)
    }
    const [target] = await tx
      .select({
        id: user.id,
        role: user.role,
        status: userProfile.status,
        banned: user.banned,
      })
      .from(user)
      .innerJoin(userProfile, eq(userProfile.userId, user.id))
      .where(eq(user.id, targetUserId))
      .for("update")
    if (!target) groupFailure(404, "NOT_FOUND", "User not found")
    const roles = new Set(
      target.role
        ?.split(",")
        .map((role) => role.trim())
        .filter(Boolean) ?? []
    )
    const exists = roles.has("admin")
    if ((action === "grant") === exists) return
    if (action === "grant") {
      await requireActiveAccount(tx, targetUserId)
      roles.add("admin")
    } else {
      if (
        target.status === "active" &&
        target.banned !== true &&
        activeAdmins.length === 1
      )
        groupFailure(409, "LAST_ADMIN", "Cannot revoke the last administrator")
      roles.delete("admin")
    }
    await tx
      .update(user)
      .set({ role: [...roles].join(",") || null })
      .where(eq(user.id, targetUserId))
    await tx.insert(moderationAction).values({
      actorUserId: actorUserId ?? targetUserId,
      targetKind: "user",
      targetId: targetUserId,
      action: `admin.${action}`,
      reason:
        action === "grant" ? "Administrator granted" : "Administrator revoked",
      before: { isAdmin: exists },
      after: { isAdmin: action === "grant", bootstrap: !activeAdmins.length },
    })
  })
}
