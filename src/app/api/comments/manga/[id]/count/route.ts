import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface RouteParams {
	params: Promise<{
		id: string;
	}>;
}

// GET /api/comments/manga/[id]/count
export async function GET(req: NextRequest, { params }: RouteParams) {
	const { id } = await params;

	if (!id) {
		return NextResponse.json({ error: "Missing id" }, { status: 400 });
	}

	const count = await prisma.mangaComment.count({
		where: { mangaId: id },
	});

	return NextResponse.json({ count });
}
