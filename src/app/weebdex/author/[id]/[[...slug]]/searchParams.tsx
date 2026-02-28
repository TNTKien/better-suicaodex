import { createLoader, parseAsInteger } from "nuqs/server";

export const authorSearchParams = {
  page: parseAsInteger.withDefault(1),
};

export const loadSearchParams = createLoader(authorSearchParams);
