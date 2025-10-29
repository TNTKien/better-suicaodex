import { Group, GroupStats, Manga, OriginalGroup } from "@/types/types";
import { axiosWithProxyFallback } from "../axios";
import { MangaParser } from "./manga";

export function GroupParser(data: OriginalGroup): Group {
  const id = data.id;
  const attributes = data.attributes;

  if (!attributes) {
    return {
      id: id,
      name: "Unknown Group",
      description: "",
      website: "",
      discord: "",
      email: "",
      twitter: "",
      language: [],
      leader: null,
    };
  }

  const name = attributes.name;
  const description = attributes.description;
  const website = attributes.website;
  const discord = attributes.discord;
  const email = attributes.contactEmail;
  const twitter = attributes.twitter;
  const leader =
    data.relationships?.find(
      (relationship) => relationship.type === "leader"
    ) ?? null;
  const language = attributes.focusedLanguages;

  const group: Group = {
    id,
    name,
    description,
    website,
    discord,
    email,
    twitter,
    language,
    leader: leader
      ? { id: leader.id, username: leader.attributes.username }
      : null,
  };
  return group;
}

export async function getGroup(id: string): Promise<Group> {
  const data = await axiosWithProxyFallback({
    url: `/group/${id}`,
    method: "get",
    params: {
      includes: ["leader"],
    },
  });
  return GroupParser(data.data);
}

export async function getGroupStats(id: string): Promise<GroupStats> {
  try {
    const [statsResponse, uploadedResponse] = await Promise.all([
      axiosWithProxyFallback({
        url: `/statistics/group/${id}`,
        method: "get",
      }),
      axiosWithProxyFallback({
        url: `/chapter`,
        method: "get",
        params: {
          limit: 0,
          groups: [id],
          contentRating: ["safe", "suggestive", "erotica", "pornographic"],
        },
      }),
    ]);

    const totalReplied =
      statsResponse.statistics?.[id]?.comments?.repliesCount || 0;
    const totalUploaded = uploadedResponse.total || 0;

    return { repliesCount: totalReplied, totalUploaded };
  } catch (error) {
    console.error("Error fetching group stats:", error);
    return { repliesCount: 0, totalUploaded: 0 };
  }
}

export async function getGroupTitles(
  id: string,
  limit: number,
  offset: number
): Promise<{
  mangas: Manga[];
  total: number;
}> {
  const max_total = 10000;

  if (limit + offset > max_total) {
    limit = max_total - offset;
  }
  const data = await axiosWithProxyFallback({
    url: `/manga`,
    method: "get",
    params: {
      limit,
      offset,
      group: id,
      contentRating: ["safe", "suggestive", "erotica", "pornographic"],
      includes: ["cover_art", "author", "artist"],
    },
  });
  const total = data.total > max_total ? max_total : data.total;

  return {
    mangas: data.data.map((item: any) => MangaParser(item)),
    total: total,
  };
}

export async function searchGroups(
  query: string,
  limit: number,
  offset: number
): Promise<{
  groups: Group[];
  total: number;
}> {
  const max_total = 10000;

  if (limit + offset > max_total) {
    limit = max_total - offset;
  }
  const params: any = {
    limit: limit,
    offset: offset,
    includes: ["leader"],
  };

  if (query) {
    params.name = query;
  }

  const data = await axiosWithProxyFallback({
    url: `/group`,
    method: "get",
    params: params,
  });
  const total = data.total > max_total ? max_total : data.total;

  return {
    groups: data.data.map((item: any) => GroupParser(item)),
    total: total,
  };
}
