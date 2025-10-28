import { GB, VN } from "country-flag-icons/react/3x2";
import { Clock, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { ChapterTitle } from "@/components/Chapter/ChapterReader/chapter-info";
import NoPrefetchLink from "@/components/Custom/no-prefetch-link";
import { Button } from "@/components/ui/button";
import { Card, CardFooter, CardHeader } from "@/components/ui/card";
import { formatTimeToNow } from "@/lib/utils";
import type { Chapter } from "@/types/types";

interface HistoryCompactCardProps {
	chapter: Chapter;
}

export default function HistoryCompactCard({
	chapter,
}: HistoryCompactCardProps) {
	const title = ChapterTitle(chapter);
	const router = useRouter();
	return (
		<Card className="rounded-sm shadow-sm transition-colors duration-200 w-full">
			<CardHeader className="px-2 py-1 border-b font-bold line-clamp-2 md:line-clamp-1 break-all">
				<NoPrefetchLink href={`/manga/${chapter.manga.id}`}>
					{chapter.manga.title}
				</NoPrefetchLink>
			</CardHeader>
			<CardFooter className="py-1 px-2 w-full hover:bg-secondary">
				<NoPrefetchLink
					className="flex flex-col gap-1 w-full"
					href={`/chapter/${chapter.id}`}
				>
					<div className="items-center flex gap-1">
						{chapter.language === "vi" ? (
							<VN className="size-4 shrink-0" />
						) : (
							<GB className="size-4 shrink-0" />
						)}
						<span className="font-bold text-sm">{title}</span>
					</div>
					<div className="flex justify-between">
						<div className="flex items-center justify-self-start">
							<Users size={15} className="shrink-0" />
							{chapter.group.length === 0 ? (
								<span className="line-clamp-1 font-normal text-xs px-[0.25rem]">
									No Group
								</span>
							) : (
								<div className="flex items-center space-x-1">
									{chapter.group.map((group) => (
										<Button
											key={group.id}
											variant="ghost"
											className="whitespace-normal font-normal text-start line-clamp-1 rounded-sm h-4 py-0 px-[0.25rem] hover:underline hover:text-primary break-all"
											size="sm"
											onClick={(e: React.MouseEvent) => {
												e.preventDefault();
												e.stopPropagation();
												router.push(`/group/${group.id}`);
											}}
										>
											{group.name}
										</Button>
									))}
								</div>
							)}
						</div>
						<div className="flex items-center space-x-1 w-full max-w-max justify-end pr-1">
							<time
								className="text-xs font-light"
								dateTime={new Date(chapter.updatedAt).toDateString()}
							>
								{formatTimeToNow(new Date(chapter.updatedAt))}
							</time>
							<Clock size={15} className="shrink-0" />
						</div>
					</div>
				</NoPrefetchLink>
			</CardFooter>
		</Card>
	);
}
