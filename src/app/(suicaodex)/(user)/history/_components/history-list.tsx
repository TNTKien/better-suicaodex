"use client";

import useReadingHistoryV2 from "@/hooks/use-reading-history-v2";
import HistoryMangaCard from "./history-manga-card";
import { Button } from "@/components/ui/button";
import { BookOpen, Trash2 } from "lucide-react";
import { useIsMounted } from "usehooks-ts";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";

export default function HistoryList() {
  const isMounted = useIsMounted();
  const { sortedEntries, removeHistory, clearHistory } = useReadingHistoryV2();

  if (!isMounted()) {
    return (
      <div className="flex items-center justify-center">
        <Button variant="ghost" disabled size="lg">
          <Spinner />
          Loaing...
        </Button>
      </div>
    );
  }

  if (sortedEntries.length === 0) {
    return (
      <Empty className="bg-muted/30 h-full mt-2">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BookOpen />
          </EmptyMedia>
          <EmptyTitle>Bạn chưa đọc truyện nào</EmptyTitle>
          <EmptyDescription className="max-w-xs text-pretty">
            Đọc đi chứ còn đợi gì nữa 🤪
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-4 mt-4">
      {/* Clear all button */}
      <div className="flex justify-end">
        <Button variant="destructive" size="sm" onClick={clearHistory}>
          <Trash2 size={14} />
          Xóa tất cả
        </Button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {sortedEntries.map(([mangaId, record]) => (
          <HistoryMangaCard
            key={mangaId}
            mangaId={mangaId}
            chapters={record.chapters}
            meta={record.meta}
            onRemove={removeHistory}
          />
        ))}
      </div>
    </div>
  );
}
