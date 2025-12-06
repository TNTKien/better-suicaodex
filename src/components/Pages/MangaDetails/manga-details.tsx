"use client";

import { ChapterList } from "@/components/Chapter/ChapterList";
import Banner from "@/components/Manga/manga-banner";
import MangaCover from "@/components/Manga/manga-cover";
import MangaDescription from "@/components/Manga/manga-description";
import MangaMaintain from "@/components/Manga/manga-maintain";
import MangaNotFound from "@/components/Manga/manga-notfound";
import MangaReadButtons from "@/components/Manga/manga-read-buttons";
import { MangaStatsComponent } from "@/components/Manga/manga-stats";
import Tags from "@/components/Manga/Tags";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { siteConfig } from "@/config/site";
import { useConfig } from "@/hooks/use-config";
import { useIsMobile } from "@/hooks/use-mobile";
import { fetchMangaDetail } from "@/lib/mangadex/manga";
import { cn } from "@/lib/utils";
import { Artist, Author, Manga } from "@/types/types";
import {
  Archive,
  Bug,
  Ellipsis,
  ImagesIcon,
  LibraryBig,
  List,
  MessageSquare,
  Share2,
  Sprout,
  Square,
  SquareCheckBig,
  Terminal,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import MangaDetailsSkeleton from "./manga-details-skeleton";
import { toast } from "sonner";
import AddToLibraryBtn from "@/components/Manga/add-to-library-btn";
import MangaCoversTab from "@/components/Manga/manga-covers-tab";
import MangaSubInfo from "@/components/Manga/manga-subinfo";
import CommentSection from "@/components/Comment/comment-section";
import { useCommentCount } from "@/hooks/use-comment-count";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import MangaRecommendations from "@/components/Manga/manga-recomendations";

interface MangaDetailsProps {
  id: string;
}

export default function MangaDetails({ id }: MangaDetailsProps) {
  const isMobile = useIsMobile();
  const [config, setConfig] = useConfig();

  const [manga, setManga] = useState<Manga>();
  const [loading, setLoading] = useState(true);
  const [statusCode, setStatusCode] = useState<number>(200);

  const { count: cmtCount } = useCommentCount(id);

  const [showHiddenChapters, setShowHiddenChapters] = useState(false);

  //TODO: useSWR
  useEffect(() => {
    const fetchData = async () => {
      const { manga, status } = await getMangaData(id);
      if (status === 200 && manga) {
        setManga(manga);
      } else {
        setStatusCode(status);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  if (loading) return <MangaDetailsSkeleton />;
  if (statusCode === 404) return <MangaNotFound />;
  if (statusCode === 503) return <MangaMaintain />;
  if (statusCode !== 200 || !manga) return <div>Lỗi mất rồi 😭</div>;

  return (
    <>
      {/* R18 Warning */}
      {!config.r18 && manga.contentRating === "pornographic" && (
        <AlertDialog defaultOpen>
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

      {/* Banner */}
      <Banner id={manga.id} src={manga.cover} />

      {/* Content */}
      <div className="grid grid-cols-1 gap-4">
        <div className="grid grid-cols-[auto_1fr] gap-4 w-full">
          <div className="relative">
            <MangaCover
              id={manga.id}
              cover={manga.cover}
              alt={manga.title}
              placeholder="/images/place-doro.webp"
              className="shadow-md drop-shadow-md"
              wrapper="w-[130px] md:w-[200px] h-auto"
              isExpandable
            />
          </div>

          {isMobile ? (
            <div className="flex flex-col gap-2 justify-between">
              <div className="flex flex-col gap-1.5">
                <p
                  className="drop-shadow-md font-black leading-[1.15]"
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
                {!!manga.altTitle && (
                  <h2 className="drop-shadow-md text-base leading-5 line-clamp-2">
                    {manga.altTitle}
                  </h2>
                )}
                <p className="drop-shadow-md text-sm line-clamp-1 break-all">
                  {[
                    ...new Set([
                      ...manga.author.map((a: Author) => a.name),
                      ...manga.artist.map((a: Artist) => a.name),
                    ]),
                  ].join(", ")}
                </p>
              </div>
              {!!manga.stats && (
                <MangaStatsComponent stats={manga.stats} size="sm" />
              )}
            </div>
          ) : (
            <div className="flex flex-col">
              <div className="flex flex-col justify-between h-54 pb-2">
                <div className="flex flex-col">
                  <p
                    className="drop-shadow-md font-black md:text-white wrap-break-word leading-[1.15]"
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
                  {!!manga.altTitle && (
                    <span
                      className="drop-shadow-md text-lg md:text-white line-clamp-1"
                      title={manga.altTitle}
                    >
                      {manga.altTitle}
                    </span>
                  )}
                </div>

                <p className="text-sm md:text-white line-clamp-1 max-w-[80%]">
                  {[
                    ...new Set([
                      ...manga.author.map((a: Author) => a.name),
                      ...manga.artist.map((a: Artist) => a.name),
                    ]),
                  ].join(", ")}
                </p>
              </div>

              <div className="pt-[0.85rem] flex flex-col gap-4">
                <div className="flex flex-wrap gap-2">
                  <AddToLibraryBtn isMobile={isMobile} manga={manga} />

                  <MangaReadButtons id={id} />

                  <Button
                    size="icon"
                    className="rounded-sm h-10 w-10"
                    variant="secondary"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `${siteConfig.suicaodex.domain}/manga/${id}`
                      );
                      return toast.success("Đã sao chép link truyện!");
                    }}
                  >
                    <Share2 />
                  </Button>

                  <DropdownMenu>
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
                  </DropdownMenu>
                </div>

                <div className="flex flex-wrap gap-1">
                  <Tags
                    tags={manga.tags}
                    contentRating={manga.contentRating}
                    status={manga.status}
                  />
                </div>

                {!!manga.stats && (
                  <MangaStatsComponent stats={manga.stats} size="lg" />
                )}
              </div>
            </div>
          )}
        </div>

        {isMobile && (
          <>
            <div className="flex flex-wrap gap-1">
              <Tags
                tags={manga.tags}
                contentRating={manga.contentRating}
                status={manga.status}
              />
            </div>

            <div className="flex flex-wrap gap-2 w-full">
              <AddToLibraryBtn isMobile={isMobile} manga={manga} />

              <Button
                size="icon"
                className="rounded-sm grow-0"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `${siteConfig.suicaodex.domain}/manga/${id}`
                  );
                  return toast.success("Đã sao chép link truyện!");
                }}
              >
                <Share2 />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    className="rounded-sm grow-0"
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
              </DropdownMenu>

              <MangaReadButtons id={id} />
            </div>
          </>
        )}

        <MangaDescription
          content={manga.description.content}
          language={
            manga.description.content ? manga.description.language : "vi"
          }
          maxHeight={isMobile ? 78 : 234}
          manga={manga}
        />

        <div className="flex flex-row gap-4 w-full">
          <div className="hidden xl:block pt-2 min-w-[25%] max-w-[400px]">
            <MangaSubInfo manga={manga} />
          </div>

          <div className="w-full">
            <Tabs defaultValue="chapter">
              <div className="relative overflow-x-auto h-12">
                <TabsList className="absolute rounded-sm">
                  <TabsTrigger
                    value="chapter"
                    className="rounded-sm flex gap-1 px-2"
                  >
                    <List size={18} />
                    Danh sách chương
                  </TabsTrigger>
                  <TabsTrigger
                    value="comment"
                    className="rounded-sm flex gap-1 px-2"
                  >
                    <MessageSquare size={18} />
                    Bình luận
                    {!!cmtCount && cmtCount > 0 && (
                      <span>({cmtCount.toLocaleString("en-US")})</span>
                    )}
                  </TabsTrigger>

                  <TabsTrigger
                    value="art"
                    className="rounded-sm flex gap-1 px-2"
                  >
                    <ImagesIcon size={18} />
                    Ảnh bìa
                  </TabsTrigger>

                  <TabsTrigger
                    value="recommendation"
                    className="rounded-sm flex gap-1 px-2"
                  >
                    <Sprout size={18} />
                    Có thể bạn sẽ thích
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="chapter" className="mt-0">
                <Button
                  variant="ghost"
                  className="px-0! hover:bg-transparent! text-base [&_svg]:size-5 whitespace-normal!"
                  size="lg"
                  onClick={() => setShowHiddenChapters(!showHiddenChapters)}
                >
                  {showHiddenChapters ? (
                    <SquareCheckBig className="text-primary" strokeWidth={3} />
                  ) : (
                    <Square strokeWidth={3} />
                  )}
                  <span className="break-all! line-clamp-1">
                    Hiển thị các chương ẩn (nếu có)
                  </span>
                </Button>

                <ChapterList
                  language={config.translatedLanguage}
                  limit={100}
                  mangaID={manga.id}
                  finalChapter={manga.finalChapter}
                  r18={config.r18}
                  showUnavailable={showHiddenChapters}
                />
              </TabsContent>

              <TabsContent value="comment" className="mt-0">
                <CommentSection
                  id={manga.id}
                  type="manga"
                  title={manga.title}
                />
              </TabsContent>

              <TabsContent value="art" className="mt-0">
                <MangaCoversTab id={manga.id} />
              </TabsContent>

              <TabsContent value="recommendation" className="mt-0">
                <MangaRecommendations id={manga.id} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </>
  );
}

async function getMangaData(
  id: string
): Promise<{ status: number; manga: Manga | null }> {
  try {
    const mangaData = await fetchMangaDetail(id);
    return { status: 200, manga: mangaData };
  } catch (error: any) {
    return { status: error.status || 500, manga: null };
  }
}
