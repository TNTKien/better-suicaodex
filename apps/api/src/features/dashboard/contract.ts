import { createRoute, z } from "@hono/zod-openapi"
import { ApiErrorSchema } from "../../shared/contract.js"

const count = z.number().int().nonnegative()
const metric = z
  .object({ total: count, daily: z.array(count).length(30) })
  .openapi("DashboardMetric")
const metrics = z.object({
  manga: metric,
  chapters: metric,
  views: metric,
  comments: metric,
  members: metric,
})
export type MetricName = keyof z.infer<typeof metrics>
const dashboard = z
  .object({
    dates: z.array(z.iso.date()).length(30),
    metrics,
  })
  .openapi("AdminDashboard")
const presence = z
  .object({ main: count, hvn: count, total: count })
  .openapi("AdminPresence")
const error = {
  description: "Request failed",
  content: { "application/json": { schema: ApiErrorSchema } },
}

export const dashboardRoute = createRoute({
  method: "get",
  path: "/v1/admin/dashboard",
  tags: ["moderation"],
  responses: {
    200: {
      description: "Catalog totals and daily growth",
      content: { "application/json": { schema: dashboard } },
    },
    401: error,
    403: error,
  },
})
export const presenceRoute = createRoute({
  method: "get",
  path: "/v1/admin/dashboard/online",
  tags: ["moderation"],
  responses: {
    200: {
      description: "Active browsers in the past minute",
      content: { "application/json": { schema: presence } },
    },
    401: error,
    403: error,
    503: error,
  },
})
export const heartbeatRoute = createRoute({
  method: "post",
  path: "/v1/presence/heartbeat",
  tags: ["presence"],
  responses: {
    204: { description: "Presence updated" },
    403: error,
    503: error,
  },
})
