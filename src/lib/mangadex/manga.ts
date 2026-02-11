import { axiosWithProxyFallback } from "../axios";
import {
  Artist,
  Author,
  Chapter,
  Manga,
  MangasStats,
  MangaStats,
  Tag,
} from "@/types/types";
import { ChaptersParser } from "./chapter";
import { siteConfig } from "@/config/site";
import { MangaDexApiResponse } from "@/types/mangadex-api";
import {
  AuthorAttributes,
  CoverArtAttributes,
  MangaData,
  MangaTag,
  Relationship,
} from "@/types/manga";

function getPreferredTitle(
  titles: Record<string, string>,
  altTitles: Record<string, string>[],
) {
  const allTitles: Record<string, string> = { ...titles };
  altTitles.forEach((t) => {
    const key = Object.keys(t)[0];
    allTitles[key] = t[key];
  });

  const vi = allTitles.vi;
  const en = allTitles.en;
  const jaRo = allTitles["ja-ro"]; // Romaji
  const ja = allTitles.ja;
  const original = Object.values(titles)[0]; // Title gốc (key bất kỳ)

  // Ưu tiên: Tiếng Việt > Tiếng Anh > Romaji > Gốc
  const mainTitle = vi || en || jaRo || original || "Untitled";

  // Nếu main là Vi -> Alt là En hoặc Romaji
  // Nếu main là En -> Alt là Romaji hoặc Ja
  let subTitle: string | null = null;

  if (mainTitle === vi) subTitle = en || jaRo || ja;
  else if (mainTitle === en) subTitle = jaRo || ja;
  else if (mainTitle === jaRo) subTitle = ja;

  return { mainTitle, subTitle };
}

// Helper: Parse Author/Artist từ Relationships
function getCreators(
  relationships: Relationship[],
  type: "author" | "artist",
): Author[] | Artist[] {
  return relationships
    .filter((r) => r.type === type)
    .map((r) => ({
      id: r.id,
      name: (r.attributes as AuthorAttributes).name,
    }));
}

// Helper: Parse Tags
function getTags(rawTags: MangaTag[]): Tag[] {
  return rawTags.map((tag) => ({
    id: tag.id,
    name: tag.attributes.name.en || "Unknown",
    group: tag.attributes.group,
  }));
}

export function MangaParser(data: MangaData): Manga {
  const attr = data.attributes;
  const rels = data.relationships;

  // Xử lý Title
  const { mainTitle, subTitle } = getPreferredTitle(attr.title, attr.altTitles);

  // Xử lý Description (Ưu tiên Vi -> En -> Fallback)
  const descContent =
    attr.description.vi ||
    attr.description.en ||
    Object.values(attr.description)[0] ||
    "";

  // Xác định language của description
  const descLang: "vi" | "en" = attr.description.vi ? "vi" : "en";

  // Xử lý Cover Art
  const coverRel = rels.find((r) => r.type === "cover_art");
  const coverFileName = coverRel?.attributes
    ? (coverRel.attributes as CoverArtAttributes).fileName
    : null;

  return {
    id: data.id,
    title: mainTitle,
    altTitle: subTitle,
    // Flat map lấy tất cả value của altTitles
    altTitles: attr.altTitles.map((t) => Object.values(t)[0]),

    language: attr.availableTranslatedLanguages,

    description: {
      language: descLang,
      content: descContent,
    },

    tags: getTags(attr.tags),
    author: getCreators(rels, "author"),
    artist: getCreators(rels, "artist"),

    cover: coverFileName,

    contentRating: attr.contentRating,
    status: attr.status,

    raw: attr.links?.raw ?? undefined,

    finalChapter: attr.lastChapter ?? undefined,

    latestChapter: attr.latestUploadedChapter ?? undefined,
  };
}

export function MangaStatsParser(data: any, id: string): MangaStats {
  const distribution = data.statistics[id].rating.distribution;

  // Find the max value in the distribution
  const max = Math.max(...Object.values(distribution));

  return {
    rating: {
      bayesian: data.statistics[id].rating.bayesian,
      distribution: {
        "1": distribution["1"],
        "2": distribution["2"],
        "3": distribution["3"],
        "4": distribution["4"],
        "5": distribution["5"],
        "6": distribution["6"],
        "7": distribution["7"],
        "8": distribution["8"],
        "9": distribution["9"],
        "10": distribution["10"],
      },
      max: max,
    },
    follows: data.statistics[id].follows,
    comments: data.statistics[id].comments
      ? data.statistics[id].comments.repliesCount
      : 0,
  };
}

export async function fetchMangaDetail(id: string): Promise<Manga> {
  const [mangaResponse, stats] = await Promise.all([
    axiosWithProxyFallback<MangaDexApiResponse>({
      url: `/manga/${id}?`,
      method: "get",
      params: {
        includes: ["author", "artist", "cover_art"],
      },
    }),
    getMangaStats(id),
  ]);

  if (mangaResponse.result !== "ok") {
    throw new Error("Failed to fetch manga detail from MangaDex");
  }

  const manga = MangaParser(mangaResponse.data);
  manga.stats = stats;

  return manga;
}

export async function getMangaStats(id: string): Promise<MangaStats> {
  try {
    const data = await axiosWithProxyFallback({
      url: `/statistics/manga/${id}`,
      method: "get",
    });
    return MangaStatsParser(data, id);
  } catch (error) {
    console.log(error);
    return {
      rating: {
        bayesian: 0,
        distribution: {
          "1": 0,
          "2": 0,
          "3": 0,
          "4": 0,
          "5": 0,
          "6": 0,
          "7": 0,
          "8": 0,
          "9": 0,
          "10": 0,
        },
        max: 0,
      },
      follows: 0,
      comments: 0,
    };
  }
}

export async function getMangasStats(ids: string[]): Promise<MangasStats[]> {
  try {
    const data = await axiosWithProxyFallback({
      url: `/statistics/manga?`,
      method: "get",
      params: {
        manga: ids,
      },
    });
    return ids.map((id: any) => MangasStatsParser(data, id));
  } catch (error) {
    console.log(error);
    return ids.map(() => ({
      rating: {
        bayesian: 0,
        distribution: {
          "1": 0,
          "2": 0,
          "3": 0,
          "4": 0,
          "5": 0,
          "6": 0,
          "7": 0,
          "8": 0,
          "9": 0,
          "10": 0,
        },
        max: 0,
      },
      follows: 0,
      comments: 0,
    }));
  }
}

export function MangasStatsParser(data: any, id: string): MangasStats {
  return {
    rating: {
      bayesian: data.statistics[id].rating.bayesian,
    },
    follows: data.statistics[id].follows,
    comments: data.statistics[id].comments
      ? data.statistics[id].comments.repliesCount
      : 0,
  };
}

export async function getFirstChapter(
  id: string,
  r18: boolean,
): Promise<{
  en: string;
  vi: string;
}> {
  const params = {
    limit: 1,
    contentRating: r18
      ? ["safe", "suggestive", "erotica", "pornographic"]
      : ["safe", "suggestive", "erotica"],
    order: {
      volume: "asc",
      chapter: "asc",
    },
  };
  const [{ data: en }, { data: vi }] = await Promise.all([
    axiosWithProxyFallback({
      url: `/manga/${id}/feed`,
      method: "get",
      params: {
        ...params,
        translatedLanguage: ["en"],
      },
    }),
    axiosWithProxyFallback({
      url: `/manga/${id}/feed`,
      method: "get",
      params: {
        ...params,
        translatedLanguage: ["vi"],
      },
    }),
  ]);

  return {
    en: en.data[0]?.id,
    vi: vi.data[0]?.id,
  };
}

export async function FirstViChapter(
  id: string,
  r18: boolean,
): Promise<Chapter> {
  const data = await axiosWithProxyFallback({
    url: `/manga/${id}/feed`,
    method: "get",
    params: {
      limit: 1,
      contentRating: r18
        ? ["safe", "suggestive", "erotica", "pornographic"]
        : ["safe", "suggestive", "erotica"],
      order: {
        volume: "asc",
        chapter: "asc",
      },
      translatedLanguage: ["vi"],
      includes: ["scanlation_group", "manga"],
    },
  });
  return ChaptersParser(data.data)[0];
}

export async function FirstEnChapter(
  id: string,
  r18: boolean,
): Promise<Chapter> {
  const data = await axiosWithProxyFallback({
    url: `/manga/${id}/feed`,
    method: "get",
    params: {
      limit: 1,
      contentRating: r18
        ? ["safe", "suggestive", "erotica", "pornographic"]
        : ["safe", "suggestive", "erotica"],
      order: {
        volume: "asc",
        chapter: "asc",
      },
      translatedLanguage: ["en"],
      includes: ["scanlation_group", "manga"],
    },
  });
  return ChaptersParser(data.data)[0];
}

export async function FirstChapters(
  id: string, //manga id
  r18: boolean,
  translatedLanguage: ("vi" | "en")[],
  volume?: string,
  chapter?: string,
): Promise<Chapter[]> {
  const data = await axiosWithProxyFallback({
    url: `/chapter`,
    method: "get",
    params: {
      manga: id,
      volume: volume || "none",
      chapter: chapter || "none",
      limit: 100,
      contentRating: r18
        ? ["safe", "suggestive", "erotica", "pornographic"]
        : ["safe", "suggestive", "erotica"],
      order: {
        volume: "asc",
        chapter: "asc",
      },
      translatedLanguage: translatedLanguage,
      includes: ["scanlation_group", "manga"],
    },
  });
  return ChaptersParser(data.data);
}

export async function SearchManga(
  query: string,
  r18: boolean,
): Promise<Manga[]> {
  const data = await axiosWithProxyFallback({
    url: "/manga?",
    method: "get",
    params: {
      limit: 20,
      title: query,
      contentRating: r18
        ? ["safe", "suggestive", "erotica", "pornographic"]
        : ["safe", "suggestive", "erotica"],
      includes: ["author", "artist", "cover_art"],
      order: {
        relevance: "desc",
      },
    },
  });
  const mangas = data.data.map((item: any) => MangaParser(item));
  if (mangas.length === 0) return [];

  const stats = await getMangasStats(mangas.map((manga: Manga) => manga.id));

  return mangas.map((manga: Manga, index: number) => ({
    ...manga,
    stats: stats[index],
  }));
}

export async function getPopularMangas(
  language: ("vi" | "en")[],
  r18: boolean,
): Promise<Manga[]> {
  const data = await axiosWithProxyFallback({
    url: `/manga?`,
    method: "get",
    params: {
      limit: 10,
      includes: ["cover_art", "author", "artist"],
      contentRating: r18
        ? ["safe", "suggestive", "erotica", "pornographic"]
        : ["safe", "suggestive", "erotica"],
      hasAvailableChapters: "true",
      availableTranslatedLanguage: language,
      order: {
        followedCount: "desc",
      },
      createdAtSince: new Date(new Date().setDate(new Date().getDate() - 30))
        .toISOString()
        .slice(0, 19),
    },
  });

  return data.data.map((item: any) => MangaParser(item));
}

export async function getRecentlyMangas(
  limit: number,
  language: ("vi" | "en")[],
  r18: boolean,
  offset?: number,
): Promise<{
  mangas: Manga[];
  total: number;
}> {
  const max_total = 10000;
  const safeOffset = offset || 0;
  if (limit + safeOffset > max_total) {
    limit = max_total - safeOffset;
  }
  const data = await axiosWithProxyFallback({
    url: `/manga?`,
    method: "get",
    params: {
      limit: limit,
      offset: safeOffset,
      includes: ["cover_art", "author", "artist"],
      availableTranslatedLanguage: language,
      contentRating: r18
        ? ["safe", "suggestive", "erotica", "pornographic"]
        : ["safe", "suggestive", "erotica"],
      order: {
        createdAt: "desc",
      },
    },
  });
  const total = data.total > max_total ? max_total : data.total;

  return {
    mangas: data.data.map((item: any) => MangaParser(item)),
    total: total,
  };
}

export async function getTopFollowedMangas(
  language: ("vi" | "en")[],
  r18: boolean,
): Promise<Manga[]> {
  const params: any = {
    limit: 10,
    includes: ["cover_art", "author", "artist"],
    availableTranslatedLanguage: language,
    hasAvailableChapters: "true",
    contentRating: r18
      ? ["safe", "suggestive", "erotica", "pornographic"]
      : ["safe", "suggestive", "erotica"],
    order: {
      followedCount: "desc",
    },
  };

  const data = await axiosWithProxyFallback({
    url: `/manga?`,
    method: "get",
    params,
  });

  const mangas = data.data.map((item: any) => MangaParser(item));
  const stats = await getMangasStats(mangas.map((manga: Manga) => manga.id));

  return mangas.map((manga: Manga, index: number) => ({
    ...manga,
    stats: stats[index],
  }));
}

export async function getTopRatedMangas(
  language: ("vi" | "en")[],
  r18: boolean,
): Promise<Manga[]> {
  const data = await axiosWithProxyFallback({
    url: `/manga?`,
    method: "get",
    params: {
      limit: 10,
      includes: ["cover_art", "author", "artist"],
      hasAvailableChapters: "true",
      availableTranslatedLanguage: language,
      contentRating: r18
        ? ["safe", "suggestive", "erotica", "pornographic"]
        : ["safe", "suggestive", "erotica"],
      order: {
        rating: "desc",
      },
    },
  });

  const mangas = data.data.map((item: any) => MangaParser(item));
  const stats = await getMangasStats(mangas.map((manga: Manga) => manga.id));

  return mangas.map((manga: Manga, index: number) => ({
    ...manga,
    stats: stats[index],
  }));
}

export async function getStaffPickMangas(r18: boolean): Promise<Manga[]> {
  const staffPickList = siteConfig.mangadexAPI.staffPickList;
  const seasonalList = siteConfig.mangadexAPI.seasonalList;

  // Randomly choose between staffPickList and seasonalList
  const selectedList = Math.random() < 0.5 ? staffPickList : seasonalList;

  const StaffPickID = await axiosWithProxyFallback({
    url: `/list/${selectedList}`,
    method: "get",
  }).then((res) =>
    res.data.relationships
      .filter((item: any) => item.type === "manga")
      .map((item: any) => item.id),
  );

  if (StaffPickID.length === 0) return [];

  const limit = Math.min(32, StaffPickID.length);
  const maxOffset = Math.max(StaffPickID.length - limit, 0);

  const data = await axiosWithProxyFallback({
    url: `/manga?`,
    method: "get",
    params: {
      limit,
      offset:
        selectedList === seasonalList
          ? Math.floor(Math.random() * (maxOffset + 1))
          : 0,
      includes: ["cover_art", "author", "artist"],
      // hasAvailableChapters: "true",
      // availableTranslatedLanguage: ["vi"],
      contentRating: r18
        ? ["safe", "suggestive", "erotica", "pornographic"]
        : ["safe", "suggestive", "erotica"],
      ids: StaffPickID,
      order: {
        rating: "desc",
      },
    },
  });

  // Parse the data and then shuffle the results before returning
  const mangaResults = data.data.map((item: any) => MangaParser(item));

  // Fisher-Yates shuffle algorithm to randomize the order
  for (let i = mangaResults.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [mangaResults[i], mangaResults[j]] = [mangaResults[j], mangaResults[i]];
  }

  return mangaResults;
}

export async function getCompletedMangas(
  language: ("vi" | "en")[],
  r18: boolean,
): Promise<Manga[]> {
  const data = await axiosWithProxyFallback({
    url: `/manga?`,
    method: "get",
    params: {
      limit: 32,
      includes: ["cover_art", "author", "artist"],
      hasAvailableChapters: "true",
      availableTranslatedLanguage: language,
      contentRating: r18
        ? ["safe", "suggestive", "erotica", "pornographic"]
        : ["safe", "suggestive", "erotica"],
      status: ["completed"],
    },
  });

  return data.data.map((item: any) => MangaParser(item));
}

export async function getRecommendedMangas(
  id: string,
  r18: boolean,
): Promise<Manga[]> {
  const rcmData = await axiosWithProxyFallback({
    url: `/manga/${id}/recommendation`,
    method: "get",
  });

  //filter "type": "manga_recommendation"
  const mangaIDs = rcmData.data
    .filter((item: any) => item.type === "manga_recommendation")
    .map((item: any) => item.id.split("_")[1]);

  if (mangaIDs.length === 0) return [];

  const mangasData = await axiosWithProxyFallback({
    url: "/manga",
    method: "get",
    params: {
      limit: 100,
      ids: mangaIDs,
      includes: ["cover_art", "author", "artist"],
      contentRating: r18
        ? ["safe", "suggestive", "erotica", "pornographic"]
        : ["safe", "suggestive", "erotica"],
    },
  });

  return mangasData.data.map((m: any) => MangaParser(m));
}

export async function getTotalMangas(): Promise<number> {
  const data = await axiosWithProxyFallback({
    url: `/manga`,
    method: "get",
    params: {
      availableTranslatedLanguage: ["vi"],
    },
  });
  if (data.total > 10000) return 10000;

  return data.total;
}
