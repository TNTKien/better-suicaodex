import { Chapter, Manga } from "@/types/types";
import { axiosWithProxyFallback } from "../axios";
import { MangaParser } from "./manga";
import { ChapterParser } from "./chapter";

export async function fetchHistory(
  m_ids: string[],
  c_ids: string[]
): Promise<Chapter[]> {
    if (m_ids.length === 0 || c_ids.length === 0 || m_ids.length !== c_ids.length) return [];
    const mangaRequest = getMangasByIDs(m_ids);
    const chapterRequest = getChaptersByIds(c_ids);
    
    const [mangas, chapters] = await Promise.all([mangaRequest, chapterRequest]);

    return chapters.map(chapter => {
      const relatedManga = mangas.find(manga => manga.id === chapter.manga.id);
      if (relatedManga) {
        return {
          ...chapter,
          manga: {
            ...chapter.manga,
            title: relatedManga.title,
            cover: relatedManga.cover
          }
        };
      }
      return chapter;
    });
}

export async function getMangasByIDs(ids: string[]): Promise<Manga[]> {
  if (ids.length === 0) return [];

  const chunkSize = 100;
  const chunks = [];

  for (let i = 0; i < ids.length; i += chunkSize) {
    chunks.push(ids.slice(i, i + chunkSize));
  }

  const requests = chunks.map((chunk) =>
    axiosWithProxyFallback({
      url: `/manga`,
      method: "get",
      params: {
        limit: chunk.length,
        ids: chunk,
        includes: ["cover_art", "author", "artist"],
        contentRating: ["safe", "suggestive", "erotica", "pornographic"],
      },
    })
  );

  const responses = await Promise.all(requests);
  const mangas = responses.flatMap((response) => response.data);

  return mangas.map((item: any) => MangaParser(item));
}

export async function getChaptersByIds(ids: string[]): Promise<Chapter[]> {
  if (ids.length === 0) return [];

  const chunkSize = 100;
  const chunks = [];

  for (let i = 0; i < ids.length; i += chunkSize) {
    chunks.push(ids.slice(i, i + chunkSize));
  }

  const requests = chunks.map((chunk) =>
    axiosWithProxyFallback({
      url: `/chapter`,
      method: "get",
      params: {
        limit: chunk.length,
        ids: chunk,
        contentRating: ["safe", "suggestive", "erotica", "pornographic"],
        translatedLanguage: ["vi", "en"],
        includes: ["scanlation_group"],
        order:{
          readableAt: "desc"
        }
      },
    })
  );
  const responses = await Promise.all(requests);
  const chapters = responses.flatMap((response) => response.data);

  return chapters.map((item: any) => ChapterParser(item));
}
