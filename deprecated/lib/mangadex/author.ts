import { Author, AuthorDetail, Manga } from "@/types/types";
import { MangaParser } from "./manga";
import { axiosWithProxyFallback } from "../axios";

export function AuthorParser(data: any[]): Author[] {
  const authors = data.filter((item: any) => item.type === "author");
  if (!authors) return [];
  return authors.map((item: any) => {
    return {
      id: item.id,
      name: item.attributes?.name || "Unknown Author",
    };
  });
}

export async function SearchAuthor(author: string): Promise<Author[]> {
  if (author.length === 0) return [];
  const data = await axiosWithProxyFallback({
    url: `/author?name=${author}`,
    method: "get",
  });

  return data.data.map((item: any) => {
    return {
      id: item.id,
      name: item.attributes?.name || "Unknown Author",
    };
  });
}

export async function SearchAuthorByIds(ids: string[]): Promise<Author[]> {
  if (ids.length === 0) return [];
  try {
    // const data = await axiosWithProxyFallback.get(`/author?`, {
    //   params: {
    //     limit: ids.length,
    //     ids: ids,
    //   },
    // });
    const data = await axiosWithProxyFallback({
      url: `/author?`,
      method: "get",
      params: {
        limit: ids.length,
        ids: ids,
      },
    });

    return data.data.map((item: any) => {
      return {
        id: item.id,
        name: item.attributes?.name || "Unknown Author",
      };
    });
  } catch (error) {
    return [];
  }
}

export async function GetAuthor(id: string): Promise<AuthorDetail> {
  const data = await axiosWithProxyFallback({
    url: `/author/${id}`,
    method: "get",
  });

  const attributes = data.data.attributes;
  return {
    id: data.data.id,
    name: attributes.name || "Unknown Author",
    imageUrl: attributes.imageUrl || null,
    bio: attributes.biography.vi
      ? attributes.biography.vi
      : attributes.biography.en || null,
    social: {
      twitter: attributes.twitter || null,
      pixiv: attributes.pixiv || null,
      melonBook: attributes.melonBook || null,
      fanBox: attributes.fanBox || null,
      booth: attributes.booth || null,
      namicomi: attributes.namicomi || null,
      nicoVideo: attributes.nicoVideo || null,
      skeb: attributes.skeb || null,
      fantia: attributes.fantia || null,
      tumblr: attributes.tumblr || null,
      youtube: attributes.youtube || null,
      weibo: attributes.weibo || null,
      naver: attributes.naver || null,
      website: attributes.website || null,
    },
    mangas: data.data.relationships
      .filter((rel: any) => rel.type === "manga")
      .map((rel: any) => rel.id),
  };
}

export async function GetAuthorTitles(
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
  // const data = await axiosWithProxyFallback.get("/manga?", {
  //   params: {
  //     limit: limit,
  //     offset: offset,
  //     contentRating: ["safe", "suggestive", "erotica", "pornographic"],
  //     authorOrArtist: id,
  //     includes: ["author", "artist", "cover_art"],
  //   },
  // });
  const data = await axiosWithProxyFallback({
    url: "/manga?",
    method: "get",
    params: {
      limit: limit,
      offset: offset,
      contentRating: ["safe", "suggestive", "erotica", "pornographic"],
      authorOrArtist: id,
      includes: ["author", "artist", "cover_art"],
    },
  });
  
  const total = data.total > max_total ? max_total : data.total;
  return {
    mangas: data.data.map((item: any) => MangaParser(item)),
    total: total,
  };
}
