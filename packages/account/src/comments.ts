"use client"

import { useState } from "react"
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import { toast } from "@workspace/ui/components/toast"
import {
  CommentApiError,
  commentOptions,
  createComment,
  deleteComment,
  updateComment,
  type CommentScope,
} from "./comments-api"

export const maxCommentLength = 4_000
export type ComposerState = {
  body: string
  edit: { id: string; body: string; version: number } | null
  reply: { id: string; author: string; body: string } | null
}

export function validationError(body: string) {
  const value = body.trim()
  if (!value) return "Bình luận không được để trống."
  if (value.length > maxCommentLength)
    return `Bình luận không được dài hơn ${maxCommentLength.toLocaleString("vi-VN")} ký tự.`
  if (/<(?:!--|\/?[a-z][^>]*>)/i.test(value))
    return "Bình luận không hỗ trợ HTML."
  if (/!\[[^\]]*\](?:\([^)]*\)|\[[^\]]*\])/i.test(value))
    return "Bình luận không hỗ trợ ảnh."
  return null
}

export function useCommentThread<T>(
  apiBaseUrl: string,
  scope: CommentScope,
  targetId: string
) {
  const queryClient = useQueryClient()
  const comments = useInfiniteQuery(
    commentOptions<T>(apiBaseUrl, scope, targetId)
  )
  const [state, setState] = useState<ComposerState>({
    body: "",
    edit: null,
    reply: null,
  })
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string
    version: number
  } | null>(null)
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["comments", apiBaseUrl] })
  const showError = (error: Error) =>
    toast.add({
      type: "error",
      title:
        error instanceof CommentApiError
          ? error.message
          : "Không thể thực hiện thao tác bình luận.",
    })

  const create = useMutation({
    mutationFn: ({
      body,
      parentId,
      chapterId,
    }: {
      body: string
      parentId?: string
      chapterId?: string
    }) =>
      createComment<T>(
        apiBaseUrl,
        chapterId ? "chapter" : scope,
        chapterId ?? targetId,
        body,
        parentId
      ),
    onSuccess: async (_, { parentId }) => {
      setState((value) => ({
        ...value,
        body: parentId ? value.body : "",
        reply: parentId ? null : value.reply,
      }))
      await refresh()
      toast.add({ type: "success", title: "Đã gửi bình luận" })
    },
    onError: showError,
  })
  const edit = useMutation({
    mutationFn: ({
      id,
      body,
      expectedVersion,
    }: {
      id: string
      body: string
      expectedVersion: number
    }) => updateComment<T>(apiBaseUrl, id, body, expectedVersion),
    onSuccess: async () => {
      setState((value) => ({ ...value, edit: null }))
      await refresh()
      toast.add({ type: "success", title: "Đã sửa bình luận" })
    },
    onError: async (error) => {
      if (error instanceof CommentApiError && error.status === 409) {
        setState((value) => ({ ...value, edit: null }))
        await refresh()
      }
      showError(error)
    },
  })
  const remove = useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      deleteComment<T>(apiBaseUrl, id, version),
    onSuccess: async () => {
      setDeleteTarget(null)
      await refresh()
      toast.add({ type: "success", title: "Đã xóa bình luận" })
    },
    onError: async (error) => {
      if (error instanceof CommentApiError && error.status === 409) {
        setDeleteTarget(null)
        await refresh()
      }
      showError(error)
    },
  })

  const submit = (body: string, parentId?: string, chapterId?: string) => {
    const error = validationError(body)
    if (error) return toast.add({ type: "error", title: error })
    create.mutate({ body: body.trim(), parentId, chapterId })
  }
  const submitEdit = (id: string, body: string, expectedVersion: number) => {
    const error = validationError(body)
    if (error) return toast.add({ type: "error", title: error })
    edit.mutate({ id, body: body.trim(), expectedVersion })
  }
  const submitDelete = (id: string, version: number) =>
    setDeleteTarget({ id, version })

  const pages = comments.data?.pages ?? []
  const items = pages.flatMap(({ data }) => data)

  return {
    comments,
    items,
    state,
    setState,
    deleteTarget,
    setDeleteTarget,
    create,
    edit,
    remove,
    submit,
    submitEdit,
    submitDelete,
  }
}
