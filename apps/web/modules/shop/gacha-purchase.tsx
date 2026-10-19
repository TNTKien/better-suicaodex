"use client"

import { useEffect, useRef, useState } from "react"
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import type { CurrentAccount } from "@/modules/account/api"
import {
  ownFramesOptions,
  type FrameIdentity,
} from "@/modules/avatar-frames/account-api"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { toast } from "@workspace/ui/components/toast"
import {
  chestDisplayName,
  coinLabel,
  type ShopChest,
  type ChestPool,
  type ChestCatalog,
} from "./admin-api"
import { refreshShopPurchase, shopChestPoolOptions } from "./api"
import CaseOpening from "./case-opening"
import { caseRarities } from "./case-reel"
import {
  gachaBlockMessage,
  gachaErrorMessage,
  gachaStorageKey,
  gachaUncertain,
  personalChestOptions,
  readPendingGacha,
  rollChest,
  savePendingGacha,
  type GachaAttempt,
  type GachaReceipt,
} from "./gacha-api"

export function GachaPurchase({
  selected,
  rule,
  onClose,
  apiBaseUrl,
  identity,
  account,
}: {
  selected: ShopChest | null
  rule: ChestCatalog["rule"] | undefined
  onClose: () => void
  apiBaseUrl: string
  identity: FrameIdentity
  account: CurrentAccount | null
}) {
  const client = useQueryClient()
  const storageKey = gachaStorageKey(apiBaseUrl, identity)
  const [pending, setPending] = useState<GachaAttempt | null>(null)
  const [ready, setReady] = useState(false)
  const [storageError, setStorageError] = useState(false)
  const [recoveryOpen, setRecoveryOpen] = useState(false)
  const [receipt, setReceipt] = useState<GachaReceipt | null>(null)
  const [opening, setOpening] = useState(false)
  const alive = useRef(false)
  const submitting = useRef(false)
  const open = !!selected || recoveryOpen
  const chestId = pending?.input.chestId ?? selected?.id ?? ""
  const detail = useQuery({
    ...personalChestOptions(apiBaseUrl, identity, chestId),
    enabled: open && ready && !pending && !!chestId,
  })
  const pools = useQueries({
    queries: caseRarities.map((rarity) => ({
      ...shopChestPoolOptions(apiBaseUrl, chestId, 1, rarity),
      enabled: open && !!chestId && !receipt,
      networkMode: "always" as const,
    })),
  })

  useEffect(() => {
    alive.current = true
    try {
      // Restore browser-only state after hydration; never replace an unresolved operation.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPending(readPendingGacha(window.sessionStorage, storageKey))
      setReady(true)
    } catch {
      setStorageError(true)
    }
    return () => {
      alive.current = false
    }
  }, [storageKey])

  const clearPending = () => {
    try {
      window.sessionStorage.removeItem(storageKey)
      setPending(null)
      return true
    } catch {
      setStorageError(true)
      return false
    }
  }
  const refresh = () =>
    Promise.all([
      refreshShopPurchase(client, apiBaseUrl, identity),
      client.invalidateQueries({ queryKey: ["shop-chests", apiBaseUrl] }),
      client.invalidateQueries({ queryKey: ["shop-chest-pool", apiBaseUrl] }),
    ])
  const mutation = useMutation({
    retry: false,
    networkMode: "always",
    mutationFn: ({
      attempt,
      resume,
    }: {
      attempt: GachaAttempt
      resume: boolean
    }) => rollChest(apiBaseUrl, attempt, resume),
    onSuccess: (result) => {
      if (!alive.current) return
      // Retain the saved operation until the result is dismissed, including during animation.
      setReceipt(result)
      void refresh()
    },
    onError: (error) => {
      if (!alive.current) return
      setOpening(false)
      if (!gachaUncertain(error)) clearPending()
      toast.add({ type: "error", title: gachaErrorMessage(error) })
      void refresh()
    },
    onSettled: () => {
      submitting.current = false
    },
  })

  const confirm = () => {
    if (
      !ready ||
      storageError ||
      submitting.current ||
      mutation.isPending ||
      receipt
    )
      return
    if (!pending && !canConfirm) return
    const attempt: GachaAttempt = pending ?? {
      name: chestDisplayName(quoteChest!),
      input: {
        operationId: crypto.randomUUID(),
        chestId: quoteChest!.id,
        expectedChestVersion: quoteChest!.version,
        expectedRuleVersion: quoteRule!.version,
        expectedPoolDigest: quoteChest!.pool.digest,
        expectedPrice: quoteChest!.price,
      },
    }
    try {
      savePendingGacha(window.sessionStorage, storageKey, attempt)
    } catch {
      setStorageError(true)
      toast.add({
        type: "error",
        title:
          "Không thể lưu mã giao dịch trong trình duyệt. Chưa gửi yêu cầu mua; hãy kiểm tra quyền lưu trữ rồi tải lại trang.",
      })
      return
    }
    submitting.current = true
    setPending(attempt)
    setOpening(true)
    mutation.mutate({ attempt, resume: !!pending })
  }
  const close = () => {
    if (submitting.current || mutation.isPending) return
    if (receipt) {
      toast.add({
        type: "success",
        title: `Đã nhận ${receipt.frame.name}`,
        description: receipt.duplicate
          ? `Khung đã sở hữu — hoàn ${coinLabel(receipt.refund)}.`
          : "Khung đã vào kho của bạn; chưa tự động trang bị.",
      })
      if (clearPending()) setReceipt(null)
    }
    setRecoveryOpen(false)
    setOpening(false)
    onClose()
  }
  const name =
    pending?.name ?? (selected ? chestDisplayName(selected) : "Mua hộp")
  const quoteChest = detail.data?.data ?? selected
  const quoteRule = detail.data?.rule ?? rule
  const canConfirm =
    !!pending ||
    !!(
      quoteChest &&
      quoteRule &&
      quoteChest.saleEnabled &&
      quoteChest.ready &&
      (detail.data?.canRoll ?? true)
    )

  return (
    <>
      {storageError && (
        <Alert variant="destructive">
          <AlertTitle>Không đọc/ghi được mã giao dịch</AlertTitle>
          <AlertDescription>
            Tạm khoá mua hộp. Hãy kiểm tra quyền lưu trữ rồi tải lại trang;
            không xoá dữ liệu trình duyệt khi còn giao dịch chưa hoàn tất.
          </AlertDescription>
        </Alert>
      )}
      {pending && !open && (
        <Alert>
          <AlertTitle>Có yêu cầu mua hộp chưa hoàn tất</AlertTitle>
          <AlertDescription>
            {pending.name}
            <Button variant="outline" onClick={() => setRecoveryOpen(true)}>
              Tiếp tục
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {open && !opening && !receipt && (
        <Dialog
          open
          onOpenChange={(value) => {
            if (!value) close()
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Xác nhận mua hộp</DialogTitle>
              <DialogDescription>
                {pending
                  ? `Tiếp tục nhận kết quả của ${pending.name}?`
                  : quoteChest &&
                    `Bạn muốn mua ${name} với ${coinLabel(quoteChest.price)}?`}
              </DialogDescription>
            </DialogHeader>
            {detail.data && !detail.data.canRoll && !pending && (
              <p role="status" className="text-sm text-muted-foreground">
                {gachaBlockMessage(detail.data.rollBlockReason)}
              </p>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={close}>
                Huỷ
              </Button>
              <Button
                disabled={!ready || storageError || !canConfirm}
                onClick={confirm}
              >
                {pending ? "Tiếp tục" : "Xác nhận"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {open && (opening || receipt) && (
        <Dialog
          open
          onOpenChange={(value) => {
            if (!value) close()
          }}
        >
          <DialogContent
            showCloseButton={false}
            className="max-h-[calc(100svh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden border-none bg-transparent p-0 ring-0 sm:max-w-4xl"
          >
            <div className="min-h-0 overflow-y-auto px-4 pb-5 sm:px-6">
              <GachaOpening
                key={pending?.input.operationId ?? receipt?.operationId}
                receipt={receipt}
                samples={pools.flatMap(
                  (pool) => pool.data?.data.slice(0, 4) ?? []
                )}
                account={account}
                apiBaseUrl={apiBaseUrl}
                identity={identity}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}

function GachaOpening({
  receipt,
  samples,
  account,
  apiBaseUrl,
  identity,
}: {
  receipt: GachaReceipt | null
  samples: ChestPool["data"]
  account: CurrentAccount | null
  apiBaseUrl: string
  identity: FrameIdentity
}) {
  const inventory = useQuery({
    ...ownFramesOptions(apiBaseUrl, identity),
    staleTime: 0,
    enabled: !!receipt,
  })
  const poolWinner = samples.find((item) => item.frame.id === receipt?.frame.id)
  const frame =
    inventory.data?.data.find((item) => item.frame.id === receipt?.frame.id)
      ?.frame ??
    poolWinner?.frame ??
    null
  // Cosmetic samples do not represent odds; only the server receipt decides the stopping card.
  return (
    <CaseOpening
      receipt={receipt}
      account={account}
      winner={
        receipt
          ? {
              id: receipt.frame.id,
              name: receipt.frame.name,
              rarity: receipt.frame.rarity,
              frame,
              topic: poolWinner?.topic ?? null,
            }
          : null
      }
      samples={samples.map((item) => ({
        ...item,
        id: item.frame.id,
        name: item.frame.name,
      }))}
    />
  )
}
