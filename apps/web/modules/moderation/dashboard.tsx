"use client"

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@workspace/ui/components/chart"
import { useQuery } from "@tanstack/react-query"
import { format, parseISO } from "date-fns"
import { tz } from "@date-fns/tz"
import { useAccount } from "@/modules/account/provider"
import type { components } from "@/src/lib/generated/api"
import { adminAccountRequest } from "./account-moderation"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"

type Dashboard = components["schemas"]["AdminDashboard"]
type Online = components["schemas"]["AdminPresence"]
const names = {
  manga: "Tổng truyện",
  chapters: "Tổng chương",
  views: "Lượt đọc chương",
  comments: "Bình luận",
  members: "Thành viên",
} as const
const numbers = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 })
const calendar = { in: tz("Asia/Ho_Chi_Minh") }
const dayLabel = (day: string) =>
  format(parseISO(day, calendar), "dd/MM", calendar)

const chartConfig = {
  total: { label: "Tổng", color: "var(--chart-3)" },
} satisfies ChartConfig

function GrowthChart({
  name,
  dates,
  daily,
  baseline,
}: {
  name: string
  dates: string[]
  daily: number[]
  baseline: number
}) {
  const data = []
  let running = baseline
  for (const [i, date] of dates.entries()) {
    const delta = daily[i]!
    running += delta
    data.push({
      date,
      label: dayLabel(date),
      total: Math.max(0, running),
      delta,
    })
  }

  return (
    <div className="min-w-0">
      <ChartContainer
        config={chartConfig}
        className="aspect-auto h-36 w-full"
        aria-label={`Biểu đồ lũy kế 30 ngày · ${name}`}
      >
        <LineChart
          accessibilityLayer
          data={data}
          margin={{ top: 8, left: 12, right: 12, bottom: 0 }}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tickMargin={8}
            minTickGap={30}
          />
          <YAxis hide domain={["auto", "auto"]} allowDecimals={false} />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_, items) => {
                  const day = items[0]?.payload
                  return (
                    day &&
                    `${day.label} · +${numbers.format(day.delta)} trong ngày`
                  )
                }}
                formatter={(value) => (
                  <span className="tabular-nums">
                    Tổng {numbers.format(Number(value))}
                  </span>
                )}
              />
            }
          />
          <Line
            dataKey="total"
            type="linear"
            stroke="var(--color-total)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ChartContainer>
      <details className="mt-1 text-xs text-muted-foreground">
        <summary className="w-fit cursor-pointer py-1">
          Số liệu từng ngày
        </summary>
        <table className="mt-2 w-full text-right tabular-nums">
          <thead>
            <tr>
              <th className="text-left">Ngày</th>
              <th>Tổng</th>
              <th>Phát sinh</th>
            </tr>
          </thead>
          <tbody>
            {data.map((day) => (
              <tr key={day.date}>
                <td className="text-left">{day.label}</td>
                <td>{numbers.format(day.total)}</td>
                <td>+{numbers.format(day.delta)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}

function MetricCard({
  name,
  metric,
  dates,
}: {
  name: string
  metric: Dashboard["metrics"]["manga"]
  dates: string[]
}) {
  const growth = metric.daily.reduce((sum, n) => sum + n, 0)
  const baseline = metric.total - growth
  return (
    <article className="grid min-w-0 items-center gap-4 rounded-md border bg-card p-5 text-card-foreground @[760px]:grid-cols-[minmax(11rem,15rem)_minmax(0,1fr)] @[1050px]:min-h-48 @[1050px]:grid-cols-[minmax(11rem,15rem)_minmax(0,1fr)_minmax(15rem,20rem)]">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {name}
        </h2>

        <span
          className="rounded-full border bg-muted/35 px-2.5 py-1 text-xs font-semibold tabular-nums"
          aria-label={`Tăng trong 30 ngày: +${growth}`}
        >
          +{numbers.format(growth)}
        </span>
        <p className="col-span-full text-3xl leading-none font-semibold tabular-nums">
          {numbers.format(metric.total)}
        </p>
      </header>
      <GrowthChart
        name={name}
        dates={dates}
        daily={metric.daily}
        baseline={baseline}
      />
      <dl className="grid gap-2 @[520px]:grid-cols-2 @[760px]:col-span-full @[1050px]:col-span-1">
        {[
          [
            "Khung đo",
            `${dayLabel(dates[0]!)} – ${dayLabel(dates[dates.length - 1]!)}`,
          ],
          [
            "Tăng trưởng",
            baseline > 0
              ? numbers.format((growth * 100) / baseline) + "%"
              : "—",
          ],
          ["TB/ngày", numbers.format(growth / dates.length)],
          ["Hôm nay", "+" + numbers.format(metric.daily.at(-1) ?? 0)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-md border bg-muted/25 px-3 py-2">
            <dt className="text-[0.65rem] font-medium tracking-wider text-muted-foreground uppercase">
              {label}
            </dt>
            <dd className="mt-1 text-sm font-medium tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </article>
  )
}

export function AdminDashboard() {
  const { apiBaseUrl, user } = useAccount()
  const stats = useQuery({
    queryKey: ["account", apiBaseUrl, user?.id, "admin-dashboard"],
    queryFn: ({ signal }) =>
      adminAccountRequest<Dashboard>(
        apiBaseUrl,
        "/v1/admin/dashboard",
        {},
        signal
      ),
    staleTime: 60_000,
    refetchInterval: 60_000,
    enabled: !!user,
  })
  const presence = useQuery({
    queryKey: ["account", apiBaseUrl, user?.id, "admin-presence"],
    queryFn: ({ signal }) =>
      adminAccountRequest<Online>(
        apiBaseUrl,
        "/v1/admin/dashboard/online",
        {},
        signal
      ),
    refetchInterval: 15_000,
    retry: false,
    enabled: !!user,
  })
  return (
    <>
      <section
        className="grid gap-4 @[520px]:grid-cols-2 @[880px]:grid-cols-3"
        aria-label="Số người đang online"
      >
        <div className="grid min-h-36 content-between gap-2 rounded-md border border-l-[3px] border-l-emerald-500 bg-card bg-[radial-gradient(ellipse_at_top_right,color-mix(in_srgb,var(--color-emerald-500)_12%,transparent),transparent_65%)] p-5 @[520px]:col-span-2 @[880px]:col-span-1">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Tổng đang online
            </h2>
            {presence.isSuccess && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[0.65rem] font-semibold text-emerald-700 uppercase dark:text-emerald-300">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Trực tiếp
              </span>
            )}
          </div>
          <strong className="text-4xl leading-none tabular-nums">
            {presence.isSuccess ? numbers.format(presence.data.total) : "—"}
          </strong>
          <p role="status" className="text-xs text-muted-foreground">
            {presence.isError
              ? "Chưa lấy được số người online."
              : presence.isPending
                ? "Đang tải số người online…"
                : "Hoạt động trong 60 giây gần nhất"}
          </p>
        </div>
        {(
          [
            ["main", "Web chính"],
            ["hvn", "HVN"],
          ] as const
        ).map(([key, label]) => (
          <div
            key={key}
            className="grid min-h-36 content-between gap-2 rounded-md border bg-card p-5"
          >
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {label}
            </h3>
            <p className="text-sm text-muted-foreground">Khách và thành viên</p>
            <strong className="text-4xl leading-none tabular-nums">
              {presence.isSuccess ? numbers.format(presence.data[key]) : "—"}
            </strong>
          </div>
        ))}
      </section>
      {stats.isError ? (
        <div role="status">
          Chưa tải được thống kê.{" "}
          <Button variant="outline" onClick={() => void stats.refetch()}>
            Thử lại
          </Button>
        </div>
      ) : stats.data ? (
        <div className="grid gap-4">
          {(Object.keys(names) as (keyof typeof names)[]).map((key) => (
            <MetricCard
              key={key}
              name={names[key]}
              metric={stats.data.metrics[key]}
              dates={stats.data.dates}
            />
          ))}
        </div>
      ) : (
        <Spinner aria-label="Đang tải thống kê" />
      )}
    </>
  )
}
