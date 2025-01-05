import { Artist } from "@/types/types";

export function ArtistParser(data: any): Artist[] {
  const artists = data.filter((item: any) => item.type === "artist");
  if (!artists) return [];
  return artists.map((item: any) => {
    return {
      id: item.id,
      name: item.attributes.name,
    };
  });
}