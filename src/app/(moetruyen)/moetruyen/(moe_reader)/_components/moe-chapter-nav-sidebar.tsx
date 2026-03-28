"use client";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { GetV1ChaptersById200Data } from "@/lib/moetruyen/model/getV1ChaptersById200Data";
import type { GetV1MangaByIdChapters200DataChaptersItem } from "@/lib/moetruyen/model/getV1MangaByIdChapters200DataChaptersItem";
import { ArrowLeft, ArrowRight, ChevronsUp } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import MoeReaderSettingsDialog from "./moe-reader-settings-dialog";
import {
  formatMoeChapterTitle,
  getAdjacentChapterHref,
  getMoeChapterHref,
  sortMoeChaptersForSelect,
} from "./moe-reader-utils";
import useScrollOffset from "@/hooks/use-scroll-offset";

interface MoeChapterNavSidebarProps {
  chapterData: GetV1ChaptersById200Data;
  chapterList?: GetV1MangaByIdChapters200DataChaptersItem[];
  isChapterListLoading?: boolean;
}

export default function MoeChapterNavSidebar({
  chapterData,
  chapterList,
  isChapterListLoading = false,
}: MoeChapterNavSidebarProps) {
  const router = useRouter();
  const { isAtTop } = useScrollOffset();
  const sortedChapters = chapterList
    ? sortMoeChaptersForSelect(chapterList)
    : [];
  const prevChapterHref = getAdjacentChapterHref(chapterData.prevChapter);
  const nextChapterHref = getAdjacentChapterHref(chapterData.nextChapter);

  return (
    <ButtonGroup className="h-8 w-full">
      <ButtonGroup className="h-8 flex-1">
        <Button
          asChild={!!prevChapterHref}
          size="icon"
          variant="outline"
          className="size-8"
          disabled={!prevChapterHref}
        >
          <Link href={prevChapterHref ?? "#"}>
            <ArrowLeft />
          </Link>
        </Button>

        <Select
          value={String(chapterData.chapter.id)}
          onValueChange={(value) => {
            router.push(getMoeChapterHref(value));
          }}
          disabled={isChapterListLoading || sortedChapters.length === 0}
        >
          <SelectTrigger className="h-8 min-w-0 flex-1">
            <SelectValue
              placeholder={formatMoeChapterTitle(chapterData.chapter)}
            />
          </SelectTrigger>
          <SelectContent className="max-h-[350px]" position="popper">
            <SelectGroup>
              {sortedChapters.map((chapter) => (
                <SelectItem
                  key={chapter.id}
                  value={String(chapter.id)}
                  disabled={chapter.id === chapterData.chapter.id}
                >
                  {formatMoeChapterTitle(chapter)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Button
          asChild={!!nextChapterHref}
          size="icon"
          variant="outline"
          className="size-8"
          disabled={!nextChapterHref}
        >
          <Link href={nextChapterHref ?? "#"}>
            <ArrowRight />
          </Link>
        </Button>
      </ButtonGroup>

      <ButtonGroup>
        <MoeReaderSettingsDialog />
        <Button
          size="icon"
          disabled={isAtTop}
          className="size-8"
          variant="outline"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          <ChevronsUp />
        </Button>
      </ButtonGroup>
    </ButtonGroup>
  );
}
