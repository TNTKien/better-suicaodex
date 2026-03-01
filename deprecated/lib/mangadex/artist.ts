import { Artist } from "@/types/types";
import { axiosWithProxyFallback } from "../axios";

export function ArtistParser(data: any): Artist[] {
  const artists = data.filter((item: any) => item.type === "artist");
  if (!artists) return [];
  return artists.map((item: any) => {
    return {
      id: item.id,
      name: item.attributes?.name || 'Unknown Author'
    };
  });
}

export async function SearchArtist(artist: string): Promise<Artist[]> {
  if (artist.length === 0) return [];
  const data = await axiosWithProxyFallback({
    url: `/author?name=${artist}`,
    method: "get",
  });
  return data.data.map((item: any) => {
    return {
      id: item.id,
      name: item.attributes?.name || 'Unknown Author'
    };
  });
}
