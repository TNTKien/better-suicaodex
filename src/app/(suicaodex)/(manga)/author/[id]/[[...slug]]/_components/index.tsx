"use client";

import { useConfig } from "@/hooks/use-config";
import {
  getManga,
  getMangaResponseSuccess,
} from "@/lib/weebdex/hooks/manga/manga";
import {
  getAuthorId,
  getAuthorIdResponseSuccess,
} from "@/lib/weebdex/hooks/author/author";
import { GetMangaContentRatingItem } from "@/lib/weebdex/model";
import { useQuery } from "@tanstack/react-query";
import { useMounted } from "@mantine/hooks";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { BookX, BugIcon, Globe } from "lucide-react";
import { Streamdown } from "streamdown";
import PaginationControl from "@/components/common/pagination-control";
import { Button } from "@/components/ui/button";
import { SiX, SiPixiv, SiYoutube } from "@icons-pack/react-simple-icons";
import { Label } from "@/components/ui/label";
import { generateSlug } from "@/lib/utils";
import { generateFaviconURL } from "@/lib/weebdex/utils";
import RecentlySkeletonCard from "@/app/(suicaodex)/(home)/_components/recently-manga/recently-skeleton-card";
import MangaCard from "@/app/(suicaodex)/(manga)/manga/_components/manga-card";

interface AuthorPageProps {
  id: string;
  page: number;
}

const LIMIT = 36;

export default function AuthorPage({ id, page }: AuthorPageProps) {
  const isMounted = useMounted();
  const [config] = useConfig();
  const contentRating = config.r18
    ? Object.values(GetMangaContentRatingItem)
    : undefined;

  const {
    data: author,
    isLoading: authorLoading,
    error: authorError,
  } = useQuery({
    enabled: isMounted,
    queryKey: ["weebdex", "author", id],
    queryFn: async () => {
      const res = await getAuthorId(id);
      if (res.status !== 200) throw new Error("Failed to fetch author");
      return (res as getAuthorIdResponseSuccess).data ?? null;
    },
    refetchOnWindowFocus: false,
  });

  const { data, isLoading, error } = useQuery({
    enabled: isMounted,
    queryKey: [
      "weebdex",
      "manga",
      "author",
      id,
      config.r18,
      config.translatedLanguage,
      page,
    ],
    queryFn: async () => {
      const res = await getManga({
        limit: LIMIT,
        author: [id],
        availableTranslatedLang: config.translatedLanguage,
        contentRating,
        page,
      });
      if (res.status !== 200)
        throw new Error("Failed to fetch manga by author");
      return (res as getMangaResponseSuccess).data;
    },
    refetchOnWindowFocus: false,
  });

  const hasLinks =
    !!author?.website ||
    !!author?.twitter ||
    !!author?.pixiv ||
    !!author?.fanbox ||
    !!author?.fantia ||
    !!author?.skeb ||
    !!author?.youtube;

  const totalPages = Math.ceil((data?.total ?? 0) / LIMIT);

  function renderMangaResults() {
    if (!isMounted || isLoading)
      return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
          {[...Array(LIMIT)].map((_, i) => (
            <RecentlySkeletonCard key={i} />
          ))}
        </div>
      );

    if (error || !data)
      return (
        <Empty className="bg-muted/30 h-full">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BugIcon />
            </EmptyMedia>
            <EmptyTitle>Lỗi mất rồi 🤪</EmptyTitle>
            <EmptyDescription className="max-w-xs text-pretty">
              Có lỗi xảy ra, thử F5 xem sao nhé
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      );

    if ((data.data ?? []).length === 0)
      return (
        <Empty className="bg-muted/30 h-full">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BookX />
            </EmptyMedia>
            <EmptyTitle>Không có truyện nào</EmptyTitle>
            <EmptyDescription className="max-w-xs text-pretty">
              Tác giả này chưa có truyện nào
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      );

    return (
      <>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
          {(data.data ?? []).map((manga) => (
            <Link
              key={manga.id}
              href={`/manga/${manga.id}/${generateSlug(manga.title ?? "")}`}
              prefetch={false}
            >
              <MangaCard
                manga_id={manga.id!}
                title={manga.title ?? ""}
                cover={manga.relationships?.cover!}
              />
            </Link>
          ))}
        </div>

        {totalPages > 1 && (
          <PaginationControl
            currentPage={page}
            totalPages={totalPages}
            createHref={(p) =>
              `/author/${id}/${generateSlug(author?.name ?? "")}?page=${p}`
            }
            className="mt-4"
          />
        )}
      </>
    );
  }

  function renderAuthorInfo() {
    if (!isMounted || authorLoading)
      return (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      );

    if (authorError || !author)
      return (
        <Empty className="bg-muted/30">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BugIcon />
            </EmptyMedia>
            <EmptyTitle>Không tìm thấy tác giả</EmptyTitle>
            <EmptyDescription className="max-w-xs text-pretty">
              Tác giả này không tồn tại hoặc đã bị xoá
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      );

    return (
      <div className="flex flex-col gap-4">
        <div>
          <hr className="w-9 h-1 bg-primary border-none" />
          <h1 className="text-2xl font-black uppercase">{author.name}</h1>
          <p className="text-sm text-muted-foreground">@{id}</p>
        </div>

        {!!author.description && (
          <div className="flex flex-col gap-2">
            <Label className="text-lg font-bold">Mô tả</Label>
            <Streamdown
              controls={{ table: false }}
              className="text-sm text-muted-foreground"
            >
              {author.description}
            </Streamdown>
          </div>
        )}

        {hasLinks && (
          <div className="flex flex-col gap-2">
            <Label className="text-lg font-bold">Liên hệ</Label>
            <div className="flex flex-wrap gap-2">
              {!!author.website && (
                <Button asChild variant="secondary" size="sm">
                  <Link href={author.website} target="_blank">
                    <img
                      src={generateFaviconURL(author.website, 16)}
                      height={16}
                      width={16}
                      alt="Website Favicon"
                      className="size-4"
                    />
                    Website
                  </Link>
                </Button>
              )}
              {!!author.twitter && (
                <Button asChild variant="secondary" size="sm">
                  <Link href={author.twitter} target="_blank">
                    <SiX className="size-4" />
                    Twitter / X
                  </Link>
                </Button>
              )}
              {!!author.pixiv && (
                <Button asChild variant="secondary" size="sm">
                  <Link href={author.pixiv} target="_blank">
                    <SiPixiv className="size-4" />
                    Pixiv
                  </Link>
                </Button>
              )}
              {!!author.fanbox && (
                <Button asChild variant="secondary" size="sm">
                  <Link href={author.fanbox} target="_blank">
                    <img
                      src={generateFaviconURL(author.fanbox, 16)}
                      height={16}
                      width={16}
                      alt="Fanbox Favicon"
                      className="size-4 rounded-full"
                    />
                    Fanbox
                  </Link>
                </Button>
              )}
              {!!author.fantia && (
                <Button asChild variant="secondary" size="sm">
                  <Link href={author.fantia} target="_blank">
                    <img
                      src={generateFaviconURL(author.fantia, 16)}
                      height={16}
                      width={16}
                      alt="Fantia Favicon"
                      className="size-4 rounded-full"
                    />
                    Fantia
                  </Link>
                </Button>
              )}
              {!!author.skeb && (
                <Button asChild variant="secondary" size="sm">
                  <Link href={author.skeb} target="_blank">
                    <img
                      src={generateFaviconURL(author.skeb, 16)}
                      height={16}
                      width={16}
                      alt="Skeb Favicon"
                      className="size-4 rounded-full"
                    />
                    Skeb
                  </Link>
                </Button>
              )}
              {!!author.youtube && (
                <Button asChild variant="secondary" size="sm">
                  <Link href={author.youtube} target="_blank">
                    <SiYoutube className="size-4" />
                    YouTube
                  </Link>
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>{renderAuthorInfo()}</div>

      <div className="flex flex-col gap-2">
        <div>
          <hr className="w-9 h-1 bg-primary border-none" />
          <Label className="text-lg font-bold">
            Tác phẩm
            {data && ` (${data.total ?? 0})`}
          </Label>
        </div>
        {renderMangaResults()}
      </div>
    </div>
  );
}
