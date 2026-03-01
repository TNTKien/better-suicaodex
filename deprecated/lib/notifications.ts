import { Chapter } from "@/types/types";
import { getChaptersByIds, getMangasByIDs } from "./mangadex/history";

export async function getUnreadChapters(ids: string[]): Promise<Chapter[]> {
  if (ids.length === 0) return [];
  const chapters = await getChaptersByIds(ids);

  const mangaIDs = chapters
    .map((chapter) => chapter.manga?.id)
    .filter((id): id is string => !!id);
  const mangas = await getMangasByIDs(mangaIDs);

  return chapters.map((chapter) => {
    const relatedManga = mangas.find((manga) => manga.id === chapter.manga.id);
    if (relatedManga) {
      return {
        ...chapter,
        manga: {
          ...chapter.manga,
          title: relatedManga.title,
          cover: relatedManga.cover,
        },
      };
    }
    return chapter;
  });
}
