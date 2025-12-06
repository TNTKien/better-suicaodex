"use client";

import { Chapter } from "@/types/types";
import { ChapterTitle } from "../Chapter/ChapterReader/chapter-info";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { formatTimeToNow } from "@/lib/utils";
import { GB, VN } from "country-flag-icons/react/3x2";
import { Check, Clock, Users } from "lucide-react";
import { Button } from "../ui/button";
import { useLocalNotification } from "@/hooks/use-local-notification";
import MangaCover from "../Manga/manga-cover";
import NoPrefetchLink from "../Custom/no-prefetch-link";

interface UnreadCardProps {
  chapter: Chapter;
}

export default function UnreadCard({ chapter }: UnreadCardProps) {
  const title = ChapterTitle(chapter);
  const router = useRouter();
  const { markAsRead } = useLocalNotification();
  return (
    <Card className="rounded-sm shadow-xs transition-colors duration-200 w-full">
      <CardContent className="flex gap-1.5 p-1 md:p-1.5">
        <NoPrefetchLink href={`/manga/${chapter.manga.id}`}>
          <MangaCover
            id={chapter.manga.id || ""}
            cover={chapter.manga.cover || ""}
            alt={chapter.manga.title || ""}
            placeholder="/images/place-doro.webp"
            wrapper="w-20 h-auto border"
            className="w-20! h-[75px]! md:h-[77.5px]! object-cover!"
            quality="256"
            // quality={isMobile ? "256" : "512"}
          />
        </NoPrefetchLink>
        <div className="flex flex-col gap-0 w-full">
          <div className="w-full flex flex-row items-center justify-between border-b pb-1 md:pb-1.5">
            <NoPrefetchLink
              href={`/manga/${chapter.manga.id}`}
              className="font-bold line-clamp-1 break-all"
            >
              {chapter.manga.title}
            </NoPrefetchLink>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 md:px-3"
              onClick={() => markAsRead(chapter.id)}
            >
              <Check />
              Đánh dấu đã đọc
            </Button>
          </div>

          <div className="py-1 px-1 w-full hover:bg-secondary">
            <NoPrefetchLink
              className="flex flex-col gap-1 w-full"
              href={`/chapter/${chapter.id}`}
            >
              <div className="items-center flex gap-1">
                {chapter.language === "vi" ? (
                  <VN className="size-4 shrink-0" />
                ) : (
                  <GB className="size-4 shrink-0" />
                )}
                <span className="font-bold text-sm">{title}</span>
              </div>
              <div className="flex justify-between">
                <div className="flex items-center justify-self-start">
                  <Users size={15} className="shrink-0" />
                  {chapter.group.length === 0 ? (
                    <span className="line-clamp-1 font-normal text-xs px-1">
                      No Group
                    </span>
                  ) : (
                    <div className="flex items-center space-x-1">
                      {chapter.group.map((group) => (
                        <Button
                          key={group.id}
                          variant="ghost"
                          className="whitespace-normal font-normal text-start line-clamp-1 rounded-sm h-4 py-0 px-1 hover:underline hover:text-primary break-all"
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
                <div className="flex items-center space-x-1 w-full max-w-max justify-end pr-1">
                  <time
                    className="text-xs font-light"
                    dateTime={new Date(chapter.updatedAt).toDateString()}
                  >
                    {formatTimeToNow(new Date(chapter.updatedAt))}
                  </time>
                  <Clock size={15} className="shrink-0" />
                </div>
              </div>
            </NoPrefetchLink>
          </div>
        </div>
      </CardContent>
      {/* <CardFooter className="py-1 px-2 w-full hover:bg-secondary"></CardFooter> */}
    </Card>
  );
}
