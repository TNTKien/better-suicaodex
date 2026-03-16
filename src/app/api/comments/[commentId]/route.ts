import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getAuthSession } from "@/auth";
import { db } from "@/lib/db";
import { chapterComments, mangaComments, users } from "@/lib/db/schema";
import { limiter, RateLimitError } from "@/lib/rate-limit";
import { serializeComment } from "@/lib/suicaodex/serializers";
import { getContentLength } from "@/lib/utils";

interface RouteParams {
  params: Promise<{
    commentId: string;
  }>;
}

interface EditCommentRequestBody {
  content?: string;
  type?: "manga" | "chapter";
}

function isEditCommentRequestBody(
  value: unknown,
): value is EditCommentRequestBody {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  const type = record.type;

  return (
    (record.content === undefined || typeof record.content === "string") &&
    (type === undefined || type === "manga" || type === "chapter")
  );
}

// PATCH /api/comments/[commentId] - Edit a comment
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await getAuthSession({ disableRefresh: true });
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

  const body: unknown = await req.json();

  if (!isEditCommentRequestBody(body)) {
    return NextResponse.json({ error: "Missing data" }, { status: 400 });
  }

  const { content, type } = body;
  const contentLength = getContentLength(content ?? "");

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
    const [existing] = await db
      .select({ userId: mangaComments.userId })
      .from(mangaComments)
      .where(eq(mangaComments.id, commentId))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }
    if (existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [updated] = await db
      .update(mangaComments)
      .set({
        content,
        isEdited: true,
        updatedAt: new Date(),
      })
      .where(
        and(eq(mangaComments.id, commentId), eq(mangaComments.isEdited, false)),
      )
      .returning({ id: mangaComments.id });

    if (!updated) {
      return NextResponse.json(
        { error: "Comment can only be edited once" },
        { status: 403 },
      );
    }

    const [comment] = await db
      .select({ comment: mangaComments, user: users })
      .from(mangaComments)
      .innerJoin(users, eq(mangaComments.userId, users.id))
      .where(eq(mangaComments.id, commentId))
      .limit(1);

    if (!comment) {
      throw new Error("Updated comment could not be loaded.");
    }

    return NextResponse.json(
      serializeComment({ ...comment.comment, user: comment.user }),
    );
  } else if (type === "chapter") {
    const [existing] = await db
      .select({ userId: chapterComments.userId })
      .from(chapterComments)
      .where(eq(chapterComments.id, commentId))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }
    if (existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [updated] = await db
      .update(chapterComments)
      .set({
        content,
        isEdited: true,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(chapterComments.id, commentId),
          eq(chapterComments.isEdited, false),
        ),
      )
      .returning({ id: chapterComments.id });

    if (!updated) {
      return NextResponse.json(
        { error: "Comment can only be edited once" },
        { status: 403 },
      );
    }

    const [comment] = await db
      .select({ comment: chapterComments, user: users })
      .from(chapterComments)
      .innerJoin(users, eq(chapterComments.userId, users.id))
      .where(eq(chapterComments.id, commentId))
      .limit(1);

    if (!comment) {
      throw new Error("Updated comment could not be loaded.");
    }

    return NextResponse.json(
      serializeComment({ ...comment.comment, user: comment.user }),
    );
  }

  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}
