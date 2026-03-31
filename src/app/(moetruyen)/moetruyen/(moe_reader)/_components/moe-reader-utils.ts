import type { GetV2ChaptersById200Data } from "@/lib/moetruyen/model/getV2ChaptersById200Data";
import type { GetV2ChaptersById200DataNextChapter } from "@/lib/moetruyen/model/getV2ChaptersById200DataNextChapter";
import type { GetV2ChaptersById200DataPrevChapter } from "@/lib/moetruyen/model/getV2ChaptersById200DataPrevChapter";
import type { GetV2MangaByIdChapters200DataChaptersItem } from "@/lib/moetruyen/model/getV2MangaByIdChapters200DataChaptersItem";

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
  manga: Pick<GetV2ChaptersById200Data["manga"], "id" | "slug">,
) {
  return `/moetruyen/manga/${manga.id}/${manga.slug}`;
}

export function getAdjacentChapterHref(
  chapter:
    | GetV2ChaptersById200DataPrevChapter
    | GetV2ChaptersById200DataNextChapter,
) {
  if (!chapter) {
    return undefined;
  }

  return getMoeChapterHref(chapter.id);
}

export function sortMoeChaptersForSelect(
  chapters: GetV2MangaByIdChapters200DataChaptersItem[],
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
