import { PrefetchLink } from "@workspace/ui/components/prefetch-link"
import { coverSrcSet } from "@workspace/catalog/images"

import { AssetImage } from "@workspace/ui/components/asset-image"
import { Card, CardFooter } from "@workspace/ui/components/card"
import type { components } from "@/src/lib/generated/api"

export function MangaCard({
  manga,
}: {
  manga: components["schemas"]["MangaSummary"]
}) {
  const chapter = manga.latestChapter

  return (
    <PrefetchLink
      href={`/manga/${manga.id}/${manga.slug}`}
      className="block h-full min-w-0"
      title={manga.title}
    >
      <Card className="h-full min-w-0 gap-0 rounded-none border border-white/35 bg-background py-0 shadow-none ring-0">
        <div className="relative aspect-5/7 w-full overflow-hidden">
          <AssetImage
            alt={`Bìa truyện ${manga.title}`}
            src={manga.cover?.url ?? null}
            srcSet={coverSrcSet(manga.cover)}
            sizes="auto, (min-width: 768px) 33vw, 50vw"
            width={manga.cover?.width ?? 700}
            height={manga.cover?.height ?? 1000}
            className="absolute inset-0 size-full object-cover"
          />
          <p className="absolute inset-x-0 bottom-0 line-clamp-1 bg-black/80 px-1 py-0.5 text-center text-xs font-semibold text-white md:text-sm">
            {chapter
              ? chapter.number
                ? `Ch. ${chapter.number}`
                : "Oneshot"
              : "Chưa có chương"}
          </p>
        </div>
        <CardFooter className="min-h-10 flex-1 items-start justify-center rounded-none bg-[#2c2b2c] px-3 py-1 md:min-h-12">
          <h3 className="line-clamp-1 w-full text-center text-sm font-semibold wrap-break-word text-[#5babde] md:line-clamp-2">
            {manga.title}
          </h3>
        </CardFooter>
      </Card>
    </PrefetchLink>
  )
}
