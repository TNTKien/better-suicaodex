"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "@workspace/ui/components/toast"
import { loginHref } from "./api"
import {
  deleteLibraryItem,
  LibraryApiError,
  type LibraryCategory,
  libraryItemOptions,
  putLibraryItem,
} from "./library-api"

export function showLibraryLoginToast(
  returnTo: string,
  navigate: (href: string) => void
) {
  const id = toast.add({
    type: "info",
    title: "Bạn cần đăng nhập để dùng chức năng này!",
    actionProps: {
      children: "Đăng nhập",
      onClick: () => {
        toast.close(id)
        navigate(loginHref(returnTo))
      },
    },
  })
}

export function useLibraryItem<T>(
  apiBaseUrl: string,
  userId: string | null,
  mangaId: string
) {
  const queryClient = useQueryClient()
  const options = libraryItemOptions<T>(apiBaseUrl, userId, mangaId)
  const item = useQuery(options)
  const update = useMutation({
    mutationFn: async (category: LibraryCategory | null) => {
      if (!userId) throw new LibraryApiError(401)
      if (category) return putLibraryItem<T>(apiBaseUrl, mangaId, category)
      await deleteLibraryItem(apiBaseUrl, mangaId)
      return null
    },
    onSuccess: (data, category) => {
      queryClient.setQueryData(options.queryKey, data)
      void queryClient.invalidateQueries({
        queryKey: ["library", apiBaseUrl, userId, "list"],
      })
      toast.add({
        type: "success",
        title: category ? "Đã cập nhật thư viện" : "Đã xóa khỏi thư viện",
      })
    },
    onError: (error) => {
      if (error instanceof LibraryApiError && error.status === 401)
        void queryClient.invalidateQueries({ queryKey: ["account"] })
      toast.add({
        type: "error",
        title:
          error instanceof LibraryApiError && error.status === 403
            ? "Tài khoản không thể chỉnh sửa thư viện"
            : "Không thể cập nhật thư viện. Vui lòng thử lại.",
      })
    },
  })

  return { item, update }
}
