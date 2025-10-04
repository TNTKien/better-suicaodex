import { Chapter, ChapterAggregate, Volume } from "@/types/types";
import { GroupParser } from "./group";
import { axiosWithProxyFallback } from "../axios";
import { getCurrentApiUrl } from "../utils";

export function ChaptersParser(data: any[]): Chapter[] {
  return data.map((item) => {
    const mangaData = item.relationships.find(
      (item: any) => item.type === "manga"
    );

    const groups = item.relationships
      .filter((item: any) => item.type === "scanlation_group")
      .map((item: any) => GroupParser(item));

    return {
      id: item.id,
      vol: item.attributes.volume,
      chapter: item.attributes.chapter,
      title: item.attributes.title,
      updatedAt: item.attributes.updatedAt,
      externalUrl: item.attributes.externalUrl,
      language: item.attributes.translatedLanguage,
      group: groups,
      manga: {
        id: mangaData.id,
      },
      isUnavailable: item.attributes.isUnavailable,
    };
  });
}

export function ChapterParser(data: any): Chapter {
  const mangaData = data.relationships.find(
      (item: any) => item.type === "manga"
    );

    const groups = data.relationships
      .filter((item: any) => item.type === "scanlation_group")
      .map((item: any) => GroupParser(item));

    return {
      id: data.id,
      vol: data.attributes.volume,
      chapter: data.attributes.chapter,
      title: data.attributes.title,
      updatedAt: data.attributes.updatedAt,
      externalUrl: data.attributes.externalUrl,
      language: data.attributes.translatedLanguage,
      group: groups,
      manga: {
        id: mangaData.id,
      },
    };
}

export function groupChaptersByVolume(chapters: Chapter[]): Volume[] {
  const volumeMap: { [key: string]: Volume } = {};

  chapters.forEach((chapter) => {
    const { vol, chapter: chapNum } = chapter;

    // Create the volume if it doesn't exist
    if (!volumeMap[vol]) {
      volumeMap[vol] = { vol, chapters: [] };
    }

    // Find or create the chapter group within the volume
    let chapterGroup = volumeMap[vol].chapters.find(
      (group) => group.chapter === chapNum
    );

    if (!chapterGroup) {
      chapterGroup = { chapter: chapNum, group: [] };
      volumeMap[vol].chapters.push(chapterGroup);
    }

    // Add the chapter to the chapter group
    chapterGroup.group.push(chapter);
  });
  //Sort the volume by volume number, from highest to lowest, if the volume is not a number, it will be placed at the start

  const sortedVolumeMap = Object.keys(volumeMap).sort((a, b) => {
    if (a === "null") return -1;
    if (b === "null") return 1;

    return b.localeCompare(a, undefined, { numeric: true });
  });

  // Convert the volume map to an array of volumes
  return sortedVolumeMap.map((vol) => volumeMap[vol]);
}

export async function getChapterVolume(
  mangaID: string,
  language: string[],
  limit: number,
  offset: number,
  r18?: boolean,
  showUnavailable?: boolean
): Promise<{ volumes: Volume[]; total: number }> {
  const order = {
    volume: "desc",
    chapter: "desc",
  };
  const finalOrderQuery: { [key: string]: string } = {};

  // { "order[rating]": "desc", "order[followedCount]": "desc" }
  for (const [key, value] of Object.entries(order)) {
    finalOrderQuery[`order[${key}]`] = value;
  }

  const contentRating = ["safe", "suggestive", "erotica"];
  if (r18) {
    contentRating.push("pornographic");
  }

  const data = await axiosWithProxyFallback({
    url: `/manga/${mangaID}/feed?`,
    method: "get",
    params: {
      limit: limit,
      offset: offset,
      translatedLanguage: language,
      includes: ["scanlation_group", "manga"],
      contentRating: contentRating,
      includeUnavailable: showUnavailable ? "1" : "0",
      ...finalOrderQuery,
    },
  })

  const total = data.total;
  const chapters = ChaptersParser(data.data);

  return { volumes: groupChaptersByVolume(chapters), total };
}

export async function getChapterDetail(id: string): Promise<Chapter> {
  // const data = await axiosWithProxyFallback.get(`/chapter/${id}?`, {
  //   params: {
  //     includes: ["scanlation_group", "manga"],
  //   },
  // });

  const data = await axiosWithProxyFallback({
    url: `/chapter/${id}?`,
    method: "get",
    params: {
      includes: ["scanlation_group", "manga"],
    },
  });

  const chapter = ChaptersParser([data.data])[0];

  const manga = () => {
    const mangaData = data.data.relationships.find(
      (item: any) => item.type === "manga"
    );
    const titleVi = mangaData.attributes.altTitles.find(
      (item: any) => item.vi
    )?.vi;
    let title = titleVi
      ? titleVi
      : mangaData.attributes.title[Object.keys(mangaData.attributes.title)[0]];

    if (!title) {
      title = mangaData.attributes.altTitles.find((item: any) => item.en)?.en;
    }

    return {
      id: mangaData.id,
      title: title,
    };
  };

  // const { data: atHomeData } = await axiosWithProxyFallback.get(`/ch/${id}`);

  const atHomeData = await axiosWithProxyFallback({
    url: `/ch/${id}`,
    method: "get",
  });
  // console.log(atHomeData);

  // Use the current working API URL for images
  const apiUrl = getCurrentApiUrl();
  
  const pages = atHomeData.images.map(
    (item: string) => `${apiUrl}/${item}`
  );

  return { ...chapter, manga: manga(), pages };
}

export async function getChapterAggregate(
  mangaID: string,
  language: string,
  groups: string[]
): Promise<ChapterAggregate[]> {
  // const data = await axiosWithProxyFallback.get(`/manga/${mangaID}/aggregate?`, {
  //   params: {
  //     translatedLanguage: [language],
  //     groups: groups,
  //   },
  // });
  const data = await axiosWithProxyFallback({
    url: `/manga/${mangaID}/aggregate?`,
    method: "get",
    params: {
      translatedLanguage: [language],
      groups: groups,
    },
  });

  const result: ChapterAggregate[] = [];

  for (const volumeKey in data.volumes) {
    const volume = data.volumes[volumeKey];
    const chaptersArray = [];

    for (const chapterKey in volume.chapters) {
      const chapter = volume.chapters[chapterKey];

      chaptersArray.push({
        id: chapter.id, // Lấy trường `id`
        chapter: chapter.chapter,
        other: chapter.others,
      });
    }

    chaptersArray.sort((a, b) =>
      b.chapter.localeCompare(a.chapter, undefined, { numeric: true })
    );

    result.push({
      vol: volumeKey,
      chapters: chaptersArray,
    });
  }

  result.sort((a, b) => {
    if (a.vol === "none") return -1;
    if (b.vol === "none") return 1;

    return b.vol.localeCompare(a.vol, undefined, { numeric: true });
  });

  return result;
}
