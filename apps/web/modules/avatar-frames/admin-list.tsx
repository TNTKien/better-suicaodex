"use client"

import { useState } from "react"
import Link from "next/link"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { FrameIcon, PlusIcon, RefreshCwIcon, SearchIcon } from "lucide-react"
import {
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs"

import { useAccount } from "@/modules/account/provider"
import { AdminPagination } from "@/modules/moderation/admin-pagination"
import { AdminFrameShopEditor } from "@/modules/shop/admin-frame-editor"
import { coinLabel } from "@/modules/shop/admin-api"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Spinner } from "@workspace/ui/components/spinner"

import {
  type AdminAvatarFrame,
  type FrameFilters,
  AvatarFrameError,
  adminFramesOptions,
  defaultFrameFilters,
  frameErrorMessage,
  frameTopicsOptions,
} from "./admin-api"
import { AdminFrameEditor } from "./admin-editor"
import { AdminFramePreview } from "./admin-preview"
import { AdminFrameTopics } from "./admin-topics"

export const frameListParams = {
  page: parseAsInteger.withDefault(1),
  q: parseAsString.withDefault(""),
  rarity: parseAsStringLiteral(["all", "R", "SR", "SSR"]).withDefault("all"),
  active: parseAsStringLiteral(["all", "true", "false"]).withDefault("all"),
  limited: parseAsStringLiteral(["all", "true", "false"]).withDefault("all"),
  topicId: parseAsString.withDefault("all"),
}
const rarityFilters = [
  { label: "Tất cả độ hiếm", value: "all" },
  ...["R", "SR", "SSR"].map((value) => ({ label: value, value })),
]
const activeFilters = [
  { label: "Tất cả trạng thái", value: "all" },
  { label: "Đang bật", value: "true" },
  { label: "Đang tắt / bản nháp", value: "false" },
]
const limitedFilters = [
  { label: "Tất cả loại khung", value: "all" },
  { label: "Limited", value: "true" },
  { label: "Không limited", value: "false" },
]

function FilterSelect({
  label,
  items,
  value,
  onChange,
}: {
  label: string
  items: { label: string; value: string }[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <Select
      items={items}
      value={value}
      onValueChange={(next) => {
        if (next) onChange(next)
      }}
    >
      <SelectTrigger aria-label={label} className="w-full sm:w-48">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {items.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

export function AdminFrameCard({
  frame,
  onEdit,
  topicName,
  commerce = false,
}: {
  frame: AdminAvatarFrame
  onEdit: (frame: AdminAvatarFrame) => void
  topicName?: string
  commerce?: boolean
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="line-clamp-1 wrap-anywhere">
          {frame.name}
        </CardTitle>
        <p className="text-xs wrap-anywhere text-muted-foreground">
          {frame.code}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <AdminFramePreview frame={frame.frame} />
        <p className="text-xs wrap-anywhere text-muted-foreground">
          {topicName ?? (frame.topicId ? "…" : "Khác")}
        </p>
        {frame.description && (
          <p className="line-clamp-2 text-sm wrap-anywhere text-muted-foreground">
            {frame.description}
          </p>
        )}
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline">{frame.rarity}</Badge>
          {frame.limited && <Badge variant="secondary">Limited</Badge>}
          {frame.frame?.animated && <Badge variant="outline">Ảnh động</Badge>}
          <Badge variant={frame.active ? "default" : "secondary"}>
            {frame.active ? "Đang bật" : frame.frame ? "Đang tắt" : "Bản nháp"}
          </Badge>
        </div>
        {commerce && (
          <div className="space-y-1 text-sm">
            <p>
              Giá:{" "}
              {frame.shop.price === null
                ? "Chưa đặt giá"
                : coinLabel(frame.shop.price)}
            </p>
            <p>Tồn kho: {frame.shop.stock.toLocaleString("vi-VN")}</p>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button
          type="button"
          className="w-full"
          variant="outline"
          aria-label={
            commerce
              ? `Giá và tồn kho khung ${frame.name}`
              : `Quản lý khung ${frame.name}`
          }
          onClick={() => onEdit(frame)}
        >
          {commerce ? "Giá / tồn kho" : "Quản lý"}
        </Button>
      </CardFooter>
    </Card>
  )
}

export function AdminAvatarFrameList({
  commerce = false,
}: {
  commerce?: boolean
}) {
  const account = useAccount()
  if (account.status !== "authenticated" || !account.user) return null
  return (
    <FrameListContent
      key={account.user.id}
      apiBaseUrl={account.apiBaseUrl}
      userId={account.user.id}
      commerce={commerce}
    />
  )
}

function FrameListContent({
  apiBaseUrl,
  userId,
  commerce,
}: {
  apiBaseUrl: string
  userId: string
  commerce: boolean
}) {
  const queryClient = useQueryClient()
  const [params, setParams] = useQueryStates(frameListParams, {
    history: "push",
  })
  const filters: FrameFilters = {
    ...params,
    page: Math.max(1, params.page),
    q: params.q.trim().slice(0, 160),
  }
  const query = useQuery(adminFramesOptions(apiBaseUrl, userId, filters))
  const topics = useQuery(frameTopicsOptions(apiBaseUrl, userId))
  const [manageTopics, setManageTopics] = useState(false)
  const topicItems = [
    { label: "Tất cả chủ đề", value: "all" },
    { label: "Khác", value: "none" },
    ...(topics.data?.data ?? []).map((topic) => ({
      label: topic.name,
      value: topic.id,
    })),
  ]
  if (!topicItems.some((item) => item.value === filters.topicId))
    topicItems.push({
      label: "Chủ đề không khả dụng",
      value: filters.topicId ?? "all",
    })
  const [editor, setEditor] = useState<{
    frame: AdminAvatarFrame | null
  } | null>(null)
  const onChanged = () => {
    // Catalog changes also affect equipped frames and the admin audit trail.
    void queryClient.invalidateQueries({ queryKey: ["account", apiBaseUrl] })
    void queryClient.invalidateQueries({ queryKey: ["comments", apiBaseUrl] })
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <form
            className="w-full sm:max-w-md"
            role="search"
            onSubmit={(event) => {
              event.preventDefault()
              const formData = new FormData(event.currentTarget)
              void setParams({
                q: String(formData.get("q") ?? "").trim(),
                page: 1,
              })
            }}
          >
            <InputGroup>
              <InputGroupInput
                key={filters.q}
                name="q"
                aria-label="Tìm khung theo tên hoặc mã"
                placeholder="Tìm tên hoặc mã khung…"
                maxLength={160}
                defaultValue={filters.q}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  type="submit"
                  size="icon-xs"
                  aria-label="Tìm khung"
                >
                  <SearchIcon />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </form>
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            {!commerce && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setManageTopics(true)}
              >
                Chủ đề
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
            >
              {query.isFetching ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <RefreshCwIcon data-icon="inline-start" />
              )}
              Tải lại
            </Button>
            {commerce ? (
              <Link
                href="/admin/avatar-frames"
                className={buttonVariants({ variant: "outline" })}
              >
                Quản lý khung
              </Link>
            ) : (
              <Button type="button" onClick={() => setEditor({ frame: null })}>
                <PlusIcon data-icon="inline-start" />
                Thêm khung
              </Button>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <FilterSelect
            label="Lọc chủ đề"
            items={topicItems}
            value={filters.topicId ?? "all"}
            onChange={(topicId) => void setParams({ topicId, page: 1 })}
          />
          <FilterSelect
            label="Lọc độ hiếm"
            items={rarityFilters}
            value={filters.rarity}
            onChange={(rarity) =>
              void setParams({
                rarity: rarity as FrameFilters["rarity"],
                page: 1,
              })
            }
          />
          <FilterSelect
            label="Lọc trạng thái"
            items={activeFilters}
            value={filters.active}
            onChange={(active) =>
              void setParams({
                active: active as FrameFilters["active"],
                page: 1,
              })
            }
          />
          <FilterSelect
            label="Lọc loại khung"
            items={limitedFilters}
            value={filters.limited}
            onChange={(limited) =>
              void setParams({
                limited: limited as FrameFilters["limited"],
                page: 1,
              })
            }
          />
          {(filters.q ||
            filters.rarity !== "all" ||
            filters.active !== "all" ||
            filters.limited !== "all" ||
            filters.topicId !== "all") && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => void setParams(defaultFrameFilters)}
            >
              Xoá bộ lọc
            </Button>
          )}
        </div>
      </div>

      {query.isPending && (
        <div
          role="status"
          className="flex items-center gap-2 py-6 text-sm text-muted-foreground"
        >
          <Spinner />
          Đang tải danh sách khung…
        </div>
      )}
      {topics.isError && (
        <Alert variant="destructive">
          <AlertDescription>
            Không tải được danh sách chủ đề.{" "}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void topics.refetch()}
            >
              Tải lại chủ đề
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {query.isError && (
        <Alert variant="destructive">
          <AlertTitle>Không tải được danh sách khung</AlertTitle>
          <AlertDescription>
            <p>
              {query.error instanceof AvatarFrameError
                ? frameErrorMessage(query.error)
                : "Không kết nối được với máy chủ. Kiểm tra mạng rồi thử tải lại."}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
            >
              Thử lại
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {query.data && (
        <>
          <p className="text-sm text-muted-foreground">
            {query.data.meta.total} khung · 20 khung mỗi trang. Danh sách dùng
            preview tĩnh; mở khung để xem ảnh động.
          </p>
          {query.data.data.length ? (
            <div
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
              aria-label="Danh sách khung avatar"
              aria-busy={query.isFetching}
            >
              {query.data.data.map((frame) => (
                <AdminFrameCard
                  key={frame.id}
                  frame={frame}
                  commerce={commerce}
                  topicName={
                    topics.data?.data.find(
                      (topic) => topic.id === frame.topicId
                    )?.name
                  }
                  onEdit={(selected) => setEditor({ frame: selected })}
                />
              ))}
            </div>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FrameIcon />
                </EmptyMedia>
                <EmptyTitle>Chưa có khung phù hợp</EmptyTitle>
                <EmptyDescription>
                  {commerce
                    ? "Thay đổi bộ lọc để xem danh sách hoặc thêm khung ở trang quản lý khung."
                    : "Thêm khung mới hoặc thay đổi bộ lọc để xem danh sách."}
                </EmptyDescription>
              </EmptyHeader>
              {filters.page > 1 && (
                <Button
                  variant="outline"
                  onClick={() => void setParams({ page: 1 })}
                >
                  Về trang đầu
                </Button>
              )}
            </Empty>
          )}
          <AdminPagination
            ariaLabel="Phân trang khung avatar"
            currentPage={filters.page}
            totalPages={query.data.meta.totalPages}
            disabled={query.isFetching}
            onPageChange={(page) => setParams({ page })}
          />
        </>
      )}
      {editor && commerce && editor.frame ? (
        <AdminFrameShopEditor
          initialFrame={editor.frame}
          apiBaseUrl={apiBaseUrl}
          onChanged={onChanged}
          onClose={() => setEditor(null)}
        />
      ) : (
        editor && (
          <AdminFrameEditor
            initialFrame={editor.frame}
            apiBaseUrl={apiBaseUrl}
            userId={userId}
            onChanged={onChanged}
            onClose={() => setEditor(null)}
          />
        )
      )}
      {manageTopics && (
        <AdminFrameTopics
          apiBaseUrl={apiBaseUrl}
          userId={userId}
          onClose={() => setManageTopics(false)}
        />
      )}
    </>
  )
}
