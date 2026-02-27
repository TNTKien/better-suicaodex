"use client";

import { Chapter } from "@/lib/weebdex/model";
import { Clock, Eye, MessagesSquare, User, UserRound, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatNumber, formatTimeToNow } from "@/lib/utils";
import { useRouter } from "next/navigation";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { GB, VN } from "country-flag-icons/react/3x2";
import NoPrefetchLink from "@/components/Custom/no-prefetch-link";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface ChapterGroup {
  chapter: string | undefined;
  group: Chapter[];
}

interface ChapterCardProps {
  chapters: ChapterGroup;
  finalChapter?: string;
}

interface SingleCardProps {
  chapter: Chapter;
  finalChapter?: string;
  className?: string;
}

export const ChapterCard = ({ chapters, finalChapter }: ChapterCardProps) => {
  if (chapters.group.length > 1)
    return (
      <Accordion type="multiple" className="w-full" defaultValue={["chapter"]}>
        <AccordionItem value="chapter" className="border-none">
          <AccordionTrigger className="px-4 py-2 bg-card hover:bg-accent rounded-xs border shadow-xs [&[data-state=open]>svg]:rotate-90 transition-all">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-sm md:text-base line-clamp-1">
                {chapters.chapter ? `Chapter ${chapters.chapter}` : "Oneshot"}
              </p>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-0 pt-0">
            <div className="relative pl-4 mt-1 space-y-1">
              {chapters.group.map((chapter, index) => (
                <div key={chapter.id} className="relative">
                  {index === 0 && (
                    <div
                      className="absolute left-0 top-0 w-1 bg-border -ml-4"
                      style={{ height: "50%" }}
                    />
                  )}
                  {index < chapters.group.length - 1 && (
                    <div
                      className="absolute left-0 top-1/2 w-1 bg-border -ml-4"
                      style={{ height: "calc(100% + 0.25rem)" }}
                    />
                  )}
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-1 bg-border -ml-4 z-10" />
                  <SingleCard
                    chapter={chapter}
                    finalChapter={finalChapter}
                    className="shadow-xs"
                  />
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    );

  return <SingleCard chapter={chapters.group[0]} finalChapter={finalChapter} />;
};

export const SingleCard = ({
  chapter,
  finalChapter,
  className,
}: SingleCardProps) => {
  const router = useRouter();
  const isUnavailable = Boolean(chapter.is_unavailable);
  const groups = chapter.relationships?.groups ?? [];
  const uploader = chapter.relationships?.uploader;
  const views = chapter.relationships?.stats?.views;
  const timestamp = chapter.updated_at ?? chapter.published_at;

  const card = (
    <Card
      aria-disabled={isUnavailable}
      className={cn(
        "flex flex-col justify-between rounded-xs px-1.5 py-1.5 shadow-xs relative min-h-14 hover:bg-accent/50",
        isUnavailable && "opacity-90 cursor-not-allowed text-muted-foreground",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <div className="flex flex-auto items-center space-x-1 min-w-0">
          {chapter.language === "vi" && (
            <VN className="inline-block select-none shrink-0 size-4!" />
          )}
          {chapter.language === "en" && (
            <GB className="inline-block select-none shrink-0 size-4!" />
          )}
          <p className="font-semibold text-sm md:text-base line-clamp-1 break-all px-1">
            {chapter.chapter
              ? `Ch. ${chapter.chapter}${chapter.title ? ` - ${chapter.title}` : ""}`
              : "Oneshot"}
          </p>
          {finalChapter && finalChapter === chapter.chapter && (
            <Badge className="flex items-center gap-1 px-1 py-0 font-bold rounded text-[0.625rem] max-h-4">
              END
            </Badge>
          )}
        </div>

        {!!timestamp && (
          <div className="w-52 flex shrink-0 items-center justify-end gap-2">
            <div className="flex flex-auto items-center gap-1">
              <Clock size={16} className="shrink-0" />
              <time
                className="text-sm font-light line-clamp-1"
                dateTime={new Date(timestamp).toDateString()}
              >
                {formatTimeToNow(new Date(timestamp))}
              </time>
            </div>

            {views !== undefined && (
              <div className="flex items-center gap-1 w-16">
                <Eye size={16} className="shrink-0 ml-1" />
                <span className="text-sm font-light">
                  {formatNumber(views)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Row 2: groups (left) | uploader (right) */}
      <div className="flex items-center gap-2">
        <div className="flex flex-auto items-center space-x-1 min-w-0">
          <Users size={16} className="shrink-0" />
          {groups.length === 0 ? (
            <span className="line-clamp-1 font-normal text-sm px-1">
              No Group
            </span>
          ) : (
            <div className="flex items-center space-x-1">
              {groups.map((group) => (
                <Button
                  key={group.id}
                  variant="ghost"
                  className="whitespace-normal! shrink! font-normal text-start text-sm line-clamp-1 rounded-sm h-auto! py-0! px-1! hover:underline hover:text-primary break-all"
                  size="sm"
                  onClick={(e: React.MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    router.push(`/group/${group.id}`);
                  }}
                >
                  {group.name}
                </Button>
              ))}
            </div>
          )}
        </div>

        {!!uploader?.name && (
          <div className="w-52 flex shrink-0 items-center justify-end gap-2">
            <div className="flex flex-auto items-center gap-1">
              <User size={16} className="shrink-0" />
              <span className="text-sm font-light line-clamp-1">
                {uploader.name}
              </span>
            </div>

            <div className="flex items-center gap-1 w-16 opacity-65">
              <MessagesSquare size={16} className="shrink-0 ml-1" />
              <span className="text-sm font-light">N/A</span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );

  if (isUnavailable)
    return (
      <Tooltip>
        <TooltipTrigger asChild>{card}</TooltipTrigger>
        <TooltipContent className="select-none">
          Không thể đọc chương này
        </TooltipContent>
      </Tooltip>
    );

  return (
    <NoPrefetchLink
      suppressHydrationWarning
      href={`/chapter/${chapter.id}`}
      target="_self"
    >
      {card}
    </NoPrefetchLink>
  );
};
