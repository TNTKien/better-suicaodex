"use client"

import {
  EmojiPicker as EmojiPickerRoot,
  EmojiPickerContent,
  EmojiPickerFooter,
  EmojiPickerSearch,
} from "@workspace/ui/components/emoji-picker"

export function EmojiPicker({
  onSelect,
}: {
  onSelect: (emoji: string) => void
}) {
  return (
    <EmojiPickerRoot
      className="h-86"
      locale="vi"
      onEmojiSelect={({ emoji }) => onSelect(emoji)}
    >
      <EmojiPickerSearch
        aria-label="Tìm kiếm emoji"
        placeholder="Tìm kiếm emoji…"
      />
      <EmojiPickerContent />
      <EmojiPickerFooter />
    </EmojiPickerRoot>
  )
}
