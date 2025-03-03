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
  LibraryBig,
  List,
  ListPlus,
  MessageSquare,
  Share2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import MangaDetailsSkeleton from "./manga-details-skeleton";

interface MangaDetailsProps {
  id: string;
}

export default function MangaDetails({ id }: MangaDetailsProps) {
  const isMobile = useIsMobile();
  const [config, setConfig] = useConfig();

  const [manga, setManga] = useState<Manga>();
  const [loading, setLoading] = useState(true);
  const [statusCode, setStatusCode] = useState<number>(200);

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
      <div className="flex flex-col gap-4">
        <div className="flex flex-row gap-4">
          <div className="relative">
            <MangaCover
              id={manga.id}
              cover={manga.cover}
              alt={manga.title}
              placeholder="/images/xidoco.webp"
              className="shadow-md drop-shadow-md"
              wrapper="w-[130px] md:w-[200px] h-auto"
              isExpandable
            />
          </div>

          {isMobile ? (
            <div className="flex flex-col gap-2 justify-between">
              <div className="flex flex-col gap-1.5">
                <p className="drop-shadow-md font-black text-2xl leading-7">
                  {manga.title}
                </p>
                {!!manga.altTitle && (
                  <h2 className="drop-shadow-md text-lg leading-5 line-clamp-2">
                    {manga.altTitle}
                  </h2>
                )}
                <p className="drop-shadow-md text-sm line-clamp-1 max-w-[80%]">
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
              <div className="flex flex-col justify-between h-[13.5rem] pb-[0.5rem]">
                <div className="flex flex-col">
                  <p
                    className={cn(
                      "drop-shadow-md font-black md:text-white",
                      // "text-3xl md:text-white md:text-5xl"
                      manga.title.length > 20 ? "text-4xl" : "text-6xl"
                    )}
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
                  <Button size="lg" className="rounded-sm">
                    <ListPlus />
                    Thêm vào thư viện
                  </Button>

                  <MangaReadButtons id={id} />

                  <Button
                    size="icon"
                    className="rounded-sm h-10 w-10"
                    variant="secondary"
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

            <div className="flex grow gap-2 w-full">
              <Button size="icon" className="rounded-sm grow-0">
                <ListPlus />
              </Button>

              <Button size="icon" className="rounded-sm grow-0">
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

              {/* <Button className="rounded-sm grow" variant="secondary">
              <BookOpenCheck /> Đọc tiếp Ch. 999
            </Button> */}
            </div>
          </>
        )}

        {!!manga.description.content && (
          <MangaDescription
            content={manga.description.content}
            language={manga.description.language}
            maxHeight={isMobile ? 78 : 234}
          />
        )}

        <Tabs defaultValue="chapter">
          <TabsList className="rounded-sm w-full md:w-auto">
            <TabsTrigger
              value="chapter"
              className="rounded-sm w-full flex gap-1"
            >
              <List size={20} />
              Danh sách chương
            </TabsTrigger>
            <TabsTrigger
              value="comment"
              className="rounded-sm w-full flex gap-1"
            >
              <MessageSquare size={20} />
              Bình luận
            </TabsTrigger>
          </TabsList>
          <TabsContent value="chapter">
            <ChapterList
              language={config.translatedLanguage}
              limit={100}
              mangaID={manga.id}
              finalChapter={manga.finalChapter}
              r18={config.r18}
            />
          </TabsContent>
          <TabsContent value="comment">Tính năng đang phát triển!</TabsContent>
        </Tabs>
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
