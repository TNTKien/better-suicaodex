export const MOETRUYEN_API_URL = "https://moe.suicaodex.com";
export const MOETRUYEN_SITE_URL = "https://moetruyen.net";
export const MOETRUYEN_RANDOM_HOME_LIMIT = 7;

interface MoetruyenGenre {
  id: number;
  name: string;
}

interface MoetruyenRandomMangaPayload {
  id: number;
  slug: string;
  title: string;
  author: string | null;
  coverUrl: string | null;
  genres: MoetruyenGenre[];
}

export interface MoetruyenHomeManga {
  id: number;
  slug: string;
  title: string;
  author: string | null;
  coverUrl: string | null;
  tags: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getString(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function getNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeGenres(value: unknown): MoetruyenGenre[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((genre) => {
      if (!isRecord(genre)) return null;

      const id = getNumber(genre.id);
      const name = getString(genre.name);

      if (id === null || name === null) return null;

      return {
        id,
        name,
      } satisfies MoetruyenGenre;
    })
    .filter((genre): genre is MoetruyenGenre => genre !== null);
}

function normalizeRandomMangaItem(
  value: unknown,
): MoetruyenRandomMangaPayload | null {
  if (!isRecord(value)) return null;

  const id = getNumber(value.id);
  const slug = getString(value.slug);
  const title = getString(value.title);

  if (id === null || slug === null || title === null) {
    return null;
  }

  return {
    id,
    slug,
    title,
    author: getString(value.author),
    coverUrl: getString(value.coverUrl),
    genres: normalizeGenres(value.genres),
  } satisfies MoetruyenRandomMangaPayload;
}

function normalizeRandomMangaResponse(payload: unknown): MoetruyenHomeManga[] {
  if (!isRecord(payload) || !Array.isArray(payload.data)) {
    throw new Error("Invalid Moetruyen random manga response");
  }

  return payload.data
    .map(normalizeRandomMangaItem)
    .filter((manga): manga is MoetruyenRandomMangaPayload => manga !== null)
    .map((manga) => ({
      id: manga.id,
      slug: manga.slug,
      title: manga.title,
      author: manga.author,
      coverUrl: manga.coverUrl,
      tags: manga.genres.slice(0, 2).map((genre) => genre.name),
    }));
}

export async function getMoetruyenRandomManga(
  limit = MOETRUYEN_RANDOM_HOME_LIMIT,
): Promise<MoetruyenHomeManga[]> {
  const normalizedLimit = Math.min(Math.max(Math.trunc(limit), 1), 10);
  const url = new URL("/v1/manga/random", MOETRUYEN_API_URL);
  url.searchParams.set("limit", normalizedLimit.toString());

  const response = await fetch("https://cors.iamneyk.workers.dev?url=" + url.toString(), {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch Moetruyen random manga");
  }

  const payload = (await response.json()) as unknown;
  return normalizeRandomMangaResponse(payload);
}

export function getMoetruyenMangaUrl(slug: string) {
  return `${MOETRUYEN_SITE_URL}/manga/${slug}`;
}
