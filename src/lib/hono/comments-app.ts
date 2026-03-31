import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { type Context, Hono } from "hono";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  chapterComments,
  chapters,
  mangaComments,
  mangas,
  users,
} from "@/lib/db/schema";
import { requireAuth } from "@/lib/hono/middleware";
import { honoRateLimit, rateLimitByIp } from "@/lib/hono/rate-limit";
import type { CommentsAppEnv } from "@/lib/hono/types";
import {
  type ChapterCommentWithUser,
  type MangaCommentWithUser,
  serializeComment,
} from "@/lib/suicaodex/serializers";

export const commentsApp = new Hono<CommentsAppEnv>().basePath("/api/comments");

const COMMENT_MIN_LENGTH = 3;
const COMMENT_MAX_LENGTH = 2000;

const commentContentSchema = z
  .string()
  .max(COMMENT_MAX_LENGTH, {
    message: `Comment must not exceed ${COMMENT_MAX_LENGTH} characters`,
  })
  .refine((value) => value.trim().length >= COMMENT_MIN_LENGTH, {
    message: `Comment must be at least ${COMMENT_MIN_LENGTH} characters`,
  });

const mangaCommentRequestSchema = z
  .object({
    content: commentContentSchema,
    title: z.string().optional(),
    parentId: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.parentId?.trim() && !value.title?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["title"],
        message: "Missing data",
      });
    }
  });

const chapterCommentRequestSchema = z
  .object({
    content: commentContentSchema,
    title: z.string().optional(),
    chapterNumber: z.string().optional(),
    parentId: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.parentId?.trim() && !value.title?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["title"],
        message: "Missing data",
      });
    }

    if (!value.parentId?.trim() && !value.chapterNumber?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["chapterNumber"],
        message: "Missing data",
      });
    }
  });

const editCommentRequestSchema = z.object({
  content: commentContentSchema,
  type: z.enum(["manga", "chapter"]),
});

function getValidationErrorMessage(error: z.ZodError): string {
  const issue = error.issues[0];

  if (!issue) {
    return "Missing data";
  }

  if (issue.code === "invalid_type" || issue.code === "invalid_value") {
    return "Missing data";
  }

  return issue.message || "Missing data";
}

async function validateRequestBody<TSchema extends z.ZodTypeAny>(
  c: Context<CommentsAppEnv>,
  schema: TSchema,
): Promise<
  | { success: true; data: z.infer<TSchema> }
  | { success: false; response: Response }
> {
  const body: unknown = await c.req.json().catch(() => undefined);
  const result = schema.safeParse(body);

  if (!result.success) {
    return {
      success: false,
      response: c.json({ error: getValidationErrorMessage(result.error) }, 400),
    };
  }

  return {
    success: true,
    data: result.data,
  };
}

commentsApp.get("/manga/:id/count", rateLimitByIp(50), async (c) => {
  const id = c.req.param("id");

  if (!id) {
    return c.json({ error: "Missing id" }, 400);
  }

  const [{ count }] = await db
    .select({ count: sql<number>`cast(count(*) as integer)` })
    .from(mangaComments)
    .where(eq(mangaComments.mangaId, id));

  return c.json({ count });
});

commentsApp.get("/manga/:id", rateLimitByIp(50), async (c) => {
  const id = c.req.param("id");

  if (!id) {
    return c.json({ error: "Missing id" }, 400);
  }

  const limitParam = Number(c.req.query("limit"));
  const offsetParam = Number(c.req.query("offset"));
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(Math.floor(limitParam), 1), 50)
    : 10;
  const offset = Number.isFinite(offsetParam)
    ? Math.max(Math.floor(offsetParam), 0)
    : 0;

  const [countRows, topLevelRows] = await Promise.all([
    db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(mangaComments)
      .where(
        and(eq(mangaComments.mangaId, id), isNull(mangaComments.parentId)),
      ),
    db
      .select({ comment: mangaComments, user: users })
      .from(mangaComments)
      .innerJoin(users, eq(mangaComments.userId, users.id))
      .where(and(eq(mangaComments.mangaId, id), isNull(mangaComments.parentId)))
      .orderBy(desc(mangaComments.createdAt))
      .offset(offset)
      .limit(limit),
  ]);

  const parentIds = topLevelRows.map(({ comment }) => comment.id);

  const replyRows =
    parentIds.length === 0
      ? []
      : await db
          .select({ comment: mangaComments, user: users })
          .from(mangaComments)
          .innerJoin(users, eq(mangaComments.userId, users.id))
          .where(
            and(
              eq(mangaComments.mangaId, id),
              inArray(mangaComments.parentId, parentIds),
            ),
          )
          .orderBy(asc(mangaComments.createdAt));

  const repliesByParentId: Record<string, MangaCommentWithUser[]> = {};

  for (const { comment, user } of replyRows) {
    if (!comment.parentId) {
      continue;
    }

    const replies = repliesByParentId[comment.parentId] ?? [];
    replies.push({ ...comment, user });
    repliesByParentId[comment.parentId] = replies;
  }

  const comments: MangaCommentWithUser[] = topLevelRows.map(
    ({ comment, user }) => ({
      ...comment,
      user,
      replies: repliesByParentId[comment.id] ?? [],
    }),
  );

  const totalCount = countRows[0]?.count ?? 0;

  return c.json({
    comments: comments.map(serializeComment),
    meta: {
      limit,
      offset,
      count: comments.length,
      totalCount,
      hasNextPage: offset + comments.length < totalCount,
    },
  });
});

commentsApp.post(
  "/manga/:id",
  requireAuth,
  honoRateLimit<CommentsAppEnv>({
    limit: 10,
    key: (c) => c.get("session").user.id,
  }),
  async (c) => {
    const id = c.req.param("id");
    const parsedBody = await validateRequestBody(c, mangaCommentRequestSchema);

    if (!parsedBody.success) {
      return parsedBody.response;
    }

    const { content, title, parentId } = parsedBody.data;

    if (!id) {
      return c.json({ error: "Missing data" }, 400);
    }

    if (parentId) {
      const [parent] = await db
        .select({
          mangaId: mangaComments.mangaId,
          parentId: mangaComments.parentId,
        })
        .from(mangaComments)
        .where(eq(mangaComments.id, parentId))
        .limit(1);

      if (!parent) {
        return c.json({ error: "Parent comment not found" }, 404);
      }

      if (parent.mangaId !== id) {
        return c.json(
          { error: "Parent comment does not belong to this manga" },
          400,
        );
      }

      if (parent.parentId !== null) {
        return c.json({ error: "Cannot reply to a reply" }, 400);
      }
    }

    await db.insert(mangas).values({ id }).onConflictDoNothing({
      target: mangas.id,
    });

    const session = c.get("session");

    const [createdComment] = await db
      .insert(mangaComments)
      .values({
        content,
        title: parentId ? "" : title,
        mangaId: id,
        userId: session.user.id,
        parentId: parentId ?? null,
      })
      .returning({ id: mangaComments.id });

    const [comment] = await db
      .select({ comment: mangaComments, user: users })
      .from(mangaComments)
      .innerJoin(users, eq(mangaComments.userId, users.id))
      .where(eq(mangaComments.id, createdComment.id))
      .limit(1);

    if (!comment) {
      throw new Error("Created comment could not be loaded.");
    }

    return c.json(serializeComment({ ...comment.comment, user: comment.user }));
  },
);

commentsApp.get("/chapter/:id", rateLimitByIp(50), async (c) => {
  const id = c.req.param("id");

  if (!id) {
    return c.json({ error: "Missing id" }, 400);
  }

  const limitParam = Number(c.req.query("limit"));
  const offsetParam = Number(c.req.query("offset"));
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

  return c.json({
    comments: comments.map(serializeComment),
    meta: {
      limit,
      offset,
      count: comments.length,
      totalCount,
      hasNextPage: offset + comments.length < totalCount,
    },
  });
});

commentsApp.post(
  "/chapter/:id",
  requireAuth,
  honoRateLimit<CommentsAppEnv>({
    limit: 10,
    key: (c) => c.get("session").user.id,
  }),
  async (c) => {
    const id = c.req.param("id");
    const parsedBody = await validateRequestBody(
      c,
      chapterCommentRequestSchema,
    );

    if (!parsedBody.success) {
      return parsedBody.response;
    }

    const { content, title, chapterNumber, parentId } = parsedBody.data;

    if (!id) {
      return c.json({ error: "Missing data" }, 400);
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
        return c.json({ error: "Parent comment not found" }, 404);
      }

      if (parent.chapterId !== id) {
        return c.json(
          { error: "Parent comment does not belong to this chapter" },
          400,
        );
      }

      if (parent.parentId !== null) {
        return c.json({ error: "Cannot reply to a reply" }, 400);
      }
    }

    await db.insert(chapters).values({ id }).onConflictDoNothing({
      target: chapters.id,
    });

    const session = c.get("session");

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

    return c.json(serializeComment({ ...comment.comment, user: comment.user }));
  },
);

commentsApp.patch(
  "/:commentId",
  requireAuth,
  honoRateLimit<CommentsAppEnv>({
    limit: 20,
    key: (c) => c.get("session").user.id,
  }),
  async (c) => {
    const commentId = c.req.param("commentId");
    const parsedBody = await validateRequestBody(c, editCommentRequestSchema);

    if (!parsedBody.success) {
      return parsedBody.response;
    }

    const { content, type } = parsedBody.data;

    if (!commentId) {
      return c.json({ error: "Missing data" }, 400);
    }

    const session = c.get("session");

    if (type === "manga") {
      const [existing] = await db
        .select({ userId: mangaComments.userId })
        .from(mangaComments)
        .where(eq(mangaComments.id, commentId))
        .limit(1);

      if (!existing) {
        return c.json({ error: "Comment not found" }, 404);
      }

      if (existing.userId !== session.user.id) {
        return c.json({ error: "Forbidden" }, 403);
      }

      const [updated] = await db
        .update(mangaComments)
        .set({
          content,
          isEdited: true,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(mangaComments.id, commentId),
            eq(mangaComments.isEdited, false),
          ),
        )
        .returning({ id: mangaComments.id });

      if (!updated) {
        return c.json({ error: "Comment can only be edited once" }, 403);
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

      return c.json(
        serializeComment({ ...comment.comment, user: comment.user }),
      );
    }

    if (type === "chapter") {
      const [existing] = await db
        .select({ userId: chapterComments.userId })
        .from(chapterComments)
        .where(eq(chapterComments.id, commentId))
        .limit(1);

      if (!existing) {
        return c.json({ error: "Comment not found" }, 404);
      }

      if (existing.userId !== session.user.id) {
        return c.json({ error: "Forbidden" }, 403);
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
        return c.json({ error: "Comment can only be edited once" }, 403);
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

      return c.json(
        serializeComment({ ...comment.comment, user: comment.user }),
      );
    }

    return c.json({ error: "Invalid type" }, 400);
  },
);

commentsApp.get("/latest", rateLimitByIp(50), async (c) => {
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

  return c.json(merged);
});

commentsApp.notFound((c) => c.json({ error: "Not Found" }, 404));
