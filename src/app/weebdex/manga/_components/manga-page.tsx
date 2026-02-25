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
import { useConfig } from "@/hooks/use-config";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import Link from "next/link";
import MangaBanner from "./manga-banner";
import MangaCover from "./manga-cover";
import { Author } from "@/lib/weebdex/model";
import { useMemo } from "react";
import MangaStats from "./manga-stats";

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
  const [config, setConfig] = useConfig();

  const { data: response, isLoading } = useGetMangaId(id, {
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
    <>
      {!config.r18 && manga.content_rating === "pornographic" && (
        <AlertDialog defaultOpen>
          <AlertDialogOverlay className="backdrop-blur-lg" />
          <AlertDialogContent className={`theme-${config.theme}`}>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Truyện có <span className="text-red-600">yếu tố 18+</span>, bạn
                có chắc chắn muốn xem?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Chọn &quot;Tiếp tục&quot; sẽ thiết lập tuỳ chỉnh R18 thành
                &quot;Hiện&quot;
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel asChild>
                <Link href="/">Quay lại</Link>
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  setConfig({
                    ...config,
                    r18: true,
                  })
                }
              >
                Tiếp tục
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      <MangaBanner manga_id={id} cover={manga.relationships?.cover} />

      <div className="grid grid-cols-1 gap-4">
        <div className="grid grid-cols-[auto_1fr] gap-4 w-full">
          <div className="relative">
            <MangaCover
              manga_id={id}
              cover={manga.relationships?.cover}
              alt={title}
              placeholder="/images/place-doro.webp"
              className="shadow-md drop-shadow-md"
              wrapper="w-[130px] md:w-[200px] h-auto"
              isExpandable
            />
          </div>

          <div className="flex md:hidden flex-col gap-2 justify-between">
            <div className="flex flex-col gap-1.5">
              <p
                className="drop-shadow-md font-black leading-[1.15]"
                style={{
                  fontSize: `clamp(0.875rem, ${
                    title.length <= 30
                      ? "7vw"
                      : title.length <= 50
                        ? "6vw"
                        : title.length <= 70
                          ? "5vw"
                          : "4.5vw"
                  }, 3rem)`,
                  overflowWrap: "break-word",
                }}
              >
                {title}
              </p>
              {!!altTitles && (
                <h2 className="drop-shadow-md text-base leading-5 line-clamp-2">
                  {altTitles[0]}
                </h2>
              )}

              {!!manga.relationships && (
                <AuthorArtistNames
                  authors={manga.relationships.authors || []}
                  artists={manga.relationships.artists || []}
                  className="text-base line-clamp-1 max-w-[80%]"
                />
              )}
            </div>
            {!!manga.relationships && !!manga.relationships.stats && (
              <MangaStats
                views={manga.relationships.stats.views || 0}
                follows={manga.relationships.stats.follows || 0}
              />
            )}
          </div>

          <div className="hidden md:flex flex-col">
            <div className="flex flex-col justify-between h-54 pb-2">
              <div className="flex flex-col">
                <p
                  className="drop-shadow-md font-black wrap-break-word leading-[1.15]"
                  style={{
                    fontSize: `clamp(2.25rem, ${
                      title.length <= 20
                        ? "5vw"
                        : title.length <= 35
                          ? "4.2vw"
                          : title.length <= 50
                            ? "3.6vw"
                            : title.length <= 70
                              ? "3.1vw"
                              : "2.6vw"
                    }, 5rem)`,
                  }}
                >
                  {title}
                </p>
                {!!altTitles && (
                  <span
                    className="drop-shadow-md text-lg line-clamp-1"
                    title={altTitles[0]}
                  >
                    {altTitles[0]}
                  </span>
                )}
              </div>

              {!!manga.relationships && (
                <AuthorArtistNames
                  authors={manga.relationships.authors || []}
                  artists={manga.relationships.artists || []}
                  className="text-lg line-clamp-1 max-w-[80%]"
                />
              )}
            </div>

            <div className="pt-[0.85rem] flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                {/* <AddToLibraryBtn manga={manga} /> */}

                {/* <MangaReadNowButton id={id} language={manga.language} /> */}

                {/* <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      className="rounded-sm h-10 w-10"
                      variant="secondary"
                      size="icon"
                    >
                      <Ellipsis />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className={`theme-${config.theme}`}>
                    <DropdownMenuItem>
                      <Link
                        href={`${siteConfig.mangadexAPI.webURL}/title/${manga.id}`}
                        target="_blank"
                        className="flex items-center gap-2"
                      >
                        <Archive size={18} />
                        MangaDex
                      </Link>
                    </DropdownMenuItem>
                    {!!manga.raw && (
                      <DropdownMenuItem>
                        <Link
                          href={manga.raw}
                          target="_blank"
                          className="flex items-center gap-2"
                        >
                          <LibraryBig size={18} />
                          Raw
                        </Link>
                      </DropdownMenuItem>
                    )}

                    <DropdownMenuItem>
                      <Link
                        href={`${siteConfig.links.facebook}`}
                        target="_blank"
                        className="flex items-center gap-2"
                      >
                        <Bug size={18} />
                        Báo lỗi
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu> */}
              </div>

              {/* <div className="flex flex-wrap gap-1">
                <Tags
                  tags={manga.tags}
                  contentRating={manga.contentRating}
                  status={manga.status}
                />
              </div> */}

              {!!manga.relationships && !!manga.relationships.stats && (
                <MangaStats
                  views={manga.relationships.stats.views || 0}
                  follows={manga.relationships.stats.follows || 0}
                  size="lg"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const AuthorArtistNames = ({
  authors,
  artists,
  className = "drop-shadow-md text-sm line-clamp-1 break-all",
}: {
  authors: Author[];
  artists: Author[];
  className?: string;
}) => {
  const names = useMemo(() => {
    return [
      ...new Set([
        ...authors.map((a: Author) => a.name),
        ...artists.map((a: Author) => a.name),
      ]),
    ].join(", ");
  }, [authors, artists]);

  return <p className={className}>{names}</p>;
};
