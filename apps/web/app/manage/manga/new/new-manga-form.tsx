"use client"

import Link from "next/link"
import { useRouter } from "@bprogress/next/app"
import { type SubmitEvent, useRef, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { SaveIcon } from "lucide-react"
import {
  Controller,
  FormProvider,
  type FieldPath,
  useForm,
} from "react-hook-form"
import { useAccount } from "@/modules/account/provider"
import { usePermissionToast } from "@/hooks/use-permission-toast"
import type { components } from "@/src/lib/generated/api"
import {
  ContentGroupsField,
  type ContentGroup,
} from "@/components/content-groups-field"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { FieldError } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Spinner } from "@workspace/ui/components/spinner"
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "@workspace/ui/components/toast"

import { AlternativeTitlesField } from "./alternative-titles-field"
import {
  MAX_PUBLICATION_YEAR,
  mangaFormSchema,
  type MangaFormInput,
  type MangaFormValues,
} from "./form-schema"
import { MangaCoverField } from "./manga-cover-field"
import { MangaFormNav } from "./manga-form-nav"
import { MangaLinksField } from "./manga-links-field"
import { MangaStatusFields } from "./manga-status-fields"
import { MangaTagsField } from "./manga-tags-field"
import { MetadataPeopleFields } from "./metadata-people-fields"
import { MangaOwnerTransfer } from "./manga-owner-transfer"
import { MangaSubmissionRules } from "../manga-submission-rules"

type ApiError = components["schemas"]["ApiError"]
type MangaCreateInput = components["schemas"]["MangaCreateInput"]
type MangaManagementDetail = components["schemas"]["MangaManagementDetail"]
type MangaUpdateInput = components["schemas"]["MangaUpdateInput"]
type MyGroup = components["schemas"]["MyGroup"]
type Person = components["schemas"]["PersonSummary"]
type PersonList = components["schemas"]["PersonList"]
type Tag = components["schemas"]["TagSummary"]
type CoverUploadResponse = {
  data: NonNullable<components["schemas"]["Cover"]> & { version: number }
}
type CoverUploadSession = {
  id: string
  previewUrl: string
  width: number
  height: number
  expiresAt: string
}

const originalLanguages = [
  { value: "ja", label: "Tiếng Nhật" },
  { value: "ko", label: "Tiếng Hàn" },
  { value: "zh-Hans", label: "Tiếng Trung giản thể" },
  { value: "zh-Hant", label: "Tiếng Trung phồn thể" },
  { value: "vi", label: "Tiếng Việt" },
  { value: "en", label: "Tiếng Anh" },
  { value: "und", label: "Khác" },
]

const contentRatings = [
  { value: "safe", label: "An toàn" },
  { value: "suggestive", label: "Gợi cảm" },
  { value: "erotica", label: "NSFW (Adult)" },
]

class MangaApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | undefined,
    readonly details: ApiError["error"]["details"],
    message: string
  ) {
    super(message)
  }
}

async function request<T>(
  apiBaseUrl: string,
  path: string,
  init: RequestInit = {},
  signal?: AbortSignal,
  timeout = 8_000
) {
  const response = await fetch(new URL(path, apiBaseUrl), {
    ...init,
    cache: "no-store",
    credentials: "include",
    headers: { accept: "application/json", ...init.headers },
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(timeout)])
      : AbortSignal.timeout(timeout),
  })
  const body = (await response.json().catch(() => null)) as T | ApiError | null
  if (!response.ok) {
    const error =
      body && typeof body === "object" && "error" in body ? body.error : null
    throw new MangaApiError(
      response.status,
      error?.code,
      error?.details,
      error?.message ?? "Không thể kết nối tới máy chủ."
    )
  }
  return body as T
}

function formDefaults(manga?: MangaManagementDetail): MangaFormInput {
  const alternativeTitles = manga
    ? Object.values(manga.alternativeTitles).flat()
    : []
  return {
    title: manga?.title ?? "",
    alternativeTitles: alternativeTitles.length ? alternativeTitles : [""],
    description: manga?.description ?? "",
    originalLanguage: manga?.originalLanguage ?? "ja",
    publicationDemographic: manga?.publicationDemographic ?? null,
    status: manga?.status ?? "ongoing",
    contentRating:
      manga?.contentRating === "pornographic"
        ? "erotica"
        : (manga?.contentRating ?? "safe"),
    year: manga?.year ? String(manga.year) : "",
    lastVolume: manga?.lastVolume ?? "",
    lastChapter: manga?.lastChapter ?? "",
    links: (manga?.links ?? {}) as MangaFormInput["links"],
    tagIds: manga?.tagIds ?? [],
    authorIds: manga?.authorIds ?? [],
    artistIds: manga?.artistIds ?? [],
    groupIds:
      manga?.groups
        .filter((group) => group.id !== manga.ownerGroup.id)
        .map((group) => group.id) ?? [],
    cover: null,
    coverUploadId: null,
  }
}

function LoadingPage({ title }: { title: string }) {
  return (
    <section className="mx-auto flex w-full max-w-480 flex-col gap-5 px-4 py-6 sm:px-6">
      <h1 className="section-heading text-2xl">{title}</h1>
      <Spinner aria-label="Đang tải dữ liệu truyện" className="self-center" />
    </section>
  )
}

function ErrorPage({
  message,
  onRetry,
  title,
}: {
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
      </div>
    </section>
  )
}

function FieldLabel({
  children,
  htmlFor,
  required = false,
}: {
  children: React.ReactNode
  htmlFor: string
  required?: boolean
}) {
  return (
    <label className="text-sm font-medium" htmlFor={htmlFor}>
      {children}
      {required ? (
        <>
          <span aria-hidden="true" className="text-destructive">
            {" "}
            *
          </span>
          <span className="sr-only"> (bắt buộc)</span>
        </>
      ) : null}
    </label>
  )
}

function FormField({
  children,
  description,
  error,
  htmlFor,
  label,
  required,
}: {
  children: React.ReactNode
  description?: string
  error?: string
  htmlFor: string
  label: string
  required?: boolean
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2" data-invalid={!!error}>
      <FieldLabel htmlFor={htmlFor} required={required}>
        {label}
      </FieldLabel>
      {children}
      {description ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
      {error ? <FieldError>{error}</FieldError> : null}
    </div>
  )
}

function MangaFormLoader({
  admin = false,
  mangaId,
  tags,
}: {
  admin?: boolean
  mangaId?: string
  tags: Tag[]
}) {
  const account = useAccount()
  const router = useRouter()
  const queryClient = useQueryClient()
  const title = mangaId ? "Chỉnh sửa truyện" : "Thêm truyện mới"
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
  const detailKey = [
    "manga-management",
    account.apiBaseUrl,
    admin ? "admin" : contributorGroupId,
    mangaId,
  ] as const
  const detail = useQuery({
    queryKey: detailKey,
    enabled: Boolean(
      account.status === "authenticated" &&
      mangaId &&
      (admin || contributorGroupId)
    ),
    queryFn: ({ signal }) =>
      request<{ data: MangaManagementDetail }>(
        account.apiBaseUrl,
        admin
          ? `/v1/admin/manga/${encodeURIComponent(mangaId!)}`
          : `/v1/contribution/groups/${encodeURIComponent(contributorGroupId!)}/manga/${encodeURIComponent(mangaId!)}`,
        {},
        signal
      ),
    staleTime: 30_000,
    retry: false,
  })
  const manga = detail.data?.data
  const personIds = manga
    ? [...new Set([...manga.authorIds, ...manga.artistIds])]
    : []
  const people = useQuery({
    queryKey: ["people", account.apiBaseUrl, "ids", ...personIds],
    enabled: personIds.length > 0,
    queryFn: ({ signal }) => {
      const url = new URL("/v1/people", account.apiBaseUrl)
      for (const id of personIds) url.searchParams.append("id", id)
      url.searchParams.set("limit", String(personIds.length))
      return request<PersonList>(
        account.apiBaseUrl,
        url.pathname + url.search,
        {},
        signal
      )
    },
    staleTime: 5 * 60_000,
    retry: false,
  })

  if (
    account.status === "loading" ||
    (account.status === "authenticated" && !admin && mine.isPending) ||
    (mangaId && (admin || contributorGroupId) && detail.isPending) ||
    (personIds.length > 0 && people.isPending)
  )
    return <LoadingPage title={title} />
  if (account.status === "guest")
    return (
      <ErrorPage message="Bạn cần đăng nhập để quản lý truyện." title={title} />
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
  if (!admin && !contributorGroupId)
    return (
      <ErrorPage
        message="Bạn cần thuộc một nhóm đã được duyệt để quản lý truyện."
        title={title}
      />
    )
  if (mangaId && detail.isError)
    return (
      <ErrorPage
        message={detail.error.message || "Không thể tải dữ liệu truyện."}
        onRetry={() => void detail.refetch()}
        title={title}
      />
    )
  if (mangaId && !manga)
    return <ErrorPage message="Không tìm thấy truyện." title={title} />
  const ownerGroup = manga?.ownerGroup ?? membership?.group
  const groupId = admin ? (ownerGroup?.id ?? null) : contributorGroupId
  if (!groupId || !ownerGroup)
    return (
      <ErrorPage
        message="Truyện chưa được gắn với nhóm quản lý."
        title={title}
      />
    )
  if (personIds.length > 0 && people.isError)
    return (
      <ErrorPage
        message="Không thể tải tác giả và họa sĩ."
        onRetry={() => void people.refetch()}
        title={title}
      />
    )

  const isAdmin = admin || (mine.data?.isAdmin ?? false)
  const permission = admin
    ? true
    : manga
      ? membership!.membership.permissions.canEditManga
      : membership!.membership.permissions.canAddManga
  const canSave = isAdmin || (!manga?.moderationHiddenAt && permission)
  const persons = people.data?.data ?? []
  const personById = new Map(persons.map((person) => [person.id, person]))
  const initialAuthors =
    manga?.authorIds.flatMap((id) => personById.get(id) ?? []) ?? []
  const initialArtists =
    manga?.artistIds.flatMap((id) => personById.get(id) ?? []) ?? []

  return (
    <MangaForm
      admin={admin}
      apiBaseUrl={account.apiBaseUrl}
      canSave={canSave}
      groupId={groupId}
      initialArtists={initialArtists}
      initialAuthors={initialAuthors}
      key={manga ? `${manga.id}:${manga.version}` : "new"}
      manga={manga}
      ownerGroup={ownerGroup}
      onReload={mangaId ? () => void detail.refetch() : undefined}
      onSaved={(saved) => {
        if (mangaId) {
          queryClient.setQueryData(detailKey, { data: saved })
          if (admin) {
            void queryClient.invalidateQueries({
              queryKey: [
                "account",
                account.apiBaseUrl,
                account.user?.id,
                "admin-mangas",
              ],
            })
            void queryClient.invalidateQueries({
              queryKey: ["group-manga", account.apiBaseUrl],
            })
          }
        } else router.replace(`/manage/group/mangas`)
      }}
      returnHref={admin ? "/admin/mangas" : "/manage/group/mangas"}
      tags={tags}
    />
  )
}

export function NewMangaForm({ tags }: { tags: Tag[] }) {
  return <MangaFormLoader tags={tags} />
}

export function EditMangaForm({
  mangaId,
  tags,
}: {
  mangaId: string
  tags: Tag[]
}) {
  return <MangaFormLoader mangaId={mangaId} tags={tags} />
}

export function AdminEditMangaForm({
  mangaId,
  tags,
}: {
  mangaId: string
  tags: Tag[]
}) {
  return <MangaFormLoader admin mangaId={mangaId} tags={tags} />
}

function MangaForm({
  admin,
  apiBaseUrl,
  canSave,
  groupId,
  initialArtists,
  initialAuthors,
  manga,
  ownerGroup,
  onReload,
  onSaved,
  returnHref,
  tags,
}: {
  admin: boolean
  apiBaseUrl: string
  canSave: boolean
  groupId: string
  initialArtists: Person[]
  initialAuthors: Person[]
  manga?: MangaManagementDetail
  ownerGroup: ContentGroup
  onReload?: () => void
  onSaved: (manga: MangaManagementDetail) => void
  returnHref: string
  tags: Tag[]
}) {
  const form = useForm<MangaFormInput, unknown, MangaFormValues>({
    resolver: zodResolver(mangaFormSchema),
    defaultValues: formDefaults(manga),
    mode: "onBlur",
  })
  const saving = useRef(false)
  const [formGeneration, setFormGeneration] = useState(0)
  const [coverUploading, setCoverUploading] = useState(false)
  const mangaPath = `/v1/contribution/groups/${encodeURIComponent(groupId)}/manga`
  const save = useMutation({
    retry: false,
    mutationFn: async (values: MangaFormValues) => {
      const { cover, coverUploadId, groupIds, ...input } = values
      void cover
      const body: MangaCreateInput | MangaUpdateInput = manga
        ? { ...input, slug: manga.slug, expectedVersion: manga.version }
        : { ...input, coverUploadId: coverUploadId ?? undefined, groupIds }
      const saved = await request<{ data: MangaManagementDetail }>(
        apiBaseUrl,
        manga
          ? admin
            ? `/v1/admin/manga/${encodeURIComponent(manga.id)}`
            : `${mangaPath}/${encodeURIComponent(manga.id)}`
          : mangaPath,
        {
          method: manga ? "PUT" : "POST",
          body: JSON.stringify(body),
          headers: { "Content-Type": "application/json" },
        }
      )

      let coverError: string | null = null
      if (coverUploadId) {
        try {
          const uploaded = await request<CoverUploadResponse>(
            apiBaseUrl,
            `${mangaPath}/${encodeURIComponent(saved.data.id)}/cover-uploads/${encodeURIComponent(coverUploadId)}`,
            {
              method: "POST",
              body: JSON.stringify({ expectedVersion: saved.data.version }),
              headers: { "Content-Type": "application/json" },
            },
            undefined,
            30_000
          )
          const { version, ...nextCover } = uploaded.data
          saved.data = { ...saved.data, cover: nextCover, version }
        } catch (error) {
          coverError =
            error instanceof Error
              ? error.message
              : "Không thể tải ảnh bìa lên máy chủ."
        }
      }

      return { manga: saved.data, coverError }
    },
  })
  const removeGroup = useMutation({
    mutationFn: async (group: ContentGroup) => {
      if (!manga) throw new Error("Không tìm thấy truyện.")
      const result = await request<{ data: MangaManagementDetail }>(
        apiBaseUrl,
        `/v1/admin/manga/${encodeURIComponent(manga.id)}/groups/${encodeURIComponent(group.id)}`,
        {
          method: "DELETE",
          body: JSON.stringify({ expectedVersion: manga.version }),
          headers: { "Content-Type": "application/json" },
        }
      )
      return { group, manga: result.data }
    },
    onSuccess: ({ group, manga: saved }) => {
      toast.add({ type: "success", title: `Đã gỡ nhóm ${group.name}` })
      onSaved(saved)
    },
    onError: (error) =>
      toast.add({
        type: "error",
        title: error instanceof Error ? error.message : "Không thể gỡ nhóm.",
      }),
  })
  const submitting = save.isPending || form.formState.isSubmitting
  const busy = submitting || coverUploading || removeGroup.isPending
  const stale =
    save.error instanceof MangaApiError && save.error.code === "STALE_MANGA"
  const accessMessage =
    manga?.moderationHiddenAt && !admin
      ? `Truyện đã bị quản trị viên ẩn${manga.moderationReason ? `: ${manga.moderationReason}` : "."}`
      : canSave
        ? null
        : manga
          ? "Bạn không có quyền sửa truyện."
          : "Bạn không có quyền thêm truyện."
  usePermissionToast(accessMessage)
  const languageOptions =
    manga &&
    !originalLanguages.some(({ value }) => value === manga.originalLanguage)
      ? [
          ...originalLanguages,
          {
            value: manga.originalLanguage,
            label: `Khác (${manga.originalLanguage})`,
          },
        ]
      : originalLanguages

  async function uploadCover(file: File) {
    const data = new FormData()
    data.set("cover", file)
    if (manga) {
      data.set("mangaId", manga.id)
      data.set("expectedVersion", String(manga.version))
    }
    return (
      await request<{ data: CoverUploadSession }>(
        apiBaseUrl,
        `${mangaPath}/cover-uploads`,
        { method: "POST", body: data },
        undefined,
        30_000
      )
    ).data
  }

  async function cancelCoverUpload(sessionId: string) {
    await request<never>(
      apiBaseUrl,
      `${mangaPath}/cover-uploads/${encodeURIComponent(sessionId)}`,
      { method: "DELETE" },
      undefined,
      30_000
    )
  }

  async function submit(values: MangaFormValues) {
    form.clearErrors("root")
    try {
      const result = await save.mutateAsync(values)
      toast.add({
        type: result.coverError ? "error" : "success",
        title: result.coverError
          ? `Đã lưu dữ liệu nhưng tải bìa thất bại: ${result.coverError}`
          : manga
            ? "Đã lưu thay đổi"
            : "Đã thêm truyện",
      })
      if (!manga) {
        form.reset(formDefaults())
        setFormGeneration((generation) => generation + 1)
      }
      onSaved(result.manga)
    } catch (error) {
      const detail =
        error instanceof MangaApiError ? error.details?.[0] : undefined
      const message =
        error instanceof MangaApiError && error.code === "STALE_MANGA"
          ? "Dữ liệu truyện đã thay đổi. Hãy tải lại trước khi lưu tiếp."
          : (detail?.message ??
            (error instanceof Error
              ? error.message
              : "Không thể lưu truyện. Vui lòng thử lại."))
      toast.add({ type: "error", title: message })
      if (detail?.path && detail.path !== "$") {
        const path = detail.path as FieldPath<MangaFormInput>
        form.setError(path, { type: "server", message: detail.message })
        form.setFocus(path)
      }
    }
  }

  async function handleMangaSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving.current) return
    saving.current = true
    try {
      await form.handleSubmit(submit)(event)
    } finally {
      saving.current = false
    }
  }

  return (
    <FormProvider {...form}>
      <form key={formGeneration} onSubmit={handleMangaSubmit}>
        <section className="mx-auto flex w-full max-w-480 flex-col gap-5 px-4 py-6 sm:px-6">
          <h1 className="section-heading text-2xl">
            {manga ? "Chỉnh sửa truyện" : "Thêm truyện mới"}
          </h1>

          <MangaSubmissionRules />

          <div className="grid min-w-0 gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
            <MangaFormNav />

            <fieldset className="contents" disabled={submitting || !canSave}>
              <div className="flex min-w-0 flex-col gap-5">
                <Card className="scroll-mt-24" id="title">
                  <CardContent className="gap-5">
                    <Controller
                      control={form.control}
                      name="title"
                      render={({ field, fieldState }) => (
                        <FormField
                          error={fieldState.error?.message}
                          htmlFor="title-name"
                          label="Tên truyện"
                          required
                        >
                          <Input
                            {...field}
                            aria-invalid={fieldState.invalid}
                            autoComplete="off"
                            id="title-name"
                            maxLength={255}
                            placeholder="Nhập tên truyện"
                            required
                          />
                        </FormField>
                      )}
                    />

                    <FormField
                      description="Tên khác của truyện, có thể thêm nhiều tên."
                      htmlFor="alternative-title-0"
                      label="Tên khác"
                    >
                      <AlternativeTitlesField />
                    </FormField>

                    <Controller
                      control={form.control}
                      name="description"
                      render={({ field, fieldState }) => (
                        <FormField
                          description="Hỗ trợ Markdown"
                          error={fieldState.error?.message}
                          htmlFor="description"
                          label="Mô tả"
                        >
                          <Textarea
                            {...field}
                            aria-invalid={fieldState.invalid}
                            className="max-h-64 min-h-36 resize-y"
                            id="description"
                            maxLength={20000}
                            placeholder="Nhập mô tả..."
                          />
                        </FormField>
                      )}
                    />
                  </CardContent>
                </Card>

                <Card className="scroll-mt-24 overflow-visible" id="metadata">
                  <CardContent className="gap-5">
                    <div className="grid gap-5 sm:grid-cols-2">
                      <MetadataPeopleFields
                        apiBaseUrl={apiBaseUrl}
                        disabled={busy || !canSave}
                        groupId={groupId}
                        initialArtists={initialArtists}
                        initialAuthors={initialAuthors}
                      />
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                      <Controller
                        control={form.control}
                        name="originalLanguage"
                        render={({ field, fieldState }) => (
                          <FormField
                            error={fieldState.error?.message}
                            htmlFor="original-language"
                            label="Ngôn ngữ gốc"
                            required
                          >
                            <Select
                              items={languageOptions}
                              name={field.name}
                              onValueChange={field.onChange}
                              required
                              value={field.value}
                            >
                              <SelectTrigger
                                aria-invalid={fieldState.invalid}
                                className="w-full"
                                id="original-language"
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent alignItemWithTrigger={false}>
                                <SelectGroup>
                                  {languageOptions.map((item) => (
                                    <SelectItem
                                      key={item.value}
                                      value={item.value}
                                    >
                                      {item.label}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                          </FormField>
                        )}
                      />

                      <Controller
                        control={form.control}
                        name="contentRating"
                        render={({ field, fieldState }) => (
                          <FormField
                            error={fieldState.error?.message}
                            htmlFor="content-rating"
                            label="Phân loại nội dung"
                            required
                          >
                            <Select
                              items={contentRatings}
                              name={field.name}
                              onValueChange={field.onChange}
                              required
                              value={field.value}
                            >
                              <SelectTrigger
                                aria-invalid={fieldState.invalid}
                                className="w-full"
                                id="content-rating"
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent alignItemWithTrigger={false}>
                                <SelectGroup>
                                  {contentRatings.map((item) => (
                                    <SelectItem
                                      key={item.value}
                                      value={item.value}
                                    >
                                      {item.label}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                          </FormField>
                        )}
                      />

                      <Controller
                        control={form.control}
                        name="year"
                        render={({ field, fieldState }) => (
                          <FormField
                            error={fieldState.error?.message}
                            htmlFor="publication-year"
                            label="Năm phát hành"
                          >
                            <Input
                              {...field}
                              aria-invalid={fieldState.invalid}
                              id="publication-year"
                              inputMode="numeric"
                              max={MAX_PUBLICATION_YEAR}
                              min={1}
                              placeholder="Ví dụ: 2024"
                              type="number"
                            />
                          </FormField>
                        )}
                      />

                      <MangaStatusFields />
                    </div>
                  </CardContent>
                </Card>

                <Card className="scroll-mt-24 overflow-visible" id="groups">
                  <CardContent className="gap-5">
                    <Controller
                      control={form.control}
                      name="groupIds"
                      render={({ field, fieldState }) => (
                        <>
                          <ContentGroupsField
                            apiBaseUrl={apiBaseUrl}
                            description={
                              manga
                                ? "Các nhóm đang được gắn với truyện."
                                : "Nhóm hiện tại được gắn mặc định. Bạn có thể thêm các nhóm khác cùng quản lý truyện."
                            }
                            disabled={busy || !canSave}
                            editable={!manga}
                            groups={manga?.groups ?? [ownerGroup]}
                            onChange={field.onChange}
                            onRemove={
                              admin && manga
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
                          {fieldState.error?.message ? (
                            <FieldError>{fieldState.error.message}</FieldError>
                          ) : null}
                        </>
                      )}
                    />
                    {admin && manga ? (
                      <MangaOwnerTransfer
                        apiBaseUrl={apiBaseUrl}
                        disabled={busy}
                        manga={manga}
                        onTransferred={onSaved}
                      />
                    ) : null}
                  </CardContent>
                </Card>

                <Card className="scroll-mt-24" id="genres">
                  <CardContent>
                    <MangaTagsField tags={tags} />
                  </CardContent>
                </Card>

                <Card className="scroll-mt-24" id="links">
                  <CardContent>
                    <MangaLinksField />
                  </CardContent>
                </Card>

                <Card className="scroll-mt-24" id="cover">
                  <CardContent>
                    <MangaCoverField
                      cancelUpload={cancelCoverUpload}
                      initialPreview={manga?.cover?.url}
                      onUploadingChange={setCoverUploading}
                      upload={uploadCover}
                    />
                  </CardContent>
                </Card>
              </div>
            </fieldset>
          </div>

          <div className="sticky bottom-0 z-20 -mx-4 mt-1 grid grid-cols-1 items-center justify-end gap-3 border-t bg-background px-4 py-3 sm:-mx-6 sm:px-6 md:flex">
            {stale && onReload ? (
              <Button
                onClick={() => {
                  save.reset()
                  form.clearErrors()
                  onReload()
                }}
                size="lg"
                type="button"
                variant="outline"
              >
                Tải lại dữ liệu
              </Button>
            ) : null}

            <Link
              className={buttonVariants({
                variant: "secondary",
                size: "lg",
                className: "h-8! min-w-24 md:h-10!",
              })}
              href={returnHref}
            >
              Quay lại
            </Link>
            <Button
              disabled={
                busy || !canSave || Boolean(manga && !form.formState.isDirty)
              }
              size="lg"
              type="submit"
              className="h-8! md:h-10!"
            >
              {busy ? (
                <Spinner aria-hidden="true" data-icon="inline-start" />
              ) : (
                <SaveIcon aria-hidden="true" data-icon="inline-start" />
              )}
              {coverUploading
                ? "Đang tải bìa…"
                : submitting
                  ? "Đang lưu…"
                  : manga
                    ? "Lưu thay đổi"
                    : "Thêm truyện"}
            </Button>
          </div>
        </section>
      </form>
    </FormProvider>
  )
}
