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
import { MangaAddToLibBtn } from "./manga-add-to-lib-btn";
import {
  ButtonGroup,
  ButtonGroupSeparator,
} from "@/components/ui/button-group";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  Ellipsis,
  Flag,
  ImagesIcon,
  List,
  MessageSquare,
  Sprout,
  SquareArrowOutUpRight,
} from "lucide-react";
import { siteConfig } from "@/config/site";
import { ContentRatingTag, NormalTag, StatusTag } from "./manga-tags";
import MangaDescription from "./manga-description";
import MangaSubInfo from "./manga-subinfo";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MangaChaptersList } from "./chapters-list/manga-chapters-list";
import CommentSection from "@/components/Comment/comment-section";
import MangaCoversTab from "./manga-covers-tab";
import MangaRcms from "./manga-rcms";

interface PageProps {
  id: string;
  // page: number;
  // tab: (typeof MANGA_PAGE_TABS)[number];
  initData?: getMangaIdResponse;
}

export default function MangaPage({ id, initData }: PageProps) {
  const [currentPage, setCurrentPage] = useQueryState(
    "page",
    parseAsInteger.withDefault(1),
  );
  if(currentPage < 1) setCurrentPage(1);

  const [currentTab, setCurrentTab] = useQueryState(
    "tab",
    parseAsStringLiteral(MANGA_PAGE_TABS).withDefault("chapters"),
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
              ext="512.webp"
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

            <div className="pt-[0.85rem] flex flex-col gap-[0.85rem]">
              <div className="flex flex-wrap gap-2">
                <MangaAddToLibBtn mangaId={id} />

                {/* <MangaReadNowButton id={id} language={manga.language} /> */}
                {/* TODO: Readnow Btn */}
                <Button variant="secondary">
                  <BookOpen />
                  Đọc ngay
                </Button>
                <Button variant="secondary" asChild>
                  <Link href={siteConfig.links.facebook} target="_blank">
                    <Flag />
                    Báo lỗi
                  </Link>
                </Button>
                <Button variant="secondary" asChild>
                  <Link
                    href={`${siteConfig.weebdex.domain}/title/${id}`}
                    target="_blank"
                  >
                    <SquareArrowOutUpRight />
                    WeebDex
                  </Link>
                </Button>
              </div>

              <div className="flex flex-wrap gap-1">
                {manga.status && (
                  <StatusTag status={manga.status} isLink={true} />
                )}
                {manga.content_rating && (
                  <ContentRatingTag
                    rating={manga.content_rating}
                    isLink={true}
                  />
                )}
                {manga.relationships &&
                  manga.relationships.tags &&
                  manga.relationships.tags.map((tag) => (
                    <NormalTag key={tag.id} className="uppercase">
                      {tag.name}
                    </NormalTag>
                  ))}
              </div>

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

        <div className="flex md:hidden flex-wrap gap-1">
          {manga.status && <StatusTag status={manga.status} isLink={true} />}
          {manga.content_rating && (
            <ContentRatingTag rating={manga.content_rating} isLink={true} />
          )}
          {manga.relationships &&
            manga.relationships.tags &&
            manga.relationships.tags.map((tag) => (
              <NormalTag key={tag.id} className="uppercase">
                {tag.name}
              </NormalTag>
            ))}
        </div>

        <div className="flex md:hidden flex-wrap gap-2 w-full">
          <MangaAddToLibBtn mangaId={id} />

          <ButtonGroup className="flex-1">
            <Button variant="secondary" className="flex-1">
              <BookOpen />
              Đọc ngay
            </Button>

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
                    href={`${siteConfig.weebdex.domain}/title/${id}`}
                    target="_blank"
                  >
                    <SquareArrowOutUpRight />
                    WeebDex
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </ButtonGroup>
        </div>

        <MangaDescription
          content={manga.description || ""}
          maxHeight={160}
          manga={manga}
        />

        <div className="flex flex-row gap-4 w-full">
          <div className="hidden xl:block pt-2 min-w-[25%] max-w-[400px]">
            <MangaSubInfo manga={manga} />
          </div>

          <div className="w-full">
            <Tabs
              defaultValue={currentTab}
              onValueChange={(value) =>
                setCurrentTab(value as (typeof MANGA_PAGE_TABS)[number])
              }
            >
              <div className="relative overflow-x-auto h-12">
                <TabsList className="absolute ">
                  <TabsTrigger value="chapters" className="flex gap-1 px-2">
                    <List size={18} />
                    Danh sách chương
                  </TabsTrigger>
                  <TabsTrigger value="comments" className="flex gap-1 px-2">
                    <MessageSquare size={18} />
                    Bình luận
                  </TabsTrigger>

                  <TabsTrigger value="covers" className="flex gap-1 px-2">
                    <ImagesIcon size={18} />
                    Ảnh bìa
                  </TabsTrigger>

                  <TabsTrigger
                    value="recommendations"
                    className="flex gap-1 px-2"
                  >
                    <Sprout size={18} />
                    Có thể bạn sẽ thích
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="chapters" className="mt-0">
                <MangaChaptersList
                  mangaId={id}
                  finalChapter={manga.last_chapter}
                  page={currentPage}
                  onPageChange={(p) => setCurrentPage(p)}
                />
              </TabsContent>

              <TabsContent value="comments" className="mt-0">
                <CommentSection
                  id={id}
                  type="manga"
                  title={title}
                />
              </TabsContent>

              <TabsContent value="covers" className="mt-0">
                <MangaCoversTab id={id} />
              </TabsContent>

              <TabsContent value="recommendations" className="mt-0">
                <MangaRcms id={id} />
              </TabsContent>
            </Tabs>
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
