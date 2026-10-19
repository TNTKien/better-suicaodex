"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ReplyIcon } from "lucide-react"
import type { Dispatch, SetStateAction } from "react"
import { Streamdown } from "streamdown"
import {
  useCommentThread,
  maxCommentLength,
  type ComposerState,
} from "@workspace/account/comments"
import {
  CommentEditor as SharedCommentEditor,
  type CommentEditorProps,
} from "@workspace/ui/components/comment-editor"

import { formatVietnamDateTimeInline } from "@/lib/date"

import { siteConfig } from "@/config/site"
import { basicMarkdownElements } from "@/lib/markdown"
import { loginHref } from "@/modules/account/api"
import { useAccount } from "@/modules/account/provider"
import { AvatarDecoration } from "@/modules/avatar-frames/avatar-decoration"
import type { Comment, CommentScope } from "./api"
import { stickerByName, stickerCategories, parseCommentBody } from "./stickers"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { DrawerFooter } from "@workspace/ui/components/drawer"
import { Spinner } from "@workspace/ui/components/spinner"
import { cn } from "@workspace/ui/lib/utils"

function CommentEditor(
  props: Omit<
    CommentEditorProps,
    "maxLength" | "stickerCategories" | "discordUrl"
  >
) {
  return (
    <SharedCommentEditor
      {...props}
      maxLength={maxCommentLength}
      stickerCategories={stickerCategories}
      discordUrl={siteConfig.links.discord}
    />
  )
}

function CommentContent({ body }: { body: string }) {
  const { text, stickerNames } = parseCommentBody(body)

  return (
    <>
      {text ? (
        <div className="w-fit max-w-full rounded-xl bg-muted px-3 py-2">
          <Streamdown
            allowedElements={basicMarkdownElements}
            className="text-sm leading-6 wrap-break-word"
            controls={false}
            mode="static"
            skipHtml
          >
            {text}
          </Streamdown>
        </div>
      ) : null}
      {stickerNames.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {stickerNames.map((name, index) => {
            const sticker = stickerByName.get(name)!
            return (
              <Image
                alt={`Sticker ${name}`}
                className="size-28 rounded-md object-contain sm:size-32"
                height={128}
                key={`${name}-${index}`}
                src={sticker.url}
                unoptimized
                width={128}
              />
            )
          })}
        </div>
      ) : null}
    </>
  )
}

function CommentItem({
  comment,
  currentUserId,
  isReply = false,
  state,
  setState,
  createPending,
  editingId,
  deletingId,
  showChapter,
  onCreate,
  onEdit,
  onDelete,
}: {
  comment: Comment | Comment["replies"][number]
  currentUserId?: string
  isReply?: boolean
  state: ComposerState
  setState: Dispatch<SetStateAction<ComposerState>>
  createPending: boolean
  editingId?: string
  deletingId?: string
  showChapter?: boolean
  onCreate: (body: string, parentId?: string, chapterId?: string) => void
  onEdit: (id: string, body: string, expectedVersion: number) => void
  onDelete: (id: string, expectedVersion: number) => void
}) {
  const own = currentUserId === comment.author.id
  const editing =
    state.edit?.id === comment.id && !comment.deleted && !comment.hidden
  const replying = state.reply?.id === comment.id
  const replies = "replies" in comment ? comment.replies : []
  const editPending = editingId === comment.id
  const deletePending = deletingId === comment.id

  return (
    <article
      className={cn(
        "grid grid-cols-[2.5rem_minmax(0,1fr)] gap-2",
        isReply ? "gap-3" : "sm:grid-cols-[3rem_minmax(0,1fr)] sm:gap-3"
      )}
    >
      <Link
        aria-label={`Trang cá nhân của ${comment.author.name}`}
        className={cn("size-10 rounded-full", !isReply && "sm:size-12")}
        href={`/profile/${comment.author.id}`}
        prefetch={false}
      >
        <AvatarDecoration frame={comment.author.avatarFrame ?? null}>
          <Avatar
            className={cn("size-10 overflow-hidden", !isReply && "sm:size-12")}
          >
            {comment.author.image ? (
              <AvatarImage alt="" src={comment.author.image} />
            ) : null}
            <AvatarFallback>
              {comment.author.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </AvatarDecoration>
      </Link>
      <div className="min-w-0">
        <div
          className={cn(
            "relative min-h-10 sm:min-h-12",
            replies.length > 0 &&
              "before:pointer-events-none before:absolute before:inset-y-0 before:top-10 before:-left-7 before:border-l-2 before:border-secondary before:content-[''] sm:before:top-12 sm:before:-left-9"
          )}
        >
          <div className="flex flex-wrap items-baseline gap-x-2">
            <Link
              className="truncate text-sm font-semibold underline-offset-4 hover:underline"
              href={`/profile/${comment.author.id}`}
              prefetch={false}
            >
              {comment.author.name}
            </Link>
            <time
              className="text-xs text-muted-foreground"
              dateTime={comment.createdAt}
              title={formatVietnamDateTimeInline(comment.createdAt)}
            >
              {formatVietnamDateTimeInline(comment.createdAt)}
              {comment.editedAt ? " · đã sửa" : ""}
            </time>
            {showChapter && comment.chapter ? (
              <Link
                className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                href={`/chapter/${comment.chapter.id}`}
                prefetch={false}
              >
                {comment.chapter.number
                  ? `Ch. ${comment.chapter.number}`
                  : comment.chapter.title || "Chapter"}
                {comment.chapter.number && comment.chapter.title
                  ? ` - ${comment.chapter.title}`
                  : ""}
              </Link>
            ) : null}
          </div>

          <div className="mt-1">
            {editing && state.edit ? (
              <CommentEditor
                body={state.edit.body}
                label="Chỉnh sửa bình luận"
                onCancel={() => setState((value) => ({ ...value, edit: null }))}
                onChange={(body) =>
                  setState((value) => ({
                    ...value,
                    edit: { ...value.edit!, id: comment.id, body },
                  }))
                }
                onSubmit={() =>
                  onEdit(comment.id, state.edit!.body, state.edit!.version)
                }
                pending={editPending}
                placeholder="Chỉnh sửa bình luận…"
              />
            ) : comment.deleted ? (
              <p className="text-sm text-muted-foreground italic">
                Bình luận đã bị xóa.
              </p>
            ) : comment.hidden ? (
              <p className="text-sm text-muted-foreground italic">
                Bình luận đã bị ẩn.
              </p>
            ) : (
              <CommentContent body={comment.body ?? ""} />
            )}
          </div>

          {!comment.deleted && !editing ? (
            <div className="mt-1 flex flex-wrap items-center gap-1">
              {!comment.hidden && !isReply && currentUserId ? (
                <Button
                  onClick={() =>
                    setState((value) => ({
                      ...value,
                      edit: null,
                      reply: {
                        id: comment.id,
                        author: comment.author.name,
                        body: "",
                      },
                    }))
                  }
                  size="xs"
                  type="button"
                  variant="ghost"
                >
                  <ReplyIcon data-icon="inline-start" />
                  Trả lời
                </Button>
              ) : null}
              {own ? (
                <>
                  {!comment.hidden ? (
                    <Button
                      onClick={() =>
                        setState((value) => ({
                          ...value,
                          edit: {
                            id: comment.id,
                            body: comment.body ?? "",
                            version: comment.version,
                          },
                          reply: null,
                        }))
                      }
                      size="xs"
                      type="button"
                      variant="ghost"
                    >
                      Sửa
                    </Button>
                  ) : null}
                  <Button
                    disabled={deletePending}
                    onClick={() => onDelete(comment.id, comment.version)}
                    size="xs"
                    type="button"
                    variant="ghost"
                  >
                    Xóa
                  </Button>
                </>
              ) : null}
            </div>
          ) : null}

          {!comment.hidden && replying && state.reply ? (
            <div className="mt-2">
              <CommentEditor
                body={state.reply.body}
                label={`Trả lời ${state.reply.author}`}
                onCancel={() =>
                  setState((value) => ({ ...value, reply: null }))
                }
                onChange={(body) =>
                  setState((value) => ({
                    ...value,
                    reply: { ...state.reply!, body },
                  }))
                }
                onSubmit={() =>
                  onCreate(state.reply!.body, comment.id, comment.chapter?.id)
                }
                pending={createPending}
                placeholder={`Trả lời ${state.reply.author}…`}
              />
            </div>
          ) : null}
        </div>

        {replies.length > 0 ? (
          <div className="grid min-w-0 grid-cols-1">
            {replies.map((reply) => (
              <div
                className="relative py-1.5 before:pointer-events-none before:absolute before:top-0 before:-left-7 before:h-6.5 before:w-7 before:rounded-bl-xl before:border-b-2 before:border-l-2 before:border-secondary before:content-[''] after:pointer-events-none after:absolute after:top-2.5 after:bottom-0 after:-left-7 after:border-l-2 after:border-secondary after:content-[''] last:after:hidden sm:before:-left-9 sm:before:w-9 sm:after:-left-9"
                key={reply.id}
              >
                <CommentItem
                  comment={reply}
                  createPending={false}
                  currentUserId={currentUserId}
                  deletingId={deletingId}
                  editingId={editingId}
                  isReply
                  onCreate={onCreate}
                  onDelete={onDelete}
                  onEdit={onEdit}
                  setState={setState}
                  state={state}
                />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  )
}

export function CommentSection({
  className,
  drawer = false,
  scope,
  targetId,
}: {
  className?: string
  drawer?: boolean
  scope: CommentScope
  targetId: string
}) {
  const { apiBaseUrl, retry, status, user, account } = useAccount()
  const pathname = usePathname()
  const {
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
  } = useCommentThread<Comment>(apiBaseUrl, scope, targetId)

  const composer =
    status === "authenticated" ? (
      <div className="grid grid-cols-[3rem_minmax(0,1fr)] gap-3">
        <AvatarDecoration frame={account?.user.avatarFrame ?? null}>
          <Avatar className="size-12 overflow-hidden">
            {user?.image ? <AvatarImage alt="" src={user.image} /> : null}
            <AvatarFallback>
              {(user?.name || "SC").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </AvatarDecoration>
        <CommentEditor
          body={state.body}
          label="Viết bình luận"
          onChange={(body) => setState((value) => ({ ...value, body }))}
          onSubmit={() => submit(state.body)}
          pending={create.isPending && !create.variables?.parentId}
          placeholder="Viết bình luận… (hỗ trợ Markdown)"
        />
      </div>
    ) : status === "loading" ? (
      <div className="flex justify-center py-4">
        <Spinner />
      </div>
    ) : status === "error" ? (
      <Alert>
        <AlertDescription className="flex items-center justify-between gap-3">
          Không thể kiểm tra phiên đăng nhập.
          <Button onClick={() => void retry()} size="sm" variant="outline">
            Thử lại
          </Button>
        </AlertDescription>
      </Alert>
    ) : (
      <Alert>
        <AlertDescription className="flex items-center justify-between gap-3">
          Bạn cần đăng nhập để bình luận.
          <Link
            href={loginHref(pathname)}
            className={buttonVariants({ size: "sm" })}
          >
            Đăng nhập
          </Link>
        </AlertDescription>
      </Alert>
    )

  return (
    <section
      className={cn(
        drawer
          ? "flex min-h-0 flex-1 flex-col overflow-hidden"
          : "mt-2 flex flex-col gap-5",
        className
      )}
    >
      <Dialog
        onOpenChange={(open) => {
          if (!open && !remove.isPending) setDeleteTarget(null)
        }}
        open={deleteTarget !== null}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Xóa bình luận?</DialogTitle>
            <DialogDescription>
              Bình luận sẽ bị xóa và không thể khôi phục.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose
              disabled={remove.isPending}
              render={<Button variant="outline" />}
            >
              Hủy
            </DialogClose>
            <Button
              disabled={!deleteTarget || remove.isPending}
              onClick={() => {
                if (deleteTarget) remove.mutate(deleteTarget)
              }}
              type="button"
              variant="destructive"
            >
              {remove.isPending ? <Spinner /> : null}
              {remove.isPending ? "Đang xóa…" : "Xóa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* <div className="flex items-center gap-3">
        <h2 className="font-heading text-lg font-semibold">
          Bình luận <span className="text-muted-foreground">{total}</span>
        </h2>
        <Separator className="flex-1" />
      </div> */}

      {drawer ? null : composer}

      <div className={cn(drawer && "min-h-0 flex-1 overflow-y-auto px-4 py-5")}>
        {comments.isPending ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : comments.isError ? (
          <Alert variant="destructive">
            <AlertDescription className="flex items-center justify-between gap-3">
              Không thể tải bình luận.
              <Button
                onClick={() => void comments.refetch()}
                size="sm"
                variant="outline"
              >
                Thử lại
              </Button>
            </AlertDescription>
          </Alert>
        ) : items.length ? (
          <div className="flex flex-col gap-5">
            {items.map((comment) => (
              <CommentItem
                comment={comment}
                createPending={create.isPending}
                currentUserId={user?.id}
                deletingId={remove.isPending ? remove.variables?.id : undefined}
                editingId={edit.isPending ? edit.variables?.id : undefined}
                key={comment.id}
                onCreate={submit}
                onDelete={submitDelete}
                onEdit={submitEdit}
                setState={setState}
                showChapter={scope === "manga"}
                state={state}
              />
            ))}
            {comments.hasNextPage ? (
              <Button
                className="self-center"
                disabled={comments.isFetchingNextPage}
                onClick={() => void comments.fetchNextPage()}
                variant="outline"
              >
                {comments.isFetchingNextPage ? <Spinner /> : null}
                Xem thêm
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Chưa có bình luận nào. Hãy là người đầu tiên bình luận!
          </p>
        )}
      </div>

      {drawer ? (
        <DrawerFooter className="border-t pt-4">{composer}</DrawerFooter>
      ) : null}
    </section>
  )
}
