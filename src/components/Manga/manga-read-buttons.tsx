"use client";

import { BookOpen, BookX, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useConfig } from "@/hooks/use-config";
import useReadingHistory from "@/hooks/use-reading-history";
import { FirstEnChapter, FirstViChapter } from "@/lib/mangadex/manga";
import type { Chapter } from "@/types/types";
import { Button } from "../ui/button";

interface MangaReadButtonProps {
	id: string;
}

export default function MangaReadButtons({ id }: MangaReadButtonProps) {
	const [config] = useConfig();
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState(false);
	const [chapter, setChapter] = useState<Chapter>();

	const { history } = useReadingHistory();
	const readingHistory = history[id];

	useEffect(() => {
		const fetchData = async () => {
			if (readingHistory) {
				setIsLoading(false);
				return;
			}
			try {
				if (
					JSON.stringify(config.translatedLanguage) === JSON.stringify(["en"])
				) {
					const res = await FirstEnChapter(id, config.r18);
					setChapter(res);
				} else if (
					JSON.stringify(config.translatedLanguage) === JSON.stringify(["vi"])
				) {
					const res = await FirstViChapter(id, config.r18);
					setChapter(res);
				} else {
					const vi = await FirstViChapter(id, config.r18);
					const en = await FirstEnChapter(id, config.r18);
					if (vi) {
						setChapter(vi);
					} else {
						setChapter(en);
					}
				}
			} catch (err) {
				setError(true);
				console.error(err);
			} finally {
				setIsLoading(false);
			}
		};
		fetchData();
	}, [id, config.r18, config.translatedLanguage, readingHistory]);

	if (isLoading) {
		return (
			<Button
				variant="secondary"
				disabled
				className="rounded-sm md:h-10 grow md:grow-0"
			>
				<Loader2 className="animate-spin" />
			</Button>
		);
	}

	if (readingHistory) {
		const label = readingHistory.chapter
			? `Đọc tiếp Ch. ${readingHistory.chapter}`
			: `Đọc tiếp`;
		return (
			<Button
				variant="secondary"
				className="rounded-sm md:h-10 grow md:grow-0"
				asChild
			>
				<Link href={`/chapter/${readingHistory.chapterId}`}>
					<BookOpen />
					{label}
				</Link>
			</Button>
		);
	}

	if (error) {
		return (
			<Button
				variant="secondary"
				disabled
				className="rounded-sm md:h-10 grow md:grow-0"
			>
				Lỗi mất rồi 😭
			</Button>
		);
	}

	if (!chapter) {
		return (
			<Button
				variant="secondary"
				disabled
				className="rounded-sm md:h-10 grow md:grow-0"
			>
				<BookX />
				Đọc ngay
			</Button>
		);
	}

	return (
		<Button
			variant="secondary"
			className="rounded-sm md:h-10 grow md:grow-0"
			asChild
		>
			<Link href={`/chapter/${chapter.id}`}>
				<BookOpen />
				Đọc ngay
			</Link>
		</Button>
	);
}
