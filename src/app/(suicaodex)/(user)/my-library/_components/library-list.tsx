"use client";

import {
  type LocalLibraryCategory,
  useLocalLibraryV2,
} from "@/hooks/use-local-library-v2";
import LibraryMangaCard from "./library-manga-card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { BookOpen } from "lucide-react";
import { useMounted } from "@mantine/hooks";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

interface LibraryListProps {
  category: LocalLibraryCategory;
}

export default function LibraryList({ category }: LibraryListProps) {
  const mounted = useMounted();
  const { getByCategory, removeFromLibrary } = useLocalLibraryV2();

  const entries = getByCategory(category);

  if (!mounted)
    return (
      <div className="flex items-center justify-center">
        <Button variant="ghost" disabled size="lg">
          <Spinner />
          Loaing...
        </Button>
      </div>
    );

  if (entries.length === 0) {
    return (
      <Empty className="bg-muted/30 h-full mt-2">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BookOpen />
          </EmptyMedia>
          <EmptyTitle>Bạn chưa lưu truyện vào mục này</EmptyTitle>
          <EmptyDescription className="max-w-xs text-pretty">
            Thử qua mấy mục khác xem sao 🤪
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 mt-2">
      {entries.map(([mangaId, entry]) => (
        <LibraryMangaCard
          key={mangaId}
          mangaId={mangaId}
          meta={entry.meta}
          onRemove={removeFromLibrary}
        />
      ))}
    </div>
  );
}
