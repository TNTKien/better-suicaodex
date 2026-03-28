import {
  createLoader,
  parseAsInteger,
  parseAsStringLiteral,
} from "nuqs/server";

export const MOE_MANGA_PAGE_TABS = ["chapters", "comments"] as const;

export const moeMangaSearchParams = {
  page: parseAsInteger.withDefault(1),
  tab: parseAsStringLiteral(MOE_MANGA_PAGE_TABS).withDefault("chapters"),
};

export const loadSearchParams = createLoader(moeMangaSearchParams);
