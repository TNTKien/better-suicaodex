import { createLoader, parseAsInteger, parseAsString } from "nuqs/server";

export const groupsSearchParams = {
  page: parseAsInteger.withDefault(1),
  q: parseAsString.withDefault(""),
};

export const loadSearchParams = createLoader(groupsSearchParams);
