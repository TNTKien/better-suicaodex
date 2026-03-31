"use client";

import { useGetV2MangaByIdChapters } from "@/lib/moetruyen/hooks/manga/manga";
import { BookOpen, BookX, Loader2 } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";

export default function MoeMangaReadNowBtn({ id }: { id: number }) {
  const { data, isLoading } = useGetV2MangaByIdChapters(id, {
    query: {
      refetchInterval: 1000 * 60 * 10,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  });

  const firstPublicChapter = useMemo(() => {
    if (data?.status !== 200) {
      return null;
    }

    const publicChapters = data.data.data.chapters.filter(
      (chapter) => chapter.access === "public",
    );

    return publicChapters.at(-1) ?? null;
  }, [data]);

  if (isLoading) {
    return (
      <Button variant="secondary" className="flex-1 md:flex-initial" disabled>
        <Loader2 className="animate-spin" />
        Đọc ngay
      </Button>
    );
  }

  if (!firstPublicChapter) {
    return (
      <Button variant="secondary" className="flex-1 md:flex-initial" disabled>
        <BookX />
        Đọc ngay
      </Button>
    );
  }

  return (
    <Button variant="secondary" className="flex-1 md:flex-initial" asChild>
      <Link
        href={`/moetruyen/chapter/${firstPublicChapter.id}`}
        prefetch={false}
      >
        <BookOpen />
        Đọc ngay
      </Link>
    </Button>
  );
}
