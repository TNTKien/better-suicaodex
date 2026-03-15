const GOOGLE_API_FAVICON = "https://www.google.com/s2/favicons";
export const generateFaviconURL = (site: string, size: number = 32) => {
  return `${GOOGLE_API_FAVICON}?sz=${size}&domain=${site}`;
};

/* ============================================================
   1. Link Keys
============================================================ */

export type MangaLinkKey =
  | "al"
  | "ap"
  | "bw"
  | "cdj"
  | "ebj"
  | "mal"
  | "mu"
  | "nu"
  | "amz"
  | "engtl"
  | "raw"
  | "kt";

/* ============================================================
   2. Raw Manga Links Type
============================================================ */

export type MangaMangaLinks = Partial<Record<MangaLinkKey, string>>;

/* ============================================================
   3. Metadata
============================================================ */

export type MangaLinkType = "database" | "store" | "official" | "other";

export interface MangaLinkMeta {
  key: MangaLinkKey;
  name: string;
  siteName: string;
  baseDomain: string;
  type: MangaLinkType;
  isIdBased: boolean;
}

export const Manga_LINK_METADATA: Record<MangaLinkKey, MangaLinkMeta> = {
  al: {
    key: "al",
    name: "AniList",
    siteName: "AniList",
    baseDomain: "anilist.co",
    type: "database",
    isIdBased: true,
  },
  mal: {
    key: "mal",
    name: "MyAnimeList",
    siteName: "MyAnimeList",
    baseDomain: "myanimelist.net",
    type: "database",
    isIdBased: true,
  },
  mu: {
    key: "mu",
    name: "MangaUpdates",
    siteName: "MangaUpdates",
    baseDomain: "mangaupdates.com",
    type: "database",
    isIdBased: true,
  },
  kt: {
    key: "kt",
    name: "Kitsu",
    siteName: "Kitsu",
    baseDomain: "kitsu.io",
    type: "database",
    isIdBased: true,
  },
  ap: {
    key: "ap",
    name: "Anime-Planet",
    siteName: "Anime-Planet",
    baseDomain: "anime-planet.com",
    type: "database",
    isIdBased: true,
  },
  nu: {
    key: "nu",
    name: "NovelUpdates",
    siteName: "NovelUpdates",
    baseDomain: "novelupdates.com",
    type: "database",
    isIdBased: true,
  },
  bw: {
    key: "bw",
    name: "BookWalker",
    siteName: "BookWalker",
    baseDomain: "bookwalker.jp",
    type: "store",
    isIdBased: true,
  },
  cdj: {
    key: "cdj",
    name: "CDJapan",
    siteName: "CDJapan",
    baseDomain: "cdjapan.co.jp",
    type: "store",
    isIdBased: false,
  },
  ebj: {
    key: "ebj",
    name: "ebookjapan",
    siteName: "ebookjapan.yahoo.co.jp",
    baseDomain: "ebookjapan.yahoo.co.jp",
    type: "store",
    isIdBased: false,
  },
  amz: {
    key: "amz",
    name: "Amazon",
    siteName: "Amazon",
    baseDomain: "amazon.co.jp",
    type: "store",
    isIdBased: false,
  },
  engtl: {
    key: "engtl",
    name: "Official English",
    siteName: "Official English Publisher",
    baseDomain: "",
    type: "official",
    isIdBased: false,
  },
  raw: {
    key: "raw",
    name: "Raw",
    siteName: "Original Source",
    baseDomain: "",
    type: "official",
    isIdBased: false,
  },
};

/* ============================================================
   4. URL Resolvers
============================================================ */

export const Manga_LINK_RESOLVERS: Partial<
  Record<MangaLinkKey, (value: string) => string>
> = {
  al: (id) => `https://anilist.co/manga/${id}`,
  mal: (id) => `https://myanimelist.net/manga/${id}`,
  mu: (id) => `https://www.mangaupdates.com/series/${id}`,
  kt: (id) => `https://kitsu.io/manga/${id}`,
  ap: (slug) => `https://www.anime-planet.com/manga/${slug}`,
  bw: (id) => `https://bookwalker.jp/${id}`,
};

/* ============================================================
   5. Resolve Full URL
============================================================ */

export function resolveMangaLink(key: MangaLinkKey, value: string): string {
  const resolver = Manga_LINK_RESOLVERS[key];
  if (resolver) return resolver(value);
  return value;
}

function parseMangaLinkURL(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/* ============================================================
   6. UI Ready Normalizer (with favicon)
============================================================ */

export interface ResolvedMangaLink {
  key: MangaLinkKey;
  name: string;
  siteName: string;
  type: MangaLinkType;
  url: string;
  faviconUrl?: string;
}

export function normalizeMangaLinks(
  links: MangaMangaLinks,
  faviconSize: number = 32,
): ResolvedMangaLink[] {
  return Object.entries(links)
    .filter((entry): entry is [MangaLinkKey, string] => {
      const [key, value] = entry;
      return Boolean(value) && key in Manga_LINK_METADATA;
    })
    .flatMap(([key, value]) => {
      const meta = Manga_LINK_METADATA[key];

      const url = resolveMangaLink(key, value);
      const parsedUrl = parseMangaLinkURL(url);

      if (!parsedUrl) return [];

      const domain = meta.baseDomain || parsedUrl.hostname;

      return [
        {
          key,
          name: meta.name,
          siteName: meta.siteName,
          type: meta.type,
          url,
          faviconUrl: domain
            ? generateFaviconURL(domain, faviconSize)
            : undefined,
        },
      ];
    });
}
