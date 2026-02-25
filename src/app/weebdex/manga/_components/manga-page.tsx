"use client";

import MangaSkeleton from "./manga-skeleton";
import { parseAsInteger, parseAsStringLiteral, useQueryState } from "nuqs";
import { MANGA_PAGE_TABS } from "@/types/types";
import {
  getMangaIdResponse,
  useGetMangaId,
} from "@/lib/weebdex/hooks/manga/manga";
import ErrorPage from "@/components/error-page";
import { parseMangaTitle } from "@/lib/weebdex/utils";

interface PageProps {
  id: string;
  page: number;
  tab: (typeof MANGA_PAGE_TABS)[number];
  initData?: getMangaIdResponse;
}

export default function MangaPage({ id, initData, page, tab }: PageProps) {
  const [currentPage, setCurrentPage] = useQueryState(
    "page",
    parseAsInteger.withDefault(page),
  );
  const [currentTab, setCurrentTab] = useQueryState(
    "tab",
    parseAsStringLiteral(MANGA_PAGE_TABS).withDefault(tab),
  );

  const { data:response, isLoading } = useGetMangaId(id, {
    query: {
      queryKey: [`manga-${id}`, id],
      enabled: !initData,
      initialData: initData,
      refetchOnMount: !initData,
      refetchInterval: 1000 * 60 * 10,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  });

  if (isLoading || !response || !initData) {
    return <MangaSkeleton />;
  }
  if (response.status !== 200) {
    return <ErrorPage statusCode={response.status} />;
  }

  const manga = response.data;
  const { title, altTitles } = parseMangaTitle(manga);

  return (
    <div>
      <h1>{title}</h1>
      <p>Alt Titles: {altTitles.join(" / ")}</p>
      <p>Page: {currentPage}</p>
      <p>Tab: {currentTab}</p>
    </div>
  );
}
