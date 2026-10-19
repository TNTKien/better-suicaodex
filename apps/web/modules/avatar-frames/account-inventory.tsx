"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { FrameIcon, SearchIcon } from "lucide-react"
import {
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs"

import { useAccount } from "@/modules/account/provider"
import { ProfileAvatar } from "@/modules/account/profile"
import type { CurrentAccount } from "@/modules/account/api"
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
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  canEquipOwnFrame,
  canUnequipOwnFrame,
  ownFrameErrorMessage,
  ownFramesOptions,
  refreshOwnFrames,
  setOwnFrame,
  type FrameIdentity,
  type OwnFrame,
  type OwnInventory,
} from "./account-api"

export const ownFrameParams = {
  framePage: parseAsInteger.withDefault(1),
  frameQ: parseAsString.withDefault(""),
  frameRarity: parseAsStringLiteral(["all", "R", "SR", "SSR"]).withDefault(
    "all"
  ),
  frameTopic: parseAsString.withDefault("all"),
}
const pageSize = 20
const rarityItems = [
  { value: "all", label: "Tất cả độ hiếm" },
  ...["R", "SR", "SSR"].map((value) => ({ value, label: value })),
]
type FrameAction = { kind: "equip" | "unequip"; item: OwnFrame }

export function OwnAvatarFrames() {
  const { apiBaseUrl, status, account, identity } = useAccount()
  if (
    status !== "authenticated" ||
    !account ||
    !identity ||
    account.user.id !== identity.userId
  )
    return null
  return (
    <OwnFramesContent
      key={`${apiBaseUrl}:${identity.userId}:${identity.sessionId}`}
      apiBaseUrl={apiBaseUrl}
      account={account}
      identity={identity}
    />
  )
}

function OwnFramesContent({
  apiBaseUrl,
  account,
  identity,
}: {
  apiBaseUrl: string
  account: CurrentAccount
  identity: FrameIdentity
}) {
  const client = useQueryClient()
  const [open, setOpen] = useState(false)
  const inventory = useQuery({
    ...ownFramesOptions(apiBaseUrl, identity),
    enabled: open,
  })
  const mutation = useMutation({
    retry: false,
    networkMode: "always",
    mutationFn: (action: FrameAction) =>
      setOwnFrame(
        apiBaseUrl,
        identity,
        action.kind === "equip" ? action.item.frame.id : null
      ),
    onSuccess: async (updated, action) => {
      toast.add({
        type: "success",
        title:
          action.kind === "equip"
            ? "Đã dùng khung avatar"
            : "Đã gỡ khung khỏi avatar",
      })
      await refreshOwnFrames(client, apiBaseUrl, identity, updated)
    },
    onError: async () => {
      // Reconcile a possibly committed request before allowing another write.
      await refreshOwnFrames(client, apiBaseUrl, identity)
    },
  })
  const pending = mutation.isPending
  const ready = inventory.isSuccess && !inventory.isFetching
  const canEquip = account.profile.status === "active"
  const choose = (item: OwnFrame) => {
    if (!ready || pending) return
    const current = inventory.data.data.find(
      (entry) => entry.frame.id === item.frame.id
    )
    if (!current) return
    const kind = item.selected ? "unequip" : "equip"
    const allowed =
      kind === "equip"
        ? canEquipOwnFrame(current, inventory.data.enabled, canEquip)
        : canUnequipOwnFrame(current, inventory.data.selectedFrameId)
    if (!allowed) return
    mutation.reset()
    mutation.mutate({ item: current, kind })
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return
        setOpen(next)
        mutation.reset()
      }}
    >
      <DialogTrigger render={<Button type="button" variant="outline" />}>
        <FrameIcon aria-hidden="true" data-icon="inline-start" />
        Khung Avatar
      </DialogTrigger>
      <DialogContent
        showCloseButton={!pending}
        className="max-h-[calc(100svh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-4xl"
      >
        <DialogHeader className="p-6 pr-12 pb-0">
          <DialogTitle>
            Kho khung{inventory.data ? ` (${inventory.data.data.length})` : ""}
          </DialogTitle>
          <DialogDescription>
           Các khung bạn đang có
          </DialogDescription>
        </DialogHeader>
        <div
          className="flex min-h-0 flex-col gap-4 overflow-y-auto pt-4 px-6 pb-6"
          aria-busy={pending || inventory.isFetching}
        >
          {inventory.isPending ? (
            <Spinner
              className="self-center"
              aria-label="Đang tải kho khung của bạn"
            />
          ) : inventory.isError ? (
            <InventoryError
              error={inventory.error}
              onRetry={() => void inventory.refetch()}
            />
          ) : (
            <>
              {!inventory.data.enabled && (
                <Alert>
                  <AlertTitle>Khung avatar đang tạm tắt</AlertTitle>
                  <AlertDescription>
                    Khung đang chọn và quyền sở hữu vẫn được giữ. Bạn không thể
                    chọn khung mới nhưng vẫn có thể gỡ khung khỏi avatar.
                  </AlertDescription>
                </Alert>
              )}
              {!canEquip && (
                <p className="text-sm text-muted-foreground">
                  Tài khoản đang bị hạn chế nên không thể chọn khung mới. Bạn
                  vẫn có thể gỡ khung.
                </p>
              )}
              {mutation.isError && (
                <Alert variant="destructive">
                  <AlertTitle>Chưa hoàn tất thao tác</AlertTitle>
                  <AlertDescription className="flex flex-col items-start gap-3">
                    <p>{ownFrameErrorMessage(mutation.error)}</p>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={pending || inventory.isFetching}
                      onClick={() => void inventory.refetch()}
                    >
                      Thử lại tải kho
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
              {open && (
                <OwnFrameGrid
                  inventory={inventory.data}
                  account={account}
                  disabled={!ready || pending}
                  pendingFrameId={
                    pending ? mutation.variables?.item.frame.id : undefined
                  }
                  onChoose={choose}
                />
              )}
            </>
          )}
        </div>
        <DialogFooter className="border-t p-4 sm:px-6">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => {
              setOpen(false)
              mutation.reset()
            }}
          >
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function InventoryError({
  error,
  onRetry,
}: {
  error: unknown
  onRetry: () => void
}) {
  return (
    <Alert variant="destructive">
      <AlertTitle>Không thể tải kho khung</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-3">
        <p>{ownFrameErrorMessage(error)}</p>
        <Button type="button" variant="outline" onClick={onRetry}>
          Thử lại
        </Button>
      </AlertDescription>
    </Alert>
  )
}

export function filterOwnFrames(
  items: OwnFrame[],
  q: string,
  rarity: string,
  topicId = "all"
) {
  const search = q.trim().toLocaleLowerCase("vi-VN")
  return items.filter(
    (item) =>
      (rarity === "all" || item.rarity === rarity) &&
      (topicId === "all" ||
        (topicId === "none" ? !item.topic : item.topic?.id === topicId)) &&
      (!search || item.frame.name.toLocaleLowerCase("vi-VN").includes(search))
  )
}

export function OwnFrameGrid({
  inventory,
  account,
  disabled,
  pendingFrameId,
  onChoose,
}: {
  inventory: OwnInventory
  account: CurrentAccount
  disabled: boolean
  pendingFrameId?: string
  onChoose: (item: OwnFrame) => void
}) {
  const [params, setParams] = useQueryStates(ownFrameParams, {
    history: "replace",
  })
  const items = filterOwnFrames(
    inventory.data,
    params.frameQ,
    params.frameRarity,
    params.frameTopic
  )
  const topics = new Map(
    inventory.data.flatMap(({ topic }) =>
      topic ? [[topic.id, topic.name] as const] : []
    )
  )
  const topicItems = [
    { value: "all", label: "Tất cả chủ đề" },
    { value: "none", label: "Khác" },
    ...Array.from(topics, ([value, label]) => ({ value, label })).sort((a, b) =>
      a.label.localeCompare(b.label, "vi-VN")
    ),
  ]
  if (!topicItems.some((item) => item.value === params.frameTopic))
    topicItems.push({
      value: params.frameTopic,
      label: "Chủ đề không khả dụng",
    })
  const totalPages = Math.ceil(items.length / pageSize)
  const page = Math.min(Math.max(1, params.framePage), Math.max(1, totalPages))
  return (
    <>
      {inventory.data.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <form
            className="flex-1 sm:min-w-48"
            role="search"
            onSubmit={(event) => {
              event.preventDefault()
              const data = new FormData(event.currentTarget)
              void setParams({
                frameQ: String(data.get("frameQ") ?? "").trim(),
                framePage: 1,
              })
            }}
          >
            <InputGroup>
              <InputGroupInput
                key={params.frameQ}
                name="frameQ"
                maxLength={160}
                defaultValue={params.frameQ}
                aria-label="Tìm khung đã sở hữu"
                placeholder="Tìm tên khung…"
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
            items={rarityItems}
            value={params.frameRarity}
            onValueChange={(rarity) => {
              if (rarity)
                void setParams({
                  frameRarity: rarity as typeof params.frameRarity,
                  framePage: 1,
                })
            }}
          >
            <SelectTrigger
              className="w-full sm:w-48"
              aria-label="Lọc độ hiếm khung sở hữu"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {rarityItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select
            items={topicItems}
            value={params.frameTopic}
            onValueChange={(frameTopic) => {
              if (frameTopic) void setParams({ frameTopic, framePage: 1 })
            }}
          >
            <SelectTrigger
              className="w-full sm:w-48"
              aria-label="Lọc chủ đề khung sở hữu"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {topicItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      )}
      {items.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.slice((page - 1) * pageSize, page * pageSize).map((item) => (
            <OwnFrameCard
              key={item.frame.id}
              item={item}
              account={account}
              disabled={disabled}
              enabled={inventory.enabled}
              selectedFrameId={inventory.selectedFrameId}
              pending={pendingFrameId === item.frame.id}
              onChoose={onChoose}
            />
          ))}
        </div>
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>
              {inventory.data.length
                ? "Không có khung phù hợp"
                : "Kho khung đang trống"}
            </EmptyTitle>
            <EmptyDescription>
              {inventory.data.length
                ? "Thử tìm tên khác hoặc đổi bộ lọc độ hiếm, chủ đề."
                : "Những khung được cấp cho bạn sẽ xuất hiện ở đây."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      <AdminPagination
        ariaLabel="Trang kho khung của bạn"
        currentPage={page}
        totalPages={totalPages}
        disabled={disabled}
        onPageChange={(framePage) => setParams({ framePage })}
      />
    </>
  )
}

export function OwnFrameCard({
  item,
  account,
  disabled,
  enabled,
  selectedFrameId,
  pending = false,
  onChoose,
}: {
  item: OwnFrame
  account: CurrentAccount
  disabled: boolean
  enabled: boolean
  selectedFrameId: string | null
  pending?: boolean
  onChoose: (item: OwnFrame) => void
}) {
  const allowed = item.selected
    ? canUnequipOwnFrame(item, selectedFrameId)
    : canEquipOwnFrame(item, enabled, account.profile.status === "active")
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="line-clamp-2 min-h-[2lh] wrap-anywhere">
          {item.frame.name}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center p-3">
          <ProfileAvatar
            name={account.user.name}
            image={account.user.image}
            avatarFrame={item.frame}
            shape="circle"
            className="size-24"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline">{item.rarity}</Badge>
          {item.limited && <Badge variant="secondary">Limited</Badge>}
          {item.frame.animated && <Badge variant="outline">Ảnh động</Badge>}
          {!item.active && <Badge variant="secondary">Đang tắt</Badge>}
        </div>
      </CardContent>
      <CardFooter className="mt-auto">
        <Button
          type="button"
          variant={item.selected ? "secondary" : "default"}
          className="w-full"
          disabled={disabled || !allowed}
          aria-label={`${item.selected ? "Gỡ" : "Dùng"} khung ${item.frame.name}`}
          onClick={() => {
            if (!disabled && allowed) onChoose(item)
          }}
        >
          {pending && <Spinner aria-hidden="true" data-icon="inline-start" />}
          {item.selected ? "Gỡ" : "Dùng"}
        </Button>
      </CardFooter>
    </Card>
  )
}
