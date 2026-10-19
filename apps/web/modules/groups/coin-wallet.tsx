"use client"

import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import type { FrameIdentity } from "@/modules/avatar-frames/account-api"
import { AvatarFrameError } from "@/modules/avatar-frames/admin-api"
import { coinLabel } from "@/modules/shop/admin-api"
import type { components } from "@/src/lib/generated/api"
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
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import {
  coinTransferStorageKey,
  coinTransferUncertain,
  groupCoinErrorMessage,
  groupCoinOptions,
  isCoinTransferInput,
  readPendingCoinTransfer,
  refreshGroupCoin,
  savePendingCoinTransfer,
  transferGroupCoin,
  validateCoinTransfer,
  type CoinTransferAttempt,
} from "./coin-api"

export function GroupCoinWallet({
  apiBaseUrl,
  identity,
  groupId,
  recipient,
  onClose,
  disabled,
}: {
  apiBaseUrl: string
  identity: FrameIdentity
  groupId: string
  recipient: components["schemas"]["GroupMembership"] | null
  onClose: () => void
  disabled: boolean
}) {
  const client = useQueryClient()
  const wallet = useQuery(groupCoinOptions(apiBaseUrl, identity, groupId))
  const storageKey = coinTransferStorageKey(apiBaseUrl, identity, groupId)
  const [pending, setPending] = useState<CoinTransferAttempt | null>(null)
  const [ready, setReady] = useState(false)
  const [storageError, setStorageError] = useState(false)
  const [recoveryOpen, setRecoveryOpen] = useState(false)
  const [amount, setAmount] = useState("")
  const [fieldError, setFieldError] = useState<string | null>(null)
  const submitting = useRef(false)

  useEffect(() => {
    try {
      // Restore unresolved operations only after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPending(readPendingCoinTransfer(window.sessionStorage, storageKey))
      setReady(true)
    } catch {
      setStorageError(true)
    }
  }, [storageKey])

  const clearPending = () => {
    try {
      window.sessionStorage.removeItem(storageKey)
      setPending(null)
    } catch {
      setStorageError(true)
    }
  }
  const close = () => {
    if (submitting.current) return
    setAmount("")
    setFieldError(null)
    setRecoveryOpen(false)
    onClose()
  }
  const mutation = useMutation({
    retry: false,
    networkMode: "always",
    mutationFn: ({
      attempt,
    }: {
      attempt: CoinTransferAttempt
      resume: boolean
    }) => transferGroupCoin(apiBaseUrl, groupId, attempt),
    onSuccess: (_receipt, { attempt }) => {
      clearPending()
      setAmount("")
      setRecoveryOpen(false)
      onClose()
      toast.add({
        type: "success",
        title: `Đã chuyển ${coinLabel(attempt.input.amount)} cho ${attempt.name}.`,
      })
    },
    onError: (error, { resume }) => {
      // Auth/rate-limit failures during replay cannot rule out a previous commit.
      if (!coinTransferUncertain(error, resume)) clearPending()
      toast.add({ type: "error", title: groupCoinErrorMessage(error) })
    },
    onSettled: (_data, _error, { attempt }) => {
      submitting.current = false
      void refreshGroupCoin(
        client,
        apiBaseUrl,
        identity,
        attempt.input.recipientUserId
      )
    },
  })

  const confirm = () => {
    if (disabled || !ready || storageError || submitting.current) return
    let attempt = pending
    if (!attempt) {
      if (!recipient || !wallet.data || wallet.isError) return
      const error = validateCoinTransfer(amount.trim(), wallet.data.balance)
      setFieldError(error)
      if (error) return
      attempt = {
        name: recipient.name,
        input: {
          recipientUserId: recipient.userId,
          amount: amount.trim(),
          operationId: crypto.randomUUID(),
        },
      }
    }
    try {
      savePendingCoinTransfer(window.sessionStorage, storageKey, attempt)
    } catch {
      setStorageError(true)
      toast.add({
        type: "error",
        title:
          "Không thể lưu mã giao dịch. Chưa gửi yêu cầu chuyển coin; hãy kiểm tra quyền lưu trữ rồi tải lại trang.",
      })
      return
    }
    submitting.current = true
    setPending(attempt)
    mutation.mutate({ attempt, resume: !!pending })
  }
  const open = !!recipient || recoveryOpen

  return (
    <>
      <div className="flex flex-col gap-3">
        {wallet.isPending ? (
          <Skeleton className="h-8 w-40" aria-label="Đang tải số dư nhóm" />
        ) : wallet.isError ? (
          <Alert variant="destructive">
            <AlertTitle>Không thể tải số dư nhóm</AlertTitle>
            <AlertDescription className="flex flex-col items-start gap-2">
              {wallet.error instanceof AvatarFrameError
                ? groupCoinErrorMessage(wallet.error)
                : "Không thể kết nối tới máy chủ. Vui lòng thử lại."}
              <Button variant="outline" onClick={() => void wallet.refetch()}>
                Thử lại
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <div
            className="flex flex-wrap items-center gap-2"
            aria-live="polite"
            aria-atomic="true"
          >
            <span>Coin nhóm:</span>
            <Image
              src="/images/suicao_coin.webp"
              alt=""
              width={24}
              height={24}
              unoptimized
            />
            <span className="font-semibold text-warning tabular-nums">
              {coinLabel(wallet.data.balance)}
            </span>
          </div>
        )}
        {storageError && (
          <Alert variant="destructive">
            <AlertTitle>Không đọc/ghi được mã giao dịch</AlertTitle>
            <AlertDescription>
              Tạm khóa chuyển coin. Hãy kiểm tra quyền lưu trữ rồi tải lại
              trang; không xóa dữ liệu trình duyệt khi còn giao dịch chưa hoàn
              tất.
            </AlertDescription>
          </Alert>
        )}
        {pending && !open && (
          <Alert>
            <AlertTitle>Có yêu cầu chuyển coin chưa hoàn tất</AlertTitle>
            <AlertDescription className="flex flex-col items-start gap-2">
              {coinLabel(pending.input.amount)} cho {pending.name}
              <Button
                variant="outline"
                disabled={disabled}
                onClick={() => setRecoveryOpen(true)}
              >
                Tiếp tục
              </Button>
            </AlertDescription>
          </Alert>
        )}
      </div>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) close()
        }}
      >
        <DialogContent showCloseButton={!mutation.isPending}>
          <DialogHeader>
            <DialogTitle>Xác nhận chuyển coin</DialogTitle>
            <DialogDescription>
              Chuyển từ ví nhóm cho {pending?.name ?? recipient?.name}.
            </DialogDescription>
          </DialogHeader>
          {pending ? (
            <p>Đang chuyển {coinLabel(pending.input.amount)}...</p>
          ) : (
            <form
              id="group-coin-transfer"
              onSubmit={(event) => {
                event.preventDefault()
                confirm()
              }}
            >
              <FieldGroup>
                <Field data-invalid={!!fieldError}>
                  <FieldLabel htmlFor="group-coin-amount">Số coin</FieldLabel>
                  <Input
                    id="group-coin-amount"
                    inputMode="numeric"
                    maxLength={19}
                    autoComplete="off"
                    value={amount}
                    disabled={disabled || mutation.isPending}
                    aria-invalid={!!fieldError}
                    aria-describedby={
                      fieldError ? "group-coin-error" : undefined
                    }
                    onChange={(event) => {
                      if (!isCoinTransferInput(event.target.value)) return
                      setAmount(event.target.value)
                      setFieldError(null)
                    }}
                  />
                  {fieldError && (
                    <FieldError id="group-coin-error">{fieldError}</FieldError>
                  )}
                </Field>
              </FieldGroup>
            </form>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={mutation.isPending}
              onClick={close}
            >
              Đóng
            </Button>
            <Button
              type={pending ? "button" : "submit"}
              form={pending ? undefined : "group-coin-transfer"}
              onClick={pending ? confirm : undefined}
              disabled={
                disabled ||
                !ready ||
                storageError ||
                mutation.isPending ||
                (!pending && (!wallet.data || wallet.isError))
              }
            >
              {mutation.isPending && <Spinner data-icon="inline-start" />}
              {mutation.isPending
                ? "Đang chuyển"
                : pending
                  ? "Thử lại"
                  : "Xác nhận chuyển"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
