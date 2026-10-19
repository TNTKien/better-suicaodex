import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const source = readFileSync(
  new URL("../modules/comments/comment-section.tsx", import.meta.url),
  "utf8"
)
const api = readFileSync(
  new URL("../../../packages/account/src/comments-api.ts", import.meta.url),
  "utf8"
)
const emojiPicker = readFileSync(
  new URL(
    "../../../packages/ui/src/components/comment-emoji-picker.tsx",
    import.meta.url
  ),
  "utf8"
)
const editor = readFileSync(
  new URL(
    "../../../packages/ui/src/components/comment-editor.tsx",
    import.meta.url
  ),
  "utf8"
)
const reader = readFileSync(
  new URL("../app/(reader)/chapter/[id]/reader-client.tsx", import.meta.url),
  "utf8"
)
const popover = readFileSync(
  new URL("../../../packages/ui/src/components/popover.tsx", import.meta.url),
  "utf8"
)

assert.match(source, /"replies" in comment/)
assert.match(source, /grid-cols-\[2\.5rem_minmax\(0,1fr\)\]/)
assert.match(source, /sm:grid-cols-\[3rem_minmax\(0,1fr\)\]/)
assert.match(source, /"size-10 rounded-full", !isReply && "sm:size-12"/)
assert.match(source, /"size-10 overflow-hidden", !isReply && "sm:size-12"/)
assert.match(
  source,
  /<AvatarDecoration frame=\{comment\.author\.avatarFrame \?\? null\}>/
)
assert.match(
  source,
  /<AvatarDecoration frame=\{account\?\.user\.avatarFrame \?\? null\}>/
)
assert.match(source, /<Avatar className="size-12 overflow-hidden">/)
assert.doesNotMatch(source, /<Avatar(?:Image|Fallback)?[^>]*rounded-md/)
assert.match(source, /before:top-10 before:-left-7/)
assert.match(source, /sm:before:top-12 sm:before:-left-9/)
assert.match(source, /before:h-6\.5 before:w-7/)
assert.match(source, /before:rounded-bl-xl/)
assert.match(source, /after:top-2\.5/)
assert.match(source, /last:after:hidden/)
assert.match(editor, /kind="emoji"/)
assert.match(editor, /kind="sticker"/)
assert.match(editor, /components\/popover/)
assert.match(source, /components\/dialog/)
assert.match(source, /<DrawerFooter/)
assert.match(source, /<DialogTitle>Xóa bình luận\?<\/DialogTitle>/)
assert.match(source, /Bình luận đã bị ẩn\./)
assert.match(source, /!comment\.hidden && !isReply/)
assert.match(source, /onDelete\(comment\.id, comment\.version\)/)
assert.match(api, /JSON\.stringify\(\{ body, expectedVersion \}\)/)
assert.match(api, /JSON\.stringify\(\{ expectedVersion \}\)/)
assert.doesNotMatch(source, /window\.confirm/)
assert.match(source, /siteConfig\.links\.discord/)
assert.match(editor, /defaultValue="all"/)
assert.match(editor, /dynamic\(/)
assert.match(editor, /keepMounted=\{isEmoji && hasOpened\}/)
assert.match(editor, /if \(isEmoji && nextOpen\) setHasOpened\(true\)/)
assert.match(editor, /style=\{isEmoji \? \{ animation: "none" \} : undefined\}/)
assert.match(popover, /keepMounted && "data-closed:invisible"/)
assert.match(popover, /hidden=\{keepMounted \? false : undefined\}/)
assert.match(emojiPicker, /components\/emoji-picker/)
assert.match(emojiPicker, /locale="vi"/)
assert.doesNotMatch(reader, /modal=\{false\}/)
assert.match(reader, /swipeDirection=\{isMobile \? "down" : "left"\}/)
assert.doesNotMatch(source, /gap-4 border-l pl-4/)

console.log("Comment thread checks passed")
