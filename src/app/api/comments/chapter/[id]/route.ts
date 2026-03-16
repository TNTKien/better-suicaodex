import { NextRequest, NextResponse } from "next/server";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getAuthSession } from "@/auth";
import { db } from "@/lib/db";
import { chapterComments, chapters, users } from "@/lib/db/schema";
import { limiter, RateLimitError } from "@/lib/rate-limit";
import {
  type ChapterCommentWithUser,
  serializeComment,
} from "@/lib/suicaodex/serializers";
import { getContentLength } from "@/lib/utils";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

interface ChapterCommentRequestBody {
  content?: string;
  title?: string;
  chapterNumber?: string;
  parentId?: string;
}

function isChapterCommentRequestBody(
  value: unknown,
): value is ChapterCommentRequestBody {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    (record.content === undefined || typeof record.content === "string") &&
    (record.title === undefined || typeof record.title === "string") &&
    (record.chapterNumber === undefined ||
      typeof record.chapterNumber === "string") &&
    (record.parentId === undefined || typeof record.parentId === "string")
  );
}

// GET /api/comments/chapter/[id]
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

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

  const url = new URL(req.url);
  const limitParam = Number(url.searchParams.get("limit"));
  const offsetParam = Number(url.searchParams.get("offset"));
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(Math.floor(limitParam), 1), 50)
    : 10;
  const offset = Number.isFinite(offsetParam)
    ? Math.max(Math.floor(offsetParam), 0)
    : 0;

  const [countRows, topLevelRows] = await Promise.all([
    db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(chapterComments)
      .where(
        and(
          eq(chapterComments.chapterId, id),
          isNull(chapterComments.parentId),
        ),
      ),
    db
      .select({ comment: chapterComments, user: users })
      .from(chapterComments)
      .innerJoin(users, eq(chapterComments.userId, users.id))
      .where(
        and(
          eq(chapterComments.chapterId, id),
          isNull(chapterComments.parentId),
        ),
      )
      .orderBy(desc(chapterComments.createdAt))
      .offset(offset)
      .limit(limit),
  ]);

  const parentIds = topLevelRows.map(({ comment }) => comment.id);

  const replyRows =
    parentIds.length === 0
      ? []
      : await db
          .select({ comment: chapterComments, user: users })
          .from(chapterComments)
          .innerJoin(users, eq(chapterComments.userId, users.id))
          .where(
            and(
              eq(chapterComments.chapterId, id),
              inArray(chapterComments.parentId, parentIds),
            ),
          )
          .orderBy(asc(chapterComments.createdAt));

  const repliesByParentId: Record<string, ChapterCommentWithUser[]> = {};

  for (const { comment, user } of replyRows) {
    if (!comment.parentId) {
      continue;
    }

    const replies = repliesByParentId[comment.parentId] ?? [];
    replies.push({ ...comment, user });
    repliesByParentId[comment.parentId] = replies;
  }

  const comments: ChapterCommentWithUser[] = topLevelRows.map(
    ({ comment, user }) => ({
      ...comment,
      user,
      replies: repliesByParentId[comment.id] ?? [],
    }),
  );

  const totalCount = countRows[0]?.count ?? 0;

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
  const session = await getAuthSession();
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

  const body: unknown = await req.json();

  if (!isChapterCommentRequestBody(body)) {
    return NextResponse.json({ error: "Missing data" }, { status: 400 });
  }

  const { content, title, chapterNumber, parentId } = body;
  const contentLength = getContentLength(content ?? "");

  if (!id || !content) {
    return NextResponse.json({ error: "Missing data" }, { status: 400 });
  }

  // Top-level comments require title and chapterNumber, replies do not
  if (!parentId && (!title || !chapterNumber)) {
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
    const [parent] = await db
      .select({
        chapterId: chapterComments.chapterId,
        parentId: chapterComments.parentId,
      })
      .from(chapterComments)
      .where(eq(chapterComments.id, parentId))
      .limit(1);

    if (!parent) {
      return NextResponse.json(
        { error: "Parent comment not found" },
        { status: 404 },
      );
    }

    if (parent.chapterId !== id) {
      return NextResponse.json(
        { error: "Parent comment does not belong to this chapter" },
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

  await db.insert(chapters).values({ id }).onConflictDoNothing({
    target: chapters.id,
  });

  const [createdComment] = await db
    .insert(chapterComments)
    .values({
      content,
      title: parentId ? "" : title,
      chapterId: id,
      chapterNumber: parentId ? "" : chapterNumber,
      userId: session.user.id,
      parentId: parentId ?? null,
    })
    .returning({ id: chapterComments.id });

  const [comment] = await db
    .select({ comment: chapterComments, user: users })
    .from(chapterComments)
    .innerJoin(users, eq(chapterComments.userId, users.id))
    .where(eq(chapterComments.id, createdComment.id))
    .limit(1);

  if (!comment) {
    throw new Error("Created comment could not be loaded.");
  }

  return NextResponse.json(
    serializeComment({ ...comment.comment, user: comment.user }),
  );
}
