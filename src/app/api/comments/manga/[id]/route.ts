import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { serializeComment } from "@/lib/suicaodex/serializers";
import { getAuthSession } from "@/auth";
import { limiter, RateLimitError } from "@/lib/rate-limit";
import { getContentLength } from "@/lib/utils";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

// GET /api/comments/manga/[id]
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

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

  const url = new URL(req.url);
  const limitParam = Number(url.searchParams.get("limit"));
  const offsetParam = Number(url.searchParams.get("offset"));
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(Math.floor(limitParam), 1), 50)
    : 10;
  const offset = Number.isFinite(offsetParam)
    ? Math.max(Math.floor(offsetParam), 0)
    : 0;

  const [totalCount, comments] = await Promise.all([
    prisma.mangaComment.count({
      where: { mangaId: id, parentId: null },
    }),
    prisma.mangaComment.findMany({
      where: { mangaId: id, parentId: null },
      include: {
        user: true,
        replies: {
          include: { user: true },
          orderBy: { createdAt: "asc" },
        },
      },
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

// POST /api/comments/manga/[id]
export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await getAuthSession({ disableRefresh: true });
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

  const { content, title, parentId } = await req.json();
  const contentLength = getContentLength(content || "");

  if (!id || !content) {
    return NextResponse.json({ error: "Missing data" }, { status: 400 });
  }

  // Top-level comments require a title, replies do not
  if (!parentId && !title) {
    return NextResponse.json({ error: "Missing data" }, { status: 400 });
  }

  if (contentLength < 1) {
    return NextResponse.json(
      { error: "Comment must be at least 1 character" },
      { status: 400 },
    );
  }

  if (contentLength > 2000) {
    return NextResponse.json(
      { error: "Comment must not exceed 2000 characters" },
      { status: 400 },
    );
  }

  if (parentId) {
    const parent = await prisma.mangaComment.findUnique({
      where: { id: parentId },
      select: { mangaId: true, parentId: true },
    });

    if (!parent) {
      return NextResponse.json(
        { error: "Parent comment not found" },
        { status: 404 },
      );
    }

    if (parent.mangaId !== id) {
      return NextResponse.json(
        { error: "Parent comment does not belong to this manga" },
        { status: 400 },
      );
    }

    if (parent.parentId !== null) {
      return NextResponse.json(
        { error: "Cannot reply to a reply" },
        { status: 400 },
      );
    }
  }

  const comment = await prisma.mangaComment.create({
    data: {
      content,
      title: parentId ? "" : title,
      mangaId: id,
      userId: session.user.id,
      ...(parentId ? { parentId } : {}),
    },
    include: {
      user: true,
    },
  });

  return NextResponse.json(serializeComment(comment));
}
