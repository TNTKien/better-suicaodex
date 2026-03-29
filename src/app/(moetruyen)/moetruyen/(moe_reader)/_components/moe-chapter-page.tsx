"use client";

import ErrorPage from "@/components/error-page";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useGetV1ChaptersById,
  type getV1ChaptersByIdResponseSuccess,
} from "@/lib/moetruyen/hooks/chapters/chapters";
import { useGetV1MangaByIdChapters } from "@/lib/moetruyen/hooks/manga/manga";

import MoeReader from "./moe-reader";
import MoeReaderSidebar from "./moe-reader-sidebar";
import { MoetruyenHeader } from "@/app/(moetruyen)/_components/moetruyen-header";

interface MoeChapterPageProps {
  id: number;
  initialData?: getV1ChaptersByIdResponseSuccess;
}

export default function MoeChapterPage({
  id,
  initialData,
}: MoeChapterPageProps) {
  const {
    data: response,
    isLoading,
    error,
  } = useGetV1ChaptersById(id, {
    query: {
      initialData,
      refetchOnMount: !initialData,
      refetchInterval: 1000 * 60 * 30,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  });

  const payload = response?.status === 200 ? response.data.data : undefined;
  const mangaId = payload?.manga.id;
  const { data: chapterListResponse, isLoading: isChapterListLoading } =
    useGetV1MangaByIdChapters(mangaId ?? 0, {
      query: {
        enabled: !!mangaId,
        refetchInterval: 1000 * 60 * 10,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
    });

  if (error) {
    if ((error as { status?: number }).status === 404) {
      return <ErrorPage statusCode={404} />;
    }

    if ((error as { status?: number }).status === 403) {
      return (
        <ErrorPage
          statusCode={403}
          message="Chương này đang bị khoá hoặc cần mật khẩu để đọc."
        />
      );
    }

    return <div>Lỗi mất rồi 😭</div>;
  }

  if (isLoading || !payload) {
    return (
      <div className="grid grid-cols-1 gap-2 pb-2">
        <Skeleton className="h-5 w-1/2 rounded-sm bg-gray-500 md:w-1/5" />
        <Skeleton className="h-5 w-3/4 rounded-sm bg-gray-500 md:w-1/3" />
        <Skeleton className="h-5 w-1/4 rounded-sm bg-gray-500" />
      </div>
    );
  }

  const pages = payload.pageUrls;
  const chapterList =
    chapterListResponse?.status === 200
      ? chapterListResponse.data.data.chapters
      : undefined;

  if (pages.length === 0) {
    return (
      <ErrorPage
        statusCode={404}
        message="Chương này chưa có ảnh để hiển thị."
      />
    );
  }

  return (
    <>
      <div className="border-grid flex flex-1 flex-col">
        <MoetruyenHeader />
        <MoeReader
          key={payload.chapter.id}
          images={pages}
          chapterData={payload}
          chapterList={chapterList}
          isChapterListLoading={isChapterListLoading}
        />
      </div>
      <MoeReaderSidebar
        chapter={payload}
        chapterList={chapterList}
        isChapterListLoading={isChapterListLoading}
        side="right"
      />
    </>
  );
}
