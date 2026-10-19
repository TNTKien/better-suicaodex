import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi"
import { and, asc, count, eq, exists, isNull, sql } from "drizzle-orm"
import { formatISO } from "date-fns"
import { tz } from "@date-fns/tz"

import type { Database } from "../../db/client.js"
import {
  chapter,
  manga,
  mangaPerson,
  organization,
  person,
  tag,
  translationGroupProfile,
} from "../../db/schema.js"
import {
  ApiErrorSchema,
  TimestampSchema,
  apiError,
} from "../../shared/contract.js"
import {
  catalogManga,
  publicGroup,
  readableChapter,
  visibleManga,
  type CatalogDependencies,
  type CatalogVisibility,
} from "./routes.js"

export const sitemapPageSize = 10_000
export const SitemapResourceSchema = z
  .enum(["manga", "chapter", "tag", "group", "author", "artist"])
  .openapi("SitemapResource")
type SitemapResource = z.infer<typeof SitemapResourceSchema>
const resources = SitemapResourceSchema.options
const ids = {
  manga: manga.id,
  chapter: chapter.id,
  tag: tag.id,
  group: organization.id,
  author: person.id,
  artist: person.id,
}
const SitemapIndexSchema = z
  .object({
    data: z.array(
      z.object({
        resource: SitemapResourceSchema,
        pages: z.number().int().nonnegative(),
      })
    ),
  })
  .openapi("SitemapIndex")
const SitemapPageSchema = z
  .object({
    data: z
      .array(
        z.object({
          path: z.string().startsWith("/"),
          lastModified: z.union([TimestampSchema, z.null()]),
        })
      )
      .max(sitemapPageSize),
  })
  .openapi("SitemapPage")
const indexRoute = createRoute({
  method: "get",
  path: "/v1/sitemap",
  tags: ["catalog"],
  responses: {
    200: {
      content: { "application/json": { schema: SitemapIndexSchema } },
      description: "Number of sitemap pages for each public resource",
    },
  },
})
const pageRoute = createRoute({
  method: "get",
  path: "/v1/sitemap/{resource}/{page}",
  tags: ["catalog"],
  request: {
    params: z.object({
      resource: SitemapResourceSchema,
      page: z.coerce.number().int().min(0).max(99_999),
    }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: SitemapPageSchema } },
      description: "Canonical paths in stable ID order, up to 10000 per page",
    },
    400: {
      content: { "application/json": { schema: ApiErrorSchema } },
      description: "Invalid sitemap resource or page",
    },
    404: {
      content: { "application/json": { schema: ApiErrorSchema } },
      description: "Sitemap page does not exist",
    },
  },
})

export function sitemapQuery(
  database: Database,
  visibility: CatalogVisibility,
  resource: SitemapResource
) {
  if (resource === "manga") {
    return database
      .select({
        id: manga.id,
        slug: manga.slug,
        lastModified:
          sql`greatest(${manga.updatedAt}, ${manga.latestChapterPublishedAt})`.mapWith(
            manga.updatedAt
          ),
      })
      .from(manga)
      .where(catalogManga(database, visibility))
  }
  if (resource === "chapter") {
    return database
      .select({
        id: chapter.id,
        slug: sql<string>`''`,
        lastModified: chapter.updatedAt,
      })
      .from(chapter)
      .innerJoin(manga, eq(chapter.mangaId, manga.id))
      .where(and(visibleManga(visibility), readableChapter(visibility)))
  }
  if (resource === "tag") {
    return database
      .select({ id: tag.id, slug: tag.slug, lastModified: sql<null>`null` })
      .from(tag)
      .where(isNull(tag.moderationHiddenAt))
  }
  if (resource === "group") {
    return database
      .select({
        id: organization.id,
        slug: organization.slug,
        lastModified: translationGroupProfile.updatedAt,
      })
      .from(organization)
      .innerJoin(
        translationGroupProfile,
        eq(translationGroupProfile.organizationId, organization.id)
      )
      .where(publicGroup)
  }
  return database
    .select({
      id: person.id,
      slug: person.slug,
      lastModified: person.updatedAt,
    })
    .from(person)
    .where(
      exists(
        database
          .select({ id: mangaPerson.personId })
          .from(mangaPerson)
          .innerJoin(manga, eq(manga.id, mangaPerson.mangaId))
          .where(
            and(
              eq(mangaPerson.personId, person.id),
              eq(mangaPerson.role, resource),
              catalogManga(database, visibility)
            )
          )
      )
    )
}

export function registerSitemapRoutes(
  app: OpenAPIHono,
  dependencies: CatalogDependencies
) {
  const { database } = dependencies
  app.openapi(indexRoute, async (c) => {
    const data = await Promise.all(
      resources.map(async (resource) => {
        const [row] = await database
          .select({ total: count() })
          .from(
            sitemapQuery(database, dependencies, resource).as("sitemap_entries")
          )
        return {
          resource,
          pages: Math.ceil((row?.total ?? 0) / sitemapPageSize),
        }
      })
    )
    return c.json({ data }, 200)
  })
  app.openapi(pageRoute, async (c) => {
    const { resource, page } = c.req.valid("param")
    const rows = await sitemapQuery(database, dependencies, resource)
      .orderBy(asc(ids[resource]))
      .limit(sitemapPageSize)
      .offset(page * sitemapPageSize)
    if (rows.length === 0) {
      return c.json(
        apiError("NOT_FOUND", "Sitemap page not found", c.get("requestId")),
        404
      )
    }
    return c.json(
      {
        data: rows.map((row) => ({
          path:
            resource === "chapter"
              ? `/chapter/${row.id}`
              : `/${resource}/${encodeURIComponent(row.id)}/${encodeURIComponent(row.slug!)}`,
          lastModified: row.lastModified
            ? formatISO(row.lastModified, { in: tz("UTC") })
            : null,
        })),
      },
      200
    )
  })
}
