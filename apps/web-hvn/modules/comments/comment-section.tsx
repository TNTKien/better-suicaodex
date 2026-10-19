"use client"

import { primaryWebOrigin } from "@workspace/catalog/origins"


import Link from "next/link"
import { usePathname } from "next/navigation"
import { tz } from "@date-fns/tz"
import { format, parseISO } from "date-fns"
import { Streamdown } from "streamdown"
import { loginHref } from "@workspace/account/api"
import { useCommentThread, maxCommentLength } from "@workspace/account/comments"
import type { CommentScope } from "@workspace/account/comments-api"
import {
  parseCommentBody,
  stickerByName,
  stickerCategories,
} from "@workspace/account/comment-stickers"
import { AssetImage } from "@workspace/ui/components/asset-image"
import { Button } from "@workspace/ui/components/button"
import {
  CommentEditor as SharedCommentEditor,
  type CommentEditorProps,
} from "@workspace/ui/components/comment-editor"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Spinner } from "@workspace/ui/components/spinner"
import { cn } from "@workspace/ui/lib/utils"
import { basicMarkdownElements } from "@workspace/ui/lib/markdown"
import type { components } from "@/src/lib/generated/api"
import { hvnAvatarSrc } from "@/lib/avatar"
import { useAccount } from "@/modules/account/provider"

type Comment = components["schemas"]["ChapterComment"]
type Thread = ReturnType<typeof useCommentThread<Comment>>
const vietnamTimeZone = tz("Asia/Ho_Chi_Minh")
const primarySite = primaryWebOrigin
const editorCategories = stickerCategories.map((category) => ({
  ...category,
  stickers: category.stickers.map((sticker) => ({
    ...sticker,
    url: new URL(sticker.url, primarySite).href,
  })),
}))

function CommentEditor(
  props: Omit<
    CommentEditorProps,
    "maxLength" | "stickerCategories" | "discordUrl" | "className"
  >
) {
  return (
    <SharedCommentEditor
      {...props}
      className="hvn-comment-editor"
      maxLength={maxCommentLength}
      stickerCategories={editorCategories}
      discordUrl="https://discord.gg/fs2qHsS2EJ"
    />
  )
}

function CommentContent({ body }: { body: string }) {
  const { text, stickerNames } = parseCommentBody(body)
  return (
    <>
      {text ? (
        <Streamdown
          allowedElements={basicMarkdownElements}
          className="hvn-comment-content text-base leading-7 wrap-break-word"
          controls={false}
          mode="static"
          skipHtml
        >
          {text}
        </Streamdown>
      ) : null}
      {stickerNames.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {stickerNames.map((name, index) => (
            <AssetImage
              key={`${name}-${index}`}
              src={new URL(stickerByName.get(name)!.url, primarySite).href}
              alt={`Sticker ${name}`}
              width={128}
              height={128}
              className="size-28 object-contain sm:size-32"
            />
          ))}
        </div>
      ) : null}
    </>
  )
}

function CommentItem({
  comment,
  thread,
  currentUserId,
  isReply = false,
  showChapter = false,
}: {
  comment: Comment | Comment["replies"][number]
  thread: Thread
  currentUserId?: string
  isReply?: boolean
  showChapter?: boolean
}) {
  const {
    state,
    setState,
    create,
    edit,
    remove,
    submit,
    submitEdit,
    submitDelete,
  } = thread
  const own = currentUserId === comment.author.id
  const editing =
    state.edit?.id === comment.id && !comment.deleted && !comment.hidden
  const replying = state.reply?.id === comment.id
  const replies = !isReply && "replies" in comment ? comment.replies : []
  return (
    <article
      className={cn(
        "hvn-comment border border-[#555555] p-2 text-white sm:p-3",
        isReply ? "bg-[#333333]" : "bg-[#1b1c1c]"
      )}
    >
      <div className="flex items-start gap-2">
        <Link
          href={`/profile/${comment.author.id}`}
          prefetch={false}
          aria-label={`Tường nhà ${comment.author.name}`}
          className="shrink-0 border border-white/70 p-0.5"
        >
          <AssetImage
            src={hvnAvatarSrc(comment.author.image)}
            fallbackSrc="/brand/mac_dinh.webp"
            alt=""
            width={60}
            height={60}
            className="size-12 object-cover sm:size-15"
          />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <Link
              href={`/profile/${comment.author.id}`}
              prefetch={false}
              className="min-w-0 font-bold wrap-break-word text-[#00bfff] hover:underline"
            >
              {comment.author.name}
            </Link>
            <time
              dateTime={comment.createdAt}
              className="ml-auto text-xs text-[#999999]"
            >
              {format(parseISO(comment.createdAt), "HH:mm:ss - dd/MM/yyyy", {
                in: vietnamTimeZone,
              })}
              {comment.editedAt ? " · đã sửa" : ""}
            </time>
          </div>
          {showChapter && comment.chapter ? (
            <Link
              href={`/chapter/${comment.chapter.id}`}
              prefetch={false}
              className="text-sm text-[#00bfff] hover:underline"
            >
              {comment.chapter.number
                ? `Chap ${comment.chapter.number}`
                : "Oneshot"}
              {comment.chapter.title ? `: ${comment.chapter.title}` : ""}
            </Link>
          ) : null}
          <div className="mt-1">
            {editing && state.edit ? (
              <CommentEditor
                body={state.edit.body}
                label="Chỉnh sửa bình luận"
                placeholder="Chỉnh sửa bình luận…"
                pending={edit.isPending && edit.variables?.id === comment.id}
                onCancel={() => setState((value) => ({ ...value, edit: null }))}
                onChange={(body) =>
                  setState((value) => ({
                    ...value,
                    edit: { ...value.edit!, id: comment.id, body },
                  }))
                }
                onSubmit={() =>
                  submitEdit(comment.id, state.edit!.body, state.edit!.version)
                }
              />
            ) : comment.deleted ? (
              <p className="text-sm text-[#999999] italic">
                Bình luận đã bị xóa.
              </p>
            ) : comment.hidden ? (
              <p className="text-sm text-[#999999] italic">
                Bình luận đã bị ẩn.
              </p>
            ) : (
              <CommentContent body={comment.body ?? ""} />
            )}
          </div>
          {!comment.deleted && !editing ? (
            <div className="mt-2 flex items-center justify-between gap-2">
              {!comment.hidden && !isReply && currentUserId ? (
                <Button
                  className="hvn-comment-action"
                  data-kind="reply"
                  size="xs"
                  variant="ghost"
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
                >
                  Trả lời
                </Button>
              ) : (
                <span />
              )}
              {own ? (
                <div className="flex gap-2">
                  {!comment.hidden ? (
                    <Button
                      className="hvn-comment-action"
                      size="xs"
                      variant="ghost"
                      onClick={() =>
                        setState((value) => ({
                          ...value,
                          reply: null,
                          edit: {
                            id: comment.id,
                            body: comment.body ?? "",
                            version: comment.version,
                          },
                        }))
                      }
                    >
                      Sửa
                    </Button>
                  ) : null}
                  <Button
                    className="hvn-comment-action"
                    size="xs"
                    variant="ghost"
                    disabled={
                      remove.isPending && remove.variables?.id === comment.id
                    }
                    onClick={() => submitDelete(comment.id, comment.version)}
                  >
                    Xóa
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
          {!comment.hidden && replying && state.reply ? (
            <div className="mt-2">
              <CommentEditor
                body={state.reply.body}
                label={`Trả lời ${state.reply.author}`}
                placeholder={`Trả lời ${state.reply.author}…`}
                pending={create.isPending}
                onCancel={() =>
                  setState((value) => ({ ...value, reply: null }))
                }
                onChange={(body) =>
                  setState((value) => ({
                    ...value,
                    reply: { ...value.reply!, body },
                  }))
                }
                onSubmit={() =>
                  submit(state.reply!.body, comment.id, comment.chapter?.id)
                }
              />
            </div>
          ) : null}
        </div>
      </div>
      {replies.length ? (
        <div className="mt-2 ml-4 flex flex-col gap-2 sm:ml-16">
          {replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              thread={thread}
              currentUserId={currentUserId}
              isReply
            />
          ))}
        </div>
      ) : null}
    </article>
  )
}

export function CommentSection({
  scope,
  targetId,
}: {
  scope: CommentScope
  targetId: string
}) {
  const { apiBaseUrl, status, user, retry } = useAccount()
  const pathname = usePathname()
  const thread = useCommentThread<Comment>(apiBaseUrl, scope, targetId)
  const {
    comments,
    items,
    state,
    setState,
    create,
    remove,
    deleteTarget,
    setDeleteTarget,
    submit,
  } = thread
  const currentUserId = status === "authenticated" ? user?.id : undefined
  return (
    <section aria-labelledby="comments-heading" className="mt-2 min-w-0">
      <h2
        id="comments-heading"
        className="inline-block bg-[#e74c3c] px-5 py-1.5 text-lg font-bold"
      >
        Bình luận
      </h2>
      <div className="flex flex-col gap-3 border border-[#666666] bg-[#111111] p-2 sm:p-3">
        {status === "authenticated" ? (
          <CommentEditor
            body={state.body}
            label="Viết bình luận"
            placeholder="Viết bình luận… (hỗ trợ Markdown)"
            pending={create.isPending && !create.variables?.parentId}
            onChange={(body) => setState((value) => ({ ...value, body }))}
            onSubmit={() => submit(state.body)}
          />
        ) : status === "loading" ? (
          <div className="flex justify-center py-3">
            <Spinner aria-label="Đang kiểm tra đăng nhập" />
          </div>
        ) : status === "error" ? (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-2"
          >
            <p>Không thể kiểm tra phiên đăng nhập.</p>
            <Button
              className="hvn-copy-manga-link"
              size="sm"
              onClick={() => void retry()}
            >
              Thử lại
            </Button>
          </div>
        ) : (
          <p>
            Bạn cần{" "}
            <Link
              href={loginHref(pathname)}
              className="font-bold text-[#00bfff] hover:underline"
            >
              đăng nhập
            </Link>{" "}
            để bình luận.
          </p>
        )}
        {comments.isPending ? (
          <div className="flex justify-center py-6">
            <Spinner aria-label="Đang tải bình luận" />
          </div>
        ) : comments.isError ? (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-2"
          >
            <p>Không thể tải bình luận.</p>
            <Button
              className="hvn-copy-manga-link"
              size="sm"
              onClick={() => void comments.refetch()}
            >
              Thử lại
            </Button>
          </div>
        ) : items.length ? (
          <div className="flex flex-col gap-3">
            {items.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                thread={thread}
                currentUserId={currentUserId}
                showChapter={scope === "manga"}
              />
            ))}
            {comments.hasNextPage ? (
              <Button
                className="hvn-copy-manga-link self-center"
                disabled={comments.isFetchingNextPage}
                onClick={() => void comments.fetchNextPage()}
              >
                {comments.isFetchingNextPage ? <Spinner /> : null}Xem thêm
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="py-6 text-center text-[#999999]">
            Chưa có ai bình luận. Mau bóc tem em nó đi nào!
          </p>
        )}
      </div>
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !remove.isPending) setDeleteTarget(null)
        }}
      >
        <DialogContent showCloseButton={false} className="rounded-none">
          <DialogHeader>
            <DialogTitle>Xóa bình luận?</DialogTitle>
            <DialogDescription>
              Bình luận sẽ bị xóa và không thể khôi phục.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={remove.isPending}
              onClick={() => setDeleteTarget(null)}
            >
              Hủy
            </Button>
            <Button
              variant="destructive"
              disabled={!deleteTarget || remove.isPending}
              onClick={() => {
                if (deleteTarget) remove.mutate(deleteTarget)
              }}
            >
              {remove.isPending ? <Spinner /> : null}
              {remove.isPending ? "Đang xóa…" : "Xóa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
