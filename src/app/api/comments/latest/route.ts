import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeComment } from "@/lib/suicaodex/serializers";
import { limiter, RateLimitError } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  const headers = new Headers();

  try {
    const identifier = req.headers.get("x-forwarded-for") || "anonymous";
    await limiter.check(headers, 50, identifier); // 50 req/min
  } catch (err) {
    if (err instanceof RateLimitError) {
      return new NextResponse(JSON.stringify({ error: err.message }), {
        status: err.statusCode,
        headers,
      });
    }
    throw err;
  }

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

  const taggedManga = mangaComments.map((c) => ({
    ...serializeComment(c),
    type: "manga" as const,
  }));

  const taggedChapter = chapterComments.map((c) => ({
    ...serializeComment(c),
    type: "chapter" as const,
  }));

  const merged = [...taggedManga, ...taggedChapter]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  return NextResponse.json(merged);
}
