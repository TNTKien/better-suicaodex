import { PrefetchLink } from "@workspace/ui/components/prefetch-link"
import Link from "next/link"

import { cover256, coverSrcSet } from "@workspace/catalog/images"
import { tagPath } from "@workspace/catalog/routing"
import { AssetImage } from "@workspace/ui/components/asset-image"
import { Badge } from "@workspace/ui/components/badge"
import { Card } from "@workspace/ui/components/card"
import type { components } from "@/src/lib/generated/api"

const statusLabels: Record<string, string> = {
  completed: "Kết thúc.",
  ongoing: "Đang tiến hành.",
  hiatus: "Tạm ngưng.",
  cancelled: "Đã hủy.",
}
const countFormat = new Intl.NumberFormat("vi-VN")

export function MangaRow({
  manga,
}: {
  manga: components["schemas"]["MangaListItem"]
}) {
  const href = `/manga/${manga.id}/${manga.slug}`
  const alternativeTitles = [
    ...new Set(Object.values(manga.alternativeTitles).flat()),
  ]
    .filter((title) => title.trim() && title !== manga.title)
    .slice(0, 2)

  return (
    <Card className="flex-row items-start gap-3 rounded-none border border-white/35 bg-[#111111] p-2 shadow-none ring-0">
      <PrefetchLink
        href={href}
        className="relative aspect-3/4 w-24 shrink-0 overflow-hidden border border-white/35 sm:w-40"
        title={manga.title}
      >
        <AssetImage
          src={cover256(manga.cover?.url ?? null)}
          srcSet={coverSrcSet(manga.cover)}
          sizes="(min-width: 640px) 160px, 96px"
          alt={`Bìa truyện ${manga.title}`}
          width={manga.cover?.width ?? 700}
          height={manga.cover?.height ?? 1000}
          className="absolute inset-0 size-full object-cover"
        />
      </PrefetchLink>
      <div className="min-w-0 flex-1 space-y-2 text-sm wrap-break-word sm:text-lg">
        <h2 className="text-lg leading-tight sm:text-2xl">
          <PrefetchLink
            href={href}
            className="text-[#00bfff] hover:underline"
          >
            {manga.title}
          </PrefetchLink>
          {manga.status && statusLabels[manga.status] && (
            <span> - {statusLabels[manga.status]}</span>
          )}
        </h2>
        <p>
          <span className="font-semibold text-[#888888]">Tên Khác: </span>
          <span className="text-[#00bfff]">
            {alternativeTitles.join("; ") || ""}
          </span>
        </p>
        <div className="flex flex-wrap items-center gap-1">
          <span className="font-semibold text-[#888888]">Thể Loại:</span>
          {manga.tags.map((tag) => (
            <Badge
              key={tag.id}
              className="rounded-[4px] bg-[#237ec7] px-1 py-0.5 text-xs sm:text-sm font-bold text-white hover:bg-[#ae3910]!"
              render={
                <Link href={tagPath(tag.id, tag.slug)} prefetch={false} />
              }
            >
              {tag.name}
            </Badge>
          ))}
        </div>
        <p>
          <span className="font-semibold text-[#888888]">Theo dõi: </span>
          {countFormat.format(manga.statistics.follows)}
        </p>
        <p>
          <span className="font-semibold text-[#888888]">Lượt xem: </span>
          {countFormat.format(manga.statistics.views)}
        </p>
      </div>
    </Card>
  )
}
