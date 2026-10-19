"use client"

import { useQuery } from "@tanstack/react-query"
import { ArrowRightIcon, SearchIcon } from "lucide-react"
import { parseAsInteger, parseAsString, useQueryStates } from "nuqs"

import { PagePagination } from "@/components/page-pagination"
import { groupDirectoryOptions } from "@/modules/groups/api"
import { GroupDirectoryItems } from "@/modules/groups/directory-items"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@workspace/ui/components/input-group"
import { Skeleton } from "@workspace/ui/components/skeleton"

export function GroupDiscovery({
  apiBaseUrl,
  busy,
  onJoin,
}: {
  apiBaseUrl: string
  busy: boolean
  onJoin: (groupId: string) => void
}) {
  const [filters, setFilters] = useQueryStates(
    { q: parseAsString.withDefault(""), page: parseAsInteger.withDefault(1) },
    { history: "push" }
  )
  const q = filters.q.trim().slice(0, 100)
  const page = Math.max(1, filters.page)
  const groups = useQuery(groupDirectoryOptions(apiBaseUrl, q, page))
  return (
    <section aria-label="Tìm nhóm dịch đã có" className="flex flex-col gap-5">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          const value = String(new FormData(event.currentTarget).get("q") ?? "")
            .trim()
            .slice(0, 100)
          void setFilters({ q: value, page: 1 })
        }}
      >
        <InputGroup className="h-11">
          <InputGroupInput
            key={q}
            aria-label="Tên nhóm dịch"
            name="q"
            defaultValue={q}
            maxLength={100}
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
      </form>
      {groups.isPending ? (
        <div
          aria-label="Đang tải danh sách nhóm dịch"
          role="status"
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {Array.from({ length: 12 }, (_, index) => (
            <Skeleton key={index} className="h-24" />
          ))}
        </div>
      ) : groups.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Không thể tải danh sách nhóm dịch</AlertTitle>
          <AlertDescription>
            <Button
              type="button"
              variant="outline"
              onClick={() => void groups.refetch()}
            >
              Thử lại
            </Button>
          </AlertDescription>
        </Alert>
      ) : groups.data.data.length ? (
        <>
          <GroupDirectoryItems
            groups={groups.data.data}
            busy={busy}
            onJoin={onJoin}
          />
          <PagePagination
            ariaLabel="Phân trang nhóm dịch"
            currentPage={page}
            totalPages={groups.data.meta.totalPages}
            onPageChange={(value) => void setFilters({ page: value })}
            getPageHref={(value) =>
              `/manage/group?${new URLSearchParams({ ...(q ? { q } : {}), page: String(value) })}`
            }
          />
        </>
      ) : (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>
              {q ? "Không tìm thấy nhóm dịch" : "Chưa có nhóm dịch"}
            </EmptyTitle>
            <EmptyDescription>
              Thử tên khác hoặc tạo nhóm mới nếu nhóm của bạn chưa có.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </section>
  )
}
