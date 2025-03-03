"use client";

import MangaCover from "@/components/Manga/manga-cover";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatTimeToNow } from "@/lib/utils";
import { Chapter } from "@/types/types";
import { Clock, ExternalLink, Users } from "lucide-react";
import Link from "next/link";

interface LatestCardProps {
  chapter: Chapter;
}

export default function LatestCard({ chapter }: LatestCardProps) {
  return (
    <Card className="rounded-sm shadow-xs transition-colors duration-200">
      <CardContent className="flex gap-2 p-1">
        {!!chapter.manga.title && !!chapter.manga.cover && (
          <>
            <Link href={`/manga/${chapter.manga.id}`}>
              <MangaCover
                id={chapter.manga.id}
                cover={chapter.manga.cover}
                alt={chapter.manga.title}
                placeholder="/images/xidoco.webp"
                wrapper="w-20 h-auto border"
                className="w-20! h-28! object-cover!"
                quality="256"
                //isExpandable
              />
            </Link>

            <div className="flex flex-col justify-evenly w-full">
              <Link
                href={`/manga/${chapter.manga.id}`}
                className="line-clamp-1 font-bold text-lg"
              >
                {chapter.manga.title}
              </Link>

              <div className="flex items-center space-x-1">
                {chapter.language === "vi" && (
                  <img
                    src="/flags/vn.svg"
                    alt="Vietnamese"
                    className="inline-block select-none shrink-0 h-5! w-5!"
                  />
                )}

                {chapter.language === "en" && (
                  <img
                    src="/flags/en.svg"
                    alt="English"
                    className="inline-block select-none shrink-0 h-5! w-5!"
                  />
                )}
                {chapter.externalUrl && <ExternalLink size={16} />}
                <Link
                  href={
                    chapter.externalUrl
                      ? chapter.externalUrl
                      : `/chapter/${chapter.id}`
                  }
                  className="hover:underline"
                >
                  <p className="font-semibold text-sm md:text-base line-clamp-1">
                    {chapter.chapter
                      ? `Ch. ${chapter.chapter}
      ${chapter.title ? ` - ${chapter.title}` : ""}`
                      : "Oneshot"}
                  </p>
                </Link>
              </div>

              <div className="flex justify-between">
                <div className="flex items-center justify-self-start space-x-1">
                  <Users size={16} className="shrink-0" />
                  {chapter.group.length === 0 ? (
                    <span className="line-clamp-1 font-normal text-xs px-[0.25rem]">
                      No Group
                    </span>
                  ) : (
                    <div className="flex items-center space-x-1">
                      {chapter.group.map((group) => (
                        <Button
                          asChild
                          key={group.id}
                          variant="ghost"
                          className="whitespace-normal font-normal text-start line-clamp-1 rounded-sm h-4 py-0 px-[0.25rem] hover:text-primary"
                          size="sm"
                        >
                          <Link href={`/group/${group.id}`}>{group.name}</Link>
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center space-x-1 w-full max-w-max justify-end pr-1">
                  <time
                    className="text-xs font-light line-clamp-1"
                    dateTime={new Date(chapter.updatedAt).toDateString()}
                  >
                    {formatTimeToNow(new Date(chapter.updatedAt))}
                  </time>
                  <Clock size={16} className="hidden sm:flex shrink-0" />
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
