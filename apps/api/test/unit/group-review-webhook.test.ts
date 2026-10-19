import { expect, spyOn, test } from "bun:test"
import { parseISO } from "date-fns"

import { createApp } from "../../src/app"
import type { Database } from "../../src/db/client"
import {
  member,
  organization,
  translationGroupApplication,
  translationGroupProfile,
  user,
  userProfile,
} from "../../src/db/schema"
import type { Auth } from "../../src/features/account/auth"
import { notifyGroupReview } from "../../src/features/groups/review-webhook"
import type { GroupRow } from "../../src/features/groups/service"
import type { BusinessCache } from "../../src/shared/cache"
import type { Logger } from "../../src/shared/logger"

const webhook = {
  url: "https://discord.com/api/webhooks/123456789012345678/private-token",
  mentionUserId: "234567890123456789",
}
const origin = "http://localhost:3000"
const input = {
  groupId: "0199f711-739b-7000-8000-000000000010",
  groupName: "Nhóm @everyone <@345678901234567890>",
  creatorId: "creator",
  creatorName: "User A",
  webOrigin: [origin, "https://sfw.suicaodex.com"],
  requestId: "request-1",
}

test("group review webhook is disabled without configuration", async () => {
  const fetcher = spyOn(globalThis, "fetch").mockResolvedValue(new Response())
  try {
    await notifyGroupReview(undefined, input, () => undefined)
    expect(fetcher).not.toHaveBeenCalled()
  } finally {
    fetcher.mockRestore()
  }
})

test("group review webhook confirms delivery and only allows the configured user mention", async () => {
  const fetcher = spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({ id: "message" })
  )
  const timeout = spyOn(AbortSignal, "timeout")
  const entries: unknown[] = []
  try {
    await notifyGroupReview(webhook, input, (...entry) => entries.push(entry))
    expect(fetcher).toHaveBeenCalledTimes(1)
    const [target, request] = fetcher.mock.calls[0]!
    expect(String(target)).toBe(`${webhook.url}?wait=true`)
    expect(request?.method).toBe("POST")
    expect(request?.redirect).toBe("error")
    expect(request?.signal).toBeInstanceOf(AbortSignal)
    expect(timeout).toHaveBeenCalledWith(5_000)
    const body = JSON.parse(String(request?.body))
    expect(body.content).toBe(
      `<@${webhook.mentionUserId}> Có nhóm dịch mới chờ duyệt.`
    )
    expect(body.allowed_mentions).toEqual({
      parse: [],
      users: [webhook.mentionUserId],
    })
    expect(body.embeds[0].title).toBe("Yêu cầu tạo nhóm dịch")
    expect(body.embeds[0].footer.text).toBe(`ID nhóm: ${input.groupId}`)
    expect(body.embeds[0].fields).toEqual([
      { name: "Nhóm dịch", value: input.groupName },
      { name: "Người tạo", value: "User A" },
    ])
    const reviewUrl = new URL(body.embeds[0].url)
    expect(reviewUrl.origin).toBe(origin)
    expect(reviewUrl.pathname).toBe("/admin/groups")
    expect(reviewUrl.searchParams.get("status")).toBe("pending")
    expect(reviewUrl.searchParams.get("q")).toBe(input.groupName)
    expect(entries).toEqual([
      [
        "info",
        "discord.group_review.sent",
        {
          groupId: input.groupId,
          actorUserId: "creator",
          requestId: "request-1",
          status: 200,
        },
      ],
    ])
  } finally {
    fetcher.mockRestore()
    timeout.mockRestore()
  }
})

for (const status of [400, 429, 500]) {
  test(`Discord HTTP ${status} does not throw, retry or expose its token/body`, async () => {
    const fetcher = spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("private-body", { status })
    )
    const entries: unknown[] = []
    try {
      await notifyGroupReview(webhook, input, (...entry) => entries.push(entry))
      expect(fetcher).toHaveBeenCalledTimes(1)
      expect(entries).toEqual([
        [
          "warn",
          "discord.group_review.failed",
          {
            groupId: input.groupId,
            actorUserId: "creator",
            requestId: "request-1",
            status,
          },
        ],
      ])
      expect(JSON.stringify(entries)).not.toContain("private-")
      expect(JSON.stringify(entries)).not.toContain("discord.com")
    } finally {
      fetcher.mockRestore()
    }
  })
}

for (const name of ["TimeoutError", "TypeError"]) {
  test(`Discord ${name} is contained and logs no raw error or webhook URL`, async () => {
    const fetcher = spyOn(globalThis, "fetch").mockRejectedValue(
      Object.assign(new Error(`request to ${webhook.url} failed`), { name })
    )
    const entries: unknown[] = []
    try {
      await notifyGroupReview(webhook, input, (...entry) => entries.push(entry))
      expect(fetcher).toHaveBeenCalledTimes(1)
      expect(entries).toEqual([
        [
          "warn",
          "discord.group_review.failed",
          {
            groupId: input.groupId,
            actorUserId: "creator",
            requestId: "request-1",
            reason: name === "TimeoutError" ? "timeout" : "request_failed",
          },
        ],
      ])
      expect(JSON.stringify(entries)).not.toContain("private-token")
    } finally {
      fetcher.mockRestore()
    }
  })
}

function fixture(
  options: {
    failCommit?: boolean
    existingMember?: boolean
    disabled?: boolean
  } = {}
) {
  let group: GroupRow
  let hasMembership = options.existingMember ?? false
  let committed = false
  const instant = parseISO("2026-10-11T00:00:00Z")
  const entries: unknown[] = []
  const logger: Logger = (...entry) => {
    entries.push(entry)
  }
  const database = {
    async transaction(operation: (tx: Database) => Promise<unknown>) {
      const result = await operation(database as unknown as Database)
      if (options.failCommit) throw new Error("Commit failed")
      committed = true
      return result
    },
    execute: async () => [],
    select() {
      let table: unknown
      const chain = {
        from(value: unknown) {
          table = value
          return chain
        },
        innerJoin: () => chain,
        where: () => chain,
        for: () => chain,
        limit: () => chain,
        then(
          resolve: (rows: unknown[]) => unknown,
          reject: (error: unknown) => unknown
        ) {
          let rows: unknown[]
          if (table === userProfile) rows = [{ status: "active" }]
          else if (table === user) rows = [{ id: "creator", role: "admin" }]
          else if (table === member)
            rows = hasMembership ? [{ id: "member" }] : []
          else if (table === translationGroupApplication) rows = []
          else if (table === organization) rows = [group]
          else throw new Error("Unexpected table")
          return Promise.resolve(rows).then(resolve, reject)
        },
      }
      return chain
    },
    insert(table: unknown) {
      const chain = {
        values(value: Record<string, unknown>) {
          if (table === organization)
            group = {
              id: value.id as string,
              name: value.name as string,
              slug: value.slug as string,
              createdAt: instant,
              updatedAt: instant,
              avatarUrl: null,
              bannerUrl: null,
              description: null,
              links: {},
              inactive: false,
              approvalStatus: "pending",
              publicationState: "draft",
              createdByUserId: "creator",
              reviewedAt: null,
              reviewedByUserId: null,
              deletedAt: null,
              deletedByUserId: null,
              deleteReason: null,
            }
          if (table === translationGroupProfile) Object.assign(group, value)
          if (table === member) hasMembership = true
          return chain
        },
        onConflictDoNothing: () => chain,
        returning: async () => [{ id: group.id }],
        then: Promise.resolve([]).then.bind(Promise.resolve([])),
      }
      return chain
    },
  }
  const app = createApp({
    auth: {
      api: {
        getSession: async () => ({ user: { id: "creator", name: "User A" } }),
      },
    } as unknown as Auth,
    catalog: {
      database: database as unknown as Database,
      cache: {
        invalidateCatalog: async () => undefined,
      } as unknown as BusinessCache,
      assetBaseUrl: "http://localhost:9000/",
    },
    groupReviewWebhook: options.disabled ? undefined : webhook,
    webOrigin: origin,
    logger,
  })
  return {
    entries,
    committed: () => committed,
    request: (
      path = "/v1/contribution/groups",
      body: unknown = { name: "A-Group" }
    ) =>
      app.request(path, {
        method: "POST",
        headers: { Origin: origin, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
  }
}

test("user group creation sends once only after commit; replay cannot send again", async () => {
  const state = fixture()
  const fetcher = spyOn(globalThis, "fetch").mockImplementation(async () => {
    expect(state.committed()).toBe(true)
    return Response.json({ id: "message" })
  })
  try {
    const response = await state.request()
    expect(response.status).toBe(200)
    expect((await response.json()).data.approvalStatus).toBe("pending")
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect((await state.request()).status).toBe(409)
    expect(fetcher).toHaveBeenCalledTimes(1)
  } finally {
    fetcher.mockRestore()
  }
})

test("Discord failure leaves the newly created group and success response intact", async () => {
  const state = fixture()
  const fetcher = spyOn(globalThis, "fetch").mockRejectedValue(
    new Error(webhook.url)
  )
  try {
    expect((await state.request()).status).toBe(200)
    expect(state.committed()).toBe(true)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(state.entries)).not.toContain("private-token")
  } finally {
    fetcher.mockRestore()
  }
})

for (const reason of [
  "commit",
  "member",
  "validation",
  "disabled",
  "admin",
] as const) {
  test(`does not send a group review webhook for ${reason}`, async () => {
    const state = fixture({
      failCommit: reason === "commit",
      existingMember: reason === "member",
      disabled: reason === "disabled",
    })
    const fetcher = spyOn(globalThis, "fetch").mockResolvedValue(new Response())
    try {
      const response = await state.request(
        reason === "admin" ? "/v1/admin/groups" : undefined,
        reason === "validation"
          ? { name: "" }
          : reason === "admin"
            ? { name: "Admin group", leaderUserId: "creator" }
            : undefined
      )
      expect(response.status).toBe(
        {
          commit: 500,
          member: 409,
          validation: 400,
          disabled: 200,
          admin: 200,
        }[reason]
      )
      expect(fetcher).not.toHaveBeenCalled()
    } finally {
      fetcher.mockRestore()
    }
  })
}
