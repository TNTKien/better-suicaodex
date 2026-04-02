import { createLoader, parseAsInteger } from "nuqs/server";

export const mangaSearchParams = {
  page: parseAsInteger.withDefault(1),
};

export const loadSearchParams = createLoader(mangaSearchParams);
