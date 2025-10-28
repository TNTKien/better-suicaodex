"use client";

import { Bookmark, MessageSquare, Star } from "lucide-react";
import MangaCover from "@/components/Manga/manga-cover";
import StatusChip from "@/components/Manga/Tags/status-tag";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Manga } from "@/types/types";

interface CompactCardProps {
	manga: Manga;
}

export default function CompactCard({ manga }: CompactCardProps) {
	return (
		<Card className="rounded-md shadow-sm hover:bg-accent transition-colors duration-200">
			<CardContent className="flex gap-2 p-2">
				<MangaCover
					id={manga.id}
					cover={manga.cover}
					alt={manga.title}
					placeholder="/images/place-doro.webp"
					wrapper="w-14 h-auto border"
					className="!w-14 !h-20 !object-cover"
					quality="256"
				/>
				<div className="flex flex-col justify-evenly w-full">
					<p className="line-clamp-1 font-black text-xl">{manga.title}</p>

					{!!manga.stats && (
						<div className="flex flex-row gap-2">
							<span className="flex items-center gap-1 text-sm cursor-pointer text-[hsl(var(--primary))] drop-shadow-md">
								<Star size={16} />
								<span>{manga.stats.rating.bayesian.toFixed(2)}</span>
							</span>

							<span
								className={cn("flex items-center gap-1 drop-shadow-md text-sm")}
							>
								<Bookmark size={16} />
								<span>{manga.stats.follows.toLocaleString("en-US")}</span>
							</span>

							{!!manga.stats.comments && (
								<span
									className={cn(
										"flex items-center gap-1 drop-shadow-md text-sm",
									)}
								>
									<MessageSquare size={16} />
									<span>{manga.stats.comments.toLocaleString("en-US")}</span>
								</span>
							)}
						</div>
					)}

					<StatusChip status={manga.status} />
				</div>
			</CardContent>
		</Card>
	);
}
