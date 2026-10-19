"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import {
  type ChangeEvent,
  type ReactNode,
  type SubmitEvent,
  useRef,
  useState,
} from "react"
import { useRouter } from "@bprogress/next/app"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeftIcon,
  ArrowDownAZIcon,
  ImageIcon,
  MoveIcon,
  PencilIcon,
  PlusIcon,
  SaveIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import {
  Controller,
  FormProvider,
  type FieldPath,
  useForm,
  useWatch,
} from "react-hook-form"

import { isUuid } from "@/lib/catalog"
import { usePermissionToast } from "@/hooks/use-permission-toast"
import { useAccount } from "@/modules/account/provider"
import type { components } from "@/src/lib/generated/api"
import {
  ContentGroupsField,
  type ContentGroup,
} from "@/components/content-groups-field"
import { Badge } from "@workspace/ui/components/badge"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Checkbox } from "@workspace/ui/components/checkbox"
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
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  Sortable,
  SortableContent,
  SortableItem,
  SortableItemHandle,
} from "@workspace/ui/components/sortable"
import { toast } from "@workspace/ui/components/toast"

import { MangaSubmissionRules } from "../../../manga-submission-rules"
import { MangaInformation } from "../manga-information"
import {
  chapterFormSchema,
  type ChapterFormInput,
  type ChapterFormValues,
} from "./form-schema"
import { RestartUploadButton } from "./restart-upload-button"
import {
  ChapterApiError,
  chapterRequest as request,
  isClosedChapterUploadError,
  restartChapterUpload,
  uploadChapterPage as uploadPage,
} from "./upload-client"

type Chapter = components["schemas"]["ChapterManagementDetail"]
type ChapterSession = components["schemas"]["ChapterUploadSession"]
type Manga = components["schemas"]["MangaManagementDetail"]
type MyGroup = components["schemas"]["MyGroup"]
type SaveDestination = "list" | "new"

type LocalPage = {
  attempted: boolean
  error?: string
  file: File | null
  height: number | null
  id: string
  name: string
  preview: string | null
  progress: number
  size: number
  status: "pending" | "uploading" | "uploaded" | "error"
  stored: boolean
  width: number | null
}

const MAX_PAGES = 220
const MAX_PAGE_BYTES = 12 * 1024 * 1024
const MAX_SESSION_BYTES = 512 * 1024 * 1024
const PAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
])
const naturalFilenameCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
})

class ChapterFinalizeError extends Error {
  constructor(
    readonly chapterId: string,
    cause: unknown
  ) {
    super(
      cause instanceof Error
        ? cause.message
        : "Không thể xử lý bộ ảnh của chương.",
      { cause }
    )
  }
}

function readPreview(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener("load", () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Không thể đọc ảnh"))
    )
    reader.addEventListener("error", () => reject(reader.error))
    reader.readAsDataURL(file)
  })
}

function sessionPages(session?: ChapterSession): LocalPage[] {
  if (!session) return []
  const position = new Map(
    session.orderedPageIds.map((pageId, index) => [pageId, index])
  )
  return [...session.pages]
    .sort(
      (left, right) =>
        (position.get(left.id) ?? MAX_PAGES) -
        (position.get(right.id) ?? MAX_PAGES)
    )
    .map((page, index) => ({
      attempted: true,
      error:
        page.state === "ready"
          ? undefined
          : "Trang tải dở dang. Hãy xoá và chọn lại ảnh.",
      file: null,
      height: page.height,
      id: page.id,
      name: "Trang " + (index + 1),
      preview: page.previewUrl,
      progress: page.state === "ready" ? 100 : 0,
      size: page.sourceByteSize ?? 0,
      status: page.state === "ready" ? "uploaded" : "error",
      stored: page.state === "ready",
      width: page.width,
    }))
}

function sessionIsProcessing(session?: ChapterSession) {
  return (
    session?.processingState === "queued" ||
    session?.processingState === "processing"
  )
}

function LoadingPage({ title }: { title: string }) {
  return (
    <section className="mx-auto flex w-full max-w-480 flex-col gap-5 px-4 py-6 sm:px-6">
      <h1 className="section-heading text-2xl">{title}</h1>
      <Spinner
        aria-label={"Đang tải biểu mẫu " + title.toLocaleLowerCase("vi")}
        className="self-center"
      />
    </section>
  )
}

function ErrorPage({
  actions,
  message,
  onRetry,
  title,
}: {
  actions?: ReactNode
  message: string
  onRetry?: () => void
  title: string
}) {
  return (
    <section className="mx-auto flex w-full max-w-480 flex-col gap-5 px-4 py-6 sm:px-6">
      <h1 className="section-heading text-2xl">{title}</h1>
      <div className="flex flex-col items-start gap-3 rounded-xl border p-5">
        <p className="text-sm text-destructive" role="alert">
          {message}
        </p>
        {onRetry ? (
          <Button onClick={onRetry} type="button" variant="outline">
            Thử lại
          </Button>
        ) : null}
        {actions}
      </div>
    </section>
  )
}

function ChapterFormLoader({
  admin = false,
  chapterId,
  mangaId,
}: {
  admin?: boolean
  chapterId?: string
  mangaId: string
}) {
  const account = useAccount()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const title = chapterId ? "Chỉnh sửa chương" : "Thêm chương mới"
  const [uploadParam] = useState(() => searchParams.get("upload"))
  const [sessionOverride, setSessionOverride] =
    useState<ChapterSession | null>()
  const uploadId = uploadParam && isUuid(uploadParam) ? uploadParam : null
  const mine = useQuery({
    queryKey: ["account", account.apiBaseUrl, account.user?.id, "groups", "me"],
    enabled: account.status === "authenticated" && !admin,
    queryFn: ({ signal }) =>
      request<MyGroup>(account.apiBaseUrl, "/v1/me/groups", {}, signal),
    staleTime: 30_000,
    retry: false,
  })
  const membership = mine.data?.data
  const groupAvailable = Boolean(
    account.account?.profile.status === "active" &&
    membership &&
    membership.group.approvalStatus === "approved" &&
    membership.group.publicationState === "published" &&
    !membership.group.inactive &&
    (mine.data?.isAdmin || membership.membership.status === "approved")
  )
  const contributorGroupId = groupAvailable
    ? (membership?.group.id ?? null)
    : null
  const manga = useQuery({
    queryKey: [
      "manga-management",
      account.apiBaseUrl,
      admin ? "admin" : contributorGroupId,
      mangaId,
    ],
    enabled:
      account.status === "authenticated" &&
      (admin || Boolean(contributorGroupId)),
    queryFn: ({ signal }) =>
      request<{ data: Manga }>(
        account.apiBaseUrl,
        admin
          ? `/v1/admin/manga/${encodeURIComponent(mangaId)}`
          : `/v1/contribution/groups/${encodeURIComponent(contributorGroupId!)}/manga/${encodeURIComponent(mangaId)}`,
        {},
        signal
      ),
    staleTime: 30_000,
    retry: false,
  })
  const chapter = useQuery({
    queryKey: [
      "chapter-management",
      account.apiBaseUrl,
      admin ? "admin" : contributorGroupId,
      mangaId,
      chapterId,
    ],
    enabled: Boolean(chapterId && manga.data && (admin || contributorGroupId)),
    queryFn: ({ signal }) =>
      request<{ data: Chapter; groupId?: string }>(
        account.apiBaseUrl,
        admin
          ? `/v1/admin/chapters/${encodeURIComponent(chapterId!)}`
          : `/v1/contribution/groups/${encodeURIComponent(contributorGroupId!)}/manga/${encodeURIComponent(mangaId)}/chapters/${encodeURIComponent(chapterId!)}`,
        {},
        signal
      ),
    staleTime: 30_000,
    retry: false,
  })
  const groupId = admin ? (chapter.data?.groupId ?? null) : contributorGroupId
  const activeUploadId =
    sessionOverride === undefined
      ? chapterId
        ? (chapter.data?.data.activeUploadSession?.id ?? null)
        : uploadId
      : (sessionOverride?.id ?? null)
  const preparePublishedPages = Boolean(
    sessionOverride === undefined &&
    chapterId &&
    chapter.data?.data.publicationState === "published"
  )
  const shouldLoadUpload = Boolean(activeUploadId || preparePublishedPages)
  const upload = useQuery({
    queryKey: [
      "chapter-staging",
      account.apiBaseUrl,
      groupId,
      mangaId,
      chapterId,
      activeUploadId,
    ],
    enabled: Boolean(groupId && manga.data && shouldLoadUpload),
    queryFn: ({ signal }) =>
      request<{ data: ChapterSession }>(
        account.apiBaseUrl,
        "/v1/contribution/groups/" +
          encodeURIComponent(groupId!) +
          "/manga/" +
          encodeURIComponent(mangaId) +
          (chapterId
            ? "/chapters/" +
              encodeURIComponent(chapterId) +
              "/uploads" +
              (activeUploadId ? "/" + encodeURIComponent(activeUploadId) : "")
            : "/chapter-uploads/" + encodeURIComponent(activeUploadId!)),
        activeUploadId
          ? {}
          : {
              method: "POST",
              body: JSON.stringify({
                expectedVersion: chapter.data!.data.version,
                mode: "replacement",
              }),
              headers: { "Content-Type": "application/json" },
            },
        signal
      ),
    staleTime: 30_000,
    retry: false,
  })

  if (
    account.status === "loading" ||
    (account.status === "authenticated" && !admin && mine.isPending) ||
    ((admin || groupId) && manga.isPending)
  )
    return <LoadingPage title={title} />
  if (account.status === "guest")
    return (
      <ErrorPage message="Bạn cần đăng nhập để quản lý chương." title={title} />
    )
  if (account.status === "error")
    return (
      <ErrorPage
        message="Không thể tải thông tin tài khoản."
        onRetry={() => void account.retry()}
        title={title}
      />
    )
  if (!admin && mine.isError)
    return (
      <ErrorPage
        message="Không thể tải thông tin nhóm dịch."
        onRetry={() => void mine.refetch()}
        title={title}
      />
    )
  if (!admin && !groupId)
    return (
      <ErrorPage
        message="Bạn cần thuộc một nhóm đã được duyệt để quản lý chương."
        title={title}
      />
    )
  if (manga.isError)
    return (
      <ErrorPage
        message={manga.error.message || "Không thể tải dữ liệu truyện."}
        onRetry={() => void manga.refetch()}
        title={title}
      />
    )
  if (!manga.data)
    return <ErrorPage message="Không tìm thấy truyện." title={title} />
  if (!chapterId && uploadParam && !uploadId)
    return <ErrorPage message="Mã phiên tải ảnh không hợp lệ." title={title} />
  if (
    (chapterId && chapter.isPending) ||
    (shouldLoadUpload && upload.isPending)
  )
    return <LoadingPage title={title} />
  if (chapter.isError)
    return (
      <ErrorPage
        message={chapter.error.message || "Không thể tải dữ liệu chương."}
        onRetry={() => void chapter.refetch()}
        title={title}
      />
    )
  if (chapterId && !chapter.data)
    return <ErrorPage message="Không tìm thấy chương." title={title} />
  if (admin && chapter.data && chapter.data.data.mangaId !== mangaId)
    return <ErrorPage message="Chương không thuộc truyện này." title={title} />
  if (!groupId)
    return (
      <ErrorPage
        message="Chương chưa được gắn với nhóm quản lý truyện."
        title={title}
      />
    )
  const isAdmin = admin || (mine.data?.isAdmin ?? false)
  const canAdd = isAdmin || membership!.membership.permissions.canAddChapter
  const canEdit = isAdmin || membership!.membership.permissions.canEditChapter
  const initialChapter = chapter.data?.data
  const moderationBlocked =
    !admin &&
    Boolean(
      manga.data.data.moderationHiddenAt || initialChapter?.moderationHiddenAt
    )
  const canUpload =
    !moderationBlocked &&
    (initialChapter?.publicationState === "published" ? canEdit : canAdd)
  function sessionChanged(next: ChapterSession | null) {
    if (next)
      queryClient.setQueryData(
        [
          "chapter-staging",
          account.apiBaseUrl,
          groupId,
          mangaId,
          chapterId,
          next.id,
        ],
        { data: next }
      )
    setSessionOverride(next)
  }
  if (shouldLoadUpload && upload.isError)
    return (
      <ErrorPage
        message={upload.error.message || "Không thể tải phiên tải ảnh."}
        onRetry={() => void upload.refetch()}
        actions={
          canUpload &&
          activeUploadId &&
          isClosedChapterUploadError(upload.error) ? (
            <RestartUploadButton
              onRestart={async () => {
                const base =
                  `/v1/contribution/groups/${encodeURIComponent(groupId)}/manga/${encodeURIComponent(mangaId)}` +
                  (chapterId
                    ? `/chapters/${encodeURIComponent(chapterId)}/uploads`
                    : "/chapter-uploads")
                const next = await restartChapterUpload({
                  apiBaseUrl: account.apiBaseUrl,
                  path: base,
                  sessionId: activeUploadId,
                  input: initialChapter
                    ? {
                        expectedVersion: initialChapter.version,
                        mode:
                          initialChapter.publicationState === "published"
                            ? "replacement"
                            : "initial",
                      }
                    : undefined,
                  onCancelled: () => undefined,
                })
                sessionChanged(next)
                if (!chapterId) {
                  const url = new URL(window.location.href)
                  url.searchParams.set("upload", next.id)
                  window.history.replaceState(window.history.state, "", url)
                }
              }}
            />
          ) : null
        }
        title={title}
      />
    )

  const ownerGroup = initialChapter?.ownerGroup ?? membership?.group
  if (!ownerGroup)
    return (
      <ErrorPage
        message="Chương chưa được gắn với nhóm quản lý."
        title={title}
      />
    )
  return (
    <ChapterForm
      apiBaseUrl={account.apiBaseUrl}
      admin={admin}
      canSave={!moderationBlocked && (chapterId ? canEdit : canAdd)}
      canUpload={canUpload}
      groupId={groupId}
      initialChapter={initialChapter}
      initialSession={
        sessionOverride === undefined
          ? upload.data?.data
          : (sessionOverride ?? undefined)
      }
      key={(chapterId ?? "new") + ":" + groupId}
      manga={manga.data.data}
      mangaId={mangaId}
      ownerGroup={ownerGroup}
      onSessionChanged={sessionChanged}
      onSaved={(saved) => {
        if (saved && admin)
          queryClient.setQueryData(
            [
              "chapter-management",
              account.apiBaseUrl,
              "admin",
              mangaId,
              chapterId,
            ],
            { data: saved, groupId }
          )
        if (admin) {
          void queryClient.invalidateQueries({
            queryKey: ["admin-chapters", account.apiBaseUrl, mangaId],
          })
          void queryClient.invalidateQueries({
            queryKey: [
              "chapter-management",
              account.apiBaseUrl,
              "admin",
              mangaId,
              chapterId,
            ],
          })
        }
        void queryClient.invalidateQueries({
          queryKey: ["group-manga", account.apiBaseUrl, groupId],
        })
        void queryClient.invalidateQueries({
          queryKey: ["manga-management", account.apiBaseUrl, groupId, mangaId],
        })
        void queryClient.invalidateQueries({
          queryKey: ["group-chapters", account.apiBaseUrl, groupId, mangaId],
        })
        if (chapterId)
          void queryClient.invalidateQueries({
            queryKey: [
              "chapter-management",
              account.apiBaseUrl,
              groupId,
              mangaId,
              chapterId,
            ],
          })
      }}
    />
  )
}

function ChapterForm({
  admin,
  apiBaseUrl,
  canSave,
  canUpload,
  groupId,
  initialChapter,
  initialSession,
  manga,
  mangaId,
  onSaved,
  onSessionChanged,
  ownerGroup,
}: {
  admin: boolean
  apiBaseUrl: string
  canSave: boolean
  canUpload: boolean
  groupId: string
  initialChapter?: Chapter
  initialSession?: ChapterSession
  manga: Manga
  mangaId: string
  onSaved: (chapter?: Chapter) => void
  onSessionChanged: (session: ChapterSession | null) => void
  ownerGroup: ContentGroup
}) {
  const router = useRouter()
  const listHref = admin
    ? `/admin/manga/${mangaId}/chapter`
    : `/manage/manga/${mangaId}/chapters`
  const initialPages = sessionPages(initialSession)
  const sessionRef = useRef(initialSession)
  const sessionRequest = useRef<Promise<ChapterSession> | null>(null)
  const [pages, setPages] = useState(initialPages)
  const pagesRef = useRef(initialPages)
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [clearOpen, setClearOpen] = useState(false)
  const [previewPage, setPreviewPage] = useState<LocalPage | null>(null)
  const [clearingPages, setClearingPages] = useState(false)
  const [sortingPages, setSortingPages] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [restarting, setRestarting] = useState(false)
  const [saveDestination, setSaveDestination] =
    useState<SaveDestination | null>(null)
  const [finalizing, setFinalizing] = useState(
    sessionIsProcessing(initialSession)
  )
  const saving = useRef(false)
  const editing = Boolean(initialChapter)
  const form = useForm<ChapterFormInput, unknown, ChapterFormValues>({
    resolver: zodResolver(chapterFormSchema),
    defaultValues: {
      oneShot: initialChapter?.number === null,
      volumeNumber: initialChapter?.volume?.number ?? "",
      number: initialChapter?.number ?? "",
      title: initialChapter?.title ?? "",
      groupIds:
        initialChapter?.groups
          .filter((group) => group.id !== initialChapter.ownerGroup.id)
          .map((group) => group.id) ?? [],
    },
    mode: "onBlur",
  })
  const oneShot = useWatch({ control: form.control, name: "oneShot" })
  const chapterPath =
    "/v1/contribution/groups/" +
    encodeURIComponent(groupId) +
    "/manga/" +
    encodeURIComponent(mangaId) +
    (initialChapter ? "/chapters/" + encodeURIComponent(initialChapter.id) : "")
  const uploadPath = initialChapter
    ? chapterPath + "/uploads"
    : chapterPath + "/chapter-uploads"

  function rememberSession(next: ChapterSession) {
    sessionRef.current = next
    setFinalizing(sessionIsProcessing(next))
    onSessionChanged(next)
    return next
  }

  function replacePages(next: LocalPage[]) {
    pagesRef.current = next
    setPages(next)
  }

  function updatePage(id: string, values: Partial<LocalPage>) {
    setPages((current) => {
      const next = current.map((page) =>
        page.id === id ? { ...page, ...values } : page
      )
      pagesRef.current = next
      return next
    })
  }

  async function ensureSession() {
    if (sessionRef.current) return sessionRef.current
    if (sessionRequest.current) return sessionRequest.current
    sessionRequest.current = request<{ data: ChapterSession }>(
      apiBaseUrl,
      uploadPath,
      initialChapter
        ? {
            method: "POST",
            body: JSON.stringify({
              expectedVersion: initialChapter.version,
              mode:
                initialChapter.publicationState === "draft"
                  ? "initial"
                  : "replacement",
            }),
            headers: { "Content-Type": "application/json" },
          }
        : { method: "POST" }
    ).then(({ data }) => {
      rememberSession(data)
      const remotePages = sessionPages(data)
      if (remotePages.length) {
        const localIds = new Set(pagesRef.current.map((page) => page.id))
        replacePages([
          ...remotePages.filter((page) => !localIds.has(page.id)),
          ...pagesRef.current,
        ])
      }
      if (!initialChapter) {
        const url = new URL(window.location.href)
        url.searchParams.set("upload", data.id)
        window.history.replaceState(window.history.state, "", url)
      }
      return data
    })
    try {
      return await sessionRequest.current
    } finally {
      sessionRequest.current = null
    }
  }

  async function persistOrder(
    uploadSession: ChapterSession,
    selectedPages = pagesRef.current
  ) {
    const ordered = await request<{ data: ChapterSession }>(
      apiBaseUrl,
      uploadPath + "/" + encodeURIComponent(uploadSession.id) + "/order",
      {
        method: "PUT",
        body: JSON.stringify({
          pageIds: selectedPages
            .filter((page) => page.stored)
            .map((page) => page.id),
        }),
        headers: { "Content-Type": "application/json" },
      }
    )
    return rememberSession(ordered.data)
  }

  async function uploadSelectedPages(selectedPages: LocalPage[]) {
    if (!selectedPages.length || uploading) return
    setUploading(true)
    let failed = 0
    try {
      const uploadSession = await ensureSession()
      const selected = selectedPages.filter(
        (page): page is LocalPage & { file: File } => Boolean(page.file)
      )
      for (let index = 0; index < selected.length; index += 3) {
        const batch = selected.slice(index, index + 3)
        for (const page of batch)
          updatePage(page.id, {
            attempted: true,
            error: undefined,
            progress: 0,
            status: "uploading",
          })
        const results = await Promise.allSettled(
          batch.map(async (page) => {
            const uploaded = await uploadPage(
              apiBaseUrl,
              uploadPath +
                "/" +
                encodeURIComponent(uploadSession.id) +
                "/pages",
              page,
              (progress) => updatePage(page.id, { progress })
            )
            updatePage(page.id, {
              attempted: true,
              error: undefined,
              height: uploaded.height,
              progress: 100,
              status: "uploaded",
              stored: true,
              width: uploaded.width,
            })
          })
        )
        results.forEach((result, resultIndex) => {
          if (result.status === "fulfilled") return
          failed += 1
          const page = batch[resultIndex]!
          updatePage(page.id, {
            error:
              result.reason instanceof Error
                ? result.reason.message
                : "Không thể tải trang lên.",
            progress: 0,
            status: "error",
          })
        })
      }
      await persistOrder(uploadSession)
      if (failed)
        toast.add({
          type: "error",
          title: failed + " ảnh chưa tải lên được. Bấm Thử lại trên từng ảnh.",
        })
    } catch (error) {
      for (const page of selectedPages)
        if (!pagesRef.current.find(({ id }) => id === page.id)?.stored)
          updatePage(page.id, {
            attempted: true,
            error:
              error instanceof Error
                ? error.message
                : "Không thể tải trang lên.",
            progress: 0,
            status: "error",
          })
      toast.add({
        type: "error",
        title:
          error instanceof Error
            ? error.message
            : "Không thể bắt đầu phiên tải ảnh.",
      })
    } finally {
      setUploading(false)
    }
  }

  const save = useMutation({
    retry: false,
    mutationFn: async ({
      selectedPages,
      values,
    }: {
      selectedPages: LocalPage[]
      values: ChapterFormValues
    }) => {
      const uploadSession = sessionRef.current
      if (!editing && (!uploadSession || !selectedPages.length))
        throw new Error("Hãy chọn ít nhất một trang truyện.")
      if (canUpload && selectedPages.some((page) => !page.stored))
        throw new Error("Hãy chờ tất cả ảnh tải lên hoặc thử lại ảnh bị lỗi.")
      const pageIds = selectedPages
        .filter((page) => page.stored)
        .map((page) => page.id)
      const finalize = (chapter: Chapter) =>
        request<{ data: Chapter }>(
          apiBaseUrl,
          "/v1/contribution/groups/" +
            encodeURIComponent(groupId) +
            "/manga/" +
            encodeURIComponent(mangaId) +
            "/chapters/" +
            encodeURIComponent(chapter.id) +
            "/uploads/" +
            encodeURIComponent(uploadSession!.id) +
            "/finalize",
          {
            method: "POST",
            body: JSON.stringify({
              expectedVersion: chapter.version,
              pageIds,
            }),
            headers: { "Content-Type": "application/json" },
          }
        )

      if (uploadSession?.state === "finalizing") {
        if (!initialChapter)
          throw new Error("Hãy mở lại chương để tiếp tục xử lý ảnh.")
        return finalize({
          ...initialChapter,
          version:
            uploadSession.expectedChapterVersion ?? initialChapter.version,
        })
      }
      if (uploadSession && canUpload)
        await persistOrder(uploadSession, selectedPages)
      const saved = initialChapter
        ? await request<{ data: Chapter }>(apiBaseUrl, chapterPath, {
            method: "PUT",
            body: JSON.stringify({
              number: values.number,
              title: values.title,
              volumeNumber: values.volumeNumber,
              language: values.language,
              expectedVersion: initialChapter.version,
              uploadSessionId: canUpload ? uploadSession?.id : undefined,
            }),
            headers: { "Content-Type": "application/json" },
          })
        : await request<{ data: Chapter }>(
            apiBaseUrl,
            uploadPath +
              "/" +
              encodeURIComponent(uploadSession!.id) +
              "/commit",
            {
              method: "POST",
              body: JSON.stringify(values),
              headers: { "Content-Type": "application/json" },
            }
          )
      if (!uploadSession) return saved
      try {
        const finalized = await finalize(saved.data)
        rememberSession({
          ...uploadSession,
          chapterId: saved.data.id,
          expectedChapterVersion: saved.data.version,
          failureReason: null,
          processingState: "queued",
          state: "finalizing",
        })
        return finalized
      } catch (error) {
        throw new ChapterFinalizeError(saved.data.id, error)
      }
    },
  })
  const removeGroup = useMutation({
    mutationFn: async (group: ContentGroup) => {
      if (!initialChapter) throw new Error("Không tìm thấy chương.")
      const result = await request<{ data: Chapter }>(
        apiBaseUrl,
        `/v1/admin/chapters/${encodeURIComponent(initialChapter.id)}/groups/${encodeURIComponent(group.id)}`,
        {
          method: "DELETE",
          body: JSON.stringify({ expectedVersion: initialChapter.version }),
          headers: { "Content-Type": "application/json" },
        }
      )
      return { chapter: result.data, group }
    },
    onSuccess: ({ chapter: saved, group }) => {
      toast.add({ type: "success", title: `Đã gỡ nhóm ${group.name}` })
      onSaved(saved)
    },
    onError: (error) =>
      toast.add({
        type: "error",
        title: error instanceof Error ? error.message : "Không thể gỡ nhóm.",
      }),
  })

  const busy =
    save.isPending ||
    removeGroup.isPending ||
    uploading ||
    removing !== null ||
    clearingPages ||
    sortingPages ||
    cancelling ||
    restarting
  const uploadedCount = pages.filter((page) => page.stored).length

  async function selectPages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ""
    const remaining = MAX_PAGES - pagesRef.current.length
    const currentBytes = pagesRef.current.reduce(
      (total, page) => total + page.size,
      0
    )
    let bytes = currentBytes
    let rejected = 0
    const valid: File[] = []
    for (const file of files.slice(0, Math.max(remaining, 0))) {
      if (
        !PAGE_TYPES.has(file.type) ||
        file.size === 0 ||
        file.size > MAX_PAGE_BYTES ||
        bytes + file.size > MAX_SESSION_BYTES
      ) {
        rejected += 1
        continue
      }
      bytes += file.size
      valid.push(file)
    }
    rejected += Math.max(0, files.length - remaining)
    if (rejected)
      toast.add({
        type: "error",
        title: rejected + " ảnh không hợp lệ hoặc vượt giới hạn tải lên.",
      })
    try {
      const selected = await Promise.all(
        valid.map(async (file): Promise<LocalPage> => ({
          attempted: false,
          file,
          height: null,
          id: crypto.randomUUID(),
          name: file.name,
          preview: await readPreview(file),
          progress: 0,
          size: file.size,
          status: "pending",
          stored: false,
          width: null,
        }))
      )
      replacePages([...pagesRef.current, ...selected])
      await uploadSelectedPages(selected)
    } catch {
      toast.add({ type: "error", title: "Không thể đọc ảnh đã chọn." })
    }
  }

  async function retryPage(page: LocalPage) {
    if (!page.file) {
      toast.add({
        type: "error",
        title: "Ảnh gốc không còn trong trình duyệt. Hãy xoá và chọn lại.",
      })
      return
    }
    await uploadSelectedPages([page])
  }

  async function deleteUploadedPage(
    uploadSession: ChapterSession,
    pageId: string
  ) {
    try {
      await request<void>(
        apiBaseUrl,
        uploadPath +
          "/" +
          encodeURIComponent(uploadSession.id) +
          "/pages/" +
          encodeURIComponent(pageId),
        { method: "DELETE" }
      )
    } catch (error) {
      if (!(error instanceof ChapterApiError && error.status === 404))
        throw error
    }
  }

  async function replacePageImage(
    page: LocalPage,
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    const nextTotalBytes =
      pagesRef.current.reduce((total, item) => total + item.size, 0) -
      page.size +
      file.size
    if (
      !PAGE_TYPES.has(file.type) ||
      file.size === 0 ||
      file.size > MAX_PAGE_BYTES ||
      nextTotalBytes > MAX_SESSION_BYTES
    ) {
      toast.add({ type: "error", title: "Ảnh thay thế không hợp lệ." })
      return
    }
    if (pagesRef.current.length >= MAX_PAGES) {
      toast.add({
        type: "error",
        title: "Hãy xoá ảnh cũ trước khi thay ảnh khi đã đủ 220 trang.",
      })
      return
    }

    setUploading(true)
    let replacement: LocalPage | undefined
    let uploadSession: ChapterSession | undefined
    try {
      replacement = {
        attempted: true,
        file,
        height: null,
        id: crypto.randomUUID(),
        name: file.name,
        preview: await readPreview(file),
        progress: 0,
        size: file.size,
        status: "uploading",
        stored: false,
        width: null,
      }
      uploadSession = await ensureSession()
      updatePage(page.id, {
        error: undefined,
        progress: 0,
        status: "uploading",
      })
      const uploaded = await uploadPage(
        apiBaseUrl,
        uploadPath + "/" + encodeURIComponent(uploadSession.id) + "/pages",
        replacement as LocalPage & { file: File },
        (progress) => updatePage(page.id, { progress })
      )
      replacement = {
        ...replacement,
        height: uploaded.height,
        progress: 100,
        status: "uploaded",
        stored: true,
        width: uploaded.width,
      }
      const reordered = pagesRef.current.map((item) =>
        item.id === page.id ? replacement! : item
      )
      await persistOrder(uploadSession, reordered)
      await deleteUploadedPage(uploadSession, page.id)
      replacePages(reordered)
    } catch (error) {
      if (replacement && uploadSession) {
        await deleteUploadedPage(uploadSession, replacement.id).catch(
          () => undefined
        )
        await persistOrder(uploadSession, pagesRef.current).catch(
          () => undefined
        )
      }
      updatePage(page.id, {
        error: undefined,
        progress: 100,
        status: "uploaded",
      })
      toast.add({
        type: "error",
        title:
          error instanceof Error ? error.message : "Không thể thay ảnh này.",
      })
    } finally {
      setUploading(false)
    }
  }

  async function removePage(page: LocalPage) {
    if (busy) return
    setRemoving(page.id)
    try {
      const uploadSession = sessionRef.current
      if (uploadSession && page.attempted)
        await deleteUploadedPage(uploadSession, page.id)
      replacePages(pagesRef.current.filter(({ id }) => id !== page.id))
      if (uploadSession)
        rememberSession({
          ...uploadSession,
          orderedPageIds: uploadSession.orderedPageIds.filter(
            (id) => id !== page.id
          ),
          pages: uploadSession.pages.filter(({ id }) => id !== page.id),
        })
    } catch (error) {
      toast.add({
        type: "error",
        title:
          error instanceof Error
            ? error.message
            : "Không thể xoá trang truyện.",
      })
    } finally {
      setRemoving(null)
    }
  }

  function reorderPages(reordered: LocalPage[]) {
    replacePages(reordered)
  }

  async function sortPagesNaturally() {
    if (busy || pagesRef.current.length < 2) return
    const previous = pagesRef.current
    const sorted = [...previous].sort((left, right) =>
      naturalFilenameCollator.compare(left.name, right.name)
    )
    setSortingPages(true)
    replacePages(sorted)
    try {
      const uploadSession = sessionRef.current
      if (uploadSession) await persistOrder(uploadSession, sorted)
      toast.add({ type: "success", title: "Đã sắp xếp ảnh theo tên file." })
    } catch (error) {
      replacePages(previous)
      toast.add({
        type: "error",
        title:
          error instanceof Error
            ? error.message
            : "Không thể lưu thứ tự trang.",
      })
    } finally {
      setSortingPages(false)
    }
  }

  async function clearAllPages() {
    if (busy || !pagesRef.current.length) return
    setClearingPages(true)
    try {
      const uploadSession = sessionRef.current
      if (uploadSession && editing) {
        for (const page of [...pagesRef.current]) {
          if (page.attempted) await deleteUploadedPage(uploadSession, page.id)
          replacePages(pagesRef.current.filter(({ id }) => id !== page.id))
        }
        rememberSession({
          ...uploadSession,
          orderedPageIds: [],
          pages: [],
        })
      } else if (uploadSession) {
        await request<void>(
          apiBaseUrl,
          uploadPath + "/" + encodeURIComponent(uploadSession.id),
          { method: "DELETE" }
        )
      }
      replacePages([])
      if (!editing) {
        sessionRef.current = undefined
        sessionRequest.current = null
        onSessionChanged(null)
        setFinalizing(false)
        const url = new URL(window.location.href)
        url.searchParams.delete("upload")
        window.history.replaceState(window.history.state, "", url)
      }
      setClearOpen(false)
      toast.add({ type: "success", title: "Đã xoá tất cả ảnh." })
    } catch (error) {
      toast.add({
        type: "error",
        title:
          error instanceof Error ? error.message : "Không thể xoá tất cả ảnh.",
      })
    } finally {
      setClearingPages(false)
    }
  }

  async function submit(
    values: ChapterFormValues,
    destination: SaveDestination
  ) {
    form.clearErrors("root")
    try {
      const hasUpload = Boolean(sessionRef.current)
      await save.mutateAsync({ selectedPages: pagesRef.current, values })
      resetDraft()
      onSaved()
      toast.add({
        type: "success",
        title: editing
          ? hasUpload
            ? "Đã lưu, chương đang được xử lý"
            : "Đã lưu thay đổi chương"
          : "Đã gửi chương để xử lý",
      })
      if (destination === "list") router.replace(listHref)
    } catch (error) {
      if (error instanceof ChapterFinalizeError && !editing) {
        toast.add({
          type: "error",
          title:
            "Chương đã được tạo nhưng bộ ảnh chưa xử lý xong. Hãy thử lưu lại.",
        })
        router.replace(
          admin
            ? `/admin/manga/${mangaId}/chapter/${error.chapterId}/edit`
            : `/manage/manga/${mangaId}/chapters/${error.chapterId}/edit`
        )
        return
      }
      const detail =
        error instanceof ChapterApiError ? error.details?.[0] : undefined
      const message =
        detail?.message ??
        (error instanceof Error
          ? error.message
          : editing
            ? "Không thể lưu thay đổi."
            : "Không thể đăng chương.")
      toast.add({ type: "error", title: message })
      if (
        detail?.path &&
        ["number", "volumeNumber", "title"].includes(detail.path)
      ) {
        const path = detail.path as FieldPath<ChapterFormInput>
        form.setError(path, { type: "server", message: detail.message })
        form.setFocus(path)
      }
    }
  }

  function resetDraft() {
    sessionRef.current = undefined
    sessionRequest.current = null
    onSessionChanged(null)
    setFinalizing(false)
    replacePages([])
    form.reset()
    const url = new URL(window.location.href)
    url.searchParams.delete("upload")
    window.history.replaceState(window.history.state, "", url)
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving.current || uploading) return
    const submitter = event.nativeEvent.submitter
    const destination: SaveDestination =
      !editing &&
      submitter instanceof HTMLButtonElement &&
      submitter.value === "new"
        ? "new"
        : "list"
    saving.current = true
    setSaveDestination(destination)
    try {
      await form.handleSubmit((values) => submit(values, destination))(event)
    } finally {
      saving.current = false
      setSaveDestination(null)
    }
  }

  async function cancel() {
    if (busy) return
    if (finalizing) {
      router.replace(listHref)
      return
    }
    setCancelling(true)
    try {
      const uploadSession = sessionRef.current
      if (uploadSession)
        await request<void>(
          apiBaseUrl,
          uploadPath + "/" + encodeURIComponent(uploadSession.id),
          { method: "DELETE" }
        )
      resetDraft()
      setCancelling(false)
      router.replace(listHref)
    } catch (error) {
      toast.add({
        type: "error",
        title:
          error instanceof Error
            ? error.message
            : "Không thể huỷ phiên tải ảnh.",
      })
      setCancelling(false)
    }
  }

  async function restartSession() {
    const current = sessionRef.current
    if (!current || busy || finalizing || !canUpload) return
    setRestarting(true)
    try {
      const next = await restartChapterUpload({
        apiBaseUrl,
        path: uploadPath,
        sessionId: current.id,
        input: initialChapter
          ? {
              expectedVersion: initialChapter.version,
              mode:
                initialChapter.publicationState === "published"
                  ? "replacement"
                  : "initial",
            }
          : undefined,
        onCancelled: () => {
          sessionRef.current = undefined
          sessionRequest.current = null
          setFinalizing(false)
          replacePages([])
          setPreviewPage(null)
          onSessionChanged(null)
          const url = new URL(window.location.href)
          url.searchParams.delete("upload")
          window.history.replaceState(window.history.state, "", url)
        },
      })
      rememberSession(next)
      replacePages(sessionPages(next))
      if (!initialChapter) {
        const url = new URL(window.location.href)
        url.searchParams.set("upload", next.id)
        window.history.replaceState(window.history.state, "", url)
      }
    } finally {
      setRestarting(false)
    }
  }

  const moderationReason =
    initialChapter?.moderationReason ?? manga.moderationReason
  const accessMessage =
    !canSave && manga.moderationHiddenAt
      ? `Truyện đã bị quản trị viên ẩn${moderationReason ? `: ${moderationReason}` : "."}`
      : !canSave && initialChapter?.moderationHiddenAt
        ? `Chương đã bị quản trị viên ẩn${moderationReason ? `: ${moderationReason}` : "."}`
        : canSave
          ? null
          : editing
            ? "Bạn không có quyền sửa chương cho nhóm này."
            : "Bạn không có quyền thêm chương cho nhóm này."
  usePermissionToast(accessMessage)
  const processingMessage = finalizing
    ? "Chương đang được xử lý. Bạn có thể quay lại danh sách và tiếp tục công việc khác."
    : initialSession?.failureReason
      ? `Lần xử lý trước thất bại: ${initialSession.failureReason}`
      : null
  return (
    <FormProvider {...form}>
      <form onSubmit={handleSubmit}>
        <section className="mx-auto flex w-full max-w-480 flex-col gap-5 px-4 py-6 sm:px-6">
          <div className="flex items-center gap-2">
            <Link
              aria-label="Quay lại danh sách chương"
              className={buttonVariants({
                size: "icon-sm",
                variant: "secondary",
              })}
              href={listHref}
            >
              <ArrowLeftIcon aria-hidden="true" />
            </Link>
            <h1 className="section-heading text-2xl">
              {editing ? "Chỉnh sửa chương" : "Thêm chương mới"}
            </h1>
          </div>

          <MangaSubmissionRules />

          <Card>
            <CardHeader>
              <CardTitle>Thông tin truyện</CardTitle>
            </CardHeader>
            <CardContent>
              <MangaInformation manga={manga} />
            </CardContent>
          </Card>

          <Card className="overflow-visible">
            <CardHeader>
              <CardTitle>Thông tin chương</CardTitle>
              {processingMessage ? (
                <CardDescription>{processingMessage}</CardDescription>
              ) : null}
            </CardHeader>
            <CardContent>
              <fieldset
                disabled={
                  save.isPending ||
                  cancelling ||
                  restarting ||
                  finalizing ||
                  !canSave
                }
              >
                <FieldGroup>
                  <Controller
                    control={form.control}
                    name="oneShot"
                    render={({ field }) => (
                      <Field orientation="horizontal">
                        <Checkbox
                          checked={field.value}
                          id="chapter-oneshot"
                          name={field.name}
                          onBlur={field.onBlur}
                          onCheckedChange={field.onChange}
                        />
                        <FieldContent>
                          <FieldLabel htmlFor="chapter-oneshot">
                            Đây là Oneshot
                          </FieldLabel>
                          <FieldDescription>
                            Oneshot không cần số tập hoặc số chương.
                          </FieldDescription>
                        </FieldContent>
                      </Field>
                    )}
                  />

                  <div className="grid gap-5 md:grid-cols-2">
                    <Controller
                      control={form.control}
                      name="volumeNumber"
                      render={({ field, fieldState }) => (
                        <Field
                          data-disabled={oneShot || undefined}
                          data-invalid={fieldState.invalid || undefined}
                        >
                          <FieldLabel htmlFor="chapter-volume">
                            Số Tập (Volume)
                          </FieldLabel>
                          <Input
                            {...field}
                            aria-invalid={fieldState.invalid}
                            disabled={oneShot}
                            id="chapter-volume"
                            inputMode="decimal"
                            max="9999999.9"
                            min="0"
                            placeholder="Ví dụ: 2"
                            step="0.1"
                            type="number"
                          />
                          <FieldError errors={[fieldState.error]} />
                        </Field>
                      )}
                    />

                    <Controller
                      control={form.control}
                      name="number"
                      render={({ field, fieldState }) => (
                        <Field
                          data-disabled={oneShot || undefined}
                          data-invalid={fieldState.invalid || undefined}
                        >
                          <FieldLabel htmlFor="chapter-number">
                            Số Chương (Chapter)
                          </FieldLabel>
                          <Input
                            {...field}
                            aria-invalid={fieldState.invalid}
                            disabled={oneShot}
                            id="chapter-number"
                            inputMode="decimal"
                            max="9999999.9"
                            min="0"
                            placeholder="Ví dụ: 12.5"
                            step="0.1"
                            type="number"
                          />
                          <FieldError errors={[fieldState.error]} />
                        </Field>
                      )}
                    />
                  </div>

                  <Controller
                    control={form.control}
                    name="title"
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid || undefined}>
                        <FieldLabel htmlFor="chapter-title">Tiêu đề</FieldLabel>
                        <FieldDescription>
                          Chỉ nhập tiêu đề chương (nếu có), không cần nhập kiểu
                          &quot;Chap 36/Ch. 36/Oneshot...&quot;
                        </FieldDescription>
                        <Input
                          {...field}
                          aria-invalid={fieldState.invalid}
                          id="chapter-title"
                          maxLength={255}
                          placeholder="Nhập tên chương (không bắt buộc)"
                        />
                        <FieldError errors={[fieldState.error]} />
                      </Field>
                    )}
                  />

                  <Controller
                    control={form.control}
                    name="groupIds"
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid || undefined}>
                        <ContentGroupsField
                          apiBaseUrl={apiBaseUrl}
                          description={
                            editing
                              ? "Các nhóm đang được gắn với chương này."
                              : "Thêm nhóm vào chương cũng tự động thêm nhóm đó vào truyện."
                          }
                          disabled={busy || finalizing || !canSave}
                          editable={!editing}
                          groups={initialChapter?.groups ?? [ownerGroup]}
                          onChange={field.onChange}
                          onRemove={
                            admin && editing
                              ? (group) => removeGroup.mutate(group)
                              : undefined
                          }
                          ownerGroup={ownerGroup}
                          removingId={
                            removeGroup.isPending
                              ? removeGroup.variables?.id
                              : null
                          }
                          selectedIds={field.value}
                        />
                        <FieldError errors={[fieldState.error]} />
                      </Field>
                    )}
                  />
                </FieldGroup>
              </fieldset>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <CardTitle>Upload ảnh truyện</CardTitle>
                  {pages.length ? (
                    <Badge variant="outline">
                      {uploadedCount}/{pages.length}
                    </Badge>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <RestartUploadButton
                    disabled={
                      busy || finalizing || !canUpload || !initialSession
                    }
                    onRestart={restartSession}
                  />
                  <Button
                    disabled={busy || finalizing || pages.length < 2}
                    onClick={() => void sortPagesNaturally()}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    {sortingPages ? (
                      <Spinner data-icon="inline-start" />
                    ) : (
                      <ArrowDownAZIcon
                        aria-hidden="true"
                        data-icon="inline-start"
                      />
                    )}
                    Sắp xếp nhanh
                  </Button>
                  <Button
                    disabled={busy || finalizing || !pages.length}
                    onClick={() => setClearOpen(true)}
                    size="sm"
                    type="button"
                    variant="destructive"
                  >
                    <Trash2Icon aria-hidden="true" data-icon="inline-start" />
                    Xoá tất cả
                  </Button>
                </div>
              </div>
              <CardDescription>
                {initialChapter?.publicationState === "published"
                  ? "Bộ ảnh hiện tại đã được nạp sẵn. Bạn có thể thay, thêm, xoá hoặc sắp xếp từng trang rồi lưu thay đổi."
                  : "Ảnh sẽ tự upload lên máy chủ, hỗ trợ JPEG/PNG/WebP/AVIF, dung lượng tối đa 12MB (không khuyến khích ảnh có kích thước quá lớn)."}
                <br />
                Click vào ảnh đã upload để xem preview, kéo thả để thay đổi thứ
                tự.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldSet disabled={busy || finalizing || !canUpload}>
                <FieldLegend className="sr-only">Ảnh trang truyện</FieldLegend>
                <Sortable
                  getItemValue={(page) => page.id}
                  onValueChange={reorderPages}
                  orientation="mixed"
                  value={pages}
                >
                  <SortableContent className="flex max-w-[70.5rem] flex-wrap gap-5">
                    {pages.map((page, index) => (
                      <SortableItem
                        className="group/page relative aspect-[7/10] w-32 shrink-0 overflow-visible rounded-md border bg-muted shadow-sm sm:w-36"
                        key={page.id}
                        value={page.id}
                      >
                        <div className="absolute inset-0 overflow-hidden rounded-[inherit]">
                          {page.preview ? (
                            // eslint-disable-next-line @next/next/no-img-element -- Local preview is not an optimizable asset.
                            <img
                              alt={"Trang " + (index + 1) + ": " + page.name}
                              className="block size-full object-contain"
                              draggable={false}
                              loading="lazy"
                              src={page.preview}
                            />
                          ) : (
                            <div className="flex size-full flex-col items-center justify-center gap-2 p-3 text-center text-muted-foreground">
                              <ImageIcon
                                aria-hidden="true"
                                className="size-7"
                              />
                              {page.width && page.height ? (
                                <span className="text-xs">
                                  {page.width} × {page.height}
                                </span>
                              ) : null}
                            </div>
                          )}
                        </div>

                        {page.preview ? (
                          <button
                            aria-label={"Xem trước trang " + (index + 1)}
                            className="absolute inset-0 z-10 cursor-zoom-in rounded-[inherit] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                            onClick={() => setPreviewPage(page)}
                            title="Xem ảnh"
                            type="button"
                          />
                        ) : null}

                        {page.stored ? (
                          <label
                            className={buttonVariants({
                              variant: "secondary",
                              size: "icon-sm",
                              className:
                                "absolute -top-2 -left-2 z-10 size-8 cursor-pointer rounded-full shadow-sm focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
                            })}
                            title="Thay ảnh"
                          >
                            <PencilIcon aria-hidden="true" />
                            <input
                              accept="image/jpeg,image/png,image/webp,image/avif"
                              aria-label={"Thay ảnh trang " + (index + 1)}
                              className="sr-only"
                              onChange={(event) =>
                                void replacePageImage(page, event)
                              }
                              type="file"
                            />
                          </label>
                        ) : null}

                        <Button
                          aria-label={"Xoá trang " + (index + 1)}
                          className="absolute -top-2 -right-2 z-10 rounded-md shadow-sm"
                          disabled={page.status === "uploading"}
                          onClick={() => void removePage(page)}
                          size="icon-sm"
                          title="Xoá ảnh"
                          type="button"
                          variant="secondary"
                        >
                          {removing === page.id ? (
                            <Spinner />
                          ) : (
                            <XIcon aria-hidden="true" />
                          )}
                        </Button>

                        <SortableItemHandle
                          aria-label={
                            "Kéo để sắp xếp hoặc nhấn để xem trước trang " +
                            (index + 1)
                          }
                          className="absolute inset-x-8 inset-y-8 z-20 flex cursor-grab touch-none items-center justify-center rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:cursor-grabbing"
                          disabled={busy || !page.stored}
                          onClick={() => setPreviewPage(page)}
                          title="Kéo để sắp xếp"
                        >
                          <span
                            className={buttonVariants({
                              variant: "secondary",
                              size: "icon-sm",
                              className:
                                "pointer-events-none rounded-full opacity-90 shadow-sm sm:opacity-0 sm:group-focus-within/page:opacity-90 sm:group-hover/page:opacity-90",
                            })}
                          >
                            <MoveIcon aria-hidden="true" />
                          </span>
                        </SortableItemHandle>

                        {page.status === "pending" ||
                        page.status === "uploading" ? (
                          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[inherit] bg-background/75">
                            <Spinner aria-label="Đang tải ảnh" />
                          </div>
                        ) : null}

                        {page.status === "error" && page.file ? (
                          <Badge
                            className="absolute top-1/2 left-1/2 z-10 max-w-[calc(100%-1rem)] -translate-x-1/2 -translate-y-1/2 cursor-pointer"
                            render={
                              <button
                                aria-label={"Thử tải lại trang " + (index + 1)}
                                onClick={() => void retryPage(page)}
                                type="button"
                              />
                            }
                            title={page.error}
                            variant="destructive"
                          >
                            Lỗi · Thử lại
                          </Badge>
                        ) : null}

                        <Badge
                          className="pointer-events-none absolute bottom-2 left-2 z-10 max-w-[calc(100%-1rem)] truncate"
                          title={page.name}
                          variant="secondary"
                        >
                          {page.name}
                        </Badge>
                      </SortableItem>
                    ))}

                    <label
                      className="flex aspect-[7/10] w-32 cursor-pointer items-center justify-center rounded-md border border-dashed bg-muted/20 text-muted-foreground transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 hover:bg-muted/50 hover:text-foreground sm:w-36"
                      title="Thêm ảnh"
                    >
                      <PlusIcon aria-hidden="true" className="size-8" />
                      <span className="sr-only">Thêm ảnh trang truyện</span>
                      <input
                        accept="image/jpeg,image/png,image/webp,image/avif"
                        aria-label="Thêm ảnh trang truyện"
                        className="sr-only"
                        multiple
                        onChange={(event) => void selectPages(event)}
                        type="file"
                      />
                    </label>
                  </SortableContent>
                </Sortable>
              </FieldSet>
            </CardContent>
          </Card>
          <Dialog
            onOpenChange={(open) => {
              if (!open) setPreviewPage(null)
            }}
            open={previewPage !== null}
          >
            <DialogContent
              className="w-fit max-w-[calc(100%-2rem)] gap-0 border-none bg-transparent p-2 shadow-none ring-0 sm:max-w-[calc(100%-2rem)]"
              showCloseButton={false}
            >
              <DialogHeader className="sr-only">
                <DialogTitle>Xem trước {previewPage?.name}</DialogTitle>
                <DialogDescription>
                  Ảnh đầy đủ của trang truyện đã chọn.
                </DialogDescription>
              </DialogHeader>
              {previewPage?.preview ? (
                // eslint-disable-next-line @next/next/no-img-element -- Local preview is not an optimizable asset.
                <img
                  alt={"Xem trước " + previewPage.name}
                  className="max-h-[calc(100svh-2rem)] max-w-[calc(100vw-2rem)] object-contain"
                  src={previewPage.preview}
                />
              ) : null}
            </DialogContent>
          </Dialog>

          <Dialog
            onOpenChange={(open) => {
              if (!clearingPages) setClearOpen(open)
            }}
            open={clearOpen}
          >
            <DialogContent showCloseButton={!clearingPages}>
              <DialogHeader>
                <DialogTitle>Xoá tất cả ảnh?</DialogTitle>
                <DialogDescription>
                  Toàn bộ ảnh trong bộ đang chỉnh sửa sẽ bị xoá. Hành động này
                  không thể hoàn tác.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  disabled={clearingPages}
                  onClick={() => setClearOpen(false)}
                  type="button"
                  variant="outline"
                >
                  Huỷ
                </Button>
                <Button
                  disabled={clearingPages}
                  onClick={() => void clearAllPages()}
                  type="button"
                  variant="destructive"
                >
                  {clearingPages ? <Spinner data-icon="inline-start" /> : null}
                  {clearingPages ? "Đang xoá…" : "Xoá tất cả"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <div className="sticky bottom-0 z-30 -mx-4 mt-1 grid grid-cols-1 items-center justify-end gap-3 border-t bg-background px-4 py-3 sm:-mx-6 sm:flex sm:px-6">
            <Button
              className="h-9! min-w-24 sm:h-10!"
              disabled={busy}
              onClick={() => void cancel()}
              size="lg"
              type="button"
              variant="secondary"
            >
              {cancelling ? <Spinner data-icon="inline-start" /> : null}
              {editing ? "Quay lại" : "Huỷ"}
            </Button>
            {!editing ? (
              <Button
                className="order-last col-span-2 h-9! sm:order-none sm:h-10! sm:min-w-48"
                disabled={
                  busy ||
                  finalizing ||
                  !canSave ||
                  !pages.length ||
                  uploadedCount !== pages.length
                }
                size="lg"
                type="submit"
                value="new"
              >
                {save.isPending && saveDestination === "new" ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <PlusIcon aria-hidden="true" data-icon="inline-start" />
                )}
                {save.isPending && saveDestination === "new"
                  ? "Đang lưu"
                  : "Đăng và thêm chương mới"}
              </Button>
            ) : null}
            <Button
              className="h-9! min-w-28 sm:h-10!"
              disabled={
                busy ||
                finalizing ||
                !canSave ||
                (canUpload && !pages.length) ||
                (canUpload && uploadedCount !== pages.length)
              }
              size="lg"
              type="submit"
              value="list"
            >
              {save.isPending && saveDestination === "list" ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <SaveIcon aria-hidden="true" data-icon="inline-start" />
              )}
              {save.isPending && saveDestination === "list"
                ? "Đang lưu"
                : finalizing
                  ? "Đang xử lý"
                  : initialSession?.processingState === "failed"
                    ? "Thử xử lý lại"
                    : editing
                      ? "Lưu thay đổi"
                      : "Đăng chương"}
            </Button>
          </div>
        </section>
      </form>
    </FormProvider>
  )
}

export function NewChapterForm({ mangaId }: { mangaId: string }) {
  return <ChapterFormLoader mangaId={mangaId} />
}

export function EditChapterForm({
  chapterId,
  mangaId,
}: {
  chapterId: string
  mangaId: string
}) {
  return <ChapterFormLoader chapterId={chapterId} mangaId={mangaId} />
}

export function AdminEditChapterForm({
  chapterId,
  mangaId,
}: {
  chapterId: string
  mangaId: string
}) {
  return <ChapterFormLoader admin chapterId={chapterId} mangaId={mangaId} />
}
