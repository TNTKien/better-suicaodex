import { createLoader, parseAsInteger } from "nuqs/server";

export const meoSearchParams = {
  page: parseAsInteger.withDefault(1),
  limit: parseAsInteger.withDefault(20),
};

export const loadSearchParams = createLoader(meoSearchParams);
