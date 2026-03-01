import { siteConfig } from "@/config/site";
import { Manga, Relation, ChapterAggregateResponse } from "./model";
import { generateSlug } from "../utils";
import { ChapterAggregate } from "@/types/types";

/**
 * parse manga title from manga data
 * - title: vi > original title
 * - altTitles: flattened from alt_titles
 */
export const parseMangaTitle = (
  manga: Manga,
): {
  title: string;
  altTitles: string[];
} => {
  const viTitle = manga.alt_titles?.["vi"]?.[0];
  const title = viTitle ?? manga.title ?? "";

  const langPriority = (lang: string) => {
    if (lang === "en") return 0;
    if (lang === "ja") return 1;
    return 2;
  };

  const altTitlesRaw = Object.entries(manga.alt_titles ?? {})
    .filter(([lang]) => lang !== "vi")
    .sort(([a], [b]) => langPriority(a) - langPriority(b))
    .flatMap(([, values]) => values);

  const altTitles =
    viTitle && manga.title ? [manga.title, ...altTitlesRaw] : altTitlesRaw;

  return { title, altTitles };
};

export const parseRelationTitle = (
  rel: Relation,
): {
  title: string;
  altTitles: string[];
} => {
  const viTitle = rel.alt_titles?.["vi"]?.[0];
  const title = viTitle ?? rel.title ?? "";

  const langPriority = (lang: string) => {
    if (lang === "en") return 0;
    if (lang === "ja") return 1;
    return 2;
  };

  const altTitlesRaw = Object.entries(rel.alt_titles ?? {})
    .filter(([lang]) => lang !== "vi")
    .sort(([a], [b]) => langPriority(a) - langPriority(b))
    .flatMap(([, values]) => values);

  const altTitles =
    viTitle && rel.title ? [rel.title, ...altTitlesRaw] : altTitlesRaw;

  return { title, altTitles };
};

export const generateJsonLd = (manga: Manga) => {
  const { title } = parseMangaTitle(manga);
  const description =
    manga.description || `Đọc truyện ${manga.title} - SuicaoDex`;
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    mainEntityOfPage: `${process.env.SITE_URL}/manga/${manga.id}/${generateSlug(
      title,
    )}`,
    headline: `${title}`,
    description: description,
    image: {
      "@type": "ImageObject",
      url: `${siteConfig.weebdex.ogURL}/og-image/manga/${manga.id}`,
      width: 1280,
      height: 960,
    },
  };
};

const GOOGLE_API_FAVICON = "https://www.google.com/s2/favicons";
export const generateFaviconURL = (site: string, size: number) => {
  return `${GOOGLE_API_FAVICON}?sz=${size}&domain=${site}`;
};

/**
 * Convert WeebDex ChapterAggregateResponse to reader's ChapterAggregate[] format.
 * Volumes and chapters are sorted in descending order (newest first).
 * If currentChapterId is provided, it will be placed as the primary id in its entry.
 */
export function toReaderAggregate(
  response: ChapterAggregateResponse,
  currentChapterId?: string,
): ChapterAggregate[] {
  // Group chapters by volume
  const volumeMap = new Map<string, { chapter: string; ids: string[] }[]>();

  for (const agg of response.chapters ?? []) {
    const vol = agg.volume ?? "none";
    const chapter = agg.chapter ?? "none";
    const entryIds = Object.keys(agg.entries ?? {});

    if (!volumeMap.has(vol)) volumeMap.set(vol, []);
    volumeMap.get(vol)!.push({ chapter, ids: entryIds });
  }

  // Sort volumes descending (numeric, "none" treated as Infinity → appears first)
  const sortedVols = Array.from(volumeMap.entries()).sort(([a], [b]) => {
    const na = a === "none" ? Infinity : parseFloat(a);
    const nb = b === "none" ? Infinity : parseFloat(b);
    return nb - na;
  });

  return sortedVols.map(([vol, chapters]) => ({
    vol,
    chapters: chapters
      // Sort chapters descending (newest first), "none" treated as 0
      .sort((a, b) => {
        const na = a.chapter === "none" ? 0 : parseFloat(a.chapter);
        const nb = b.chapter === "none" ? 0 : parseFloat(b.chapter);
        return nb - na;
      })
      .map(({ chapter, ids }) => {
        // Prioritise the currently-reading chapter ID as the primary id
        let orderedIds = ids;
        if (currentChapterId && ids.includes(currentChapterId)) {
          orderedIds = [
            currentChapterId,
            ...ids.filter((id) => id !== currentChapterId),
          ];
        }
        return {
          id: orderedIds[0] ?? "",
          chapter,
          other: orderedIds.length > 1 ? orderedIds.slice(1) : undefined,
        };
      }),
  }));
}

