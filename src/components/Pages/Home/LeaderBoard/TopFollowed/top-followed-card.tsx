"use client";

import MangaCover from "@/components/Manga/manga-cover";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Artist, Author, Manga } from "@/types/types";
import { Bookmark } from "lucide-react";
import Link from "next/link";

interface TopFollowedCardProps {
  manga: Manga;
}

export default function TopFollowedCard({ manga }: TopFollowedCardProps) {
  return (
    <Card className="rounded-sm shadow-none transition-colors duration-200 border-none dark:bg-background">
      <CardContent className="flex gap-3 p-1">
        <Link href={`/manga/${manga.id}`}>
          <MangaCover
            id={manga.id}
            cover={manga.cover}
            alt={manga.title}
            placeholder="/images/xidoco.webp"
            wrapper="w-20 h-auto border"
            className="w-20! h-28! object-cover!"
            quality="256"
          />
        </Link>

        <div className="flex flex-col justify-between ">
          <div className="flex flex-col gap-1">
            <Link
              href={`/manga/${manga.id}`}
              className="line-clamp-2 font-bold text-xl"
            >
              {manga.title}
            </Link>

            <p className="text-sm line-clamp-1">
              {[
                ...new Set([
                  ...manga.author.map((a: Author) => a.name),
                  ...manga.artist.map((a: Artist) => a.name),
                ]),
              ].join(", ")}
            </p>
          </div>

          {!!manga.stats && (
            <div className="flex flex-row gap-2">
              <span
                className={cn("flex items-center gap-1 text-base text-primary")}
              >
                <Bookmark size={18} />
                <span>{manga.stats.follows.toLocaleString("en-US")}</span>
              </span>

              {/* <span className="flex items-center gap-1 text-base">
                <Star size={18} />
                <span>{manga.stats.rating.bayesian.toFixed(2)}</span>
              </span>

              {!!manga.stats.comments && (
                <span className={cn("flex items-center gap-1 text-base")}>
                  <MessageSquare size={18} />
                  <span>{manga.stats.comments.toLocaleString("en-US")}</span>
                </span>
              )} */}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
