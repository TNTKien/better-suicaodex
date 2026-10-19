import { randomUUID } from "node:crypto"
import { and, count, eq, gt, isNull, notInArray, or, sql } from "drizzle-orm"
import { parseISO } from "date-fns"

import type { Database } from "../../src/db/client.js"
import { CONTENT_WRITE_LOCK } from "../../src/shared/content-lock.js"
import {
  chapter,
  chapterGroup,
  chapterPage,
  chapterTikTokReplica,
  cover,
  manga,
  mangaGroup,
  mangaLanguage,
  mangaPerson,
  mangaTag,
  mangaVolume,
  organization as translationGroup,
  person,
  tag,
  translationGroupProfile,
} from "../../src/db/schema.js"

const fixture = {
  tags: [
    {
      id: "6dabea6a-eaff-4b90-811f-59bd7352c747",
      slug: "comedy",
      group: "genre",
      name: "Comedy",
    },
    {
      id: "5faf97a7-4ef9-41fb-8a0c-a0da312d128d",
      slug: "romance",
      group: "genre",
      name: "Romance",
    },
    {
      id: "0c2125bf-6c5a-424a-88e8-32d56d3732dc",
      slug: "slice-of-life",
      group: "genre",
      name: "Slice of Life",
    },
    {
      id: "c8496c41-b3a1-4421-8eed-a76d3f58cb0b",
      slug: "school-life",
      group: "theme",
      name: "School Life",
    },
    {
      id: "b19c2a94-269d-4ec3-8032-c6ba22a9098e",
      slug: "mafia",
      group: "theme",
      name: "Mafia",
    },
    {
      id: "a7b9e654-4257-40ba-82fa-0d126050a867",
      slug: "supernatural",
      group: "theme",
      name: "Supernatural",
    },
    {
      id: "ff06e07a-68eb-4ff5-8739-7b0f92479abb",
      slug: "drama",
      group: "genre",
      name: "Drama",
    },
    {
      id: "5d4da38a-e39b-44d9-867b-97b90dc3953b",
      slug: "sports",
      group: "genre",
      name: "Sports",
    },
    {
      id: "8df73271-cac0-4248-86cf-f56f1bcafdc3",
      slug: "traditional-games",
      group: "theme",
      name: "Traditional Games",
    },
    {
      id: "7d47d6aa-0cb9-4d4f-807a-b9d014297d58",
      slug: "action",
      group: "genre",
      name: "Action",
    },
    {
      id: "7c8c4f55-8b29-453e-89a7-7e268b3bab0d",
      slug: "fantasy",
      group: "genre",
      name: "Fantasy",
    },
    {
      id: "5c8e2507-e32f-43ab-82e6-f664df6b3875",
      slug: "isekai",
      group: "genre",
      name: "Isekai",
    },
    {
      id: "16fad4be-eddc-4ba4-888a-33fc9f702cec",
      slug: "crossdressing",
      group: "theme",
      name: "Crossdressing",
    },
    {
      id: "16fbc936-956a-4d0d-8191-40598a2c8881",
      slug: "demons",
      group: "theme",
      name: "Demons",
    },
    {
      id: "d38ebb51-f8d4-4b3f-89b4-ff895cc0bc79",
      slug: "magic",
      group: "theme",
      name: "Magic",
    },
    {
      id: "2b40242e-8c03-4678-8516-9109795fb783",
      slug: "monsters",
      group: "theme",
      name: "Monsters",
    },
    {
      id: "ea81f2f9-4b76-47e9-8f7c-1195d5cd996d",
      slug: "web-comic",
      group: "format",
      name: "Web Comic",
    },
    {
      id: "4a845190-00e6-4c99-826f-514df7dbcb01",
      slug: "gyaru",
      group: "theme",
      name: "Gyaru",
    },
    {
      id: "3bf83024-7126-43b8-85bb-77c714d1a5a4",
      slug: "full-color",
      group: "format",
      name: "Full Color",
    },
  ],
  people: [
    {
      id: "6d887f9d-7196-4a8d-839d-c4e7e0334183",
      slug: "sample-people-1",
      name: "Sample people 1",
    },
    {
      id: "de9c6701-061a-42b4-880e-1cb5eb2f05c3",
      slug: "sample-people-2",
      name: "Sample people 2",
    },
    {
      id: "4e27c50f-fa69-4cb8-8293-026cf1248656",
      slug: "sample-people-3",
      name: "Sample people 3",
    },
    {
      id: "034162ca-9e51-4bc8-80ea-f1dc756000b4",
      slug: "sample-people-4",
      name: "Sample people 4",
    },
    {
      id: "5c22a816-fbdc-4538-89be-d3e10ffa46f2",
      slug: "sample-people-5",
      name: "Sample people 5",
    },
    {
      id: "71feffa9-d52d-40f6-8390-b8e989f59528",
      slug: "sample-people-6",
      name: "Sample people 6",
    },
    {
      id: "911c75e9-245d-4b49-81e3-1e6e93020098",
      slug: "sample-people-7",
      name: "Sample people 7",
    },
    {
      id: "782cf15b-468b-47de-818e-e38f10036343",
      slug: "sample-people-8",
      name: "Sample people 8",
    },
    {
      id: "290bb6a7-9ae7-4622-81eb-34c48a217de1",
      slug: "sample-people-9",
      name: "Sample people 9",
    },
    {
      id: "34fb0ba8-089f-4ec4-859b-52858d0e225b",
      slug: "sample-people-10",
      name: "Sample people 10",
    },
  ],
  groups: [
    {
      id: "2e4d78e0-e0ee-4aeb-8be1-ec05b80bda37",
      slug: "sample-groups-1",
      name: "Sample groups 1",
    },
    {
      id: "1883504b-a379-4ffd-85c6-3d7c161cc613",
      slug: "sample-groups-2",
      name: "Sample groups 2",
    },
    {
      id: "c1e881c3-66df-4846-81ad-2dd2cf209250",
      slug: "sample-groups-3",
      name: "Sample groups 3",
    },
    {
      id: "ea217a0a-3d13-4954-8ef3-df659c4864c1",
      slug: "sample-groups-4",
      name: "Sample groups 4",
    },
    {
      id: "f282eeed-1b86-4820-8e19-c30b71cdc0ad",
      slug: "sample-groups-5",
      name: "Sample groups 5",
    },
    {
      id: "3e835f0b-c787-4c1e-8689-e277b66a6674",
      slug: "sample-groups-6",
      name: "Sample groups 6",
    },
    {
      id: "76801251-0ac4-41dd-81a7-100af9363ba1",
      slug: "sample-groups-7",
      name: "Sample groups 7",
    },
    {
      id: "fe5ca8aa-cff5-4c78-826b-a29c49756499",
      slug: "sample-groups-8",
      name: "Sample groups 8",
    },
    {
      id: "dbfef025-6695-42e2-8891-2e37bac17ae7",
      slug: "sample-groups-9",
      name: "Sample groups 9",
    },
  ],
  manga: [
    {
      id: "425b0671-b5f5-4b34-850b-4429d1e6286a",
      slug: "sample-manga-1",
      title: "Sample manga 1",
      alternativeTitles: {
        en: ["Sample title 1 en 1"],
        ja: ["Sample title 1 ja 1"],
        uk: ["Sample title 1 uk 1"],
      },
      description: "Synthetic manga fixture 1.",
      originalLanguage: "ja",
      publicationDemographic: "seinen",
      status: "completed",
      contentRating: "suggestive",
      year: 2024,
      lastVolume: "2",
      lastChapter: "17",
      links: { al: "123456789" },
      languages: ["en", "pt-br", "vi"],
      tagIds: [
        "6dabea6a-eaff-4b90-811f-59bd7352c747",
        "5faf97a7-4ef9-41fb-8a0c-a0da312d128d",
        "0c2125bf-6c5a-424a-88e8-32d56d3732dc",
        "c8496c41-b3a1-4421-8eed-a76d3f58cb0b",
      ],
      personId: "6d887f9d-7196-4a8d-839d-c4e7e0334183",
      latestChapterPublishedAt: "2026-04-04T10:53:04.513Z",
      createdAt: "2025-10-09T09:03:23.541Z",
      updatedAt: "2026-02-25T09:38:10.222Z",
      publishedAt: "2025-10-09T09:03:25.779Z",
      cover: {
        id: "fdb71e5b-e09e-4b0a-848b-0d71516ddee7",
        width: 1800,
        height: 2560,
        language: "ja",
      },
    },
    {
      id: "9783abb1-16aa-498c-8f79-7d2342a7295d",
      slug: "sample-manga-2",
      title: "Sample manga 2",
      alternativeTitles: {
        en: ["Sample title 2 en 1"],
        ja: ["Sample title 2 ja 1"],
        vi: ["Sample title 2 vi 1"],
      },
      description: "Synthetic manga fixture 2.",
      originalLanguage: "ja",
      publicationDemographic: "shounen",
      status: "ongoing",
      contentRating: "safe",
      year: 2025,
      lastVolume: null,
      lastChapter: null,
      links: {},
      languages: ["en", "es-la", "fr", "id", "pt-br", "vi"],
      tagIds: [
        "6dabea6a-eaff-4b90-811f-59bd7352c747",
        "5faf97a7-4ef9-41fb-8a0c-a0da312d128d",
        "0c2125bf-6c5a-424a-88e8-32d56d3732dc",
        "c8496c41-b3a1-4421-8eed-a76d3f58cb0b",
      ],
      personId: "de9c6701-061a-42b4-880e-1cb5eb2f05c3",
      latestChapterPublishedAt: "2026-04-04T01:56:24.683Z",
      createdAt: "2025-11-04T20:40:51.789Z",
      updatedAt: "2026-03-12T20:52:19.887Z",
      publishedAt: "2025-11-04T20:40:54.779Z",
      cover: {
        id: "2f38b2d4-2662-4b22-80bf-c3c3c1043b14",
        width: 1303,
        height: 2048,
        language: "ja",
      },
    },
    {
      id: "f9a5ed37-bdac-454f-8ba6-3b445abdd2f8",
      slug: "sample-manga-3",
      title: "Sample manga 3",
      alternativeTitles: {
        en: ["Sample title 3 en 1"],
        ja: ["Sample title 3 ja 1"],
        ko: ["Sample title 3 ko 1"],
        "ja-ro": ["Sample title 3 ja-ro 1"],
      },
      description: "Synthetic manga fixture 3.",
      originalLanguage: "ja",
      publicationDemographic: "seinen",
      status: "completed",
      contentRating: "safe",
      year: 2010,
      lastVolume: "19",
      lastChapter: "100",
      links: {},
      languages: ["en", "vi"],
      tagIds: [
        "6dabea6a-eaff-4b90-811f-59bd7352c747",
        "0c2125bf-6c5a-424a-88e8-32d56d3732dc",
        "b19c2a94-269d-4ec3-8032-c6ba22a9098e",
        "a7b9e654-4257-40ba-82fa-0d126050a867",
      ],
      personId: "4e27c50f-fa69-4cb8-8293-026cf1248656",
      latestChapterPublishedAt: "2026-04-04T13:06:20.606Z",
      createdAt: "2025-10-09T15:59:45.734Z",
      updatedAt: "2025-10-09T15:59:47.955Z",
      publishedAt: "2025-10-09T15:59:47.955Z",
      cover: {
        id: "bcdd9868-91a7-4829-8fd9-a61715ca005b",
        width: 704,
        height: 1000,
        language: "ja",
      },
    },
    {
      id: "9fd3d986-d949-4f7c-89ae-cb077416cc8e",
      slug: "sample-manga-4",
      title: "Sample manga 4",
      alternativeTitles: {
        ja: ["Sample title 4 ja 1"],
        vi: ["Sample title 4 vi 1"],
        "ja-ro": ["Sample title 4 ja-ro 1"],
      },
      description: "Synthetic manga fixture 4.",
      originalLanguage: "ja",
      publicationDemographic: "shounen",
      status: "ongoing",
      contentRating: "safe",
      year: 2023,
      lastVolume: null,
      lastChapter: null,
      links: {},
      languages: ["vi"],
      tagIds: [
        "6dabea6a-eaff-4b90-811f-59bd7352c747",
        "ff06e07a-68eb-4ff5-8739-7b0f92479abb",
        "5d4da38a-e39b-44d9-867b-97b90dc3953b",
        "8df73271-cac0-4248-86cf-f56f1bcafdc3",
      ],
      personId: "034162ca-9e51-4bc8-80ea-f1dc756000b4",
      latestChapterPublishedAt: "2026-04-03T16:24:44.892Z",
      createdAt: "2025-10-09T14:26:34.477Z",
      updatedAt: "2026-01-22T21:26:03.161Z",
      publishedAt: "2025-10-09T14:26:37.455Z",
      cover: {
        id: "bf085b32-a131-4603-890e-f94d18089a95",
        width: 1440,
        height: 2048,
        language: "ja",
      },
    },
    {
      id: "d4e7adfc-9641-45d8-8382-6f2d7ba5836b",
      slug: "sample-manga-5",
      title: "Sample manga 5",
      alternativeTitles: {
        en: ["Sample title 5 en 1", "Sample title 5 en 2"],
        ja: ["Sample title 5 ja 1"],
        vi: ["Sample title 5 vi 1"],
      },
      description: "Synthetic manga fixture 5.",
      originalLanguage: "ja",
      publicationDemographic: "shounen",
      status: "ongoing",
      contentRating: "safe",
      year: 2024,
      lastVolume: null,
      lastChapter: null,
      links: {},
      languages: ["en", "id", "pt-br", "vi"],
      tagIds: [
        "6dabea6a-eaff-4b90-811f-59bd7352c747",
        "5faf97a7-4ef9-41fb-8a0c-a0da312d128d",
        "0c2125bf-6c5a-424a-88e8-32d56d3732dc",
        "c8496c41-b3a1-4421-8eed-a76d3f58cb0b",
      ],
      personId: "5c22a816-fbdc-4538-89be-d3e10ffa46f2",
      latestChapterPublishedAt: "2026-04-03T12:05:33.809Z",
      createdAt: "2025-10-09T11:20:36.007Z",
      updatedAt: "2025-10-09T11:20:36.525Z",
      publishedAt: "2025-10-09T11:20:36.525Z",
      cover: {
        id: "8abfbae8-88a3-4d5d-8fbc-5ca281253a5e",
        width: 3024,
        height: 4299,
        language: "ja",
      },
    },
    {
      id: "b7f27aa0-0bd0-41c8-8cfb-5e4e76f2005f",
      slug: "sample-manga-6",
      title: "Sample manga 6",
      alternativeTitles: {
        en: ["Sample title 6 en 1"],
        ja: ["Sample title 6 ja 1"],
        vi: ["Sample title 6 vi 1", "Sample title 6 vi 2"],
      },
      description: "Synthetic manga fixture 6.",
      originalLanguage: "ja",
      publicationDemographic: "shounen",
      status: "ongoing",
      contentRating: "safe",
      year: 2017,
      lastVolume: null,
      lastChapter: null,
      links: {},
      languages: ["en", "id", "pt-br", "vi"],
      tagIds: [
        "7d47d6aa-0cb9-4d4f-807a-b9d014297d58",
        "6dabea6a-eaff-4b90-811f-59bd7352c747",
        "7c8c4f55-8b29-453e-89a7-7e268b3bab0d",
        "5c8e2507-e32f-43ab-82e6-f664df6b3875",
        "5faf97a7-4ef9-41fb-8a0c-a0da312d128d",
        "16fad4be-eddc-4ba4-888a-33fc9f702cec",
        "16fbc936-956a-4d0d-8191-40598a2c8881",
        "d38ebb51-f8d4-4b3f-89b4-ff895cc0bc79",
        "2b40242e-8c03-4678-8516-9109795fb783",
        "c8496c41-b3a1-4421-8eed-a76d3f58cb0b",
      ],
      personId: "71feffa9-d52d-40f6-8390-b8e989f59528",
      latestChapterPublishedAt: "2026-04-02T16:27:27.340Z",
      createdAt: "2025-10-09T08:48:58.699Z",
      updatedAt: "2026-02-02T12:42:07.645Z",
      publishedAt: "2025-10-09T18:19:00.784Z",
      cover: {
        id: "ffc36b0f-5742-4438-867f-cb4f9cb7d013",
        width: 1326,
        height: 2048,
        language: "ja",
      },
    },
    {
      id: "e96fb247-4e0b-4d1f-8c9c-47f04c095aeb",
      slug: "sample-manga-7",
      title: "Sample manga 7",
      alternativeTitles: {
        en: ["Sample title 7 en 1"],
        ja: ["Sample title 7 ja 1"],
        vi: ["Sample title 7 vi 1"],
      },
      description: "Synthetic manga fixture 7.",
      originalLanguage: "ja",
      publicationDemographic: "josei",
      status: "ongoing",
      contentRating: "safe",
      year: 2022,
      lastVolume: null,
      lastChapter: null,
      links: {},
      languages: ["en", "vi"],
      tagIds: [
        "ff06e07a-68eb-4ff5-8739-7b0f92479abb",
        "5faf97a7-4ef9-41fb-8a0c-a0da312d128d",
      ],
      personId: "911c75e9-245d-4b49-81e3-1e6e93020098",
      latestChapterPublishedAt: "2026-04-02T15:29:23.567Z",
      createdAt: "2025-10-09T14:58:19.138Z",
      updatedAt: "2026-03-16T13:57:36.382Z",
      publishedAt: "2025-10-09T14:58:26.788Z",
      cover: {
        id: "35c8d611-1047-433f-8622-c858d17aefe5",
        width: 1454,
        height: 2048,
        language: "ja",
      },
    },
    {
      id: "6cb8718f-6626-44d3-82f4-177ae8fe6f8d",
      slug: "sample-manga-8",
      title: "Sample manga 8",
      alternativeTitles: {
        en: ["Sample title 8 en 1", "Sample title 8 en 2"],
        ja: ["Sample title 8 ja 1"],
        vi: ["Sample title 8 vi 1"],
      },
      description: "Synthetic manga fixture 8.",
      originalLanguage: "ja",
      publicationDemographic: "seinen",
      status: "ongoing",
      contentRating: "suggestive",
      year: 2025,
      lastVolume: null,
      lastChapter: null,
      links: {},
      languages: ["en", "fr", "id", "pt-br", "vi"],
      tagIds: [
        "ea81f2f9-4b76-47e9-8f7c-1195d5cd996d",
        "6dabea6a-eaff-4b90-811f-59bd7352c747",
        "5faf97a7-4ef9-41fb-8a0c-a0da312d128d",
        "0c2125bf-6c5a-424a-88e8-32d56d3732dc",
        "4a845190-00e6-4c99-826f-514df7dbcb01",
      ],
      personId: "782cf15b-468b-47de-818e-e38f10036343",
      latestChapterPublishedAt: "2026-04-02T12:31:53.884Z",
      createdAt: "2025-12-11T17:40:28.266Z",
      updatedAt: "2026-03-19T12:21:30.655Z",
      publishedAt: "2025-12-11T17:40:30.196Z",
      cover: {
        id: "f07aff6c-b8bc-4592-85e1-6690a7a4288e",
        width: 2894,
        height: 4093,
        language: "ja",
      },
    },
    {
      id: "bc5287e5-5095-4aff-8998-904ce32c73e4",
      slug: "sample-manga-9",
      title: "Sample manga 9",
      alternativeTitles: {
        en: ["Sample title 9 en 1"],
        ja: ["Sample title 9 ja 1"],
      },
      description: "Synthetic manga fixture 9.",
      originalLanguage: "ja",
      publicationDemographic: null,
      status: "ongoing",
      contentRating: "suggestive",
      year: 2024,
      lastVolume: null,
      lastChapter: null,
      links: {},
      languages: ["de", "en", "id", "pt-br", "tr", "vi"],
      tagIds: [
        "3bf83024-7126-43b8-85bb-77c714d1a5a4",
        "6dabea6a-eaff-4b90-811f-59bd7352c747",
        "ff06e07a-68eb-4ff5-8739-7b0f92479abb",
        "5faf97a7-4ef9-41fb-8a0c-a0da312d128d",
        "0c2125bf-6c5a-424a-88e8-32d56d3732dc",
        "c8496c41-b3a1-4421-8eed-a76d3f58cb0b",
      ],
      personId: "290bb6a7-9ae7-4622-81eb-34c48a217de1",
      latestChapterPublishedAt: "2026-04-02T12:10:39.642Z",
      createdAt: "2025-10-09T13:46:58.270Z",
      updatedAt: "2025-10-09T13:47:00.403Z",
      publishedAt: "2025-10-09T13:47:00.403Z",
      cover: {
        id: "7c336b18-0b45-44ee-8b3a-cf2c52f01a4f",
        width: 1748,
        height: 2480,
        language: "ja",
      },
    },
    {
      id: "24a52c89-ee6f-4bf8-85de-f1f9b32b9c62",
      slug: "sample-manga-10",
      title: "Sample manga 10",
      alternativeTitles: {
        en: ["Sample title 10 en 1"],
        ja: ["Sample title 10 ja 1"],
        vi: ["Sample title 10 vi 1"],
      },
      description: "Synthetic manga fixture 10.",
      originalLanguage: "ja",
      publicationDemographic: "shounen",
      status: "ongoing",
      contentRating: "safe",
      year: 2024,
      lastVolume: null,
      lastChapter: null,
      links: {},
      languages: ["en", "fr", "id", "pt-br", "vi"],
      tagIds: [
        "6dabea6a-eaff-4b90-811f-59bd7352c747",
        "5faf97a7-4ef9-41fb-8a0c-a0da312d128d",
        "0c2125bf-6c5a-424a-88e8-32d56d3732dc",
        "c8496c41-b3a1-4421-8eed-a76d3f58cb0b",
      ],
      personId: "34fb0ba8-089f-4ec4-859b-52858d0e225b",
      latestChapterPublishedAt: "2026-03-31T11:32:10.261Z",
      createdAt: "2025-10-09T10:07:57.170Z",
      updatedAt: "2026-03-31T16:49:49.090Z",
      publishedAt: "2025-10-09T10:07:59.775Z",
      cover: {
        id: "90df0c29-7525-4540-8643-21ab8909498e",
        width: 705,
        height: 1000,
        language: "ja",
      },
    },
  ],
  chapters: [
    {
      id: "69280506-3498-47e6-8f16-61413d81bdab",
      mangaId: "425b0671-b5f5-4b34-850b-4429d1e6286a",
      groupId: "2e4d78e0-e0ee-4aeb-8be1-ec05b80bda37",
      volume: "2",
      number: "9.5",
      title: null,
      language: "vi",
      createdAt: "2026-04-02T11:28:52.136Z",
      updatedAt: "2026-04-02T11:28:54.809Z",
      publishedAt: "2026-04-02T11:28:54.809Z",
      pages: [
        ["page-1.webp", 1356, 1920],
        ["page-2.webp", 1356, 1920],
        ["page-3.webp", 1356, 1920],
        ["page-4.webp", 1422, 793],
        ["page-5.webp", 1918, 1078],
      ],
    },
    {
      id: "ac2af2e3-5ebf-4f39-8113-8a96e989d3ac",
      mangaId: "9783abb1-16aa-498c-8f79-7d2342a7295d",
      groupId: "1883504b-a379-4ffd-85c6-3d7c161cc613",
      volume: null,
      number: "24",
      title: "Sample chapter 2",
      language: "vi",
      createdAt: "2026-04-04T01:56:19.304Z",
      updatedAt: "2026-04-04T05:39:17.884Z",
      publishedAt: "2026-04-04T01:56:24.683Z",
      pages: [],
    },
    {
      id: "90a858ba-afbd-4abb-8764-90d2851a7eb4",
      mangaId: "425b0671-b5f5-4b34-850b-4429d1e6286a",
      groupId: "2e4d78e0-e0ee-4aeb-8be1-ec05b80bda37",
      volume: "1",
      number: "7.6",
      title: "Sample chapter 3",
      language: "vi",
      createdAt: "2026-03-12T11:39:04.683Z",
      updatedAt: "2026-03-12T11:44:31.211Z",
      publishedAt: "2026-03-12T11:39:08.376Z",
      pages: [
        ["page-1.webp", 1356, 1920],
        ["page-2.webp", 1356, 1920],
        ["page-3.webp", 1356, 1920],
        ["page-4.webp", 1356, 1920],
        ["page-5.webp", 1356, 1920],
        ["page-6.webp", 1356, 1920],
        ["page-7.webp", 1356, 1920],
        ["page-8.webp", 1356, 1920],
        ["page-9.webp", 1356, 1920],
        ["page-10.webp", 1422, 793],
        ["page-11.webp", 1918, 1078],
      ],
    },
    {
      id: "129ff9ca-f5f9-483e-8d5c-52d223d3b7b9",
      mangaId: "f9a5ed37-bdac-454f-8ba6-3b445abdd2f8",
      groupId: "c1e881c3-66df-4846-81ad-2dd2cf209250",
      volume: "7",
      number: "33",
      title: null,
      language: "vi",
      createdAt: "2026-04-04T13:06:14.586Z",
      updatedAt: "2026-04-04T13:44:48.111Z",
      publishedAt: "2026-04-04T13:06:20.606Z",
      pages: [],
    },
    {
      id: "1884ca89-5c66-4ac4-88f4-9674283036dd",
      mangaId: "9fd3d986-d949-4f7c-89ae-cb077416cc8e",
      groupId: "ea217a0a-3d13-4954-8ef3-df659c4864c1",
      volume: "5",
      number: "38",
      title: null,
      language: "vi",
      createdAt: "2026-04-03T16:24:38.400Z",
      updatedAt: "2026-04-03T16:24:44.893Z",
      publishedAt: "2026-04-03T16:24:44.892Z",
      pages: [
        ["page-1.webp", 1447, 2100],
        ["page-2.webp", 1447, 2100],
        ["page-3.webp", 1439, 2100],
        ["page-4.webp", 1447, 2100],
        ["page-5.webp", 1439, 2100],
        ["page-6.webp", 1447, 2100],
        ["page-7.webp", 1439, 2100],
        ["page-8.webp", 1447, 2100],
        ["page-9.webp", 1439, 2100],
        ["page-10.webp", 1447, 2100],
        ["page-11.webp", 1439, 2100],
        ["page-12.webp", 1447, 2100],
        ["page-13.webp", 1439, 2100],
        ["page-14.webp", 1447, 2100],
        ["page-15.webp", 1439, 2100],
        ["page-16.webp", 1447, 2100],
        ["page-17.webp", 1439, 2100],
        ["page-18.webp", 1447, 2100],
      ],
    },
    {
      id: "6d08f12a-08ef-4489-8a8b-fa46a93bd7c3",
      mangaId: "d4e7adfc-9641-45d8-8382-6f2d7ba5836b",
      groupId: "f282eeed-1b86-4820-8e19-c30b71cdc0ad",
      volume: "3",
      number: "26",
      title: "Sample chapter 6",
      language: "vi",
      createdAt: "2026-04-03T12:05:29.514Z",
      updatedAt: "2026-04-03T12:05:33.810Z",
      publishedAt: "2026-04-03T12:05:33.809Z",
      pages: [
        ["page-1.webp", 1920, 1080],
        ["page-2.webp", 960, 1378],
        ["page-3.webp", 960, 1378],
        ["page-4.webp", 960, 1378],
        ["page-5.webp", 960, 1378],
        ["page-6.webp", 960, 1378],
        ["page-7.webp", 960, 1378],
        ["page-8.webp", 960, 1378],
        ["page-9.webp", 960, 1378],
        ["page-10.webp", 960, 1378],
        ["page-11.webp", 960, 1378],
        ["page-12.webp", 960, 1378],
        ["page-13.webp", 960, 1378],
        ["page-14.webp", 960, 1378],
        ["page-15.webp", 960, 1378],
        ["page-16.webp", 960, 1378],
        ["page-17.webp", 960, 1378],
        ["page-18.webp", 960, 1378],
        ["page-19.webp", 960, 1378],
        ["page-20.webp", 960, 1378],
        ["page-21.webp", 960, 1378],
      ],
    },
    {
      id: "b4c1f18e-69f4-435e-8ed4-d97e782c2610",
      mangaId: "b7f27aa0-0bd0-41c8-8cfb-5e4e76f2005f",
      groupId: "3e835f0b-c787-4c1e-8689-e277b66a6674",
      volume: null,
      number: "438",
      title: "Sample chapter 7",
      language: "vi",
      createdAt: "2026-04-02T16:27:20.593Z",
      updatedAt: "2026-04-02T16:27:27.341Z",
      publishedAt: "2026-04-02T16:27:27.340Z",
      pages: [
        ["page-1.webp", 1393, 2000],
        ["page-2.webp", 1393, 2000],
        ["page-3.webp", 1393, 2000],
        ["page-4.webp", 1393, 2000],
        ["page-5.webp", 1393, 2000],
        ["page-6.webp", 1393, 2000],
        ["page-7.webp", 1393, 2000],
        ["page-8.webp", 1393, 2000],
        ["page-9.webp", 1393, 2000],
        ["page-10.webp", 1393, 2000],
        ["page-11.webp", 1393, 2000],
        ["page-12.webp", 1393, 2000],
        ["page-13.webp", 1393, 2000],
        ["page-14.webp", 1393, 2000],
        ["page-15.webp", 1393, 2000],
        ["page-16.webp", 1393, 2000],
        ["page-17.webp", 1393, 2000],
        ["page-18.webp", 2740, 2000],
        ["page-19.webp", 1393, 2000],
        ["page-20.webp", 1393, 2000],
        ["page-21.webp", 1393, 2000],
        ["page-22.webp", 1341, 2000],
        ["page-23.webp", 1341, 2000],
        ["page-24.webp", 1341, 2000],
        ["page-25.webp", 1341, 2000],
        ["page-26.webp", 1341, 2000],
        ["page-27.webp", 1920, 1080],
      ],
    },
    {
      id: "021bc8cd-ea4e-4f0a-84b4-2d9dd21f909b",
      mangaId: "e96fb247-4e0b-4d1f-8c9c-47f04c095aeb",
      groupId: "76801251-0ac4-41dd-81a7-100af9363ba1",
      volume: "1",
      number: "6",
      title: "Sample chapter 8",
      language: "vi",
      createdAt: "2026-04-02T15:29:17.605Z",
      updatedAt: "2026-04-02T15:29:23.567Z",
      publishedAt: "2026-04-02T15:29:23.567Z",
      pages: [
        ["page-1.webp", 2904, 2048],
        ["page-2.webp", 1453, 2048],
        ["page-3.webp", 1453, 2048],
        ["page-4.webp", 1453, 2048],
        ["page-5.webp", 1453, 2048],
        ["page-6.webp", 1453, 2048],
        ["page-7.webp", 1453, 2048],
        ["page-8.webp", 1453, 2048],
        ["page-9.webp", 1453, 2048],
        ["page-10.webp", 1453, 2048],
        ["page-11.webp", 1453, 2048],
        ["page-12.webp", 1453, 2048],
        ["page-13.webp", 1453, 2048],
        ["page-14.webp", 1453, 2048],
        ["page-15.webp", 1453, 2048],
        ["page-16.webp", 1453, 2048],
        ["page-17.webp", 1453, 2048],
        ["page-18.webp", 1453, 2048],
        ["page-19.webp", 1453, 2048],
        ["page-20.webp", 1453, 2048],
        ["page-21.webp", 1453, 2048],
      ],
    },
    {
      id: "eed18d2b-f3ba-4849-8f48-db1453ec3389",
      mangaId: "6cb8718f-6626-44d3-82f4-177ae8fe6f8d",
      groupId: "fe5ca8aa-cff5-4c78-826b-a29c49756499",
      volume: null,
      number: "19",
      title: "Sample chapter 9",
      language: "vi",
      createdAt: "2026-04-02T12:31:49.631Z",
      updatedAt: "2026-04-02T12:31:53.884Z",
      publishedAt: "2026-04-02T12:31:53.884Z",
      pages: [
        ["page-1.webp", 1920, 1080],
        ["page-2.webp", 1125, 1600],
        ["page-3.webp", 1125, 1600],
        ["page-4.webp", 1125, 1600],
        ["page-5.webp", 1125, 1600],
        ["page-6.webp", 1125, 1600],
        ["page-7.webp", 1125, 1600],
        ["page-8.webp", 1125, 1600],
        ["page-9.webp", 1125, 1600],
        ["page-10.webp", 1125, 1600],
        ["page-11.webp", 1125, 1600],
        ["page-12.webp", 1125, 1600],
        ["page-13.webp", 1125, 1600],
        ["page-14.webp", 1125, 1600],
        ["page-15.webp", 1920, 1080],
      ],
    },
    {
      id: "994a53ac-b21e-414b-8e77-3d2317edd793",
      mangaId: "bc5287e5-5095-4aff-8998-904ce32c73e4",
      groupId: "dbfef025-6695-42e2-8891-2e37bac17ae7",
      volume: "3",
      number: "35",
      title: null,
      language: "vi",
      createdAt: "2026-04-02T12:10:36.843Z",
      updatedAt: "2026-04-02T12:10:39.642Z",
      publishedAt: "2026-04-02T12:10:39.642Z",
      pages: [
        ["page-1.webp", 1444, 2048],
        ["page-2.webp", 1444, 2048],
        ["page-3.webp", 1444, 2048],
        ["page-4.webp", 1444, 2048],
        ["page-5.webp", 1444, 2048],
        ["page-6.webp", 1444, 2048],
        ["page-7.webp", 1444, 2048],
        ["page-8.webp", 1444, 2048],
        ["page-9.webp", 1444, 2048],
        ["page-10.webp", 1000, 1223],
      ],
    },
    {
      id: "a6a67b25-a207-4797-84d3-8e9f40c57ed1",
      mangaId: "24a52c89-ee6f-4bf8-85de-f1f9b32b9c62",
      groupId: "2e4d78e0-e0ee-4aeb-8be1-ec05b80bda37",
      volume: null,
      number: "41",
      title: "Sample chapter 11",
      language: "vi",
      createdAt: "2026-03-31T11:32:04.776Z",
      updatedAt: "2026-03-31T11:32:10.262Z",
      publishedAt: "2026-03-31T11:32:10.261Z",
      pages: [
        ["page-1.webp", 1445, 2048],
        ["page-2.webp", 1445, 2048],
        ["page-3.webp", 1445, 2048],
        ["page-4.webp", 1445, 2048],
        ["page-5.webp", 1445, 2048],
        ["page-6.webp", 1445, 2048],
        ["page-7.webp", 1445, 2048],
        ["page-8.webp", 1445, 2048],
        ["page-9.webp", 1445, 2048],
        ["page-10.webp", 1445, 2048],
        ["page-11.webp", 1445, 2048],
        ["page-12.webp", 1445, 2048],
        ["page-13.webp", 1445, 2048],
        ["page-14.webp", 1445, 2048],
        ["page-15.webp", 1445, 2048],
        ["page-16.webp", 1445, 2048],
        ["page-17.webp", 1422, 793],
        ["page-18.webp", 1918, 1078],
      ],
    },
  ],
}

const instant = (value: string) => parseISO(value)
const relationTime = instant("2025-10-09T00:00:00.000Z")
const systemGroupSlug = "system"

export const catalogMangaIds = fixture.manga.map(({ id }) => id)
export const catalogPersonIds = fixture.people.map(({ id }) => id)
export const catalogTagIds = fixture.tags.map(({ id }) => id)
export const catalogGroupSlugs = [systemGroupSlug]
export const catalogChapterIds = fixture.chapters.map(({ id }) => id)

export async function seedCatalog(database: Database) {
  return database.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${CONTENT_WRITE_LOCK}))`
    )
    const [protectedRows] = await tx
      .select({ count: count() })
      .from(manga)
      .where(or(gt(manga.version, 1), notInArray(manga.id, catalogMangaIds)))
    if ((protectedRows?.count ?? 0) > 0)
      throw new Error(
        `Phase 4A seed refused: ${protectedRows!.count} manga rows are managed`
      )
    const tagIds = new Map<string, string>()
    for (const item of fixture.tags) {
      const [saved] = await tx
        .insert(tag)
        .values(item)
        .onConflictDoUpdate({
          target: tag.slug,
          set: { slug: item.slug, group: item.group, name: item.name },
        })
        .returning({ id: tag.id })
      tagIds.set(item.id, saved!.id)
    }

    const personIds = new Map<string, string>()
    for (const item of fixture.people) {
      const values = {
        ...item,
        createdAt: relationTime,
        updatedAt: relationTime,
      }
      const [saved] = await tx
        .insert(person)
        .values(values)
        .onConflictDoUpdate({
          target: person.id,
          set: { slug: item.slug, name: item.name, updatedAt: relationTime },
        })
        .returning({ id: person.id })
      personIds.set(item.id, saved!.id)
    }

    const [systemGroup] = await tx
      .insert(translationGroup)
      .values({
        id: randomUUID(),
        slug: systemGroupSlug,
        name: "System",
        createdAt: relationTime,
      })
      .onConflictDoUpdate({
        target: translationGroup.slug,
        set: { name: "System" },
      })
      .returning({ id: translationGroup.id })
    await tx
      .insert(translationGroupProfile)
      .values({
        organizationId: systemGroup!.id,
        description: "Fallback owner for deleted groups",
        publicationState: "published",
        createdAt: relationTime,
        updatedAt: relationTime,
      })
      .onConflictDoUpdate({
        target: translationGroupProfile.organizationId,
        set: {
          description: "Fallback owner for deleted groups",
          approvalStatus: "approved",
          publicationState: "published",
          deletedAt: null,
          deletedByUserId: null,
          deleteReason: null,
          updatedAt: relationTime,
        },
      })

    const mangaIds = new Map<string, string>()
    for (const item of fixture.manga) {
      const values = {
        ownerGroupId: systemGroup!.id,
        id: item.id,
        slug: item.slug,
        title: item.title,
        alternativeTitles: item.alternativeTitles as unknown as Record<
          string,
          string[]
        >,
        description: item.description,
        searchTitle: item.title.toLocaleLowerCase("en"),
        originalLanguage: item.originalLanguage,
        publicationDemographic: item.publicationDemographic,
        status: item.status as "ongoing" | "completed" | "hiatus" | "cancelled",
        contentRating: item.contentRating as
          "safe" | "suggestive" | "erotica" | "pornographic",
        publicationState: "published" as const,
        year: item.year,
        lastVolume: item.lastVolume,
        lastChapter: item.lastChapter,
        links: item.links,
        hasUsableChapters: fixture.chapters.some(
          (chapter) => chapter.mangaId === item.id && chapter.pages.length > 0
        ),
        latestChapterPublishedAt: instant(item.latestChapterPublishedAt),
        createdAt: instant(item.createdAt),
        updatedAt: instant(item.updatedAt),
        publishedAt: instant(item.publishedAt),
      }
      const [saved] = await tx
        .insert(manga)
        .values(values)
        .onConflictDoUpdate({ target: manga.id, set: values })
        .returning({ id: manga.id })
      mangaIds.set(item.id, saved!.id)

      await tx
        .insert(mangaGroup)
        .values({ mangaId: saved!.id, groupId: systemGroup!.id })
        .onConflictDoNothing()

      for (const tagId of item.tagIds) {
        await tx
          .insert(mangaTag)
          .values({ mangaId: saved!.id, tagId: tagIds.get(tagId)! })
          .onConflictDoNothing()
      }
      for (const language of item.languages) {
        await tx
          .insert(mangaLanguage)
          .values({ mangaId: saved!.id, language })
          .onConflictDoNothing()
      }
      for (const role of ["author", "artist"] as const) {
        await tx
          .insert(mangaPerson)
          .values({
            mangaId: saved!.id,
            personId: personIds.get(item.personId)!,
            role,
          })
          .onConflictDoNothing()
      }

      await tx
        .update(cover)
        .set({ isPrimary: false })
        .where(eq(cover.mangaId, saved!.id))
      const coverValues = {
        id: item.cover.id,
        mangaId: saved!.id,
        storageKey: `covers/${item.id}/${item.cover.id}.webp`,
        language: item.cover.language,
        width: item.cover.width,
        height: item.cover.height,
        isPrimary: true,
        createdAt: instant(item.createdAt),
        updatedAt: instant(item.updatedAt),
      }
      await tx
        .insert(cover)
        .values(coverValues)
        .onConflictDoUpdate({ target: cover.id, set: coverValues })
    }

    for (const item of fixture.chapters) {
      const mangaId = mangaIds.get(item.mangaId)!
      let volumeId: string | null = null
      if (item.volume) {
        const [existingVolume] = await tx
          .select({ id: mangaVolume.id })
          .from(mangaVolume)
          .where(
            and(
              eq(mangaVolume.mangaId, mangaId),
              eq(mangaVolume.number, item.volume),
              isNull(mangaVolume.deletedAt)
            )
          )
          .limit(1)
        const [savedVolume] = existingVolume
          ? [existingVolume]
          : await tx
              .insert(mangaVolume)
              .values({
                mangaId,
                number: item.volume,
                createdAt: relationTime,
                updatedAt: relationTime,
              })
              .returning({ id: mangaVolume.id })
        volumeId = savedVolume!.id
      }

      const pageCount = item.pages.length
      const values = {
        isDefault: true,
        ownerGroupId: systemGroup!.id,
        id: item.id,
        mangaId,
        volumeId,
        pagesVersion: 0,
        number: item.number,
        title: item.title,
        language: item.language,
        pageCount,
        availablePageCount: pageCount,
        isFull: pageCount > 0,
        publicationState: "published" as const,
        createdAt: instant(item.createdAt),
        updatedAt: instant(item.updatedAt),
        publishedAt: instant(item.publishedAt),
      }
      const [saved] = await tx
        .insert(chapter)
        .values(values)
        .onConflictDoUpdate({ target: chapter.id, set: values })
        .returning({ id: chapter.id })

      await tx
        .insert(chapterGroup)
        .values({ chapterId: saved!.id, groupId: systemGroup!.id })
        .onConflictDoNothing()
      await tx
        .delete(chapterTikTokReplica)
        .where(eq(chapterTikTokReplica.chapterId, saved!.id))
      for (const [position, [name, width, height]] of item.pages.entries()) {
        const pageValues = {
          chapterId: saved!.id,
          position,
          originalKey: `data/${item.id}/${name}`,
          width,
          height,
        }
        await tx
          .insert(chapterPage)
          .values(pageValues)
          .onConflictDoUpdate({
            target: [chapterPage.chapterId, chapterPage.position],
            set: pageValues,
          })
      }
    }

    return {
      manga: fixture.manga.length,
      readableChapters: fixture.chapters.filter(({ pages }) => pages.length > 0)
        .length,
      pages: fixture.chapters.reduce(
        (total, item) => total + item.pages.length,
        0
      ),
    }
  })
}
