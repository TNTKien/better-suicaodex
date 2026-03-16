import { NextRequest, NextResponse } from "next/server";
import { desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { chapterComments, mangaComments, users } from "@/lib/db/schema";
import { serializeComment } from "@/lib/suicaodex/serializers";
import { limiter, RateLimitError } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  const headers = new Headers();

  try {
    const identifier = req.headers.get("x-forwarded-for") ?? "anonymous";
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

  const [latestMangaRows, latestChapterRows] = await Promise.all([
    db
      .select({ comment: mangaComments, user: users })
      .from(mangaComments)
      .innerJoin(users, eq(mangaComments.userId, users.id))
      .where(isNull(mangaComments.parentId))
      .orderBy(desc(mangaComments.createdAt))
      .limit(10),
    db
      .select({ comment: chapterComments, user: users })
      .from(chapterComments)
      .innerJoin(users, eq(chapterComments.userId, users.id))
      .where(isNull(chapterComments.parentId))
      .orderBy(desc(chapterComments.createdAt))
      .limit(10),
  ]);

  const taggedManga = latestMangaRows.map(({ comment, user }) => ({
    ...serializeComment({ ...comment, user }),
    type: "manga" as const,
  }));

  const taggedChapter = latestChapterRows.map(({ comment, user }) => ({
    ...serializeComment({ ...comment, user }),
    type: "chapter" as const,
  }));

  const merged = [...taggedManga, ...taggedChapter]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, 10);

  return NextResponse.json(merged);
}
