"use client";

import ErrorPage from "@/components/error-page";
import { Button } from "@/components/ui/button";
import {
  ButtonGroup,
  ButtonGroupSeparator,
} from "@/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { siteConfig } from "@/config/site";
import { parseAsInteger, parseAsStringLiteral, useQueryState } from "nuqs";
import {
  Ellipsis,
  Flag,
  List,
  MessageSquare,
  SquareArrowOutUpRight,
} from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import {
  useGetV2MangaById,
  type getV2MangaByIdResponse,
} from "@/lib/moetruyen/hooks/manga/manga";

import { MOE_MANGA_PAGE_TABS } from "../[id]/[[...slug]]/searchParams";
import MoeMangaAddToLibBtn from "./moe-manga-add-to-lib-btn";
import MoeMangaChaptersList from "./moe-manga-chapters-list";
import MoeMangaComments from "./moe-manga-comments";
import MoeMangaCover from "./moe-manga-cover";
import MoeMangaDescription from "./moe-manga-description";
import MoeMangaPageSkeleton from "./moe-manga-skeleton";
import MoeMangaReadNowBtn from "./moe-manga-readnow-btn";
import MoeMangaSubInfo from "./moe-manga-subinfo";
import { MoeNormalTag, MoeStatusTag } from "./moe-manga-tags";
import MoeMangaBanner from "./moe-manga-banner";
import MoeMangaStats from "./moe-manga-stats";

interface MoeMangaPageProps {
  id: number;
  initData?: getV2MangaByIdResponse;
}

export default function MoeMangaPage({ id, initData }: MoeMangaPageProps) {
  const [currentPage, setCurrentPage] = useQueryState(
    "page",
    parseAsInteger.withDefault(1),
  );

  useEffect(() => {
    if (currentPage < 1) {
      void setCurrentPage(1);
    }
  }, [currentPage, setCurrentPage]);

  const [currentTab, setCurrentTab] = useQueryState(
    "tab",
    parseAsStringLiteral(MOE_MANGA_PAGE_TABS).withDefault("chapters"),
  );

  const { data: response, isLoading } = useGetV2MangaById(
    id,
    {
      include: "stats,genres",
    },
    {
      query: {
        queryKey: [`moe-manga-${id}`, id],
        enabled: !initData,
        initialData: initData,
        refetchOnMount: !initData,
        refetchInterval: 1000 * 60 * 10,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
    },
  );

  if (isLoading || !response || !initData) {
    return <MoeMangaPageSkeleton />;
  }

  if (response.status !== 200) {
    return <ErrorPage statusCode={response.status} />;
  }

  const manga = response.data.data;
  const coverUrl = manga.coverUrl ?? "/images/no-cover.webp";

  return (
    <div className="grid">
      <MoeMangaBanner coverUrl={coverUrl} />

      <div className="col-start-1 row-start-1 grid grid-cols-1 gap-4 px-4 md:px-8 lg:px-12">
        <div className="grid w-full grid-cols-[auto_1fr] gap-4">
          <div className="relative">
            <MoeMangaCover
              src={manga.coverUrl}
              alt={manga.title}
              placeholder="/images/place-doro.webp"
              className="shadow-md drop-shadow-md"
              wrapper="w-[130px] md:w-[200px] h-auto"
              isExpandable
            />
          </div>

          <div className="flex min-w-0 flex-col justify-between gap-3 md:hidden">
            <div className="flex flex-col gap-1.5">
              <p
                className="font-black leading-[1.15] drop-shadow-md"
                style={{
                  fontSize: `clamp(0.875rem, ${
                    manga.title.length <= 30
                      ? "7vw"
                      : manga.title.length <= 50
                        ? "6vw"
                        : manga.title.length <= 70
                          ? "5vw"
                          : "4.5vw"
                  }, 3rem)`,
                  overflowWrap: "break-word",
                }}
              >
                {manga.title}
              </p>

              {manga.author ? (
                <p className="line-clamp-1 max-w-[80%] text-base">
                  {manga.author}
                </p>
              ) : null}
            </div>

            <MoeMangaStats
              totalViews={manga.stats?.totalViews ?? 0}
              bookmarkCount={manga.stats?.bookmarkCount ?? 0}
            />
          </div>

          <div className="hidden min-w-0 flex-col md:flex">
            <div className="flex h-54 flex-col justify-between pb-2">
              <div className="flex flex-col">
                <p
                  className="wrap-break-word font-black leading-[1.15] drop-shadow-md"
                  style={{
                    fontSize: `clamp(2.25rem, ${
                      manga.title.length <= 20
                        ? "5vw"
                        : manga.title.length <= 35
                          ? "4.2vw"
                          : manga.title.length <= 50
                            ? "3.6vw"
                            : manga.title.length <= 70
                              ? "3.1vw"
                              : "2.6vw"
                    }, 5rem)`,
                  }}
                >
                  {manga.title}
                </p>
              </div>

              {manga.author ? (
                <p className="line-clamp-1 max-w-[80%] text-lg">
                  {manga.author}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-[0.85rem] pt-[0.85rem]">
              <div className="flex flex-wrap gap-2">
                <MoeMangaAddToLibBtn />
                <MoeMangaReadNowBtn id={id} />

                <Button variant="secondary" asChild>
                  <Link href={siteConfig.links.facebook} target="_blank">
                    <Flag />
                    Báo lỗi
                  </Link>
                </Button>

                <Button variant="secondary" asChild>
                  <Link
                    href={`${siteConfig.moetruyen.domain}/manga/${manga.slug}`}
                    target="_blank"
                  >
                    <SquareArrowOutUpRight />
                    MoeTruyen
                  </Link>
                </Button>
              </div>

              <div className="flex flex-wrap gap-1">
                <MoeStatusTag status={manga.status} />
                {manga.genres &&
                  manga.genres.map((genre) => (
                    <MoeNormalTag key={genre.id} className="uppercase">
                      {genre.name}
                    </MoeNormalTag>
                  ))}
              </div>

              <MoeMangaStats
                totalViews={manga.stats?.totalViews ?? 0}
                bookmarkCount={manga.stats?.bookmarkCount ?? 0}
                size="lg"
              />
            </div>
          </div>
        </div>

        <div className="flex w-full flex-wrap gap-1 md:hidden">
          <MoeStatusTag status={manga.status} />
          {manga.genres &&
            manga.genres.map((genre) => (
              <MoeNormalTag key={genre.id} className="uppercase">
                {genre.name}
              </MoeNormalTag>
            ))}
        </div>

        <div className="flex w-full flex-wrap gap-2 md:hidden">
          <MoeMangaAddToLibBtn />

          <ButtonGroup className="flex-1">
            <MoeMangaReadNowBtn id={id} />

            <ButtonGroupSeparator />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="icon">
                  <Ellipsis />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={siteConfig.links.facebook} target="_blank">
                    <Flag />
                    Báo lỗi
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuItem asChild>
                  <Link
                    href={`${siteConfig.moetruyen.domain}/manga/${manga.slug}`}
                    target="_blank"
                  >
                    <SquareArrowOutUpRight />
                    MoeTruyen
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </ButtonGroup>
        </div>

        <MoeMangaDescription
          content={manga.description ?? ""}
          maxHeight={160}
          subInfo={{
            author: manga.author,
            genres: manga.genres ?? [],
            slug: manga.slug,
          }}
        />

        <div className="flex w-full flex-row gap-4">
          <div className="hidden min-w-[25%] max-w-[400px] pt-2 xl:block">
            <MoeMangaSubInfo
              data={{
                author: manga.author,
                genres: manga.genres ?? [],
                slug: manga.slug,
              }}
            />
          </div>

          <div className="w-full">
            <Tabs
              defaultValue={currentTab}
              onValueChange={(value) => {
                void setCurrentTab(
                  value as (typeof MOE_MANGA_PAGE_TABS)[number],
                );
              }}
            >
              <div className="relative h-12 overflow-x-auto">
                <TabsList className="absolute">
                  <TabsTrigger value="chapters" className="flex gap-1 px-2">
                    <List size={18} />
                    Danh sách chương
                  </TabsTrigger>
                  <TabsTrigger value="comments" className="flex gap-1 px-2">
                    <MessageSquare size={18} />
                    Bình luận
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="chapters" className="mt-0">
                <MoeMangaChaptersList mangaId={id} />
              </TabsContent>

              <TabsContent value="comments" className="mt-0">
                <MoeMangaComments
                  mangaId={id}
                  page={currentPage}
                  onPageChange={(page) => {
                    void setCurrentPage(page);
                  }}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
