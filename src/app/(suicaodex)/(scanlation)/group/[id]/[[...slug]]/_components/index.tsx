"use client";

import { useConfig } from "@/hooks/use-config";
import {
  getManga,
  getMangaResponseSuccess,
} from "@/lib/weebdex/hooks/manga/manga";
import {
  getGroupId,
  getGroupIdResponseSuccess,
} from "@/lib/weebdex/hooks/scanlation-group/scanlation-group";
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
import { BookX, BugIcon, Mail } from "lucide-react";
import { Streamdown } from "streamdown";
import PaginationControl from "@/components/common/pagination-control";
import { Button } from "@/components/ui/button";
import { SiDiscord, SiX } from "@icons-pack/react-simple-icons";
import { Label } from "@/components/ui/label";
import { generateSlug } from "@/lib/utils";
import { generateFaviconURL } from "@/lib/weebdex/utils";
import RecentlySkeletonCard from "@/app/(suicaodex)/(home)/_components/recently-manga/recently-skeleton-card";
import MangaCard from "@/app/(suicaodex)/(manga)/manga/_components/manga-card";

interface GroupPageProps {
  id: string;
  page: number;
}

const LIMIT = 36;

export default function GroupPage({ id, page }: GroupPageProps) {
  const isMounted = useMounted();
  const [config] = useConfig();
  const contentRating = config.r18
    ? Object.values(GetMangaContentRatingItem)
    : undefined;

  const {
    data: group,
    isLoading: groupLoading,
    error: groupError,
  } = useQuery({
    enabled: isMounted,
    queryKey: ["weebdex", "group", id],
    queryFn: async () => {
      const res = await getGroupId(id);
      if (res.status !== 200) throw new Error("Failed to fetch group");
      return (res as getGroupIdResponseSuccess).data ?? null;
    },
    refetchOnWindowFocus: false,
  });

  const { data, isLoading, error } = useQuery({
    enabled: isMounted,
    queryKey: [
      "weebdex",
      "manga",
      "group",
      id,
      config.r18,
      config.translatedLanguage,
      page,
    ],
    queryFn: async () => {
      const res = await getManga({
        limit: LIMIT,
        group: id,
        availableTranslatedLang: config.translatedLanguage,
        contentRating,
        page,
      });
      if (res.status !== 200) throw new Error("Failed to fetch manga by group");
      return (res as getMangaResponseSuccess).data;
    },
    refetchOnWindowFocus: false,
  });

  const hasContacts =
    !!group?.website ||
    !!group?.discord ||
    !!group?.twitter ||
    !!group?.contact_email ||
    !!group?.mangaupdates;

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
              Nhóm này chưa đăng tải truyện nào
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
                cover={manga.relationships?.cover}
              />
            </Link>
          ))}
        </div>

        {totalPages > 1 && (
          <PaginationControl
            currentPage={page}
            totalPages={totalPages}
            createHref={(p) =>
              `/group/${id}/${generateSlug(group?.name ?? "")}?page=${p}`
            }
            className="mt-4"
          />
        )}
      </>
    );
  }

  function renderGroupInfo() {
    if (!isMounted || groupLoading)
      return (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      );

    if (groupError || !group)
      return (
        <Empty className="bg-muted/30">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BugIcon />
            </EmptyMedia>
            <EmptyTitle>Không tìm thấy nhóm</EmptyTitle>
            <EmptyDescription className="max-w-xs text-pretty">
              Nhóm này không tồn tại hoặc đã bị xoá
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      );

    return (
      <div className="flex flex-col gap-4">
        <div>
          <hr className="w-9 h-1 bg-primary border-none" />
          <h1 className="text-2xl font-black uppercase">{group.name}</h1>
          <p className="text-sm text-muted-foreground">@{id}</p>
        </div>

        {/* <div className="flex flex-row gap-2 items-center flex-wrap">
          {group.inactive && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              Không hoạt động
            </span>
          )}
          {group.locked && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              Đã khoá
            </span>
          )}
        </div> */}

        {!!group.description && (
          <div className="flex flex-col gap-2">
            <Label className="text-lg font-bold">Mô tả</Label>
            <Streamdown
              controls={{ table: false }}
              className="flex flex-col gap-1 text-sm text-muted-foreground"
            >
              {group.description}
            </Streamdown>
          </div>
        )}

        {hasContacts && (
          <div className="flex flex-col gap-2">
            <Label className="text-lg font-bold">Liên hệ</Label>
            <div className="flex flex-wrap gap-2">
              {!!group.website && (
                <Button asChild variant="secondary" size="sm">
                  <Link href={group.website} target="_blank">
                    {/* <Globe className="size-4" /> */}
                    <img
                      src={generateFaviconURL(group.website, 16)}
                      height={16}
                      width={16}
                      alt="Website Favicon"
                      className="size-4 rounded-full"
                    />
                    Website
                  </Link>
                </Button>
              )}
              {!!group.discord && (
                <Button asChild variant="secondary" size="sm">
                  <Link
                    href={`https://discord.gg/${group.discord}`}
                    target="_blank"
                  >
                    <SiDiscord className="size-4" />
                    Discord
                  </Link>
                </Button>
              )}
              {!!group.twitter && (
                <Button asChild variant="secondary" size="sm">
                  <Link
                    href={`https://twitter.com/${group.twitter}`}
                    target="_blank"
                  >
                    <SiX className="size-4" />
                    Twitter / X
                  </Link>
                </Button>
              )}
              {!!group.contact_email && (
                <Button asChild variant="secondary" size="sm">
                  <Link href={`mailto:${group.contact_email}`}>
                    <Mail className="size-4" />
                    Email
                  </Link>
                </Button>
              )}
              {!!group.mangaupdates && (
                <Button asChild variant="secondary" size="sm">
                  <Link href={group.mangaupdates} target="_blank">
                    <img
                      src={generateFaviconURL(group.mangaupdates, 16)}
                      width={16}
                      height={16}
                      alt="MangaUpdates Favicon"
                      className="size-4 rounded-full"
                    />
                    MangaUpdates
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
    <div className="flex flex-col gap-6 px-4 md:px-8 lg:px-12">
      {/* Group info */}
      <div>{renderGroupInfo()}</div>

      {/* Manga list */}
      <div className="flex flex-col gap-2">
        <div>
          <hr className="w-9 h-1 bg-primary border-none" />
          <Label className="text-lg font-bold">
            Truyện đã đăng
            {data && ` (${data.total ?? 0})`}
          </Label>
        </div>
        {renderMangaResults()}
      </div>
    </div>
  );
}
