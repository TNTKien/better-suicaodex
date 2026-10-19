"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { BanIcon, Trash2Icon } from "lucide-react"

import { formatVietnamDateTimeInline } from "@/lib/date"
import { useAccount } from "@/modules/account/provider"
import type { components, paths } from "@/src/lib/generated/api"
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
import { Spinner } from "@workspace/ui/components/spinner"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { toast } from "@workspace/ui/components/toast"

type ForbiddenWord = components["schemas"]["ForbiddenWord"]
type ForbiddenWordListResponse =
  paths["/v1/admin/comments/forbidden-words"]["get"]["responses"][200]["content"]["application/json"]
type CreateForbiddenWordsResponse =
  paths["/v1/admin/comments/forbidden-words"]["post"]["responses"][201]["content"]["application/json"]
type DeleteForbiddenWordResponse =
  paths["/v1/admin/comments/forbidden-words/{id}"]["delete"]["responses"][200]["content"]["application/json"]
type ApiError = components["schemas"]["ApiError"]

const forbiddenWordsPath = "/v1/admin/comments/forbidden-words"

export class AdminForbiddenWordError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
  }
}

async function request<T>(
  apiBaseUrl: string,
  path: string,
  init: RequestInit = {},
  signal?: AbortSignal
) {
  const response = await fetch(new URL(path, apiBaseUrl), {
    ...init,
    cache: "no-store",
    credentials: "include",
    headers: { accept: "application/json", ...init.headers },
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(8_000)])
      : AbortSignal.timeout(8_000),
  })
  const body = (await response.json().catch(() => null)) as T | ApiError | null
  if (!response.ok) {
    const apiError =
      body && typeof body === "object" && "error" in body ? body.error : null
    throw new AdminForbiddenWordError(
      response.status,
      apiError?.message ?? "Không thể xử lý yêu cầu. Vui lòng thử lại."
    )
  }
  return body as T
}

export function forbiddenWordsQueryKey(
  apiBaseUrl: string,
  userId: string | undefined
) {
  return ["account", apiBaseUrl, userId, "admin-forbidden-words"] as const
}

export function runCreateForbiddenWord(apiBaseUrl: string, word: string) {
  return request<CreateForbiddenWordsResponse>(apiBaseUrl, forbiddenWordsPath, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ words: [word] }),
  })
}

export function runDeleteForbiddenWord(
  apiBaseUrl: string,
  word: ForbiddenWord
) {
  return request<DeleteForbiddenWordResponse>(
    apiBaseUrl,
    `${forbiddenWordsPath}/${encodeURIComponent(word.id)}`,
    { method: "DELETE" }
  )
}

function actionErrorMessage(error: unknown) {
  if (error instanceof AdminForbiddenWordError && error.status === 409)
    return "Từ cấm này đã tồn tại."
  return error instanceof Error
    ? error.message
    : "Không thể cập nhật từ cấm. Vui lòng thử lại."
}

export function AdminForbiddenWordList() {
  const account = useAccount()
  if (account.status !== "authenticated" || !account.user) return null
  return (
    <AdminForbiddenWordListContent
      apiBaseUrl={account.apiBaseUrl}
      userId={account.user.id}
    />
  )
}

function AdminForbiddenWordListContent({
  apiBaseUrl,
  userId,
}: {
  apiBaseUrl: string
  userId: string
}) {
  const queryClient = useQueryClient()
  const [word, setWord] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<ForbiddenWord | null>(null)
  const queryKey = forbiddenWordsQueryKey(apiBaseUrl, userId)
  const words = useQuery({
    queryKey,
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    queryFn: ({ signal }) =>
      request<ForbiddenWordListResponse>(
        apiBaseUrl,
        forbiddenWordsPath,
        {},
        signal
      ),
  })
  const createWord = useMutation({
    retry: false,
    mutationFn: (value: string) => runCreateForbiddenWord(apiBaseUrl, value),
    onSuccess: async () => {
      setWord("")
      toast.add({ type: "success", title: "Đã thêm từ cấm" })
      await queryClient.invalidateQueries({ queryKey })
    },
    onError: (error) =>
      toast.add({ type: "error", title: actionErrorMessage(error) }),
  })
  const deleteWord = useMutation({
    retry: false,
    mutationFn: (target: ForbiddenWord) =>
      runDeleteForbiddenWord(apiBaseUrl, target),
    onSuccess: async () => {
      setDeleteTarget(null)
      toast.add({ type: "success", title: "Đã xóa từ cấm" })
      await queryClient.invalidateQueries({ queryKey })
    },
    onError: (error) =>
      toast.add({ type: "error", title: actionErrorMessage(error) }),
  })
  const items = words.data?.data ?? []
  const normalizedWord = word.trim().replace(/\s+/g, " ")

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <form
        className="max-w-2xl"
        onSubmit={(event) => {
          event.preventDefault()
          if (normalizedWord) createWord.mutate(normalizedWord)
        }}
      >
        <InputGroup>
          <InputGroupInput
            aria-label="Từ cấm mới"
            autoComplete="off"
            disabled={createWord.isPending}
            maxLength={80}
            onChange={(event) => setWord(event.target.value)}
            placeholder="Nhập từ hoặc cụm từ cần che..."
            value={word}
          />
          <InputGroupAddon align="inline-end">
            {createWord.isPending ? <Spinner aria-hidden="true" /> : null}
            <InputGroupButton
              disabled={!normalizedWord || createWord.isPending}
              type="submit"
            >
              Thêm
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </form>

      {words.isPending ? (
        <Spinner
          aria-label="Đang tải danh sách từ cấm"
          className="self-center"
        />
      ) : words.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Không thể tải danh sách từ cấm</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-3">
            <span>{words.error.message}</span>
            <Button onClick={() => void words.refetch()} variant="outline">
              Thử lại
            </Button>
          </AlertDescription>
        </Alert>
      ) : items.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BanIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>Chưa có từ cấm</EmptyTitle>
            <EmptyDescription>
              Thêm từ hoặc cụm từ cần tự động che trong bình luận.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {items.length.toLocaleString("vi-VN")} từ cấm
          </p>
          <div className="divide-y overflow-hidden rounded-md border md:hidden">
            {items.map((item) => (
              <article
                className="flex items-center justify-between gap-3 p-3"
                key={item.id}
              >
                <div className="min-w-0">
                  <p className="font-medium wrap-break-word">{item.word}</p>
                  <p className="text-xs text-muted-foreground">
                    Thêm lúc {formatVietnamDateTimeInline(item.createdAt)}
                  </p>
                </div>
                <Button
                  aria-label={`Xóa từ cấm ${item.word}`}
                  onClick={() => setDeleteTarget(item)}
                  size="icon-sm"
                  variant="ghost"
                >
                  <Trash2Icon aria-hidden="true" />
                </Button>
              </article>
            ))}
          </div>
          <div className="hidden overflow-hidden rounded-md border md:block">
            <Table>
              <TableCaption className="sr-only">
                Danh sách từ cấm trong bình luận
              </TableCaption>
              <TableHeader className="uppercase">
                <TableRow>
                  <TableHead>Từ hoặc cụm từ</TableHead>
                  <TableHead>Thời gian thêm</TableHead>
                  <TableHead className="text-right">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium whitespace-normal">
                      {item.word}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatVietnamDateTimeInline(item.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        aria-label={`Xóa từ cấm ${item.word}`}
                        onClick={() => setDeleteTarget(item)}
                        size="icon-sm"
                        variant="ghost"
                      >
                        <Trash2Icon aria-hidden="true" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !deleteWord.isPending) setDeleteTarget(null)
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Xóa từ cấm?</DialogTitle>
            <DialogDescription>
              Các bình luận mới sẽ không còn tự động che cụm từ này. Bình luận
              cũ không thay đổi.
            </DialogDescription>
          </DialogHeader>
          <p className="rounded-md bg-muted p-3 font-medium wrap-break-word">
            {deleteTarget?.word}
          </p>
          <DialogFooter>
            <Button
              disabled={deleteWord.isPending}
              onClick={() => setDeleteTarget(null)}
              type="button"
              variant="outline"
            >
              Hủy
            </Button>
            <Button
              disabled={!deleteTarget || deleteWord.isPending}
              onClick={() => {
                if (deleteTarget) deleteWord.mutate(deleteTarget)
              }}
              type="button"
              variant="destructive"
            >
              {deleteWord.isPending ? (
                <Spinner aria-hidden="true" data-icon="inline-start" />
              ) : (
                <Trash2Icon aria-hidden="true" data-icon="inline-start" />
              )}
              {deleteWord.isPending ? "Đang xóa…" : "Xóa từ cấm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
