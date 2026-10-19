import { PrefetchLink } from "@workspace/ui/components/prefetch-link"
import Link from "next/link"

import { cover256, coverSrcSet } from "@workspace/catalog/images"
import { tagPath } from "@workspace/catalog/routing"
import { AssetImage } from "@workspace/ui/components/asset-image"
import { Badge } from "@workspace/ui/components/badge"
import { Card } from "@workspace/ui/components/card"
import type { components } from "@/src/lib/generated/api"

export function LibraryMangaRow({
  manga,
}: {
  manga: components["schemas"]["MangaSummary"]
}) {
  const href = `/manga/${manga.id}/${manga.slug}`
  const chapter = manga.latestChapter
  return (
    <Card className="flex-row items-start gap-3 rounded-none border border-white/35 bg-[#111111] p-2 shadow-none ring-0">
      <PrefetchLink
        href={href}
        className="relative aspect-3/4 w-24 shrink-0 overflow-hidden border border-white/35 sm:w-32"
      >
        <AssetImage
          src={cover256(manga.cover?.url ?? null)}
          srcSet={coverSrcSet(manga.cover)}
          sizes="(min-width: 640px) 128px, 96px"
          alt={`Bìa truyện ${manga.title}`}
          width={manga.cover?.width ?? 700}
          height={manga.cover?.height ?? 1000}
          className="absolute inset-0 size-full object-cover"
        />
      </PrefetchLink>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <h2 className="pr-10 text-lg leading-tight wrap-break-word text-[#00bfff] sm:text-2xl">
          <PrefetchLink href={href} className="hover:underline">
            {manga.title}
          </PrefetchLink>
        </h2>
        <div className="flex flex-wrap items-center gap-1">
          <span className="font-semibold text-[#888888]">Thể loại:</span>
          {manga.tags.map((tag) => (
            <Badge
              key={tag.id}
              className="rounded-[4px] bg-[#237ec7] px-1 py-0.5 text-xs font-bold text-white hover:bg-[#ae3910]!"
              render={
                <Link href={tagPath(tag.id, tag.slug)} prefetch={false} />
              }
            >
              {tag.name}
            </Badge>
          ))}
        </div>
        <p className="text-sm sm:text-base">
          <span className="font-semibold text-[#888888]">
            Chương mới nhất:{" "}
          </span>
          {chapter ? (
            <Link
              href={`/chapter/${chapter.id}`}
              prefetch={false}
              className="text-[#00bfff] hover:underline"
            >
              {chapter.number ? `Ch. ${chapter.number}` : "Oneshot"}
            </Link>
          ) : (
            "Chưa có chương"
          )}
        </p>
      </div>
    </Card>
  )
}
