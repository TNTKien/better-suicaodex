import type { OpenAPIHono } from "@hono/zod-openapi"
import { and, count, desc, eq, ilike, lt, or } from "drizzle-orm"
import { bodyLimit } from "hono/body-limit"

import type { Database } from "../../db/client.js"
import { moderationAction, systemNotice } from "../../db/schema.js"
import { apiError } from "../../shared/contract.js"
import { formatTimestamp } from "../../shared/timestamp.js"
import {
  isTrustedWebOrigin,
  type WebOrigins,
} from "../../shared/web-origins.js"
import type { Auth } from "../account/auth.js"
import { freshSessionUser } from "../account/guard.js"
import { groupFailure, requireGroupAdmin } from "../groups/service.js"
import {
  createSystemNoticeRoute,
  deleteSystemNoticeRoute,
  listAdminSystemNoticesRoute,
  listSystemNoticesRoute,
  updateSystemNoticeRoute,
  type SystemNotice,
} from "./contract.js"

type Dependencies = {
  auth?: Auth
  database: Database
  webOrigin: WebOrigins
}

const mapNotice = (row: typeof systemNotice.$inferSelect): SystemNotice => ({
  id: row.id,
  title: row.title,
  content: row.content,
  createdAt: formatTimestamp(row.createdAt),
  updatedAt: formatTimestamp(row.updatedAt),
})

export function registerSystemNoticeRoutes(
  app: OpenAPIHono,
  dependencies: Dependencies
) {
  const { database } = dependencies
  for (const path of [
    "/v1/admin/system-notices",
    "/v1/admin/system-notices/*",
  ]) {
    app.use(path, async (c, next) => {
      c.header("Cache-Control", "private, no-store")
      const currentUser = await freshSessionUser(
        dependencies.auth,
        c.req.raw.headers
      )
      if (!currentUser)
        groupFailure(401, "UNAUTHORIZED", "Authentication is required")
      c.set("accountUserId", currentUser.id)
      await requireGroupAdmin(database, currentUser.id)
      if (
        !["GET", "HEAD", "OPTIONS"].includes(c.req.method) &&
        !isTrustedWebOrigin(c.req.header("Origin"), dependencies.webOrigin)
      )
        groupFailure(403, "INVALID_ORIGIN", "A trusted origin is required")
      await next()
    })
    app.use(
      path,
      bodyLimit({
        maxSize: 16_384,
        onError: (c) =>
          c.json(
            apiError(
              "PAYLOAD_TOO_LARGE",
              "Request must not exceed 16 KiB",
              c.get("requestId")
            ),
            413
          ),
      })
    )
  }

  app.openapi(listSystemNoticesRoute, async (c) => {
    const { cursor, limit } = c.req.valid("query")
    let cursorCondition
    if (cursor) {
      const [anchor] = await database
        .select({ createdAt: systemNotice.createdAt })
        .from(systemNotice)
        .where(eq(systemNotice.id, cursor))
      if (!anchor)
        return c.json(
          apiError(
            "INVALID_CURSOR",
            "System notice cursor is invalid",
            c.get("requestId")
          ),
          400
        )
      cursorCondition = or(
        lt(systemNotice.createdAt, anchor.createdAt),
        and(
          eq(systemNotice.createdAt, anchor.createdAt),
          lt(systemNotice.id, cursor)
        )
      )
    }
    const rows = await database
      .select()
      .from(systemNotice)
      .where(cursorCondition)
      .orderBy(desc(systemNotice.createdAt), desc(systemNotice.id))
      .limit(limit + 1)
    const data = rows.slice(0, limit).map(mapNotice)
    return c.json(
      {
        data,
        meta: {
          limit,
          nextCursor: rows.length > limit ? data.at(-1)!.id : null,
        },
      },
      200
    )
  })

  app.openapi(listAdminSystemNoticesRoute, async (c) => {
    const { page, limit, q } = c.req.valid("query")
    const search = q
      ? ilike(systemNotice.title, `%${q.replace(/[\\%_]/g, "\\$&")}%`)
      : undefined
    const [[total], rows] = await Promise.all([
      database.select({ value: count() }).from(systemNotice).where(search),
      database
        .select()
        .from(systemNotice)
        .where(search)
        .orderBy(desc(systemNotice.createdAt), desc(systemNotice.id))
        .limit(limit)
        .offset((page - 1) * limit),
    ])
    const value = total?.value ?? 0
    return c.json(
      {
        data: rows.map(mapNotice),
        meta: {
          page,
          limit,
          total: value,
          totalPages: value === 0 ? 0 : Math.ceil(value / limit),
        },
      },
      200
    )
  })

  app.openapi(createSystemNoticeRoute, async (c) => {
    const actor = c.get("accountUserId")
    const input = c.req.valid("json")
    const created = await database.transaction(async (tx) => {
      const [notice] = await tx.insert(systemNotice).values(input).returning()
      if (!notice) throw new Error("System notice insert returned no row")
      await tx.insert(moderationAction).values({
        actorUserId: actor,
        action: "system_notice.create",
        targetKind: "system_notice",
        targetId: notice.id,
        reason: "System notice created",
        after: mapNotice(notice),
        createdAt: notice.createdAt,
      })
      return notice
    })
    return c.json({ data: mapNotice(created) }, 201)
  })

  app.openapi(updateSystemNoticeRoute, async (c) => {
    const actor = c.get("accountUserId")
    const { id } = c.req.valid("param")
    const input = c.req.valid("json")
    const now = new Date()
    const updated = await database.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(systemNotice)
        .where(eq(systemNotice.id, id))
      if (!current) return null
      const [notice] = await tx
        .update(systemNotice)
        .set({ ...input, updatedAt: now })
        .where(eq(systemNotice.id, id))
        .returning()
      if (!notice) throw new Error("System notice update returned no row")
      await tx.insert(moderationAction).values({
        actorUserId: actor,
        action: "system_notice.update",
        targetKind: "system_notice",
        targetId: id,
        reason: "System notice updated",
        before: mapNotice(current),
        after: mapNotice(notice),
        createdAt: now,
      })
      return notice
    })
    if (!updated)
      return c.json(
        apiError("NOT_FOUND", "System notice not found", c.get("requestId")),
        404
      )
    return c.json({ data: mapNotice(updated) }, 200)
  })

  app.openapi(deleteSystemNoticeRoute, async (c) => {
    const actor = c.get("accountUserId")
    const { id } = c.req.valid("param")
    const now = new Date()
    const deleted = await database.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(systemNotice)
        .where(eq(systemNotice.id, id))
      if (!current) return null
      await tx.insert(moderationAction).values({
        actorUserId: actor,
        action: "system_notice.delete",
        targetKind: "system_notice",
        targetId: id,
        reason: "System notice deleted",
        before: mapNotice(current),
        createdAt: now,
      })
      await tx.delete(systemNotice).where(eq(systemNotice.id, id))
      return current
    })
    if (!deleted)
      return c.json(
        apiError("NOT_FOUND", "System notice not found", c.get("requestId")),
        404
      )
    return c.json({ data: { id } }, 200)
  })
}
