import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeComment } from "@/lib/suicaodex/serializers";
import { auth } from "@/auth";
import removeMarkdown from "remove-markdown";
import { limiter, RateLimitError } from "@/lib/rate-limit";
import { getPlainTextFromHTML } from "@/lib/utils";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

// GET /api/comments/chapter/[id]
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get("limit") || "10", 10);
  const offset = parseInt(url.searchParams.get("offset") || "0", 10);

  const [totalCount, comments] = await Promise.all([
    prisma.chapterComment.count({
      where: { chapterId: id },
    }),
    prisma.chapterComment.findMany({
      where: { chapterId: id },
      include: { user: true },
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
    }),
  ]);

  return NextResponse.json({
    comments: comments.map(serializeComment),
    meta: {
      limit,
      offset,
      count: comments.length,
      totalCount,
      hasNextPage: offset + comments.length < totalCount,
    },
  });
}

// POST /api/comments/chapter/[id]
export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const headers = new Headers();

  try {
    await limiter.check(headers, 10, session.user.id); // 10 req/min
  } catch (err) {
    if (err instanceof RateLimitError) {
      return new NextResponse(JSON.stringify({ error: err.message }), {
        status: err.statusCode,
        headers,
      });
    }
    throw err;
  }

  const { content, title, chapterNumber } = await req.json();
  // const plainContent = removeMarkdown(content || "");
  const plainContent = getPlainTextFromHTML(content || "");

  if (!id || !plainContent || !title || !chapterNumber) {
    return NextResponse.json(
      { error: "Missing data" },
      { status: 400 }
    );
  }

  if (plainContent.trim().length < 3) {
    return NextResponse.json(
      { error: "Comment must be at least 3 characters" },
      { status: 400 }
    );
  }

  if (plainContent.length > 2000) {
    return NextResponse.json(
      { error: "Comment must not exceed 2000 characters" },
      { status: 400 }
    );
  }

  const comment = await prisma.chapterComment.create({
    data: {
      content,
      title,
      chapterId: id,
      chapterNumber,
      userId: session.user.id,
    },
    include: {
      user: true,
    },
  });

  return NextResponse.json(serializeComment(comment));
}
