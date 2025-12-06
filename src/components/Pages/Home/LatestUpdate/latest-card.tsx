"use client";

import NoPrefetchLink from "@/components/Custom/no-prefetch-link";
import MangaCover from "@/components/Manga/manga-cover";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatTimeToNow, generateSlug } from "@/lib/utils";
import { Chapter } from "@/types/types";
import { GB, VN } from "country-flag-icons/react/3x2";
import { Clock, ExternalLink, Users } from "lucide-react";

interface LatestCardProps {
  chapter: Chapter;
}

export default function LatestCard({ chapter }: LatestCardProps) {
  return (
    <Card className="rounded-sm shadow-xs transition-colors duration-200">
      <CardContent className="flex gap-2 p-1">
        {!!chapter.manga.title && !!chapter.manga.cover && (
          <>
            <NoPrefetchLink
              href={`/manga/${chapter.manga.id}/${generateSlug(
                chapter.manga.title
              )}`}
            >
              <MangaCover
                id={chapter.manga.id}
                cover={chapter.manga.cover}
                alt={chapter.manga.title}
                placeholder="/images/place-doro.webp"
                wrapper="w-20 h-auto border"
                className="w-20! h-28! object-cover!"
                quality="256"
                //isExpandable
              />
            </NoPrefetchLink>

            <div className="flex flex-col justify-evenly w-full">
              <NoPrefetchLink
                href={`/manga/${chapter.manga.id}/${generateSlug(
                  chapter.manga.title
                )}`}
                className="line-clamp-1 font-bold text-lg break-all"
              >
                {chapter.manga.title}
              </NoPrefetchLink>

              <div className="flex items-center space-x-1">
                {chapter.language === "vi" && (
                  <VN className="inline-block select-none shrink-0 h-5! w-5!" />
                )}

                {chapter.language === "en" && (
                  <GB className="inline-block select-none shrink-0 h-5! w-5!" />
                )}
                {chapter.externalUrl && <ExternalLink size={16} />}
                <NoPrefetchLink
                  href={
                    chapter.externalUrl
                      ? chapter.externalUrl
                      : `/chapter/${chapter.id}`
                  }
                  className="hover:underline"
                  target={chapter.externalUrl ? "_blank" : "_self"}
                >
                  <p className="font-semibold text-sm md:text-base line-clamp-1 break-all">
                    {chapter.chapter
                      ? `Ch. ${chapter.chapter}
      ${chapter.title ? ` - ${chapter.title}` : ""}`
                      : "Oneshot"}
                  </p>
                </NoPrefetchLink>
              </div>

              <div className="flex justify-between items-center">
                <div className="flex items-center justify-self-start space-x-1">
                  <Users size={16} className="shrink-0" />
                  {chapter.group.length === 0 ? (
                    <span className="line-clamp-1 font-normal text-xs px-1">
                      No Group
                    </span>
                  ) : (
                    <div className="flex items-center space-x-1">
                      {chapter.group.map((group) => (
                        <Button
                          asChild
                          key={group.id}
                          variant="ghost"
                          className="whitespace-normal! font-normal text-start line-clamp-1! text-xs rounded-sm h-4 py-0 px-1 hover:text-primary break-all shrink!"
                          size="sm"
                        >
                          <NoPrefetchLink href={`/group/${group.id}`}>
                            {group.name}
                          </NoPrefetchLink>
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
