import { createLoader, parseAsInteger } from "nuqs/server";

export const tagSearchParams = {
  page: parseAsInteger.withDefault(1),
};

export const loadSearchParams = createLoader(tagSearchParams);
