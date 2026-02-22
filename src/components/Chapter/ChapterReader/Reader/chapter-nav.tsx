"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import useKeyDown from "@/hooks/use-keydown";
import { useScrollDirection } from "@/hooks/use-scroll-direction";
import useScrollOffset from "@/hooks/use-scroll-offset";
import { cn } from "@/lib/utils";
import { Chapter, ChapterAggregate } from "@/types/types";
import {
  ArrowLeft,
  ArrowRight,
  ChevronsUp,
  PanelRightClose,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useConfig } from "@/hooks/use-config";
import { useSidebar } from "@/components/ui/sidebar-2-reader";

interface ChapterNavProps {
  chapterData: Chapter;
  chapterAggregate: ChapterAggregate[];
}

export default function ChapterNav({
  chapterData,
  chapterAggregate,
}: ChapterNavProps) {
  const scrollDirection = useScrollDirection();
  const { isAtBottom, isAtTop } = useScrollOffset();
  const [config] = useConfig();
  const { state, isMobile, toggleSidebar } = useSidebar();

  let currentVolIndex = chapterAggregate.findIndex((aggregate) =>
    aggregate.chapters.some((chapter) => chapter.id === chapterData.id),
  );

  if (currentVolIndex === -1) {
    currentVolIndex = chapterAggregate.findIndex((aggregate) =>
      aggregate.chapters.some((chapter) =>
        chapter.other?.some((id) => id === chapterData.id),
      ),
    );
  }

  // At this point, we should have a valid volume index since
  // the parent component ensures the chapter exists in the aggregate data
  // console.log(chapterAggregate);
  // console.log("vol: ", currentVolIndex);
  // console.log(chapterAggregate[currentVolIndex]);

  const currentChapterIndex = chapterAggregate[
    currentVolIndex
  ].chapters.findIndex((chapter) => chapter.id === chapterData.id);

  const prevChapter = chapterAggregate[currentVolIndex].chapters[
    currentChapterIndex + 1
  ]?.id
    ? chapterAggregate[currentVolIndex].chapters[currentChapterIndex + 1]?.id
    : chapterAggregate[currentVolIndex + 1]?.chapters[0]?.id;

  const nextChapter = chapterAggregate[currentVolIndex].chapters[
    currentChapterIndex - 1
  ]?.id
    ? chapterAggregate[currentVolIndex].chapters[currentChapterIndex - 1]?.id
    : chapterAggregate[currentVolIndex - 1]?.chapters.at(-1)?.id;

  const router = useRouter();
  const goNextChapter = () => {
    if (nextChapter) {
      const toastId = toast.loading("Đang chuyển chương...");
      setTimeout(() => toast.dismiss(toastId), 1000);
      return router.push(`/chapter/${nextChapter}`);
    }
    return toast.warning("Đây là chương mới nhất rồi nha!");
  };

  const goPrevChapter = () => {
    if (prevChapter) {
      const toastId = toast.loading("Đang chuyển chương...");
      setTimeout(() => toast.dismiss(toastId), 1000);
      return router.push(`/chapter/${prevChapter}`);
    }
    return toast.warning("Đây là chương đầu tiên mà!");
  };

  useKeyDown("ArrowLeft", goPrevChapter);
  useKeyDown("ArrowRight", goNextChapter);

  return (
    <>
      {/* {config.reader.type === "long-strip" && (
        <div className="grid grid-cols-1 gap-2 mt-4 mx-auto">
          {!!nextChapter && (
            <Button asChild size="lg" className="[&>svg]:size-5!">
              <Link href={`/chapter/${nextChapter}`}>
                <span>Chương tiếp theo</span>
                <ArrowRight />
              </Link>
            </Button>
          )}
          {!!prevChapter && (
            <Button asChild size="lg" className="[&>svg]:size-5!">
              <Link href={`/chapter/${prevChapter}`}>
                <span>Chương trước</span>
                <ArrowLeft />
              </Link>
            </Button>
          )}
        </div>
      )} */}

      <Card
        className={cn(
          "overflow-x-auto",
          `fixed bottom-0 left-1/2 transform -translate-x-1/2 md:-translate-x-[calc(50%+var(--sidebar-width-icon)/2)] z-10 transition-all duration-300`,
          "mx-auto flex w-full translate-y-0 items-center justify-center rounded-none bg-background border-none",
          "md:rounded-lg md:w-auto md:-translate-y-2",
          !isMobile &&
            state === "expanded" &&
            "md:-translate-x-[calc(50%+var(--sidebar-width)/2)] translate-y-full md:translate-y-full",
          isAtBottom && "translate-y-full md:translate-y-full",
          scrollDirection === "down" &&
            !isAtBottom &&
            "translate-y-full md:translate-y-full",
        )}
      >
        <CardContent className="flex gap-2 p-2 md:gap-1.5 md:p-1.5 w-full">
          <Button
            asChild={!!prevChapter}
            disabled={!prevChapter}
            size="icon"
            className="shrink-0 disabled:cursor-not-allowed [&_svg]:size-5"
          >
            <Link href={prevChapter ? `/chapter/${prevChapter}` : "#"}>
              <ArrowLeft />
            </Link>
          </Button>

          <Select
            defaultValue={chapterData.id}
            onValueChange={(id) => router.push(`/chapter/${id}`)}
          >
            <SelectTrigger
              className="focus:ring-0 min-w-min md:min-w-48 [&_svg]:size-5 [&[data-state=open]>svg]:rotate-180 bg-card shadow-xs"
              // disabled={!chapterData.chapter}
            >
              <SelectValue placeholder={ChapterTitle(chapterData)} />
            </SelectTrigger>
            <SelectContent
              sideOffset={isMobile ? 10 : 7}
              className={cn("max-h-[350px]", `theme-${config.theme}`)}
            >
              {chapterAggregate.map((vol) => (
                <SelectGroup key={vol.vol}>
                  <div className="flex items-center pr-2">
                    <SelectLabel className="shrink-0">
                      {vol.vol !== "none" ? `Volume ${vol.vol}` : "No Volume"}
                    </SelectLabel>
                    <hr className="w-full" />
                  </div>

                  {vol.chapters.map((chapter) => (
                    <SelectItem
                      key={chapter.id}
                      value={chapter.id}
                      disabled={chapter.id === chapterData.id}
                    >
                      {chapter.chapter !== "none"
                        ? `Ch. ${chapter.chapter}`
                        : "Oneshot"}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>

          <Button
            asChild={!!nextChapter}
            disabled={!nextChapter}
            size="icon"
            className="shrink-0 disabled:cursor-not-allowed [&_svg]:size-5"
          >
            <Link href={nextChapter ? `/chapter/${nextChapter}` : "#"}>
              <ArrowRight />
            </Link>
          </Button>

          <Button
            size="icon"
            className="shrink-0 [&_svg]:size-5"
            onClick={toggleSidebar}
          >
            <PanelRightClose />
          </Button>

          <Button
            size="icon"
            disabled={isAtTop}
            className="shrink-0 [&_svg]:size-5"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            <ChevronsUp />
          </Button>
        </CardContent>
      </Card>
    </>
  );
}

function ChapterTitle(chapter: Chapter) {
  if (!chapter.chapter) {
    return "Oneshot";
  }
  return `Ch. ${chapter.chapter}`;
}
