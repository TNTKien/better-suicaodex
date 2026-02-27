import { siteConfig } from "@/config/site";
import { Manga, Relation } from "./model";
import { generateSlug } from "../utils";

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
