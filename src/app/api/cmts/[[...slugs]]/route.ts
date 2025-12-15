import { Elysia, t } from "elysia";
import { prisma } from "@/lib/prisma";
import { serializeComment } from "@/lib/suicaodex/serializers";
import { auth } from "@/auth";
import { limiter, RateLimitError } from "@/lib/rate-limit";
import { getContentLength } from "@/lib/utils";

async function getLatestComments() {
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

  // Tag comments with type to differentiate
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
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, 10);

  return merged;
}

export const app = new Elysia({ prefix: "/api/cmts" })
  // GET /api/cmts/latest - Get latest comments (manga + chapter)
  .get("/latest", async () => {
    const comments = await getLatestComments();
    return { comments };
  })

  // GET /api/cmts/manga/:id - Get manga comments
  .get(
    "/manga/:id",
    async ({ params: { id }, query: { limit, offset } }) => {
      if (!id) {
        return {
          error: "Missing id",
          status: 400,
        };
      }

      const limitNum = parseInt(limit || "10", 10);
      const offsetNum = parseInt(offset || "0", 10);

      const [totalCount, comments] = await Promise.all([
        prisma.mangaComment.count({
          where: { mangaId: id },
        }),
        prisma.mangaComment.findMany({
          where: { mangaId: id },
          include: { user: true },
          orderBy: { createdAt: "desc" },
          skip: offsetNum,
          take: limitNum,
        }),
      ]);

      return {
        comments: comments.map(serializeComment),
        meta: {
          limit: limitNum,
          offset: offsetNum,
          count: comments.length,
          totalCount,
          hasNextPage: offsetNum + comments.length < totalCount,
        },
      };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
    }
  )

  // POST /api/cmts/manga/:id - Create manga comment
  .post(
    "/manga/:id",
    async ({ params: { id }, body, set, request }) => {
      const session = await auth();
      if (!session?.user?.id) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const headers = new Headers();

      try {
        await limiter.check(headers, 10, session.user.id); // 10 req/min
      } catch (err) {
        if (err instanceof RateLimitError) {
          set.status = err.statusCode;
          // Apply rate limit headers
          headers.forEach((value, key) => {
            set.headers[key] = value;
          });
          return { error: err.message };
        }
        throw err;
      }

      const { content, title } = body;
      const contentLength = getContentLength(content || "");

      if (!id || !content || !title) {
        set.status = 400;
        return { error: "Missing data" };
      }

      if (contentLength < 1) {
        set.status = 400;
        return { error: "Comment must be at least 1 character" };
      }

      if (contentLength > 2000) {
        set.status = 400;
        return { error: "Comment must not exceed 2000 characters" };
      }

      const comment = await prisma.mangaComment.create({
        data: {
          content,
          title,
          mangaId: id,
          userId: session.user.id,
        },
        include: {
          user: true,
        },
      });

      return serializeComment(comment);
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        content: t.String(),
        title: t.String(),
      }),
    }
  )

  // GET /api/cmts/manga/:id/count - Get manga comment count
  .get(
    "/manga/:id/count",
    async ({ params: { id }, set }) => {
      if (!id) {
        set.status = 400;
        return { error: "Missing id" };
      }

      const count = await prisma.mangaComment.count({
        where: { mangaId: id },
      });

      return { count };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
  )

  // GET /api/cmts/chapter/:id - Get chapter comments
  .get(
    "/chapter/:id",
    async ({ params: { id }, query: { limit, offset } }) => {
      if (!id) {
        return {
          error: "Missing id",
          status: 400,
        };
      }

      const limitNum = parseInt(limit || "10", 10);
      const offsetNum = parseInt(offset || "0", 10);

      const [totalCount, comments] = await Promise.all([
        prisma.chapterComment.count({
          where: { chapterId: id },
        }),
        prisma.chapterComment.findMany({
          where: { chapterId: id },
          include: { user: true },
          orderBy: { createdAt: "desc" },
          skip: offsetNum,
          take: limitNum,
        }),
      ]);

      return {
        comments: comments.map(serializeComment),
        meta: {
          limit: limitNum,
          offset: offsetNum,
          count: comments.length,
          totalCount,
          hasNextPage: offsetNum + comments.length < totalCount,
        },
      };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
    }
  )

  // POST /api/cmts/chapter/:id - Create chapter comment
  .post(
    "/chapter/:id",
    async ({ params: { id }, body, set }) => {
      const session = await auth();
      if (!session?.user?.id) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const headers = new Headers();

      try {
        await limiter.check(headers, 10, session.user.id); // 10 req/min
      } catch (err) {
        if (err instanceof RateLimitError) {
          set.status = err.statusCode;
          // Apply rate limit headers
          headers.forEach((value, key) => {
            set.headers[key] = value;
          });
          return { error: err.message };
        }
        throw err;
      }

      const { content, title, chapterNumber } = body;
      const contentLength = getContentLength(content || "");

      if (!id || !content || !title || !chapterNumber) {
        set.status = 400;
        return { error: "Missing data" };
      }

      if (contentLength < 1) {
        set.status = 400;
        return { error: "Comment must be at least 1 character" };
      }

      if (contentLength > 2000) {
        set.status = 400;
        return { error: "Comment must not exceed 2000 characters" };
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

      return serializeComment(comment);
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        content: t.String(),
        title: t.String(),
        chapterNumber: t.String(),
      }),
    }
  );

export const GET = (req: Request) => app.handle(req);
export const POST = (req: Request) => app.handle(req);

// Export type for Eden Treaty
export type App = typeof app;
