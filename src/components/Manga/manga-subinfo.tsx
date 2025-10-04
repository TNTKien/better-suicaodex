"use client";

import { Manga } from "@/types/types";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { LibraryBig } from "lucide-react";
import { Icons } from "../icons";

interface MangaSubInfoProps {
  manga: Manga;
}

export default function MangaSubInfo({ manga }: MangaSubInfoProps) {
  return (
    <div className="flex flex-wrap gap-4">
      <div className="flex flex-col gap-2">
        <Label className="text-base font-bold">Tác giả</Label>
        <div className="flex flex-wrap gap-2">
          {manga.author.map((a) => (
            <Button
              asChild
              className="rounded-sm hover:bg-primary/25"
              key={a.id}
              variant="secondary"
              size="sm"
            >
              <Link href={`/author/${a.id}`} prefetch={false}>
                {a.name}
              </Link>
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label className="text-base font-bold">Họa sĩ</Label>
        <div className="flex flex-wrap gap-2">
          {manga.artist.map((a) => (
            <Button
              asChild
              className="rounded-sm hover:bg-primary/25"
              key={a.id}
              variant="secondary"
              size="sm"
            >
              <Link href={`/author/${a.id}`} prefetch={false}>
                {a.name}
              </Link>
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label className="text-base font-bold">Thể loại</Label>
        <div className="flex flex-wrap gap-2">
          {manga.tags.map((tag) => (
            <Button
              asChild
              className="rounded-sm hover:bg-primary/25"
              key={tag.id}
              variant="secondary"
              size="sm"
            >
              <Link href={`/advanced-search?include=${tag.id}`}>
                {tag.name}
              </Link>
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label className="text-base font-bold">Nguồn</Label>
        <div className="flex flex-wrap gap-2">
          <Button
            asChild
            className="rounded-sm hover:bg-primary/25"
            variant="secondary"
            size="sm"
          >
            <Link
              href={`${siteConfig.mangadexAPI.webURL}/title/${manga.id}`}
              target="_blank"
            >
              <Icons.mangadex />
              MangaDex
            </Link>
          </Button>

          {!!manga.raw && (
            <Button
              asChild
              className="rounded-sm hover:bg-primary/25"
              variant="secondary"
              size="sm"
            >
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
