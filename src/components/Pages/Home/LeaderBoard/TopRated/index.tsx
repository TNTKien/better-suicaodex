"use client";

import useSWR from "swr";
import { Separator } from "@/components/ui/separator";
import { useConfig } from "@/hooks/use-config";
import { getTopRatedMangas } from "@/lib/mangadex/manga";
import { cn } from "@/lib/utils";
import LeaderBoardCardSkeleton from "../leaderboard-card-skeleon";
import TopRatedCard from "./top-rated-card";

export default function TopRated() {
	const [config] = useConfig();
	const { data, error, isLoading } = useSWR(
		["rating", config.translatedLanguage, config.r18],
		([, language, r18]) => getTopRatedMangas(language, r18),
		{
			refreshInterval: 1000 * 60 * 10,
			revalidateOnFocus: false,
		},
	);

	if (isLoading)
		return (
			<div className="grid grid-cols-1 gap-1.5 rounded-sm">
				{[...Array(4)].map((_, index) => (
					<LeaderBoardCardSkeleton key={index} />
				))}
			</div>
		);
	if (error || !data) return null;

	return (
		<div className="grid grid-cols-1 gap-1.5 rounded-sm">
			{data.map((manga, index) => (
				<div key={manga.id} className="flex flex-col gap-1.5">
					<div className="flex gap-1.5 justify-between items-center">
						<TopRatedCard key={manga.id} manga={manga} />
						<span
							className={cn(
								"text-7xl md:text-8xl font-black",
								index === 0 && "text-primary",
							)}
						>
							{index + 1}
						</span>
					</div>

					{index !== data.length - 1 && <Separator />}
				</div>
			))}
		</div>
	);
}
