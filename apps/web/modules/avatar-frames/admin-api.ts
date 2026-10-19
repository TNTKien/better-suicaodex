import { queryOptions } from "@tanstack/react-query"

import type { components, paths } from "@/src/lib/generated/api"

export type AdminAvatarFrame = components["schemas"]["AdminAvatarFrame"]
export type FrameRarity = AdminAvatarFrame["rarity"]
export type FrameTopic = components["schemas"]["AvatarFrameTopic"]
type TopicPath = paths["/v1/admin/avatar-frame-topics"]
export type FrameTopics =
  TopicPath["get"]["responses"][200]["content"]["application/json"]
type TopicResult =
  TopicPath["post"]["responses"][201]["content"]["application/json"]
type CatalogPath = paths["/v1/admin/avatar-frames"]
export type FrameList =
  CatalogPath["get"]["responses"][200]["content"]["application/json"]
export type CreateFrameInput =
  CatalogPath["post"]["requestBody"]["content"]["application/json"]
export type UpdateFrameInput =
  paths["/v1/admin/avatar-frames/{id}"]["patch"]["requestBody"]["content"]["application/json"]
type FrameResult =
  CatalogPath["post"]["responses"][201]["content"]["application/json"]
type ApiError = components["schemas"]["ApiError"]

export type FrameFilters = {
  page: number
  q: string
  rarity: FrameRarity | "all"
  active: "all" | "true" | "false"
  limited: "all" | "true" | "false"
  topicId?: string
}

export const defaultFrameFilters: FrameFilters = {
  page: 1,
  q: "",
  rarity: "all",
  active: "all",
  limited: "all",
  topicId: "all",
}
export const MAX_FRAME_SOURCE_BYTES = 10 * 1024 * 1024

export class AvatarFrameError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message)
  }
}

export async function avatarFrameRequest<T>(
  apiBaseUrl: string,
  path: string,
  init: RequestInit = {},
  timeout = 8_000
) {
  const response = await fetch(new URL(path, apiBaseUrl), {
    ...init,
    cache: "no-store",
    credentials: "include",
    headers: { accept: "application/json", ...init.headers },
    signal: init.signal
      ? AbortSignal.any([init.signal, AbortSignal.timeout(timeout)])
      : AbortSignal.timeout(timeout),
  })
  const body = (await response.json().catch(() => null)) as T | ApiError | null
  if (!response.ok) {
    const error =
      body && typeof body === "object" && "error" in body ? body.error : null
    throw new AvatarFrameError(
      response.status,
      error?.code ?? "UPSTREAM_ERROR",
      error?.message ?? "Không thể xử lý yêu cầu."
    )
  }
  if (!body) throw new Error("Missing response")
  return body as T
}

const request = avatarFrameRequest

export function adminFramesPath(filters: FrameFilters) {
  const params = new URLSearchParams({
    page: String(Math.max(1, filters.page)),
    limit: "20",
  })
  if (filters.q.trim()) params.set("q", filters.q.trim())
  if (filters.rarity !== "all") params.set("rarity", filters.rarity)
  if (filters.active !== "all") params.set("active", filters.active)
  if (filters.limited !== "all") params.set("limited", filters.limited)
  if (filters.topicId && filters.topicId !== "all")
    params.set("topicId", filters.topicId)
  return `/v1/admin/avatar-frames?${params}`
}

export function adminFramesKey(apiBaseUrl: string, userId: string) {
  return ["account", apiBaseUrl, userId, "admin-avatar-frames"] as const
}

export function frameTopicsOptions(apiBaseUrl: string, userId: string) {
  return queryOptions({
    queryKey: ["account", apiBaseUrl, userId, "avatar-frame-topics"],
    queryFn: ({ signal }) =>
      request<FrameTopics>(apiBaseUrl, "/v1/admin/avatar-frame-topics", {
        signal,
      }),
    staleTime: 30_000,
    gcTime: 0,
    retry: false,
    networkMode: "always",
  })
}

export function saveFrameTopic(
  apiBaseUrl: string,
  name: string,
  topic: FrameTopic | null
) {
  return request<TopicResult>(
    apiBaseUrl,
    `/v1/admin/avatar-frame-topics${topic ? `/${encodeURIComponent(topic.id)}` : ""}`,
    {
      method: topic ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        ...(topic ? { expectedVersion: topic.version } : {}),
      }),
    }
  )
}

export function removeFrameTopic(apiBaseUrl: string, topic: FrameTopic) {
  return request<{ deleted: true }>(
    apiBaseUrl,
    `/v1/admin/avatar-frame-topics/${encodeURIComponent(topic.id)}`,
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedVersion: topic.version }),
    }
  )
}

export async function saveFrameWithAsset(
  apiBaseUrl: string,
  input: CreateFrameInput,
  frame: AdminAvatarFrame | null,
  file: File | null,
  onMetadataSaved: (frame: AdminAvatarFrame) => void
) {
  if (file) {
    const error = validateFrameFile(file)
    if (error) throw new AvatarFrameError(400, "INVALID_AVATAR_FRAME", error)
  }
  const { code, ...metadata } = input
  const saved = frame
    ? await updateFrame(apiBaseUrl, frame.id, {
        ...metadata,
        expectedVersion: frame.version,
      })
    : await createFrame(apiBaseUrl, { ...metadata, code })
  // Preserve the created ID before uploading. Retrying after a failed upload
  // updates this draft instead of creating another catalog entry.
  onMetadataSaved(saved.data)
  return file ? uploadFrame(apiBaseUrl, saved.data, file) : saved
}

export function adminFramesOptions(
  apiBaseUrl: string,
  userId: string,
  filters: FrameFilters
) {
  return queryOptions({
    queryKey: [...adminFramesKey(apiBaseUrl, userId), filters],
    queryFn: ({ signal }) =>
      request<FrameList>(apiBaseUrl, adminFramesPath(filters), { signal }),
    staleTime: 30_000,
    gcTime: 0,
    retry: false,
    networkMode: "always",
  })
}

// There is no detail endpoint. Search the immutable code and check exact equality;
// pagination is necessary because q also matches names/substrings.
export async function findFrameByCode(apiBaseUrl: string, code: string) {
  let page = 1
  while (true) {
    const result = await request<FrameList>(
      apiBaseUrl,
      adminFramesPath({ ...defaultFrameFilters, q: code, page })
    )
    const frame = result.data.find((item) => item.code === code)
    if (frame || page >= result.meta.totalPages) return frame ?? null
    page += 1
  }
}

export function createFrame(apiBaseUrl: string, input: CreateFrameInput) {
  return request<FrameResult>(apiBaseUrl, "/v1/admin/avatar-frames", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
}

export function updateFrame(
  apiBaseUrl: string,
  id: string,
  input: UpdateFrameInput
) {
  return request<FrameResult>(
    apiBaseUrl,
    `/v1/admin/avatar-frames/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }
  )
}

export function validateFrameFile(file: File) {
  if (!file.size) return "File ảnh trống."
  if (file.size > MAX_FRAME_SOURCE_BYTES)
    return "File nguồn không được vượt quá 10 MiB."
  if (
    !/\.(png|webp)$/i.test(file.name) ||
    (file.type && !["image/png", "image/webp"].includes(file.type))
  ) {
    return "Chỉ nhận PNG tĩnh hoặc WebP tĩnh/động; không nhận GIF, SVG hoặc APNG."
  }
  return null
}

export async function uploadFrame(
  apiBaseUrl: string,
  frame: AdminAvatarFrame,
  file: File
) {
  const error = validateFrameFile(file)
  if (error) throw new AvatarFrameError(400, "INVALID_AVATAR_FRAME", error)
  const body = new FormData()
  body.set("file", file)
  body.set("expectedVersion", String(frame.version))
  // Let the browser set the multipart boundary. Normalization can take much
  // longer than a normal API query; never automatically retry this mutation.
  return request<FrameResult>(
    apiBaseUrl,
    `/v1/admin/avatar-frames/${encodeURIComponent(frame.id)}/asset`,
    {
      method: "POST",
      body,
    },
    180_000
  )
}

export function frameNeedsReload(error: unknown) {
  return (
    !(error instanceof AvatarFrameError) ||
    error.code === "VERSION_CONFLICT" ||
    error.status >= 500
  )
}

export function frameErrorMessage(error: unknown) {
  if (!(error instanceof AvatarFrameError))
    return "Mất kết nối hoặc hết thời gian chờ. Kết quả thao tác chưa xác định; hãy tải trạng thái mới trước khi thử lại."
  if (error.status === 401)
    return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
  switch (error.code) {
    case "FRAME_TOPIC_NAME_CONFLICT":
      return "Tên chủ đề đã tồn tại. Hãy chọn tên khác."
    case "FRAME_TOPIC_NOT_FOUND":
      return "Chủ đề không còn tồn tại. Hãy tải lại và chọn chủ đề khác."
    case "FRAME_CODE_CONFLICT":
      return "Mã khung đã tồn tại. Hãy chọn mã khác hoặc tìm khung hiện có trong danh sách."
    case "VERSION_CONFLICT":
      return "Khung đã thay đổi ở nơi khác. Hãy tải bản mới trước khi tiếp tục."
    case "LIMITED_IMMUTABLE":
      return "Không thể đổi loại limited sau khi khung từng được bật hoặc cấp cho người dùng."
    case "INVALID_RARITY":
      return "Khung limited phải có độ hiếm SSR."
    case "FRAME_NOT_READY":
      return "Khung chưa được bật hoặc chưa có ảnh hợp lệ. Hãy kiểm tra lại trong quản lý khung."
    case "LIMITED_FRAME_PROTECTED":
      return "Khung limited chỉ được cấp qua banner riêng; admin không thể cấp hoặc gỡ."
    case "PAYLOAD_TOO_LARGE":
      return "File nguồn không được vượt quá 10 MiB."
    case "IMAGE_PROCESSOR_BUSY":
      return "Bộ xử lý ảnh đang bận. Vui lòng thử lại sau."
    case "MEDIA_STORAGE_UNAVAILABLE":
      return "Kho ảnh chưa sẵn sàng. Hãy tải trạng thái mới và kiểm tra cấu hình lưu trữ trước khi thử lại."
    default:
      return error.status === 403
        ? "Bạn không có quyền quản lý khung avatar."
        : error.message
  }
}
