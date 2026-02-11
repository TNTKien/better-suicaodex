import { MangaData } from "./manga";

export interface MangaDexApiResponse {
  result: "ok" | "error";
  response: "entity";
  data: MangaData;
}
