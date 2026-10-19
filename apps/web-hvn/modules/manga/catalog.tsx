import "server-only"

import { io } from "next/cache"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { BookOpenIcon } from "lucide-react"
import { getMangaList } from "@workspace/catalog/server"
import { pageHref, pageNumber } from "@workspace/catalog/pagination"
import { personRoleLabels, type PersonRole } from "@workspace/catalog/routing"
import { PagePagination } from "@workspace/ui/components/page-pagination"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import type { components } from "@/src/lib/generated/api"
import { AssetImage } from "@workspace/ui/components/asset-image"
import { MangaRow } from "./manga-row"
import { GroupInfo } from "@/modules/groups/group-info"

export type CatalogSearchParams = Promise<{ page?: string | string[] }>
type CatalogPageProps = {
  path: string
  sort: "latestChapter" | "publishedAt"
  title: string
  searchParams: CatalogSearchParams
  tag?: components["schemas"]["TagSummary"]
  group?: components["schemas"]["TranslationGroupDetail"]
  person?: Pick<components["schemas"]["PersonDetail"], "id" | "name"> & {
    role: PersonRole
  }
}

export async function CatalogResults({
  path,
  sort,
  title,
  searchParams,
  tag,
  person,
  group,
}: CatalogPageProps) {
  const page = pageNumber((await searchParams).page)
  await io()
  const result = await getMangaList<components["schemas"]["MangaList"]>({
    sort,
    direction: "desc",
    limit: 36,
    page,
    includeTag: tag ? [tag.id] : [],
    author: person?.role === "author" ? [person.id] : [],
    artist: person?.role === "artist" ? [person.id] : [],
    group: group ? [group.id] : [],
    hasChapter: group ? "all" : undefined,
  })
  if (page > Math.max(1, result.meta.totalPages)) notFound()
  if (result.data.length === 0)
    return (
      <Empty className="rounded-none border border-t-0 border-white/35">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BookOpenIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>Không có truyện nào</EmptyTitle>
          <EmptyDescription>Mục này hiện chưa có nội dung.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )

  return (
    <div className="flex flex-col gap-4 border border-t-0 border-white/35 p-2">
      <div className="flex flex-col gap-2">
        {result.data.map((manga) => (
          <MangaRow key={manga.id} manga={manga} />
        ))}
      </div>
      <PagePagination
        variant="hvn"
        ariaLabel={`Phân trang ${title.toLocaleLowerCase("vi")}`}
        currentPage={page}
        getPageHref={(targetPage) => pageHref(path, targetPage)}
        totalPages={result.meta.totalPages}
      />
    </div>
  )
}

export function CatalogPage(props: CatalogPageProps) {
  return (
    <section className="min-w-0">
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
          {(props.tag || props.person || props.group) && (
            <>
              <li>
                {props.group ? (
                  "Nhóm dịch"
                ) : props.person ? (
                  personRoleLabels[props.person.role]
                ) : (
                  "Thể loại"
                )}
              </li>
              <li aria-hidden="true" className="text-white">
                /
              </li>
            </>
          )}
          <li aria-current="page">{props.title}</li>
        </ol>
      </nav>
      {props.group ? <GroupInfo group={props.group} /> : null}
      {props.tag && (
        <section
          className="hvn-login-panel mb-6"
          aria-labelledby="tag-info-heading"
        >
          <h2
            id="tag-info-heading"
            className="hvn-login-heading hvn-login-heading-info"
          >
            Thông tin
          </h2>
          <div className="flex items-start gap-3 px-4 py-4 sm:gap-4">
            <AssetImage
              src="/brand/the-loai-mac-dinh.webp"
              alt=""
              width={128}
              height={128}
              className="size-20 shrink-0 rounded-full object-cover sm:size-22"
            />
            <div className="min-w-0">
              <h3 className="text-xl font-bold sm:text-2xl">
                {props.tag.name}
              </h3>
              <p className="text-base sm:text-lg">
                Các truyện thuộc thể loại {props.tag.name}
              </p>
            </div>
          </div>
        </section>
      )}
      <div className="hvn-home-heading-frame">
        <h1 className="hvn-home-heading line-clamp-1 break-all" data-kind="catalog">
          {props.tag || props.person || props.group
            ? `Danh sách truyện: ${props.title}`
            : props.title}
        </h1>
      </div>
      <Suspense
        fallback={
          <div className="flex min-h-48 items-center justify-center border border-t-0 border-white/35">
            <Spinner
              aria-label={`Đang tải ${props.title.toLocaleLowerCase("vi")}`}
            />
          </div>
        }
      >
        <CatalogResults {...props} />
      </Suspense>
    </section>
  )
}
