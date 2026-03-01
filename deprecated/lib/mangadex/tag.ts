import { Manga, Tag, TagsGroup } from "@/types/types";
import { axiosWithProxyFallback } from "../axios";
import { MangaParser } from "./manga";

export function TagsParser(data: any[]): Tag[] {
  return data.map((item) => {
    return {
      id: item.id,
      name: item.attributes.name.en,
      group: item.attributes.group,
    };
  });
}

export async function getTags(): Promise<Tag[]> {
  const data = await axiosWithProxyFallback({
    url: "/manga/tag",
    method: "get",
  });
  return TagsParser(data.data);
}

export async function getTagById(id: string): Promise<Tag | undefined> {
  const tags = await getTags();
  return tags.find((tag) => tag.id === id);
}

const GROUP_NAME_MAP: Record<string, string> = {
  content: "Nội dung",
  format: "Định dạng",
  genre: "Thể loại",
  theme: "Chủ đề",
};

export function groupTags(tags: Tag[]): TagsGroup[] {
  const groupMap = new Map<string, TagsGroup>();

  for (const tag of tags) {
    if (!groupMap.has(tag.group)) {
      groupMap.set(tag.group, {
        group: tag.group,
        name: GROUP_NAME_MAP[tag.group] || tag.group,
        tags: [],
      });
    }
    groupMap.get(tag.group)!.tags.push(tag);
  }

  return Array.from(groupMap.values());
}

export async function getMangasByTag(
  id: string,
  limit: number,
  offset: number,
  language: ("vi" | "en")[],
  r18: boolean
): Promise<{
  mangas: Manga[];
  total: number;
}> {
  const max_total = 10000;
  if (limit + offset > max_total) {
    limit = max_total - offset;
  }
  const searchParams: { [key: string]: any } = {
    limit: limit,
    offset: offset,
    availableTranslatedLanguage: language,
    contentRating: r18
      ? ["safe", "suggestive", "erotica", "pornographic"]
      : ["safe", "suggestive", "erotica"],
    includes: ["cover_art", "author", "artist"],
    includedTags: [id],
  };

  const data = await axiosWithProxyFallback({
    url: "/manga",
    method: "get",
    params: searchParams,
  });
  const total = data.total > max_total ? max_total : data.total;

  return {
    mangas: data.data.map((item: any) => MangaParser(item)),
    total: total,
  };
}
