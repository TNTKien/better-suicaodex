import { Manga } from "@/types/types";
import { axiosWithProxyFallback } from "../axios";
import { MangaParser } from "./manga";

export async function getRandomManga(r18: boolean): Promise<Manga> {
  const data = await axiosWithProxyFallback({
    url: `/manga/random`,
    method: "get",
    params: {
      includes: ["cover_art", "author", "artist"],
      contentRating: r18
        ? ["safe", "suggestive", "erotica", "pornographic"]
        : ["safe", "suggestive", "erotica"],
    },
  });

  return MangaParser(data.data);
}
