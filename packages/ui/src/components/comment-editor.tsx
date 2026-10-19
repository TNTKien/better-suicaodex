"use client"

import Image from "next/image"
import dynamic from "next/dynamic"
import { useState } from "react"
import { SmileIcon, StickerIcon, XIcon, SendIcon } from "lucide-react"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@workspace/ui/components/input-group"
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { Spinner } from "@workspace/ui/components/spinner"
import { cn } from "@workspace/ui/lib/utils"

export type StickerCategory = {
  id: string
  label: string
  stickers: { name: string; url: string }[]
}
export type CommentEditorProps = {
  body: string
  label: string
  onCancel?: () => void
  onChange: (body: string) => void
  onSubmit: () => void
  pending: boolean
  placeholder: string
  className?: string
  maxLength: number
  stickerCategories: StickerCategory[]
  discordUrl: string
}
const EmojiPicker = dynamic(
  () => import("./comment-emoji-picker").then((module) => module.EmojiPicker),
  {
    loading: () => (
      <div className="flex h-72 items-center justify-center">
        <Spinner />
      </div>
    ),
    ssr: false,
  }
)
function CommentPicker({
  kind,
  onSelect,
  stickerCategories,
  discordUrl,
}: {
  kind: "emoji" | "sticker"
  onSelect: (value: string) => void
  stickerCategories: StickerCategory[]
  discordUrl: string
}) {
  const stickerPickerCategories = [
    {
      id: "all",
      label: "Tất cả",
      stickers: stickerCategories.flatMap((category) => category.stickers),
    },
    ...stickerCategories,
  ]
  const [open, setOpen] = useState(false)
  const [hasOpened, setHasOpened] = useState(false)
  const isEmoji = kind === "emoji"
  const label = isEmoji ? "Chọn emoji" : "Chọn sticker"
  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (isEmoji && nextOpen) setHasOpened(true)
  }
  const select = (value: string) => {
    onSelect(value)
    setOpen(false)
  }

  return (
    <Popover onOpenChange={handleOpenChange} open={open}>
      <PopoverTrigger
        render={
          <InputGroupButton aria-label={label} size="icon-sm" type="button" />
        }
      >
        {isEmoji ? <SmileIcon /> : <StickerIcon />}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(
          "gap-0 overflow-hidden p-0",
          isEmoji ? "w-fit" : "w-[min(22rem,calc(100vw-2rem))]"
        )}
        keepMounted={isEmoji && hasOpened}
        side="top"
        style={isEmoji ? { animation: "none" } : undefined}
      >
        {isEmoji ? (
          <>
            <PopoverTitle className="sr-only">{label}</PopoverTitle>
            <EmojiPicker onSelect={select} />
          </>
        ) : (
          <>
            <div className="flex flex-col gap-0.5 border-b px-3 py-2">
              <PopoverTitle>Không thấy sticker bạn thích?</PopoverTitle>
              <p className="text-xs text-muted-foreground">
                Đề xuất thêm sticker mới{" "}
                <a
                  className="font-medium text-foreground underline underline-offset-2"
                  href={discordUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  tại đây
                </a>
              </p>
            </div>
            <Tabs defaultValue="all" className="gap-0">
              <TabsList className="h-auto w-full flex-wrap justify-start rounded-none group-data-horizontal/tabs:h-auto">
                {stickerPickerCategories.map((category) => (
                  <TabsTrigger
                    className="flex-none text-xs"
                    key={category.id}
                    value={category.id}
                  >
                    {category.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {stickerPickerCategories.map((category) => (
                <TabsContent
                  className="max-h-72 overflow-y-auto p-1"
                  key={category.id}
                  value={category.id}
                >
                  <div className="grid grid-cols-3 gap-1">
                    {category.stickers.map((sticker) => (
                      <button
                        aria-label={`Chèn sticker ${sticker.name}`}
                        className="aspect-square overflow-hidden rounded-md p-1 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                        key={sticker.name}
                        onClick={() => select(`:${sticker.name}:`)}
                        type="button"
                      >
                        <Image
                          alt=""
                          className="size-full object-contain"
                          height={96}
                          src={sticker.url}
                          unoptimized
                          width={96}
                        />
                      </button>
                    ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}

export function CommentEditor({
  body,
  label,
  onCancel,
  onChange,
  onSubmit,
  pending,
  placeholder,
  className,
  maxLength,
  stickerCategories,
  discordUrl,
}: CommentEditorProps) {
  return (
    <InputGroup className={className}>
      <InputGroupTextarea
        aria-label={label}
        className="max-h-28 min-h-20"
        disabled={pending}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={3}
        value={body}
      />
      <InputGroupAddon align="block-end" className="justify-between">
        <div className="flex items-center gap-1">
          <CommentPicker
            stickerCategories={stickerCategories}
            discordUrl={discordUrl}
            kind="emoji"
            onSelect={(value) => onChange(body ? `${body} ${value}` : value)}
          />
          <CommentPicker
            stickerCategories={stickerCategories}
            discordUrl={discordUrl}
            kind="sticker"
            onSelect={(value) => onChange(body ? `${body} ${value}` : value)}
          />
        </div>
        <div className="flex items-center gap-1">
          {onCancel ? (
            <InputGroupButton
              aria-label="Hủy"
              onClick={onCancel}
              size="icon-sm"
              type="button"
            >
              <XIcon />
            </InputGroupButton>
          ) : null}
          <InputGroupButton
            aria-label={pending ? "Đang gửi bình luận" : "Gửi bình luận"}
            disabled={pending || !body.trim()}
            onClick={onSubmit}
            size="icon-sm"
            type="button"
          >
            {pending ? <Spinner /> : <SendIcon />}
          </InputGroupButton>
        </div>
      </InputGroupAddon>
    </InputGroup>
  )
}
