"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { PencilIcon, Trash2Icon } from "lucide-react"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@workspace/ui/components/dialog"
import { Field, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"

import {
  type FrameTopic,
  frameErrorMessage,
  frameTopicsOptions,
  removeFrameTopic,
  saveFrameTopic,
} from "./admin-api"

export function AdminFrameTopics({
  apiBaseUrl,
  userId,
  onClose,
}: {
  apiBaseUrl: string
  userId: string
  onClose: () => void
}) {
  const client = useQueryClient()
  const topics = useQuery(frameTopicsOptions(apiBaseUrl, userId))
  const [editing, setEditing] = useState<FrameTopic | null>(null)
  const [deleting, setDeleting] = useState<FrameTopic | null>(null)
  const [name, setName] = useState("")
  const refresh = () =>
    client.invalidateQueries({ queryKey: ["account", apiBaseUrl] })
  const mutation = useMutation({
    retry: false,
    networkMode: "always",
    mutationFn: async (action: "save" | "delete") => {
      if (action === "delete" && deleting)
        await removeFrameTopic(apiBaseUrl, deleting)
      else await saveFrameTopic(apiBaseUrl, name, editing)
    },
    onSuccess: async () => {
      setEditing(null)
      setDeleting(null)
      setName("")
      await refresh()
    },
    onError: () => {
      void refresh()
    },
  })
  const choose = (topic: FrameTopic | null) => {
    setEditing(topic)
    setDeleting(null)
    setName(topic?.name ?? "")
    mutation.reset()
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose()
      }}
    >
      <DialogContent
        showCloseButton={!mutation.isPending}
        className="max-h-[calc(100svh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-xl"
      >
        <DialogHeader className="p-6 pr-12 pb-4">
          <DialogTitle>Quản lý chủ đề</DialogTitle>
          <DialogDescription>
            Phân loại khung theo game, nhân vật hoặc bộ sưu tập.
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-6 pb-6">
          {topics.isPending && <Spinner aria-label="Đang tải chủ đề" />}
          {topics.isError && (
            <Alert variant="destructive">
              <AlertDescription>
                Không tải được chủ đề.{" "}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void topics.refetch()}
                >
                  Thử lại
                </Button>
              </AlertDescription>
            </Alert>
          )}
          {mutation.isError && (
            <Alert variant="destructive">
              <AlertDescription>
                {frameErrorMessage(mutation.error)} Chọn lại chủ đề từ danh sách
                mới trước khi thử lại.
              </AlertDescription>
            </Alert>
          )}
          {topics.data?.data.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Chưa có chủ đề. Thêm chủ đề đầu tiên bên dưới.
            </p>
          )}
          <ul className="flex flex-col divide-y">
            {topics.data?.data.map((topic) => (
              <li key={topic.id} className="flex items-center gap-2 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium wrap-anywhere">
                    {topic.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {topic.frameCount} khung
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Sửa chủ đề ${topic.name}`}
                  disabled={mutation.isPending}
                  onClick={() => choose(topic)}
                >
                  <PencilIcon />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Xoá chủ đề ${topic.name}`}
                  disabled={mutation.isPending}
                  onClick={() => {
                    setDeleting(topic)
                    mutation.reset()
                  }}
                >
                  <Trash2Icon />
                </Button>
              </li>
            ))}
          </ul>
          {deleting ? (
            <Alert>
              <AlertDescription>
                Xoá chủ đề “{deleting.name}”? Các khung thuộc chủ đề này sẽ
                chuyển về “Khác”.
              </AlertDescription>
            </Alert>
          ) : (
            <form
              id="frame-topic-form"
              onSubmit={(event) => {
                event.preventDefault()
                if (!mutation.isPending && !mutation.isError)
                  mutation.mutate("save")
              }}
            >
              <Field>
                <FieldLabel htmlFor="topic-name">
                  {editing ? "Sửa tên chủ đề" : "Thêm chủ đề"}
                </FieldLabel>
                <Input
                  id="topic-name"
                  required
                  maxLength={160}
                  value={name}
                  disabled={mutation.isPending}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Ví dụ: Genshin Impact"
                />
              </Field>
            </form>
          )}
        </div>
        <DialogFooter className="border-t p-6 pt-4">
          <Button
            variant="outline"
            disabled={mutation.isPending}
            onClick={onClose}
          >
            Đóng
          </Button>
          {(editing || deleting || mutation.isError) && (
            <Button
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => choose(null)}
            >
              Huỷ chỉnh sửa
            </Button>
          )}
          {deleting ? (
            <Button
              variant="destructive"
              disabled={mutation.isPending || mutation.isError}
              onClick={() => mutation.mutate("delete")}
            >
              {mutation.isPending && <Spinner data-icon="inline-start" />}Xoá
              chủ đề
            </Button>
          ) : (
            <Button
              type="submit"
              form="frame-topic-form"
              disabled={mutation.isPending || mutation.isError || !name.trim()}
            >
              {mutation.isPending && <Spinner data-icon="inline-start" />}
              {editing ? "Lưu tên" : "Thêm chủ đề"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
