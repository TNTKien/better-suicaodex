import Link from "next/link"
import type { ReactNode } from "react"
import { mangaDetailHref } from "@workspace/catalog/manga-routing"
import { AssetImage } from "@workspace/ui/components/asset-image"
import type { components } from "@/src/lib/generated/api"
import { CopyMangaLink } from "./copy-manga-link"

type Manga = Pick<
  components["schemas"]["MangaDetail"],
  "id" | "slug" | "groups" | "statistics"
>
const countFormat = new Intl.NumberFormat("vi-VN")

export function MangaChapterHeader({
  manga,
  children,
}: {
  manga: Manga
  children?: ReactNode
}) {
  const group = manga.groups[0]
  const isSystem = group?.slug === "system"
  return (
    <section
      aria-labelledby="manga-chapters-heading"
      className="hvn-login-panel"
    >
      <h2 id="manga-chapters-heading" className="hvn-home-heading">
        DANH SÁCH CHƯƠNG
      </h2>
      <div className="px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-[#2494f4] pb-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="shrink-0 border border-[#666666] p-0.5">
              <AssetImage
                src={group?.avatarUrl ?? "/brand/mac_dinh.webp"}
                fallbackSrc="/brand/mac_dinh.webp"
                alt={group ? `Ảnh nhóm ${group.name}` : "Ảnh nhóm mặc định"}
                width={80}
                height={80}
                className="size-20 object-cover sm:size-22"
              />
            </div>
            <div className="min-w-0">
              <p>Nhóm dịch:</p>
              {group ? (
                <>
                  <Link
                    href={`/group/${encodeURIComponent(group.id)}/${encodeURIComponent(group.slug)}`}
                    prefetch={false}
                    className="text-xl font-bold wrap-break-word text-[#00bfff] hover:underline"
                  >
                    {group.name}
                  </Link>
                  <p className="mt-1 flex items-center gap-1 text-sm font-bold">
                    <AssetImage
                      src={
                        isSystem
                          ? "/brand/uploader.webp"
                          : "/brand/chuthot.webp"
                      }
                      alt=""
                      width={16}
                      height={16}
                      className="size-4 object-contain"
                    />
                    {isSystem ? "Uploader" : "Chủ thớt"}
                  </p>
                </>
              ) : (
                <p className="text-[#888888]">Chưa có nhóm dịch</p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-6 self-center">
            <span className="flex items-center gap-1" title="Lượt theo dõi">
              <AssetImage
                src="/brand/like.webp"
                alt="Lượt theo dõi"
                width={32}
                height={32}
                className="size-8 object-contain"
              />
              {manga.statistics.follows > 0 ? (
                <span>{countFormat.format(manga.statistics.follows)}</span>
              ) : null}
            </span>
            <span className="flex items-center gap-1" title="Bình luận">
              <AssetImage
                src="/brand/dis.webp"
                alt="Bình luận"
                width={32}
                height={32}
                className="size-8 object-contain"
              />
              {manga.statistics.comments > 0 ? (
                <span>{countFormat.format(manga.statistics.comments)}</span>
              ) : null}
            </span>
          </div>
          <CopyMangaLink path={mangaDetailHref(manga)} />
        </div>
        {children}
      </div>
    </section>
  )
}
