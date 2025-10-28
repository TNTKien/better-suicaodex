"use client";

import millify from "millify";
import { Bar, BarChart, XAxis, YAxis } from "recharts";
import { type ChartConfig, ChartContainer } from "@/components/ui/chart";
import type { MangaStats } from "@/types/types";

interface RatingStats {
	stats: MangaStats;
}

const chartConfig = {
	count: {
		label: "Lượt vote:",
		color: "hsl(var(--primary))",
	},
	label: {
		color: "hsl(var(--background))",
	},
} satisfies ChartConfig;

export function RatingChart({ stats }: RatingStats) {
	const chartData = Object.entries(stats.rating.distribution)
		.map(([score, count]) => ({
			score,
			count,
		}))
		.reverse();
	return (
		<ChartContainer config={chartConfig}>
			<BarChart
				accessibilityLayer
				data={chartData}
				layout="vertical"
				margin={{
					left: -15,
				}}
				barSize={7}
			>
				<XAxis
					type="number"
					dataKey="count"
					hide
					domain={[0, stats.rating.max]}
				/>

				<YAxis
					yAxisId="left"
					orientation="left"
					dataKey="score"
					type="category"
					tickLine={false}
					tickMargin={10}
					axisLine={false}
					interval={0}
					tickFormatter={(value) => value}
					className="text-xs"
				/>

				<YAxis
					yAxisId="right"
					orientation="right"
					dataKey="count"
					type="category"
					tickLine={false}
					tickFormatter={(value) =>
						`(${
							value > 10000
								? millify(value, {
										precision: 1,
										locales: "de-DE",
										lowercase: true,
									})
								: value.toLocaleString("en-US")
						})`
					}
					axisLine={false}
					interval={0}
					className="text-xs"
				/>

				{/* <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent hideLabel />}
        /> */}
				<Bar
					yAxisId="left"
					dataKey="count"
					fill="var(--color-count)"
					radius={5}
					background={{ fill: "hsl(var(--primary) / .15)", radius: 5 }}
				/>
			</BarChart>
		</ChartContainer>
	);
}
