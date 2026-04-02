"use client";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSidebar } from "@/components/ui/sidebar-2-reader";
import { useScrollDirection } from "@/hooks/use-scroll-direction";
import useScrollOffset from "@/hooks/use-scroll-offset";
import type { GetV2ChaptersById200Data } from "@/lib/moetruyen/model/getV2ChaptersById200Data";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ArrowRight,
  ChevronsUp,
  PanelRightClose,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  formatMoeChapterTitle,
  getAdjacentChapterHref,
  getMoeChapterHref,
  type MoeChapterListItem,
  sortMoeChaptersForSelect,
} from "./moe-reader-utils";

interface MoeChapterNavProps {
  chapterData: GetV2ChaptersById200Data;
  chapterList?: MoeChapterListItem[];
  isChapterListLoading?: boolean;
}

export default function MoeChapterNav({
  chapterData,
  chapterList,
  isChapterListLoading = false,
}: MoeChapterNavProps) {
  const scrollDirection = useScrollDirection();
  const { isAtBottom, isAtTop } = useScrollOffset();
  const { state, isMobile, toggleSidebar } = useSidebar();
  const router = useRouter();

  const sortedChapters = chapterList
    ? sortMoeChaptersForSelect(chapterList)
    : [];
  const prevChapterHref = getAdjacentChapterHref(chapterData.prevChapter);
  const nextChapterHref = getAdjacentChapterHref(chapterData.nextChapter);

  return (
    <Card
      className={cn(
        "fixed bottom-0 left-1/2 z-10 mx-auto flex w-full -translate-x-1/2 translate-y-0 items-center justify-center overflow-x-auto rounded-none border-none bg-background transition-all duration-300 md:w-auto md:-translate-x-[calc(50%+var(--sidebar-width-icon)/2)] md:-translate-y-2 md:rounded-lg",
        !isMobile &&
          state === "expanded" &&
          "translate-y-full md:-translate-x-[calc(50%+var(--sidebar-width)/2)] md:translate-y-full",
        isAtBottom && "translate-y-full md:translate-y-full",
        scrollDirection === "down" &&
          !isAtBottom &&
          "translate-y-full md:translate-y-full",
      )}
    >
      <CardContent className="flex w-full gap-2 p-2 md:gap-1.5 md:p-1.5">
        <ButtonGroup className="h-9 w-full">
          <ButtonGroup className="h-9 flex-1">
            <Button
              asChild={!!prevChapterHref}
              disabled={!prevChapterHref}
              size="icon"
              className="size-9 shrink-0 disabled:cursor-not-allowed [&_svg]:size-5"
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
              <SelectTrigger className="h-9! min-w-min flex-1 bg-card shadow-xs focus:ring-0 md:min-w-48 [&_svg]:size-5">
                <SelectValue
                  placeholder={formatMoeChapterTitle(chapterData.chapter)}
                />
              </SelectTrigger>
              <SelectContent
                position="popper"
                sideOffset={isMobile ? 10 : 7}
                className="max-h-[350px]"
              >
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
              disabled={!nextChapterHref}
              size="icon"
              className="size-9 shrink-0 disabled:cursor-not-allowed [&_svg]:size-5"
            >
              <Link href={nextChapterHref ?? "#"}>
                <ArrowRight />
              </Link>
            </Button>
          </ButtonGroup>

          <ButtonGroup>
            <Button
              size="icon"
              className="size-9 shrink-0 [&_svg]:size-5"
              onClick={toggleSidebar}
            >
              <PanelRightClose />
            </Button>

            <Button
              size="icon"
              disabled={isAtTop}
              className="size-9 shrink-0 [&_svg]:size-5"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            >
              <ChevronsUp />
            </Button>
          </ButtonGroup>
        </ButtonGroup>
      </CardContent>
    </Card>
  );
}
