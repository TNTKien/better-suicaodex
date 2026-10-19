import Link from "next/link"
import { coverSrcSet } from "@workspace/catalog/images"
import { Fragment, type ReactNode } from "react"
import { formatVietnamDateTime } from "@workspace/catalog/date"

import { tagPath } from "@workspace/catalog/routing"
import { AssetImage } from "@workspace/ui/components/asset-image"
import { Badge } from "@workspace/ui/components/badge"
import type { components } from "@/src/lib/generated/api"
import { MangaLibraryAction } from "@/modules/library/manga-library-action"
import { MangaReadActions } from "@/modules/reading/manga-read-actions"
import { LazyCommentSection } from "@/modules/comments/lazy-comment-section"
import { MangaDescription } from "./manga-description"
import { MangaChapterHeader } from "./manga-chapter-header"

type MangaDetail = components["schemas"]["MangaDetail"]
const countFormat = new Intl.NumberFormat("vi-VN")
const statusLabels: Record<string, string> = {
  ongoing: "Đang tiến hành",
  completed: "Kết thúc",
  hiatus: "Tạm ngưng",
  cancelled: "Đã hủy",
}

function Credits({
  label,
  path,
  people,
}: {
  label: string
  path: "group" | "author" | "artist"
  people: { id: string; slug: string; name: string }[]
}) {
  return (
    <p>
      <span className="font-bold text-[#888888]">{label}: </span>
      {people.length
        ? people.map((person, index) => (
            <Fragment key={person.id}>
              {index > 0 ? ", " : null}
              <Link
                href={`/${path}/${encodeURIComponent(person.id)}/${encodeURIComponent(person.slug)}`}
                prefetch={false}
                className="text-[#00bfff] hover:underline"
              >
                {person.name}
              </Link>
            </Fragment>
          ))
        : ""}
    </p>
  )
}

export function MangaDetailView({
  manga,
  chapters,
}: {
  manga: MangaDetail
  chapters?: ReactNode
}) {
  const alternativeTitles = [
    ...new Set(Object.values(manga.alternativeTitles).flat()),
  ].filter((title) => title.trim() && title !== manga.title)
  return (
    <article className="min-w-0">
      <nav aria-label="Breadcrumb" className="mb-2 px-2 text-sm text-[#00bfff]">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/" className="hover:underline">
              Trang chủ
            </Link>
          </li>
          <li aria-hidden="true" className="text-white">
            /
          </li>
          <li>
            <Link href="/latest" className="hover:underline">
              Danh sách
            </Link>
          </li>
          <li aria-hidden="true" className="text-white">
            /
          </li>
          <li aria-current="page" className="min-w-0 wrap-break-word">
            {manga.title}
          </li>
        </ol>
      </nav>
      <div className="flex flex-col-reverse items-start gap-6 md:flex-row">
        <div className="flex w-full min-w-0 flex-1 flex-col gap-6">
          <section
            aria-labelledby="manga-info-heading"
            className="hvn-login-panel w-full min-w-0 flex-1"
          >
            <h2
              id="manga-info-heading"
              className="hvn-login-heading hvn-login-heading-info"
            >
              Thông tin truyện
            </h2>
            <div className="flex flex-col gap-3 px-4 py-5 text-base wrap-break-word sm:px-6">
              <h1 className="mb-1 text-2xl font-bold text-[#44b9fa] sm:text-[28px]">
                {manga.title}
              </h1>
              <p>
                <span className="font-bold text-[#888888]">Tên Khác: </span>
                <span className="text-[#00bfff]">
                  {alternativeTitles.join("; ") || ""}
                </span>
              </p>
              <div className="flex flex-wrap items-center gap-1">
                <span className="font-bold text-[#888888]">Thể Loại:</span>
                {manga.tags.map((tag) => (
                  <Badge
                    key={tag.id}
                    className="rounded-[4px] bg-[#237ec7] px-1 py-0.5 text-sm font-bold text-white hover:bg-[#ae3910]!"
                    render={
                      <Link href={tagPath(tag.id, tag.slug)} prefetch={false} />
                    }
                  >
                    {tag.name}
                  </Badge>
                ))}
              </div>
              <Credits label="Nhóm dịch" path="group" people={manga.groups} />
              <Credits label="Tác giả" path="author" people={manga.authors} />
              {manga.artists.length > 0 && (
                <Credits label="Họa sĩ" path="artist" people={manga.artists} />
              )}
              {manga.links.length > 0 && (
                <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
                  <span className="font-bold text-[#888888]">Liên kết:</span>
                  {manga.links.map((link) => (
                    <a
                      key={link.key}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#00bfff] hover:underline"
                    >
                      {link.label},
                    </a>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-x-12 gap-y-3">
                <p>
                  <span className="font-bold text-[#888888]">Tình Trạng: </span>
                  <span className="text-[#00bfff]">
                    {manga.status
                      ? (statusLabels[manga.status] ?? manga.status)
                      : "Chưa rõ trạng thái"}
                  </span>
                </p>
                <p>
                  <span className="font-bold text-[#888888]">Lượt xem: </span>
                  {countFormat.format(manga.statistics.views)}
                </p>
                <MangaLibraryAction
                  mangaId={manga.id}
                  returnTo={`/manga/${manga.id}/${manga.slug}`}
                />
              </div>
              <div className="flex flex-col gap-3">
                <h3 className="font-bold text-[#888888]">Nội dung:</h3>
                {manga.description ? (
                  <MangaDescription>{manga.description}</MangaDescription>
                ) : null}
              </div>
              <p className="mt-1 text-right text-sm">
                <span className="font-bold">Update: </span>
                <time dateTime={manga.updatedAt} className="italic">
                  {formatVietnamDateTime(manga.updatedAt)}
                </time>
              </p>
            </div>
          </section>
          <MangaChapterHeader manga={manga}>{chapters}</MangaChapterHeader>
          <LazyCommentSection
            scope="manga"
            targetId={manga.id}
            key={manga.id}
          />
        </div>
        <aside
          aria-label="Ảnh bìa và nút đọc"
          className="flex w-full max-w-xs shrink-0 flex-col gap-4 self-center md:w-66 md:self-start"
        >
          <section
            className="hvn-login-panel"
            aria-labelledby="manga-cover-heading"
          >
            <h2
              id="manga-cover-heading"
              className="hvn-login-heading hvn-login-heading-main"
            >
              Ảnh bìa
            </h2>
            <div className="p-1.5">
              <div className="border border-white/50 p-0.5">
                <AssetImage
                  src={manga.cover?.url ?? null}
                  srcSet={coverSrcSet(manga.cover)}
                  sizes="(min-width: 768px) 244px, 300px"
                  alt={`Bìa truyện ${manga.title}`}
                  width={manga.cover?.width ?? 700}
                  height={manga.cover?.height ?? 1000}
                  className="h-auto w-full"
                  eager
                />
              </div>
            </div>
          </section>
          <MangaReadActions
            mangaId={manga.id}
            hasChapters={manga.chapterCounts.releases > 0}
          />
        </aside>
      </div>
    </article>
  )
}
