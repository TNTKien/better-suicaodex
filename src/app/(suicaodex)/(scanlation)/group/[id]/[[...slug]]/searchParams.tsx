import { createLoader, parseAsInteger } from "nuqs/server";

export const groupSearchParams = {
  page: parseAsInteger.withDefault(1),
};

export const loadSearchParams = createLoader(groupSearchParams);
