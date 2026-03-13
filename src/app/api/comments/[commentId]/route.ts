import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { serializeComment } from "@/lib/suicaodex/serializers";
import { getAuthSession } from "@/auth";
import { limiter, RateLimitError } from "@/lib/rate-limit";
import { getContentLength } from "@/lib/utils";
import { Prisma } from "../../../../../prisma/generated/client";

interface RouteParams {
  params: Promise<{
    commentId: string;
  }>;
}

// PATCH /api/comments/[commentId] - Edit a comment
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { commentId } = await params;

  const headers = new Headers();
  try {
    await limiter.check(headers, 20, session.user.id); // 20 edits/min
  } catch (err) {
    if (err instanceof RateLimitError) {
      return new NextResponse(JSON.stringify({ error: err.message }), {
        status: err.statusCode,
        headers,
      });
    }
    throw err;
  }

  const { content, type } = await req.json();
  const contentLength = getContentLength(content || "");

  if (!commentId || !content || !type) {
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

  if (type === "manga") {
    const existing = await prisma.mangaComment.findUnique({
      where: { id: commentId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }
    if (existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
      const updated = await prisma.mangaComment.update({
        where: { id: commentId, isEdited: false },
        data: {
          content,
          isEdited: true,
          updatedAt: new Date(),
        },
        include: { user: true },
      });
      return NextResponse.json(serializeComment(updated));
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2025"
      ) {
        return NextResponse.json(
          { error: "Comment can only be edited once" },
          { status: 403 },
        );
      }
      throw err;
    }
  } else if (type === "chapter") {
    const existing = await prisma.chapterComment.findUnique({
      where: { id: commentId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }
    if (existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
      const updated = await prisma.chapterComment.update({
        where: { id: commentId, isEdited: false },
        data: {
          content,
          isEdited: true,
          updatedAt: new Date(),
        },
        include: { user: true },
      });
      return NextResponse.json(serializeComment(updated));
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2025"
      ) {
        return NextResponse.json(
          { error: "Comment can only be edited once" },
          { status: 403 },
        );
      }
      throw err;
    }
  }

  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}
