import { createRoute, z } from "@hono/zod-openapi"

import {
  ApiErrorSchema,
  IdSchema,
  PageMetaSchema,
  PageQuerySchema,
  SlugSchema,
  SortDirectionSchema,
  TimestampSchema,
} from "../../shared/contract.js"

const nullableTimestamp = z.union([TimestampSchema, z.null()])

const NamedResourceSchema = z.object({ id: IdSchema, name: z.string() })
export const PersonSummarySchema = NamedResourceSchema.extend({
  slug: SlugSchema,
}).openapi("PersonSummary")
const AuthorSummarySchema = PersonSummarySchema
const GroupSummarySchema = NamedResourceSchema.extend({ slug: SlugSchema })
export const TranslationGroupSummarySchema = GroupSummarySchema.extend({
  avatarUrl: z.url().nullable(),
  inactive: z.boolean(),
}).openapi("TranslationGroupSummary")
const TranslationGroupLinkSchema = z.object({
  key: z.enum(["website", "discord", "twitter", "facebook"]),
  label: z.string(),
  url: z.url(),
})
const TranslationGroupDetailSchema = TranslationGroupSummarySchema.extend({
  bannerUrl: z.url().nullable(),
  createdAt: TimestampSchema,
  description: z.string().nullable(),
  leader: z.string().nullable(),
  links: z.array(TranslationGroupLinkSchema),
  statistics: z.object({
    views: z.number().nonnegative(),
    mangaCount: z.number().int().nonnegative(),
    chapterCount: z.number().int().nonnegative(),
    releaseCount: z.number().int().nonnegative(),
  }),
}).openapi("TranslationGroupDetail")
const PersonLinkSchema = z.object({
  key: z.enum([
    "website",
    "twitter",
    "pixiv",
    "fanbox",
    "fantia",
    "skeb",
    "youtube",
  ]),
  label: z.string(),
  url: z.url(),
})
const PersonDetailSchema = NamedResourceSchema.extend({
  slug: SlugSchema,
  description: z.string().nullable(),
  links: z.array(PersonLinkSchema),
  roles: z.array(z.enum(["author", "artist"])).max(2),
}).openapi("PersonDetail")
export const TagSummarySchema = NamedResourceSchema.extend({
  slug: SlugSchema,
  group: z.string(),
}).openapi("TagSummary")
const MangaExternalLinkSchema = z.object({
  key: z.enum([
    "al",
    "amz",
    "ap",
    "bw",
    "cdj",
    "ebj",
    "engtl",
    "kt",
    "mal",
    "mu",
    "raw",
  ]),
  label: z.string(),
  url: z.url(),
})
const ChapterStatisticsSchema = z.object({
  views: z.number().int().nonnegative(),
  comments: z.number().int().nonnegative(),
})
const LatestChapterSchema = z.object({
  id: IdSchema,
  number: z.string().nullable(),
  publishedAt: TimestampSchema,
  groups: z.array(GroupSummarySchema),
  statistics: ChapterStatisticsSchema,
})
const ChapterNavigationSchema = z.object({
  id: IdSchema,
  volume: z.string().nullable(),
  number: z.string().nullable(),
  title: z.string().nullable(),
  language: z.string(),
  groups: z.array(GroupSummarySchema),
})
const NavigationChoiceSchema = z
  .object({
    state: z.enum(["boundary", "ready", "choice-required", "unordered"]),
    selectedChapterId: IdSchema.nullable(),
    options: z.array(ChapterNavigationSchema),
  })
  .openapi("ChapterNavigationChoice")

const repeatableIds = z.preprocess(
  (value) =>
    value === undefined ? [] : Array.isArray(value) ? value : [value],
  z.array(z.uuid()).max(50)
)

export const MangaCatalogQuerySchema = PageQuerySchema.extend({
  q: z.string().trim().min(1).max(160).optional(),
  sort: z
    .enum(["latestChapter", "publishedAt", "title", "year"])
    .default("latestChapter"),
  direction: z.enum(["asc", "desc"]).default("desc"),
  status: z.enum(["ongoing", "completed", "hiatus", "cancelled"]).optional(),
  hasChapter: z.enum(["true", "false", "all"]).default("true"),
  language: z
    .string()
    .trim()
    .min(2)
    .max(35)
    .regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/)
    .optional(),
  includeTag: repeatableIds,
  includeTagMode: z.enum(["and", "or"]).default("and"),
  excludeTag: repeatableIds,
  excludeTagMode: z.enum(["and", "or"]).default("or"),
  author: repeatableIds,
  artist: repeatableIds,
  group: repeatableIds,
}).openapi("MangaCatalogQuery")

export const MangaChapterListQuerySchema = PageQuerySchema.extend({
  sort: z.enum(["reading", "volume"]).default("reading"),
  direction: SortDirectionSchema.default("desc"),
  language: MangaCatalogQuerySchema.shape.language,
}).openapi("MangaChapterListQuery")

export const CoverSchema = z
  .object({
    url: z.url(),
    width: z.number().int().positive().nullable(),
    height: z.number().int().positive().nullable(),
  })
  .openapi("Cover")

export const MangaSummarySchema = z
  .object({
    id: IdSchema,
    slug: SlugSchema,
    title: z.string(),
    description: z.string().nullable(),
    originalLanguage: z.string(),
    status: z.string().nullable(),
    contentRating: z.string().nullable(),
    year: z.number().int().nullable(),
    latestChapterPublishedAt: nullableTimestamp,
    latestChapter: LatestChapterSchema.nullable(),
    cover: CoverSchema.nullable(),
    tags: z.array(TagSummarySchema),
    authors: z.array(AuthorSummarySchema),
  })
  .openapi("MangaSummary")

export const MangaDetailSchema = MangaSummarySchema.extend({
  numberingMode: z.enum(["global", "volume"]),
  readingEntries: z.array(
    z.object({
      language: z.string(),
      first: NavigationChoiceSchema,
      last: NavigationChoiceSchema,
    })
  ),
  chapterCounts: z.object({
    slots: z.number().int().nonnegative(),
    releases: z.number().int().nonnegative(),
  }),
  firstChapter: LatestChapterSchema.pick({ id: true, number: true }).nullable(),
  statistics: z.object({
    views: z.number().int().nonnegative(),
    follows: z.number().int().nonnegative(),
    comments: z.number().int().nonnegative(),
  }),
  alternativeTitles: z.record(z.string(), z.array(z.string())),
  publicationDemographic: z.string().nullable(),
  lastVolume: z.string().nullable(),
  lastChapter: z.string().nullable(),
  links: z.array(MangaExternalLinkSchema),
  artists: z.array(NamedResourceSchema.extend({ slug: SlugSchema })),
  groups: z.array(GroupSummarySchema.extend({ avatarUrl: z.url().nullable() })),
  availableLanguages: z.array(z.string()),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  publishedAt: TimestampSchema,
}).openapi("MangaDetail")

export const MangaPreviewSchema = MangaDetailSchema.extend({
  publishedAt: TimestampSchema.nullable(),
}).openapi("MangaPreview")

export const ChapterSummarySchema = z
  .object({
    id: IdSchema,
    isDefault: z.boolean(),
    volume: z.string().nullable(),
    number: z.string().nullable(),
    title: z.string().nullable(),
    language: z.string(),
    pageCount: z.number().int().min(0),
    publishedAt: TimestampSchema,
    groups: z.array(GroupSummarySchema),
    uploader: z.object({
      id: z.string().min(1).nullable(),
      name: z.string(),
    }),
    statistics: ChapterStatisticsSchema,
  })
  .openapi("ChapterSummary")

export const MangaReadingEntrySchema = z
  .object({ data: z.array(ChapterSummarySchema) })
  .openapi("MangaReadingEntry")

export const ChapterNavigationReleasesSchema = z
  .object({ data: z.array(ChapterSummarySchema) })
  .openapi("ChapterNavigationReleases")

export const ChapterSlotSchema = z
  .object({
    key: z.string(),
    language: z.string(),
    number: z.string().nullable(),
    volume: z.string().nullable(),
    automaticOrder: z.boolean(),
    defaultChapterId: IdSchema.nullable(),
    releases: z.array(ChapterSummarySchema),
  })
  .openapi("ChapterSlot")

export const ChapterDetailSchema = ChapterSummarySchema.extend({
  navigation: z.object({
    previous: NavigationChoiceSchema,
    next: NavigationChoiceSchema,
    alternatives: z.array(ChapterNavigationSchema),
  }),
  pagesVersion: z.number().int().min(0),
  manga: z.object({
    id: IdSchema,
    slug: SlugSchema,
    title: z.string(),
    cover: CoverSchema.nullable(),
    isLongStrip: z.boolean(),
  }),
  pages: z.array(
    z.object({
      position: z.number().int().min(0),
      url: z.url(),
      optimizedUrl: z.url().nullable(),
      replicaUrl: z.url().nullable(),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
      optimizedWidth: z.number().int().positive().nullable(),
      optimizedHeight: z.number().int().positive().nullable(),
    })
  ),
  previous: ChapterNavigationSchema.nullable(),
  next: ChapterNavigationSchema.nullable(),
}).openapi("ChapterDetail")

const MangaListItemSchema = MangaSummarySchema.extend({
  alternativeTitles: MangaDetailSchema.shape.alternativeTitles,
  statistics: MangaDetailSchema.shape.statistics,
}).openapi("MangaListItem")

const MangaListSchema = z
  .object({ data: z.array(MangaListItemSchema), meta: PageMetaSchema })
  .openapi("MangaList")

export const MangaRecommendationsSchema = z
  .object({
    byAuthor: z.array(MangaSummarySchema).max(10),
    similar: z.array(MangaSummarySchema).max(10),
  })
  .openapi("MangaRecommendations")

const ChapterListSchema = z
  .object({
    data: z.array(ChapterSummarySchema),
    slots: z.array(ChapterSlotSchema),
    meta: PageMetaSchema.extend({
      releaseTotal: z.number().int().nonnegative(),
    }),
  })
  .openapi("ChapterList")

const LatestChapterListSchema = z
  .object({
    data: z.array(
      ChapterSummarySchema.extend({
        manga: z.object({
          id: IdSchema,
          slug: SlugSchema,
          title: z.string(),
          cover: CoverSchema.nullable(),
        }),
      })
    ),
    meta: PageMetaSchema,
  })
  .openapi("LatestChapterList")

const RandomMangaSchema = z
  .object({ data: z.array(MangaSummarySchema).max(10) })
  .openapi("RandomManga")

export const RandomMangaQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(10).default(1),
})

const TagListSchema = z
  .object({ data: z.array(TagSummarySchema) })
  .openapi("TagList")

const TranslationGroupListSchema = z
  .object({
    data: z.array(TranslationGroupSummarySchema),
    meta: PageMetaSchema,
  })
  .openapi("TranslationGroupList")
const TranslationGroupListQuerySchema = PageQuerySchema.extend({
  q: z.string().trim().min(1).max(100).optional(),
}).openapi("TranslationGroupListQuery")

const PersonListSchema = z
  .object({ data: z.array(PersonSummarySchema) })
  .openapi("PersonList")

export const PersonListQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(160).optional(),
    role: z.enum(["author", "artist"]).optional(),
    id: repeatableIds,
    limit: z.coerce.number().int().min(1).max(50).default(10),
  })
  .openapi("PersonListQuery")

const idParams = z.object({
  id: z.uuid().openapi({ param: { in: "path", name: "id" } }),
})

const responses = <T extends z.ZodType>(schema: T, description: string) => ({
  200: {
    content: { "application/json": { schema } },
    description,
  },
  400: {
    content: { "application/json": { schema: ApiErrorSchema } },
    description: "Request validation failed",
  },
  404: {
    content: { "application/json": { schema: ApiErrorSchema } },
    description: "Resource not found",
  },
})

export const listMangaRoute = createRoute({
  method: "get",
  path: "/v1/manga",
  tags: ["catalog"],
  request: { query: MangaCatalogQuerySchema },
  responses: {
    200: {
      content: { "application/json": { schema: MangaListSchema } },
      description: "Visible manga summaries matching the catalog query",
    },
    400: {
      content: { "application/json": { schema: ApiErrorSchema } },
      description: "Request validation failed",
    },
  },
})

export const getRandomMangaRoute = createRoute({
  method: "get",
  path: "/v1/manga/random",
  tags: ["discovery"],
  request: { query: RandomMangaQuerySchema },
  responses: {
    200: {
      content: { "application/json": { schema: RandomMangaSchema } },
      description:
        "Up to 10 random visible manga, selected once per limit every 10 minutes",
    },
    400: {
      content: { "application/json": { schema: ApiErrorSchema } },
      description: "Request validation failed",
    },
  },
})

export const getMangaRoute = createRoute({
  method: "get",
  path: "/v1/manga/{id}",
  tags: ["catalog"],
  request: { params: idParams },
  responses: responses(MangaDetailSchema, "Manga detail"),
})

export const getMangaRecommendationsRoute = createRoute({
  method: "get",
  path: "/v1/manga/{id}/recommendations",
  tags: ["discovery"],
  request: { params: idParams },
  responses: responses(
    MangaRecommendationsSchema,
    "Related manga by author and shared genre or theme"
  ),
})

export const listMangaChaptersRoute = createRoute({
  method: "get",
  path: "/v1/manga/{id}/chapters",
  tags: ["catalog"],
  request: { params: idParams, query: MangaChapterListQuerySchema },
  responses: responses(ChapterListSchema, "Readable chapters"),
})

export const getMangaReadingEntryRoute = createRoute({
  method: "get",
  path: "/v1/manga/{id}/reading-entry",
  tags: ["catalog"],
  request: {
    params: idParams,
    query: z.object({ position: z.enum(["first", "last"]) }),
  },
  responses: responses(
    MangaReadingEntrySchema,
    "All readable releases in the first slot of the volume-sorted chapter list (first: ascending, last: descending)"
  ),
})

export const getChapterNavigationReleasesRoute = createRoute({
  method: "get",
  path: "/v1/chapters/{id}/navigation-releases",
  tags: ["catalog"],
  request: {
    params: idParams,
    query: z.object({ direction: z.enum(["previous", "next"]) }),
  },
  responses: responses(
    ChapterNavigationReleasesSchema,
    "Readable release summaries for the adjacent logical chapter, without page manifests"
  ),
})

export const listLatestChaptersRoute = createRoute({
  method: "get",
  path: "/v1/chapters/latest",
  tags: ["discovery"],
  request: { query: PageQuerySchema },
  responses: {
    200: {
      content: { "application/json": { schema: LatestChapterListSchema } },
      description: "Latest readable chapters with manga identity",
    },
    400: {
      content: { "application/json": { schema: ApiErrorSchema } },
      description: "Request validation failed",
    },
  },
})

export const getChapterRoute = createRoute({
  method: "get",
  path: "/v1/chapters/{id}",
  tags: ["reader"],
  request: { params: idParams },
  responses: responses(ChapterDetailSchema, "Chapter reader payload"),
})

export const listTagsRoute = createRoute({
  method: "get",
  path: "/v1/tags",
  tags: ["taxonomy"],
  responses: {
    200: {
      content: { "application/json": { schema: TagListSchema } },
      description: "Public tag taxonomy in deterministic order",
    },
  },
})

export const getTagRoute = createRoute({
  method: "get",
  path: "/v1/tags/{id}",
  tags: ["taxonomy"],
  request: { params: idParams },
  responses: responses(TagSummarySchema, "Tag metadata"),
})

export const listGroupsRoute = createRoute({
  method: "get",
  path: "/v1/groups",
  tags: ["attribution"],
  request: { query: TranslationGroupListQuerySchema },
  responses: {
    200: {
      content: { "application/json": { schema: TranslationGroupListSchema } },
      description: "Public translation groups in deterministic order",
    },
  },
})

export const getGroupRoute = createRoute({
  method: "get",
  path: "/v1/groups/{id}",
  tags: ["attribution"],
  request: { params: idParams },
  responses: responses(
    TranslationGroupDetailSchema,
    "Translation group metadata and public statistics"
  ),
})

export const getPersonRoute = createRoute({
  method: "get",
  path: "/v1/people/{id}",
  tags: ["attribution"],
  request: { params: idParams },
  responses: responses(PersonDetailSchema, "Person metadata and public roles"),
})

export const listPeopleRoute = createRoute({
  method: "get",
  path: "/v1/people",
  tags: ["attribution"],
  request: { query: PersonListQuerySchema },
  responses: {
    200: {
      content: { "application/json": { schema: PersonListSchema } },
      description:
        "All people, or people attached to visible manga when filtered by role",
    },
    400: {
      content: { "application/json": { schema: ApiErrorSchema } },
      description: "Request validation failed",
    },
  },
})

export type MangaSummary = z.infer<typeof MangaSummarySchema>
export type MangaCatalogQuery = z.infer<typeof MangaCatalogQuerySchema>
export type MangaChapterListQuery = z.infer<typeof MangaChapterListQuerySchema>
export type MangaDetail = z.infer<typeof MangaDetailSchema>
export type MangaPreview = z.infer<typeof MangaPreviewSchema>
export type ChapterSummary = z.infer<typeof ChapterSummarySchema>
export type ChapterDetail = z.infer<typeof ChapterDetailSchema>
export type MangaList = z.infer<typeof MangaListSchema>
export type MangaRecommendations = z.infer<typeof MangaRecommendationsSchema>
export type ChapterList = z.infer<typeof ChapterListSchema>
export type LatestChapterList = z.infer<typeof LatestChapterListSchema>
export type RandomManga = z.infer<typeof RandomMangaSchema>
export type TagSummary = z.infer<typeof TagSummarySchema>
export type TagList = z.infer<typeof TagListSchema>
export type TranslationGroupSummary = z.infer<
  typeof TranslationGroupSummarySchema
>
export type TranslationGroupDetail = z.infer<
  typeof TranslationGroupDetailSchema
>
export type TranslationGroupList = z.infer<typeof TranslationGroupListSchema>
export type TranslationGroupListQuery = z.infer<
  typeof TranslationGroupListQuerySchema
>
export type PersonDetail = z.infer<typeof PersonDetailSchema>
export type PersonSummary = z.infer<typeof PersonSummarySchema>
export type PersonList = z.infer<typeof PersonListSchema>
export type PersonListQuery = z.infer<typeof PersonListQuerySchema>
