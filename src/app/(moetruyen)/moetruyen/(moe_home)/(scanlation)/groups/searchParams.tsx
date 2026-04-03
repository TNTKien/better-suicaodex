import { createLoader, parseAsInteger, parseAsString } from "nuqs/server";

export const groupsSearchParams = {
  page: parseAsInteger.withDefault(1),
  q: parseAsString.withDefault(""),
  sort: parseAsString.withDefault("updated_at"),
};

export const loadSearchParams = createLoader(groupsSearchParams);
