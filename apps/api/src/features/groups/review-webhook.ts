import type { Logger } from "../../shared/logger.js"
import type { WebOrigins } from "../../shared/web-origins.js"

export type GroupReviewWebhook = {
  url: string
  mentionUserId: string
}

export async function notifyGroupReview(
  webhook: GroupReviewWebhook | undefined,
  input: {
    groupId: string
    groupName: string
    creatorId: string
    creatorName: string
    webOrigin: WebOrigins
    requestId: string
  },
  logger: Logger
) {
  if (!webhook) return
  const context = {
    groupId: input.groupId,
    actorUserId: input.creatorId,
    requestId: input.requestId,
  }
  try {
    const endpoint = new URL(webhook.url)
    endpoint.searchParams.set("wait", "true")
    const reviewUrl = new URL(
      "/admin/groups",
      typeof input.webOrigin === "string" ? input.webOrigin : input.webOrigin[0]
    )
    reviewUrl.searchParams.set("status", "pending")
    reviewUrl.searchParams.set("q", input.groupName)
    // shortcut: best-effort after commit; add an outbox only if durable delivery is needed.
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(5_000),
      body: JSON.stringify({
        content: `<@${webhook.mentionUserId}> Có nhóm dịch mới chờ duyệt.`,
        allowed_mentions: { parse: [], users: [webhook.mentionUserId] },
        embeds: [
          {
            title: "Yêu cầu tạo nhóm dịch",
            url: reviewUrl.href,
            fields: [
              { name: "Nhóm dịch", value: input.groupName },
              {
                name: "Người tạo",
                value:
                  input.creatorName.replace(/\s+/g, " ").trim().slice(0, 256) ||
                  input.creatorId,
              },
            ],
            footer: {
              text: `ID nhóm: ${input.groupId}`,
            },
          },
        ],
      }),
    })
    await response.body?.cancel()
    logger(
      response.ok ? "info" : "warn",
      response.ok ? "discord.group_review.sent" : "discord.group_review.failed",
      { ...context, status: response.status }
    )
  } catch (error) {
    logger("warn", "discord.group_review.failed", {
      ...context,
      reason:
        error instanceof Error && error.name === "TimeoutError"
          ? "timeout"
          : "request_failed",
    })
  }
}
