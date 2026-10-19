import type { OpenAPIHono } from "@hono/zod-openapi"
import { and, asc, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm"
import { bodyLimit } from "hono/body-limit"

import type { Database } from "../../db/client.js"
import {
  translationGroupApplication as applications,
  chapter,
  chapterGroup,
  chapterUploadSession,
  coverUploadOperation,
  coverUploadSession,
  translationGroupProfile as groupProfiles,
  organization as groups,
  manga,
  mangaGroup,
  translationGroupMemberProfile as memberProfiles,
  member as members,
  moderationAction,
  user,
} from "../../db/schema.js"
import type { BusinessCache } from "../../shared/cache.js"
import { CONTENT_WRITE_LOCK } from "../../shared/content-lock.js"
import { apiError } from "../../shared/contract.js"
import type { Logger } from "../../shared/logger.js"
import type { ChapterStorage, CoverStorage } from "../../shared/storage.js"
import {
  isTrustedWebOrigin,
  type WebOrigins,
} from "../../shared/web-origins.js"
import type { Auth } from "../account/auth.js"
import { accountCanMutate, freshSessionUser } from "../account/guard.js"
import { effectiveAvatarFrames } from "../avatar-frames/projection.js"
import {
  createGroupNotification,
  resolveGroupJoinRequestNotification,
} from "../notifications/service.js"
import { isChapterPageUpload } from "./chapter.js"
import * as routes from "./contract.js"
import { isMangaCoverUpload, registerMangaCoverRoute } from "./cover.js"
import { registerMangaRoutes } from "./manga.js"
import {
  isGroupMediaUpload,
  registerGroupMediaRoutes,
} from "./profile-media.js"
import { notifyGroupReview, type GroupReviewWebhook } from "./review-webhook.js"
import {
  applicationDto,
  applicationFor,
  auditGroup,
  createGroup,
  groupColumns,
  groupDto,
  groupFailure,
  groupSlug,
  groupWrite,
  isApplicationAdmin,
  lockGroup,
  lockGroupUser,
  memberColumns,
  memberDefaults,
  memberDto,
  membershipFor,
  noPermissions,
  requireActiveAccount,
  requireApprovedGroup,
  requireAvailableUser,
  requireGroupAdmin,
  requireGroupManager,
  requireGroupSettingsManager,
  requireOrdinaryGroup,
} from "./service.js"

export function registerGroupRoutes(
  app: OpenAPIHono,
  dependencies: {
    auth?: Auth
    database: Database
    cache: BusinessCache
    assetBaseUrl: string
    avatarFramesEnabled?: boolean
    logger: Logger
    storage?: CoverStorage
    stagingStorage?: ChapterStorage
    groupReviewWebhook?: GroupReviewWebhook
    webOrigin: WebOrigins
  }
) {
  const { database, auth, cache, webOrigin } = dependencies
  const groupBodyLimit = bodyLimit({
    maxSize: 16_384,
    onError: (c) =>
      c.json(
        apiError(
          "PAYLOAD_TOO_LARGE",
          "Group requests must not exceed 16 KiB",
          c.get("requestId")
        ),
        413
      ),
  })
  for (const path of [
    "/v1/me/groups",
    "/v1/contribution/groups",
    "/v1/contribution/groups/*",
    "/v1/admin/groups",
    "/v1/admin/groups/*",
  ]) {
    app.use(path, async (c, next) => {
      c.header("Cache-Control", "private, no-store")
      const currentUser = await freshSessionUser(auth, c.req.raw.headers)
      if (!currentUser)
        groupFailure(401, "UNAUTHORIZED", "Authentication is required")
      c.set("accountUserId", currentUser.id)
      c.set("accountUserName", currentUser.name)
      if (
        !["GET", "HEAD", "OPTIONS"].includes(c.req.method) &&
        !isTrustedWebOrigin(c.req.header("Origin"), webOrigin)
      )
        groupFailure(403, "INVALID_ORIGIN", "A trusted origin is required")
      await next()
    })
    app.use(path, (c, next) =>
      isMangaCoverUpload(c.req.method, c.req.path) ||
      isChapterPageUpload(c.req.method, c.req.path) ||
      isGroupMediaUpload(c.req.method, c.req.path)
        ? next()
        : groupBodyLimit(c, next)
    )
  }

  app.openapi(routes.myGroupRoute, async (c) => {
    const actor = c.get("accountUserId")
    const [approved] = await database
      .select({
        group: groupColumns,
        membership: memberColumns,
        name: user.name,
      })
      .from(members)
      .innerJoin(groups, eq(groups.id, members.organizationId))
      .innerJoin(groupProfiles, eq(groupProfiles.organizationId, groups.id))
      .innerJoin(memberProfiles, eq(memberProfiles.memberId, members.id))
      .innerJoin(user, eq(user.id, members.userId))
      .where(and(eq(members.userId, actor), isNull(groupProfiles.deletedAt)))
      .limit(1)
    const [requested] = approved
      ? []
      : await database
          .select({
            group: groupColumns,
            application: applications,
            name: user.name,
          })
          .from(applications)
          .innerJoin(groups, eq(groups.id, applications.organizationId))
          .innerJoin(groupProfiles, eq(groupProfiles.organizationId, groups.id))
          .innerJoin(user, eq(user.id, applications.userId))
          .where(
            and(eq(applications.userId, actor), isNull(groupProfiles.deletedAt))
          )
          .orderBy(
            sql`case when ${applications.status} = 'rejected' then 1 else 0 end`,
            desc(applications.updatedAt),
            asc(applications.organizationId)
          )
          .limit(1)
    const row = approved ?? requested
    const membership = approved
      ? memberDto(
          approved.group,
          {
            ...approved.membership,
            role: approved.membership.role === "owner" ? "leader" : "member",
          },
          approved.name
        )
      : requested
        ? applicationDto(requested.application, requested.name)
        : null
    if (membership && !(await accountCanMutate(database, actor)))
      membership.permissions = { ...noPermissions }
    return c.json(
      {
        isAdmin: await isApplicationAdmin(database, actor),
        data:
          row && membership ? { group: groupDto(row.group), membership } : null,
      },
      200
    )
  })

  app.openapi(routes.createGroupRoute, async (c) => {
    const actor = c.get("accountUserId")
    const data = await groupWrite(database, actor, (tx) =>
      createGroup(tx, actor, c.req.valid("json"))
    )
    await notifyGroupReview(
      dependencies.groupReviewWebhook,
      {
        groupId: data.id,
        groupName: data.name,
        creatorId: actor,
        creatorName: c.get("accountUserName") ?? actor,
        webOrigin,
        requestId: c.get("requestId"),
      },
      dependencies.logger
    )
    return c.json({ data }, 200)
  })
  app.openapi(routes.adminCreateGroupRoute, async (c) => {
    const actor = c.get("accountUserId")
    const { leaderUserId, ...input } = c.req.valid("json")
    const data = await groupWrite(database, actor, async (tx) => {
      await requireGroupAdmin(tx, actor)
      return createGroup(
        tx,
        actor,
        input,
        leaderUserId,
        true,
        "Administrator created group"
      )
    })
    await cache.invalidateCatalog()
    return c.json({ data }, 200)
  })
  app.openapi(routes.adminGroupsRoute, async (c) => {
    await requireGroupAdmin(database, c.get("accountUserId"))
    const { page, limit, q, status } = c.req.valid("query")
    const namePattern = q ? `%${q.replace(/[\\%_]/g, "\\$&")}%` : undefined
    const rows = await database
      .select({
        group: groupColumns,
        creatorId: user.id,
        creatorName: user.name,
      })
      .from(groups)
      .innerJoin(groupProfiles, eq(groupProfiles.organizationId, groups.id))
      .leftJoin(user, eq(user.id, groupProfiles.createdByUserId))
      .where(
        and(
          status ? eq(groupProfiles.approvalStatus, status) : undefined,
          namePattern
            ? sql`${groups.name} ilike ${namePattern} escape '\\'`
            : undefined,
          isNull(groupProfiles.deletedAt)
        )
      )
      .orderBy(desc(groupProfiles.createdAt), desc(groups.id))
      .limit(limit + 1)
      .offset((page - 1) * limit)
    return c.json(
      {
        data: rows.slice(0, limit).map((row) => ({
          ...groupDto(row.group),
          creator: row.creatorId
            ? { id: row.creatorId, name: row.creatorName! }
            : null,
        })),
        meta: { page, limit, hasMore: rows.length > limit },
      },
      200
    )
  })
  app.openapi(routes.getGroupRoute, async (c) => {
    const actor = c.get("accountUserId")
    const { groupId } = c.req.valid("param")
    const [group] = await database
      .select(groupColumns)
      .from(groups)
      .innerJoin(groupProfiles, eq(groupProfiles.organizationId, groups.id))
      .where(and(eq(groups.id, groupId), isNull(groupProfiles.deletedAt)))
    if (!group) groupFailure(404, "NOT_FOUND", "Group not found")
    const membership = await membershipFor(database, groupId, actor)
    const application = await applicationFor(database, groupId, actor)
    if (
      !(await isApplicationAdmin(database, actor)) &&
      !membership &&
      !application
    )
      groupFailure(404, "NOT_FOUND", "Group not found")
    return c.json({ data: groupDto(group) }, 200)
  })
  app.openapi(routes.updateGroupRoute, async (c) => {
    const actor = c.get("accountUserId")
    const { groupId } = c.req.valid("param")
    const input = c.req.valid("json")
    const data = await groupWrite(database, actor, async (tx) => {
      const group = await lockGroup(tx, groupId)
      const system = group.slug === "system"
      await requireGroupSettingsManager(tx, group, actor)
      if (system && input.name !== group.name)
        groupFailure(
          403,
          "SYSTEM_GROUP_PROTECTED",
          "System identity is protected"
        )
      const renamed = input.name.toLowerCase() !== group.name.toLowerCase()
      const slug = renamed ? groupSlug(input.name) : group.slug
      if (!system && slug === "system")
        groupFailure(403, "SYSTEM_GROUP_PROTECTED", "System is reserved")
      const [collision] = await tx
        .select({ id: groups.id })
        .from(groups)
        .where(and(eq(groups.slug, slug), ne(groups.id, groupId)))
      await tx
        .update(groups)
        .set({
          name: input.name,
          slug: collision ? `${slug}-${groupId}` : slug,
        })
        .where(eq(groups.id, groupId))
      await tx
        .update(groupProfiles)
        .set({
          description: input.description,
          links: input.links,
          updatedAt: new Date(),
        })
        .where(eq(groupProfiles.organizationId, groupId))
      const updated = await lockGroup(tx, groupId)
      await auditGroup(
        tx,
        actor,
        groupId,
        "updated",
        "Group settings updated",
        groupDto(group),
        groupDto(updated)
      )
      return groupDto(updated)
    })
    await cache.invalidateCatalog()
    return c.json({ data }, 200)
  })
  app.openapi(routes.reviewGroupRoute, async (c) => {
    const actor = c.get("accountUserId")
    const { groupId } = c.req.valid("param")
    const { action } = c.req.valid("json")
    await groupWrite(database, actor, async (tx) => {
      await requireGroupAdmin(tx, actor)
      const group = await lockGroup(tx, groupId)
      requireOrdinaryGroup(group)
      if (
        group.approvalStatus !== "pending" ||
        group.publicationState !== "draft"
      )
        groupFailure(
          409,
          "GROUP_NOT_PENDING",
          "Only pending groups can be reviewed"
        )
      const [leader] = await tx
        .select({ id: members.id, userId: members.userId })
        .from(members)
        .where(
          and(eq(members.organizationId, groupId), eq(members.role, "owner"))
        )
      if (!leader)
        groupFailure(
          409,
          "GROUP_LEADER_REQUIRED",
          "The group needs an approved leader"
        )
      if (action === "approve") await requireActiveAccount(tx, leader.userId)
      await tx
        .update(groupProfiles)
        .set({
          approvalStatus: action === "approve" ? "approved" : "rejected",
          publicationState: action === "approve" ? "published" : "draft",
          reviewedAt: new Date(),
          reviewedByUserId: actor,
          rejectionReason: null,
          updatedAt: new Date(),
        })
        .where(eq(groupProfiles.organizationId, groupId))
      if (action === "approve")
        await tx
          .delete(applications)
          .where(
            and(
              eq(applications.organizationId, groupId),
              eq(applications.type, "create")
            )
          )
      else {
        await tx
          .update(applications)
          .set({
            status: "rejected",
            reviewedAt: new Date(),
            reviewedByUserId: actor,
            rejectionReason: null,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(applications.organizationId, groupId),
              eq(applications.type, "create")
            )
          )
        await tx.delete(members).where(eq(members.organizationId, groupId))
      }
      const updated = await lockGroup(tx, groupId)
      await auditGroup(
        tx,
        actor,
        groupId,
        action === "approve" ? "approved" : "rejected",
        action === "approve" ? "Group approved" : "Group rejected",
        groupDto(group),
        groupDto(updated)
      )
      await createGroupNotification(tx, {
        userId: leader.userId,
        type: action === "approve" ? "group_approved" : "group_rejected",
        groupId,
      })
    })
    await cache.invalidateCatalog()
    return c.body(null, 204)
  })
  app.openapi(routes.groupActivityRoute, async (c) => {
    const actor = c.get("accountUserId")
    const { groupId } = c.req.valid("param")
    const { inactive } = c.req.valid("json")
    await groupWrite(database, actor, async (tx) => {
      await requireGroupAdmin(tx, actor)
      const group = await lockGroup(tx, groupId)
      requireOrdinaryGroup(group)
      requireApprovedGroup(group)
      await tx
        .update(groupProfiles)
        .set({ inactive, updatedAt: new Date() })
        .where(eq(groupProfiles.organizationId, groupId))
      await auditGroup(
        tx,
        actor,
        groupId,
        "activity_updated",
        inactive ? "Group deactivated" : "Group activated",
        { inactive: group.inactive },
        { inactive }
      )
    })
    await cache.invalidateCatalog()
    return c.body(null, 204)
  })
  app.openapi(routes.deleteGroupRoute, async (c) => {
    const actor = c.get("accountUserId")
    const { groupId } = c.req.valid("param")
    await groupWrite(database, actor, async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${CONTENT_WRITE_LOCK}))`
      )
      await requireGroupAdmin(tx, actor)
      const group = await lockGroup(tx, groupId)
      requireOrdinaryGroup(group)
      const [systemGroup] = await tx
        .select({ id: groups.id })
        .from(groups)
        .where(eq(groups.slug, "system"))
        .for("update")
      if (!systemGroup) throw new Error("System group not found")

      const [activeChapterUpload] = await tx
        .select({ id: chapterUploadSession.id })
        .from(chapterUploadSession)
        .where(
          and(
            eq(chapterUploadSession.groupId, groupId),
            inArray(chapterUploadSession.state, ["open", "finalizing"])
          )
        )
        .limit(1)
      const [activeCoverUpload] = await tx
        .select({ id: coverUploadSession.id })
        .from(coverUploadSession)
        .where(
          and(
            eq(coverUploadSession.groupId, groupId),
            eq(coverUploadSession.state, "pending")
          )
        )
        .limit(1)
      const [activeCoverOperation] = await tx
        .select({ id: coverUploadOperation.id })
        .from(coverUploadOperation)
        .where(
          and(
            eq(coverUploadOperation.groupId, groupId),
            eq(coverUploadOperation.state, "pending")
          )
        )
        .limit(1)
      if (activeChapterUpload || activeCoverUpload || activeCoverOperation)
        groupFailure(
          409,
          "GROUP_UPLOAD_ACTIVE",
          "Finish or cancel active uploads before deleting this group"
        )

      const now = new Date()
      const reassignedManga = await tx
        .update(manga)
        .set({
          ownerGroupId: systemGroup.id,
          updatedAt: now,
          version: sql`${manga.version} + 1`,
        })
        .where(eq(manga.ownerGroupId, groupId))
        .returning({ id: manga.id, version: manga.version })
      const reassignedChapters = await tx
        .update(chapter)
        .set({
          ownerGroupId: systemGroup.id,
          updatedAt: now,
          version: sql`${chapter.version} + 1`,
        })
        .where(eq(chapter.ownerGroupId, groupId))
        .returning({
          id: chapter.id,
          mangaId: chapter.mangaId,
          version: chapter.version,
        })
      await tx.delete(mangaGroup).where(eq(mangaGroup.groupId, groupId))
      await tx.delete(chapterGroup).where(eq(chapterGroup.groupId, groupId))
      if (reassignedManga.length)
        await tx
          .insert(mangaGroup)
          .values(
            reassignedManga.map((item) => ({
              mangaId: item.id,
              groupId: systemGroup.id,
              isExplicit: false,
            }))
          )
          .onConflictDoNothing()
      if (reassignedChapters.length) {
        await tx
          .insert(chapterGroup)
          .values(
            reassignedChapters.map((item) => ({
              chapterId: item.id,
              groupId: systemGroup.id,
            }))
          )
          .onConflictDoNothing()
        await tx
          .insert(mangaGroup)
          .values(
            [...new Set(reassignedChapters.map((item) => item.mangaId))].map(
              (mangaId) => ({
                mangaId,
                groupId: systemGroup.id,
                isExplicit: true,
              })
            )
          )
          .onConflictDoUpdate({
            target: [mangaGroup.mangaId, mangaGroup.groupId],
            set: { isExplicit: true },
          })
      }
      await tx
        .update(groupProfiles)
        .set({
          deletedAt: now,
          deletedByUserId: actor,
          deleteReason: null,
          updatedAt: now,
        })
        .where(eq(groupProfiles.organizationId, groupId))
      await tx
        .delete(applications)
        .where(eq(applications.organizationId, groupId))
      await tx.delete(members).where(eq(members.organizationId, groupId))
      if (reassignedManga.length)
        await tx.insert(moderationAction).values(
          reassignedManga.map((item) => ({
            actorUserId: actor,
            action: "moderation.manga.owner_transferred",
            targetKind: "manga" as const,
            targetId: item.id,
            reason: "Owner group deleted; ownership transferred to System",
            before: { ownerGroupId: groupId, version: item.version - 1 },
            after: { ownerGroupId: systemGroup.id, version: item.version },
            createdAt: now,
          }))
        )
      if (reassignedChapters.length)
        await tx.insert(moderationAction).values(
          reassignedChapters.map((item) => ({
            actorUserId: actor,
            action: "moderation.chapter.owner_transferred",
            targetKind: "chapter" as const,
            targetId: item.id,
            reason: "Owner group deleted; ownership transferred to System",
            before: { ownerGroupId: groupId, version: item.version - 1 },
            after: { ownerGroupId: systemGroup.id, version: item.version },
            createdAt: now,
          }))
        )
      await auditGroup(
        tx,
        actor,
        groupId,
        "deleted",
        "Group deleted",
        groupDto(group),
        null
      )
    })
    await cache.invalidateCatalog()
    return c.body(null, 204)
  })
  app.openapi(routes.joinGroupRoute, async (c) => {
    const actor = c.get("accountUserId")
    const { groupId } = c.req.valid("param")
    await groupWrite(database, actor, async (tx) => {
      const group = await lockGroup(tx, groupId)
      requireOrdinaryGroup(group)
      requireApprovedGroup(group)
      if (group.inactive)
        groupFailure(409, "GROUP_INACTIVE", "This group is inactive")
      await requireAvailableUser(tx, actor)
      const [leader] = await tx
        .select({ userId: members.userId })
        .from(members)
        .where(
          and(eq(members.organizationId, groupId), eq(members.role, "owner"))
        )
      if (!leader)
        groupFailure(
          409,
          "GROUP_LEADER_REQUIRED",
          "The group needs an approved leader"
        )
      await tx
        .insert(applications)
        .values({
          organizationId: groupId,
          userId: actor,
          type: "join",
          status: "pending",
        })
        .onConflictDoUpdate({
          target: [applications.organizationId, applications.userId],
          set: {
            type: "join",
            status: "pending",
            reviewedAt: null,
            reviewedByUserId: null,
            rejectionReason: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        })
      await auditGroup(
        tx,
        actor,
        groupId,
        "join_requested",
        "User requested membership",
        null,
        { userId: actor, status: "pending" }
      )
      await createGroupNotification(tx, {
        userId: leader.userId,
        type: "group_join_requested",
        groupId,
        actorUserId: actor,
      })
    })
    return c.body(null, 204)
  })
  app.openapi(routes.cancelGroupRequestRoute, async (c) => {
    const actor = c.get("accountUserId")
    const { groupId } = c.req.valid("param")
    await groupWrite(database, actor, async (tx) => {
      const group = await lockGroup(tx, groupId)
      requireOrdinaryGroup(group)
      const row = await applicationFor(tx, groupId, actor)
      const creation =
        group.approvalStatus === "pending" &&
        group.publicationState === "draft" &&
        group.createdByUserId === actor &&
        row?.type === "create"
      if (!creation && row?.status !== "pending")
        groupFailure(
          409,
          "REQUEST_NOT_PENDING",
          "This request can no longer be cancelled"
        )
      if (creation) {
        await tx
          .update(groupProfiles)
          .set({
            deletedAt: new Date(),
            deletedByUserId: actor,
            deleteReason: "Creation request cancelled",
            updatedAt: new Date(),
          })
          .where(eq(groupProfiles.organizationId, groupId))
        await tx.delete(members).where(eq(members.organizationId, groupId))
      }
      await tx
        .delete(applications)
        .where(
          and(
            eq(applications.organizationId, groupId),
            eq(applications.userId, actor)
          )
        )
      await auditGroup(
        tx,
        actor,
        groupId,
        creation ? "creation_cancelled" : "join_cancelled",
        "User cancelled their request",
        { userId: actor, status: row!.status },
        null
      )
      if (!creation)
        await resolveGroupJoinRequestNotification(tx, groupId, actor)
    })
    return c.body(null, 204)
  })
  app.openapi(routes.groupMembersRoute, async (c) => {
    const actor = c.get("accountUserId")
    const { groupId } = c.req.valid("param")
    const { status, page, limit } = c.req.valid("query")
    const [group] = await database
      .select(groupColumns)
      .from(groups)
      .innerJoin(groupProfiles, eq(groupProfiles.organizationId, groups.id))
      .where(and(eq(groups.id, groupId), isNull(groupProfiles.deletedAt)))
    if (!group) groupFailure(404, "NOT_FOUND", "Group not found")
    if (status === "approved") {
      requireOrdinaryGroup(group)
      if (!(await isApplicationAdmin(database, actor))) {
        requireApprovedGroup(group)
        if (!(await membershipFor(database, groupId, actor)))
          groupFailure(403, "FORBIDDEN", "Group membership is required")
      }
    } else await requireGroupManager(database, group, actor)
    const rows =
      status === "approved"
        ? await database
            .select({ member: memberColumns, name: user.name })
            .from(members)
            .innerJoin(memberProfiles, eq(memberProfiles.memberId, members.id))
            .innerJoin(user, eq(user.id, members.userId))
            .where(eq(members.organizationId, groupId))
            .orderBy(asc(members.createdAt), asc(members.userId))
            .limit(limit + 1)
            .offset((page - 1) * limit)
        : await database
            .select({ application: applications, name: user.name })
            .from(applications)
            .innerJoin(user, eq(user.id, applications.userId))
            .where(
              and(
                eq(applications.organizationId, groupId),
                eq(applications.type, "join"),
                eq(applications.status, status)
              )
            )
            .orderBy(asc(applications.createdAt), asc(applications.userId))
            .limit(limit + 1)
            .offset((page - 1) * limit)
    const pageRows = rows.slice(0, limit)
    const frames = await effectiveAvatarFrames(
      dependencies,
      pageRows.map((row) =>
        "member" in row ? row.member.userId : row.application.userId
      )
    )
    return c.json(
      {
        data: pageRows.map((row) => {
          const membership =
            "member" in row
              ? memberDto(
                  group,
                  {
                    ...row.member,
                    role: row.member.role === "owner" ? "leader" : "member",
                  },
                  row.name
                )
              : applicationDto(row.application, row.name)
          return {
            ...membership,
            avatarFrame: frames.get(membership.userId) ?? null,
          }
        }),
        meta: { page, limit, hasMore: rows.length > limit },
      },
      200
    )
  })
  app.openapi(routes.reviewMemberRoute, async (c) => {
    const actor = c.get("accountUserId")
    const { groupId, userId } = c.req.valid("param")
    const { action } = c.req.valid("json")
    await groupWrite(database, actor, async (tx) => {
      const group = await lockGroup(tx, groupId)
      await requireGroupManager(tx, group, actor)
      if (action === "approve" && group.inactive)
        groupFailure(409, "GROUP_INACTIVE", "This group is inactive")
      const application = await applicationFor(tx, groupId, userId)
      if (
        application?.type !== "join" ||
        application.status !== "pending" ||
        actor === userId
      )
        groupFailure(404, "NOT_FOUND", "Pending membership not found")
      if (action === "approve") {
        await lockGroupUser(tx, userId)
        const [existing] = await tx
          .select({ id: members.id })
          .from(members)
          .where(eq(members.userId, userId))
        if (existing)
          groupFailure(
            409,
            "GROUP_MEMBERSHIP_EXISTS",
            "This user already belongs to a group"
          )
      }
      const status = action === "approve" ? "approved" : "rejected"
      if (action === "approve") {
        const memberId = crypto.randomUUID()
        await tx.insert(members).values({
          id: memberId,
          organizationId: groupId,
          userId,
          role: "member",
          createdAt: new Date(),
        })
        await tx.insert(memberProfiles).values({ memberId, ...memberDefaults })
        await tx.delete(applications).where(eq(applications.id, application.id))
      } else
        await tx
          .update(applications)
          .set({
            status: "rejected",
            reviewedAt: new Date(),
            reviewedByUserId: actor,
            rejectionReason: null,
            updatedAt: new Date(),
          })
          .where(eq(applications.id, application.id))
      await auditGroup(
        tx,
        actor,
        groupId,
        `member_${status}`,
        action === "approve" ? "Membership approved" : "Membership rejected",
        { userId, status: application.status },
        { userId, status }
      )
      await resolveGroupJoinRequestNotification(tx, groupId, userId)
      await createGroupNotification(tx, {
        userId,
        type:
          action === "approve" ? "group_join_approved" : "group_join_rejected",
        groupId,
      })
    })
    return c.body(null, 204)
  })
  app.openapi(routes.memberPermissionsRoute, async (c) => {
    const actor = c.get("accountUserId")
    const { groupId, userId } = c.req.valid("param")
    const permissions = c.req.valid("json")
    await groupWrite(database, actor, async (tx) => {
      const group = await lockGroup(tx, groupId)
      await requireGroupManager(tx, group, actor)
      const member = await membershipFor(tx, groupId, userId)
      if (actor === userId || member?.role !== "member")
        groupFailure(
          403,
          "FORBIDDEN",
          "Only another approved member's permissions can be changed"
        )
      await tx
        .update(memberProfiles)
        .set({ ...permissions, updatedAt: new Date() })
        .where(eq(memberProfiles.memberId, member.id))
      const before = Object.fromEntries(
        Object.keys(noPermissions).map((key) => [
          key,
          member[key as keyof routes.GroupPermissions],
        ])
      )
      await auditGroup(
        tx,
        actor,
        groupId,
        "permissions_updated",
        "Leader or administrator changed member capabilities",
        { userId, ...before },
        { userId, ...permissions }
      )
    })
    return c.body(null, 204)
  })
  app.openapi(routes.transferLeaderRoute, async (c) => {
    const actor = c.get("accountUserId")
    const { groupId } = c.req.valid("param")
    const { userId } = c.req.valid("json")
    await groupWrite(database, actor, async (tx) => {
      const group = await lockGroup(tx, groupId)
      await requireGroupManager(tx, group, actor)
      const admin = await isApplicationAdmin(tx, actor)
      let member = await membershipFor(tx, groupId, userId)
      if (actor === userId || member?.role === "leader")
        groupFailure(409, "INVALID_LEADER", "Choose another approved member")
      if (!member) {
        if (!admin)
          groupFailure(409, "INVALID_LEADER", "Choose another approved member")
        await requireAvailableUser(tx, userId)
        const memberId = crypto.randomUUID()
        await tx.insert(members).values({
          id: memberId,
          organizationId: groupId,
          userId,
          role: "member",
          createdAt: new Date(),
        })
        await tx.insert(memberProfiles).values({ memberId, ...memberDefaults })
        member = await membershipFor(tx, groupId, userId)
      }
      if (member?.role !== "member")
        groupFailure(409, "INVALID_LEADER", "Choose another approved member")
      await requireActiveAccount(tx, userId)
      const previous = await tx
        .update(members)
        .set({ role: "member" })
        .where(
          and(eq(members.organizationId, groupId), eq(members.role, "owner"))
        )
        .returning({ userId: members.userId })
      await tx
        .update(members)
        .set({ role: "owner" })
        .where(
          and(eq(members.organizationId, groupId), eq(members.userId, userId))
        )
      await auditGroup(
        tx,
        actor,
        groupId,
        "leader_transferred",
        "Leadership assigned to an active user",
        { leaderUserIds: previous.map((row) => row.userId) },
        { leaderUserId: userId }
      )
      await createGroupNotification(tx, {
        userId,
        type: "group_leader_assigned",
        groupId,
        actorUserId: actor,
      })
    })
    await cache.invalidateCatalog()
    return c.body(null, 204)
  })
  app.openapi(routes.leaveGroupRoute, async (c) => {
    const actor = c.get("accountUserId")
    const { groupId } = c.req.valid("param")
    await groupWrite(database, actor, async (tx) => {
      const group = await lockGroup(tx, groupId)
      requireOrdinaryGroup(group)
      const member = await membershipFor(tx, groupId, actor)
      if (member?.role !== "member")
        groupFailure(
          403,
          "LEADER_CANNOT_LEAVE",
          "Only approved members may leave; transfer leadership first"
        )
      const [leader] = await tx
        .select({ userId: members.userId })
        .from(members)
        .where(
          and(eq(members.organizationId, groupId), eq(members.role, "owner"))
        )
      if (!leader)
        groupFailure(
          409,
          "GROUP_LEADER_REQUIRED",
          "The group needs an approved leader"
        )
      await tx
        .delete(members)
        .where(
          and(eq(members.organizationId, groupId), eq(members.userId, actor))
        )
      await auditGroup(
        tx,
        actor,
        groupId,
        "member_left",
        "Member left the group",
        { userId: actor },
        null
      )
      await createGroupNotification(tx, {
        userId: leader.userId,
        type: "group_member_left",
        groupId,
        actorUserId: actor,
      })
    })
    return c.body(null, 204)
  })
  app.openapi(routes.kickMemberRoute, async (c) => {
    const actor = c.get("accountUserId")
    const { groupId, userId } = c.req.valid("param")
    await groupWrite(database, actor, async (tx) => {
      const group = await lockGroup(tx, groupId)
      await requireGroupManager(tx, group, actor)
      const member = await membershipFor(tx, groupId, userId)
      if (actor === userId || member?.role !== "member")
        groupFailure(
          403,
          "FORBIDDEN",
          "Only another approved member can be removed"
        )
      await tx
        .delete(members)
        .where(
          and(eq(members.organizationId, groupId), eq(members.userId, userId))
        )
      await auditGroup(
        tx,
        actor,
        groupId,
        "member_removed",
        "Leader or administrator removed a member",
        { userId },
        null
      )
      await createGroupNotification(tx, {
        userId,
        type: "group_member_removed",
        groupId,
      })
    })
    return c.body(null, 204)
  })
  app.openapi(routes.addGroupMemberRoute, async (c) => {
    const actor = c.get("accountUserId")
    const { groupId } = c.req.valid("param")
    const { userId } = c.req.valid("json")
    await groupWrite(database, actor, async (tx) => {
      await requireGroupAdmin(tx, actor)
      const group = await lockGroup(tx, groupId)
      requireOrdinaryGroup(group)
      requireApprovedGroup(group)
      if (group.inactive)
        groupFailure(409, "GROUP_INACTIVE", "This group is inactive")
      await requireAvailableUser(tx, userId)
      await tx
        .delete(applications)
        .where(
          and(
            eq(applications.organizationId, groupId),
            eq(applications.userId, userId)
          )
        )
      const memberId = crypto.randomUUID()
      await tx.insert(members).values({
        id: memberId,
        organizationId: groupId,
        userId,
        role: "member",
        createdAt: new Date(),
      })
      await tx.insert(memberProfiles).values({ memberId, ...memberDefaults })
      await auditGroup(
        tx,
        actor,
        groupId,
        "member_added",
        "Member added",
        null,
        {
          userId,
          status: "approved",
        }
      )
    })
    return c.body(null, 204)
  })
  registerGroupMediaRoutes(app, dependencies)
  registerMangaRoutes(app, dependencies)
  registerMangaCoverRoute(app, dependencies)
}
