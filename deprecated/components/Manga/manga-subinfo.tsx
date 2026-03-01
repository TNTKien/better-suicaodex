"use client";

import { Manga } from "@/types/types";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { LibraryBig } from "lucide-react";
import { Icons } from "../icons";
import { Separator } from "../ui/separator";
import { generateSlug } from "@/lib/utils";

interface MangaSubInfoProps {
  manga: Manga;
}

export default function MangaSubInfo({ manga }: MangaSubInfoProps) {
  return (
    <div className="flex flex-wrap gap-4">
      {manga.author.length > 0 && (
        <div className="flex flex-col gap-2">
          <Label className="text-base font-bold">Tác giả</Label>
          <div className="flex flex-wrap gap-2">
            {manga.author.map((a) => (
              <Button asChild key={a.id} variant="secondary" size="sm">
                <Link href={`/author/${a.id}/${generateSlug(a.name)}`} prefetch={false}>
                  {a.name}
                </Link>
              </Button>
            ))}
          </div>
        </div>
      )}

      {manga.artist.length > 0 && (
        <div className="flex flex-col gap-2">
          <Label className="text-base font-bold">Họa sĩ</Label>
          <div className="flex flex-wrap gap-2">
            {manga.artist.map((a) => (
              <Button asChild key={a.id} variant="secondary" size="sm">
                <Link href={`/author/${a.id}/${generateSlug(a.name)}`} prefetch={false}>
                  {a.name}
                </Link>
              </Button>
            ))}
          </div>
        </div>
      )}

      {manga.tags.length > 0 && (
        <div className="flex flex-col gap-2">
          <Label className="text-base font-bold">Thể loại</Label>
          <div className="flex flex-wrap gap-2">
            {manga.tags.map((tag) => (
              <Button asChild key={tag.id} variant="secondary" size="sm">
                <Link href={`/tag/${tag.id}/${generateSlug(tag.name)}`} prefetch={false}>
                  {tag.name}
                </Link>
              </Button>
            ))}
          </div>
        </div>
      )}

      {manga.altTitles.length > 0 && (
        <div className="flex flex-col gap-2 w-full">
          <Label className="text-base font-bold">Tên khác</Label>
          <div className="-mt-2 flex flex-col w-full">
            {manga.altTitles.map((name, index) => (
              <div className="flex flex-col" key={index}>
                <span className="text-sm py-2 wrap-break-word">{name}</span>

                {index !== manga.altTitles.length - 1 && (
                  <Separator className="w-full" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label className="text-base font-bold">Nguồn</Label>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link
              href={`${siteConfig.mangadexAPI.webURL}/title/${manga.id}`}
              target="_blank"
            >
              <Icons.mangadex />
              MangaDex
            </Link>
          </Button>

          {!!manga.raw && (
            <Button asChild variant="secondary" size="sm">
              <Link href={manga.raw} target="_blank">
                <LibraryBig />
                Raw
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
