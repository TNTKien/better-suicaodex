import { MANGA_PAGE_TABS } from "@/types/types";
import {
  createLoader,
  parseAsInteger,
  parseAsStringLiteral,
} from "nuqs/server";

export const mangaSearchParams = {
  page: parseAsInteger.withDefault(1),
  tab: parseAsStringLiteral(MANGA_PAGE_TABS).withDefault("chapters"),
};

export const loadSearchParams = createLoader(mangaSearchParams);
