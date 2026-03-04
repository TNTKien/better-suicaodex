"use client";

import useReadingHistoryV2, {
  migrateFromV2 /*, migrateFromDevHistory*/,
} from "@/hooks/use-reading-history-v2";
import HistoryMangaCard from "./history-manga-card";
import { Button } from "@/components/ui/button";
import { BookOpen, DicesIcon, RefreshCw, Trash2 } from "lucide-react";
import { useMounted } from "@mantine/hooks";
import { toast } from "sonner";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import Link from "next/link";

export default function HistoryList() {
  const isMounted = useMounted();
  const { sortedEntries, removeHistory, clearHistory } = useReadingHistoryV2();

  const handleSync = () => {
    const count = migrateFromV2(); /*+ migrateFromDevHistory()*/
    if (count > 0) {
      toast.success(`Đồng bộ thành công!`);
    } else {
      toast.info("Không có dữ liệu!");
    }
  };

  if (!isMounted) {
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
          <EmptyContent className="flex flex-col md:flex-row justify-center gap-2">
            <Button asChild variant="default" size="sm">
              <Link href="/random" prefetch={false}>
                <DicesIcon size={14} />
                Truyện ngẫu nhiên
              </Link>
            </Button>
            <Button variant="secondary" size="sm" onClick={handleSync}>
              <RefreshCw size={14} />
              Đồng bộ
            </Button>
          </EmptyContent>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-4 mt-4">
      {/* Clear all button */}
      <div className="flex items-center justify-end gap-2">
        {/* <Button variant="secondary" size="sm" onClick={handleSync}>
          <RefreshCw size={14} />
          Đồng bộ
        </Button> */}

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
