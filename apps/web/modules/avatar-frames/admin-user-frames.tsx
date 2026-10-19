"use client"

import { useId, useState, type ReactNode } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ChevronDownIcon, FrameIcon, SearchIcon } from "lucide-react"

import { formatVietnamDateTimeInline } from "@/lib/date"
import { AdminPagination } from "@/modules/moderation/admin-pagination"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"

import {
  adminFramesOptions,
  defaultFrameFilters,
  frameErrorMessage,
  frameTopicsOptions,
  type AdminAvatarFrame,
} from "./admin-api"
import { AdminFramePreview } from "./admin-preview"
import {
  canGrantFrame,
  changeUserFrame,
  invalidateUserFrames,
  userFramesOptions,
  type UserFrame,
} from "./admin-user-api"

type FrameAction = { kind: "grant" | "revoke"; frame: UserFrame["frame"] }
const pageSize = 20

function FrameCard({
  frame,
  rarity,
  children,
  badges,
}: {
  frame: UserFrame["frame"]
  rarity: UserFrame["rarity"]
  children: ReactNode
  badges?: ReactNode
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="line-clamp-2 min-h-[2lh] wrap-anywhere">
          {frame.name}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <AdminFramePreview frame={frame} />
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline">{rarity}</Badge>
          {frame.animated && <Badge variant="outline">Ảnh động</Badge>}
          {badges}
        </div>
      </CardContent>
      <CardFooter className="mt-auto flex-col items-stretch gap-2">
        {children}
      </CardFooter>
    </Card>
  )
}

export function OwnedUserFrameCard({
  item,
  disabled,
  onRevoke,
}: {
  item: UserFrame
  disabled: boolean
  onRevoke: (item: UserFrame) => void
}) {
  return (
    <FrameCard
      frame={item.frame}
      rarity={item.rarity}
      badges={
        <>
          {item.selected && <Badge>Đang chọn</Badge>}
          {!item.active && <Badge variant="secondary">Đang tắt</Badge>}
          {item.limited && <Badge variant="secondary">Limited</Badge>}
        </>
      }
    >
      <p className="text-xs text-muted-foreground">
        Cấp lúc {formatVietnamDateTimeInline(item.grantedAt)}
      </p>
      {item.limited ? (
        <p className="text-xs text-muted-foreground">
          Không thể gỡ khung limited từ quản trị.
        </p>
      ) : (
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          aria-label={`Gỡ khung ${item.frame.name}`}
          onClick={() => onRevoke(item)}
        >
          Gỡ khung
        </Button>
      )}
    </FrameCard>
  )
}

export function AdminUserAvatarFrames({
  apiBaseUrl,
  actorUserId,
  targetUserId,
  userName,
}: {
  apiBaseUrl: string
  actorUserId: string
  targetUserId: string
  userName: string
}) {
  const client = useQueryClient()
  const [open, setOpen] = useState(false)
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [action, setAction] = useState<FrameAction | null>(null)
  const formId = useId()
  const inventory = useQuery({
    ...userFramesOptions(apiBaseUrl, actorUserId, targetUserId),
    enabled: open || catalogOpen,
  })
  const ownedIds = new Set(inventory.data?.data.map((item) => item.frame.id))
  const mutation = useMutation({
    retry: false,
    networkMode: "always",
    mutationFn: (current: FrameAction) =>
      changeUserFrame(apiBaseUrl, targetUserId, current.frame.id, current.kind),
    onSuccess: async (result, current) => {
      setAction(null)
      // Keep the warehouse open to allow granting another frame.
      toast.add({
        type: "success",
        title: result.changed
          ? current.kind === "grant"
            ? "Đã cấp khung cho người dùng"
            : "Đã gỡ khung của người dùng"
          : current.kind === "grant"
            ? "Người dùng đã sở hữu khung này"
            : "Khung đã được gỡ trước đó",
      })
      await invalidateUserFrames(client, apiBaseUrl)
    },
    onError: async () => {
      // A transport failure may happen after commit. Re-read ownership before
      // permitting another action; PUT/DELETE remain idempotent on the server.
      await invalidateUserFrames(client, apiBaseUrl)
    },
  })
  const chooseAction = (next: FrameAction) => {
    mutation.reset()
    setAction(next)
  }
  const closeAction = () => {
    if (mutation.isPending) return
    setAction(null)
    mutation.reset()
  }
  const closeCatalog = () => {
    if (mutation.isPending) return
    closeAction()
    setCatalogOpen(false)
  }
  const inventoryReady = inventory.isSuccess && !inventory.isFetching
  const actionStillValid =
    !!action &&
    inventoryReady &&
    (action.kind === "grant"
      ? !ownedIds.has(action.frame.id)
      : inventory.data.data.some(
          (item) => item.frame.id === action.frame.id && !item.limited
        ))
  const totalPages = Math.ceil((inventory.data?.data.length ?? 0) / pageSize)
  const currentPage = Math.min(page, Math.max(1, totalPages))
  const visible =
    inventory.data?.data.slice(
      (currentPage - 1) * pageSize,
      currentPage * pageSize
    ) ?? []
  const confirmation = action ? (
    <FrameConfirmation
      action={action}
      formId={formId}
      error={mutation.isError ? frameErrorMessage(mutation.error) : null}
      pending={mutation.isPending}
      valid={actionStillValid}
      onSubmit={() => {
        if (actionStillValid) mutation.mutate(action)
      }}
    />
  ) : null
  const submitButton = action ? (
    <Button
      type="submit"
      form={formId}
      variant={action.kind === "revoke" ? "destructive" : "default"}
      disabled={mutation.isPending || !actionStillValid}
    >
      {mutation.isPending && <Spinner aria-hidden="true" />}
      {action.kind === "grant" ? "Xác nhận cấp khung" : "Xác nhận gỡ khung"}
    </Button>
  ) : null

  return (
    <>
      <Collapsible
        className="group/collapsible"
        open={open}
        onOpenChange={setOpen}
        render={<Card size="sm" />}
      >
        <CardHeader>
          <CardTitle>
            Khung Avatar
            {inventory.data ? ` (${inventory.data.data.length})` : ""}
          </CardTitle>
          <CardDescription className="col-span-2 sm:col-span-1">
            Xem, cấp và gỡ khung của người dùng. Cấp khung không tự trang bị.
          </CardDescription>
          <CardAction className="row-span-1 flex flex-wrap items-center gap-2 sm:row-span-2">
            <Button
              type="button"
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => setCatalogOpen(true)}
            >
              <FrameIcon aria-hidden="true" data-icon="inline-start" />
              Kho khung
            </Button>
            <CollapsibleTrigger
              aria-label="Thu gọn hoặc mở rộng Khung Avatar"
              disabled={mutation.isPending}
              render={<Button type="button" variant="ghost" size="icon-sm" />}
            >
              <ChevronDownIcon
                aria-hidden="true"
                className="transition-transform group-data-open/collapsible:rotate-180 motion-reduce:transition-none"
              />
            </CollapsibleTrigger>
          </CardAction>
        </CardHeader>
        <CollapsibleContent>
          <CardContent>
            {inventory.isPending ? (
              <Spinner
                className="self-center"
                aria-label="Đang tải khung của người dùng"
              />
            ) : inventory.isError ? (
              <FrameLoadError
                message={frameErrorMessage(inventory.error)}
                onRetry={() => void inventory.refetch()}
              />
            ) : (
              <>
                {!inventory.data.enabled && (
                  <p className="text-sm text-muted-foreground">
                    Tính năng hiển thị khung đang tắt. Bạn vẫn có thể quản lý
                    quyền sở hữu.
                  </p>
                )}
                {visible.length ? (
                  <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {visible.map((item) => (
                      <OwnedUserFrameCard
                        key={item.frame.id}
                        item={item}
                        disabled={mutation.isPending || inventory.isFetching}
                        onRevoke={(owned) =>
                          chooseAction({ kind: "revoke", frame: owned.frame })
                        }
                      />
                    ))}
                  </div>
                ) : (
                  <Empty>
                    <EmptyHeader>
                      <EmptyTitle>Chưa sở hữu khung nào</EmptyTitle>
                      <EmptyDescription>
                        Mở Kho khung để cấp khung cho người dùng.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )}
                <AdminPagination
                  ariaLabel="Trang khung của người dùng"
                  currentPage={currentPage}
                  totalPages={totalPages}
                  disabled={mutation.isPending || inventory.isFetching}
                  onPageChange={setPage}
                />
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
      {catalogOpen && (
        <FrameWarehouse
          apiBaseUrl={apiBaseUrl}
          actorUserId={actorUserId}
          userName={userName}
          ownedIds={ownedIds}
          inventoryReady={inventoryReady}
          inventoryError={
            inventory.isError ? frameErrorMessage(inventory.error) : null
          }
          onRetryInventory={() => void inventory.refetch()}
          onSelect={(frame) => chooseAction({ kind: "grant", frame })}
          pending={mutation.isPending}
          selected={action?.kind === "grant" ? action : null}
          confirmation={confirmation}
          submitButton={submitButton}
          onBack={closeAction}
          onClose={closeCatalog}
        />
      )}
      {action?.kind === "revoke" && (
        <Dialog
          open
          onOpenChange={(next) => {
            if (!next) closeAction()
          }}
        >
          <DialogContent
            showCloseButton={!mutation.isPending}
            className="max-h-[calc(100svh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0"
          >
            <DialogHeader className="p-6 pr-12 pb-4">
              <DialogTitle>Gỡ khung của người dùng?</DialogTitle>
              <DialogDescription>
                {userName} · {action.frame.name}
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 overflow-y-auto px-6 pb-6">
              {confirmation}
            </div>
            <DialogFooter className="border-t p-4 sm:px-6">
              <Button
                type="button"
                variant="outline"
                disabled={mutation.isPending}
                onClick={closeAction}
              >
                Hủy
              </Button>
              {submitButton}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}

function FrameLoadError({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <Alert variant="destructive">
      <AlertTitle>Không thể tải kho khung</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-3">
        <p>{message}</p>
        <Button type="button" variant="outline" onClick={onRetry}>
          Thử lại
        </Button>
      </AlertDescription>
    </Alert>
  )
}

export function FrameConfirmation({
  action,
  formId,
  error,
  pending,
  valid,
  onSubmit,
}: {
  action: FrameAction
  formId: string
  error: string | null
  pending: boolean
  valid: boolean
  onSubmit: () => void
}) {
  return (
    <form
      id={formId}
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (!pending && valid) onSubmit()
      }}
    >
      <AdminFramePreview frame={action.frame} animate />
      <p className="text-sm text-muted-foreground">
        {action.kind === "grant"
          ? "Chỉ cấp quyền sở hữu; người dùng tự chọn khung để trang bị."
          : "Khung sẽ bị gỡ khỏi kho. Nếu đang được chọn, lựa chọn đó cũng được xóa và avatar gốc được giữ nguyên."}
      </p>
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Chưa hoàn tất thao tác</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {!pending && !valid && (
        <p role="status" className="text-sm text-muted-foreground">
          Đang kiểm tra quyền sở hữu, hoặc trạng thái đã thay đổi. Hãy quay lại
          và tải trạng thái mới trước khi tiếp tục.
        </p>
      )}
    </form>
  )
}

function FrameWarehouse({
  apiBaseUrl,
  actorUserId,
  userName,
  ownedIds,
  inventoryReady,
  inventoryError,
  onRetryInventory,
  onSelect,
  pending,
  selected,
  confirmation,
  submitButton,
  onBack,
  onClose,
}: {
  apiBaseUrl: string
  actorUserId: string
  userName: string
  ownedIds: Set<string>
  inventoryReady: boolean
  inventoryError: string | null
  onRetryInventory: () => void
  onSelect: (frame: UserFrame["frame"]) => void
  pending: boolean
  selected: FrameAction | null
  confirmation: ReactNode
  submitButton: ReactNode
  onBack: () => void
  onClose: () => void
}) {
  const [filters, setFilters] = useState({
    ...defaultFrameFilters,
    active: "true" as const,
    limited: "false" as const,
  })
  const catalog = useQuery(adminFramesOptions(apiBaseUrl, actorUserId, filters))
  const topics = useQuery(frameTopicsOptions(apiBaseUrl, actorUserId))
  const items = [
    { value: "all", label: "Tất cả chủ đề" },
    { value: "none", label: "Khác" },
    ...(topics.data?.data ?? []).map((topic) => ({
      value: topic.id,
      label: topic.name,
    })),
  ]
  const frames = catalog.data?.data.filter(canGrantFrame) ?? []
  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent
        showCloseButton={!pending}
        className="max-h-[calc(100svh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-5xl"
      >
        <DialogHeader className="p-6 pr-12 pb-0">
          <DialogTitle>
            {selected ? "Cấp khung cho người dùng?" : "Kho khung"}
          </DialogTitle>
          <DialogDescription>
            {userName}
            {selected
              ? ` · ${selected.frame.name}`
              : " · Chỉ hiển thị khung đang bật, có ảnh hợp lệ và không limited."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto pt-4 px-6 pb-6">
          {selected ? (
            confirmation
          ) : (
            <>
              <div className="flex flex-col gap-3 sm:flex-row">
                <form
                  className="flex-1"
                  role="search"
                  onSubmit={(event) => {
                    event.preventDefault()
                    const data = new FormData(event.currentTarget)
                    setFilters((current) => ({
                      ...current,
                      q: String(data.get("q") ?? "").trim(),
                      page: 1,
                    }))
                  }}
                >
                  <InputGroup>
                    <InputGroupInput
                      name="q"
                      autoFocus
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
                        <SearchIcon aria-hidden="true" />
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                </form>
                <Select
                  items={items}
                  value={filters.topicId}
                  onValueChange={(topicId) => {
                    if (topicId)
                      setFilters((current) => ({
                        ...current,
                        topicId,
                        page: 1,
                      }))
                  }}
                >
                  <SelectTrigger
                    aria-label="Lọc chủ đề"
                    className="w-full sm:w-48"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {items.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              {inventoryError ? (
                <FrameLoadError
                  message={inventoryError}
                  onRetry={onRetryInventory}
                />
              ) : (
                !inventoryReady && (
                  <p role="status" className="text-sm text-muted-foreground">
                    Đang kiểm tra các khung user đã sở hữu…
                  </p>
                )
              )}
              {topics.isError && (
                <p role="status" className="text-sm text-muted-foreground">
                  Không tải được chủ đề. Vẫn có thể tìm khung theo tên hoặc mã.
                </p>
              )}
              {catalog.isPending ? (
                <Spinner
                  className="self-center"
                  aria-label="Đang tải khung khả dụng"
                />
              ) : catalog.isError ? (
                <FrameLoadError
                  message={frameErrorMessage(catalog.error)}
                  onRetry={() => void catalog.refetch()}
                />
              ) : (
                <>
                  {frames.length ? (
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      {frames.map((frame) => (
                        <GrantableFrameCard
                          key={frame.id}
                          frame={frame}
                          owned={ownedIds.has(frame.id)}
                          disabled={
                            !inventoryReady || catalog.isFetching || pending
                          }
                          onSelect={onSelect}
                        />
                      ))}
                    </div>
                  ) : (
                    <Empty>
                      <EmptyHeader>
                        <EmptyTitle>Không có khung khả dụng</EmptyTitle>
                        <EmptyDescription>
                          Kiểm tra bộ lọc hoặc bật khung trong trang quản lý
                          khung.
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  )}
                  <AdminPagination
                    ariaLabel="Trang kho khung khả dụng"
                    currentPage={filters.page}
                    totalPages={catalog.data.meta.totalPages}
                    disabled={catalog.isFetching || pending}
                    onPageChange={(page) =>
                      setFilters((current) => ({ ...current, page }))
                    }
                  />
                </>
              )}
            </>
          )}
        </div>
        <DialogFooter className="border-t p-4 sm:px-6">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={selected ? onBack : onClose}
          >
            {selected ? "Quay lại kho khung" : "Đóng"}
          </Button>
          {selected && submitButton}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function GrantableFrameCard({
  frame,
  owned,
  disabled,
  onSelect,
}: {
  frame: AdminAvatarFrame
  owned: boolean
  disabled: boolean
  onSelect: (frame: UserFrame["frame"]) => void
}) {
  if (!canGrantFrame(frame) || !frame.frame) return null
  const summary = frame.frame
  return (
    <FrameCard
      frame={summary}
      rarity={frame.rarity}
      badges={owned && <Badge variant="secondary">Đã sở hữu</Badge>}
    >
      <p className="text-xs wrap-anywhere text-muted-foreground">
        {frame.code}
      </p>
      <Button
        type="button"
        disabled={disabled || owned}
        aria-label={`Cấp khung ${frame.name}`}
        onClick={() => onSelect(summary)}
      >
        {owned ? "Đã sở hữu" : "Cấp khung"}
      </Button>
    </FrameCard>
  )
}
