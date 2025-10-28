import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeComment } from "@/lib/suicaodex/serializers";

export async function GET(_: NextRequest) {
	const [mangaComments, chapterComments] = await Promise.all([
		prisma.mangaComment.findMany({
			take: 10,
			orderBy: { createdAt: "desc" },
			include: { user: true },
		}),
		prisma.chapterComment.findMany({
			take: 10,
			orderBy: { createdAt: "desc" },
			include: { user: true },
		}),
	]);

	// Gắn thêm type để phân biệt loại comment
	const taggedManga = mangaComments.map((c) => ({
		...serializeComment(c),
		type: "manga" as const,
	}));

	const taggedChapter = chapterComments.map((c) => ({
		...serializeComment(c),
		type: "chapter" as const,
	}));

	const merged = [...taggedManga, ...taggedChapter]
		.sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
		)
		.slice(0, 10); // chỉ lấy 10 bình luận mới nhất

	return NextResponse.json(merged);
}
