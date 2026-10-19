import assert from "node:assert/strict"

import { renderToStaticMarkup } from "react-dom/server"

import { MangaDescription } from "../app/(site)/manga/[id]/[slug]/manga-description"

const html = renderToStaticMarkup(
  <MangaDescription mobileDetails={<div>Thông tin mobile</div>}>{`**In đậm** và [liên kết](https://example.com).

![Không hiển thị](https://example.com/image.webp)

<b>Không dùng HTML</b>

[Không an toàn](javascript:alert(1))`}</MangaDescription>
)

assert.match(html, /data-streamdown="strong"[^>]*>In đậm<\/span>/)
assert.match(html, /data-streamdown="link"/)
assert.match(html, /max-height:160px/)
assert.match(html, /Thông tin mobile/)
assert.doesNotMatch(html, /<img|<b>|javascript:/)

console.log("Manga description checks passed")
