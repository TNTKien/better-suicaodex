import { AssetImage } from "@/components/asset-image"
import { cover256, mangaStatusLabel } from "@/lib/catalog"
import type { components } from "@/src/lib/generated/api"
import { Badge } from "@workspace/ui/components/badge"

type Manga = components["schemas"]["MangaManagementDetail"]

export function MangaInformation({ manga }: { manga: Manga }) {
  const alternativeTitle = Object.values(manga.alternativeTitles).flat()[0]

  return (
    <div className="flex min-w-0 gap-4 rounded-lg border bg-muted/30 p-3">
      <div className="aspect-5/7 w-16 shrink-0 overflow-hidden rounded-md sm:w-20">
        <AssetImage
          alt={`Bìa truyện ${manga.title}`}
          className="size-full object-cover"
          height={manga.cover?.height ?? 1_000}
          src={cover256(manga.cover?.url ?? null)}
          width={manga.cover?.width ?? 700}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
        <div className="min-w-0">
          <p className="line-clamp-2 font-heading text-lg font-semibold wrap-break-word">
            {manga.title}
          </p>
          {alternativeTitle ? (
            <p className="line-clamp-1 text-sm text-muted-foreground">
              {alternativeTitle}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge
            variant={
              manga.publicationState === "hidden" ? "secondary" : "default"
            }
          >
            {manga.publicationState === "hidden" ? "Đang ẩn" : "Đang hiển thị"}
          </Badge>
          <Badge variant="outline">{mangaStatusLabel(manga.status)}</Badge>
          {manga.moderationHiddenAt ? (
            <Badge variant="destructive">Bị quản trị viên ẩn</Badge>
          ) : null}
        </div>
        {manga.moderationReason ? (
          <p className="text-sm text-destructive">
            Lý do: {manga.moderationReason}
          </p>
        ) : null}
      </div>
    </div>
  )
}
