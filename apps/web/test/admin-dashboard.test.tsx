import assert from "node:assert/strict"
// @ts-expect-error Bun is available at test runtime only.
import { mock } from "bun:test"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderToStaticMarkup } from "react-dom/server"

const apiBaseUrl = "https://api.example.test"
mock.module("../modules/account/provider", () => ({
  useAccount: () => ({ apiBaseUrl, user: { id: "admin" } }),
}))
const { AdminDashboard } = await import("../modules/moderation/dashboard")
const client = new QueryClient()
const dates = Array.from(
  { length: 30 },
  (_, i) => `2026-11-${String(i + 1).padStart(2, "0")}`
)
const metric = { total: 60, daily: dates.map(() => 1) }
client.setQueryData(["account", apiBaseUrl, "admin", "admin-dashboard"], {
  dates,
  metrics: {
    manga: metric,
    chapters: metric,
    views: metric,
    comments: metric,
    members: metric,
  },
})
const key = ["account", apiBaseUrl, "admin", "admin-presence"]
client.setQueryData(key, { main: 3, hvn: 2, total: 5 })
const render = () =>
  renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <AdminDashboard />
    </QueryClientProvider>
  )
try {
  const html = render()
  for (const label of [
    "Tổng truyện",
    "Tổng chương",
    "Lượt đọc chương",
    "Bình luận",
    "Thành viên",
    "Web chính",
    "HVN",
  ])
    assert.ok(html.includes(label), label)
  assert.equal(html.match(/<article/g)?.length, 5)
  assert.ok(html.includes("+30") && html.includes("100%"))
  assert.equal(html.match(/data-slot="chart"/g)?.length, 5)
  assert.equal(html.match(/Biểu đồ lũy kế 30 ngày/g)?.length, 5)
  assert.ok(html.includes("01/11 – 30/11"))
  assert.match(html, /30\/11<\/td><td>60<\/td><td>\+1<\/td>/)
  assert.match(html, /01\/11<\/td><td>31<\/td><td>\+1<\/td>/)
  for (const label of ["Tổng đang online", "Khách và thành viên", "Trực tiếp"])
    assert.ok(html.includes(label))
  const query = client.getQueryCache().find({ queryKey: key, exact: true })!
  query.setState({ status: "error", error: new Error("Redis unavailable") })
  const failed = render()
  assert.ok(failed.includes("Chưa lấy được số người online."))
  assert.equal(failed.match(/<article/g)?.length, 5)
} finally {
  client.clear()
}
console.log(
  "Dashboard cards, daily growth and independent presence error checks passed"
)
