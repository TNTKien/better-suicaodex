import type { Metadata } from "next"
import Form from "next/form"
import { notFound } from "next/navigation"
import { ArrowRightIcon, SearchIcon, UsersIcon } from "lucide-react"
import { Suspense } from "react"

import { PagePagination } from "@/components/page-pagination"
import { getGroups } from "@/lib/api"
import { groupsHref, loadGroupsSearchParams } from "@/lib/catalog"
import { GroupDirectoryItems } from "@/modules/groups/directory-items"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@workspace/ui/components/input-group"
import { Skeleton } from "@workspace/ui/components/skeleton"

type Props = {
  searchParams: Promise<{
    q?: string | string[]
    page?: string | string[]
  }>
}

function normalizeQuery(value: string) {
  return value.trim().slice(0, 100)
}

export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const params = await loadGroupsSearchParams(searchParams)
  const query = normalizeQuery(params.q)
  return {
    title: "Nhóm dịch",
    description:
      "Khám phá các nhóm dịch truyện tranh, thông tin liên hệ và những bộ truyện của nhóm trên SuicaoDex.",
    alternates: { canonical: groupsHref(query, params.page) },
    ...(query ? { robots: { index: false, follow: true } } : {}),
  }
}

function GroupSearch({ query }: { query: string }) {
  return (
    <Form action="/groups">
      <InputGroup className="h-11">
        <InputGroupInput
          aria-label="Tên nhóm dịch"
          defaultValue={query}
          maxLength={100}
          name="q"
          placeholder="Nhập tên nhóm..."
        />
        <InputGroupAddon>
          <SearchIcon aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            aria-label="Tìm kiếm nhóm dịch"
            size="icon-sm"
            type="submit"
          >
            <ArrowRightIcon aria-hidden="true" />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </Form>
  )
}

async function GroupDirectory({ searchParams }: Props) {
  const params = await loadGroupsSearchParams(searchParams)
  const query = normalizeQuery(params.q)
  const result = await getGroups({
    q: query || undefined,
    page: params.page,
    limit: 36,
  })

  if (params.page > Math.max(1, result.meta.totalPages)) notFound()

  return (
    <div className="flex flex-col gap-5">
      <GroupSearch query={query} />
      {result.data.length ? (
        <>
          <GroupDirectoryItems groups={result.data} />
          <PagePagination
            ariaLabel="Phân trang nhóm dịch"
            currentPage={params.page}
            getPageHref={(page) => groupsHref(query, page)}
            totalPages={result.meta.totalPages}
          />
        </>
      ) : (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UsersIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>
              {query ? "Không tìm thấy nhóm dịch" : "Chưa có nhóm dịch"}
            </EmptyTitle>
            <EmptyDescription>
              {query
                ? `Không có nhóm dịch nào.`
                : "Các nhóm dịch công khai sẽ xuất hiện tại đây."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  )
}

function GroupsSkeleton() {
  return (
    <div
      aria-label="Đang tải danh sách nhóm dịch"
      className="flex flex-col gap-5"
      role="status"
    >
      <Skeleton className="h-11 w-full" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 12 }, (_, index) => (
          <Skeleton className="h-11" key={index} />
        ))}
      </div>
    </div>
  )
}

export default function GroupsPage(props: Props) {
  return (
    <section className="mx-auto flex w-full max-w-480 flex-col gap-5 px-4 py-6 sm:px-6">
      <h1 className="section-heading text-2xl">Nhóm dịch</h1>
      <Suspense fallback={<GroupsSkeleton />}>
        <GroupDirectory {...props} />
      </Suspense>
    </section>
  )
}
