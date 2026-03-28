import type { GetV1ChaptersById200Data } from "@/lib/moetruyen/model/getV1ChaptersById200Data";
import type { GetV1ChaptersById200DataNextChapter } from "@/lib/moetruyen/model/getV1ChaptersById200DataNextChapter";
import type { GetV1ChaptersById200DataPrevChapter } from "@/lib/moetruyen/model/getV1ChaptersById200DataPrevChapter";
import type { GetV1MangaByIdChapters200DataChaptersItem } from "@/lib/moetruyen/model/getV1MangaByIdChapters200DataChaptersItem";

type ChapterTitleInput = {
  number: number;
  numberText: string | null;
  title: string | null;
  isOneshot?: boolean;
};

export function getMoeChapterNumber(
  chapter: Pick<ChapterTitleInput, "number" | "numberText" | "isOneshot">,
) {
  if (chapter.isOneshot) {
    return "Oneshot";
  }

  const chapterNumber = chapter.number ?? String(chapter.number);
  return `Ch. ${chapterNumber}`;
}

export function formatMoeChapterTitle(chapter: ChapterTitleInput) {
  const baseTitle = getMoeChapterNumber(chapter);

  return baseTitle;
}

export function getMoeChapterHref(id: number | string) {
  return `/moetruyen/chapter/${id}`;
}

export function getMoeMangaHref(
  manga: Pick<GetV1ChaptersById200Data["manga"], "id" | "slug">,
) {
  return `/moetruyen/manga/${manga.id}/${manga.slug}`;
}

export function getAdjacentChapterHref(
  chapter:
    | GetV1ChaptersById200DataPrevChapter
    | GetV1ChaptersById200DataNextChapter,
) {
  if (!chapter) {
    return undefined;
  }

  return getMoeChapterHref(chapter.id);
}

export function sortMoeChaptersForSelect(
  chapters: GetV1MangaByIdChapters200DataChaptersItem[],
) {
  return [...chapters].sort((a, b) => {
    const aNumber = a.number;
    const bNumber = b.number;

    if (aNumber === bNumber) {
      return a.id - b.id;
    }

    return bNumber - aNumber;
  });
}
