import assert from "node:assert/strict"
import { renderToStaticMarkup } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { SiteFooter } from "../components/site-footer"
import { SiteHeader } from "../components/site-header"
import { tagsQueryOptions } from "../lib/tags-query"
import type { TagSummary } from "../lib/tags"
import { AccountProvider } from "../modules/account/provider"

const tags: TagSummary[] = [
  {
    id: "01a0de90-31e3-7635-a5dd-311fc5aafb94",
    slug: "full-color",
    name: "Full Color",
    group: "format",
  },
  {
    id: "e9aa16d2-66de-4c1f-b85c-e48e4a1a92c2",
    slug: "action",
    name: "Action",
    group: "genre",
  },
]

function renderShell(data?: TagSummary[]) {
  const client = new QueryClient()
  if (data) client.setQueryData(tagsQueryOptions.queryKey, data)
  const markup = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <AccountProvider>
        <SiteHeader />
        <SiteFooter />
      </AccountProvider>
    </QueryClientProvider>
  )
  client.clear()
  return markup
}

const markup = renderShell(tags)

const destinations = [...markup.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map(
  (match) => match[1]
)
for (const href of [
  "/",
  "/my-library",
  "/history",
  `/tag/${tags[0]!.id}/full-color`,
  `/tag/${tags[1]!.id}/action`,
]) {
  assert.ok(destinations.includes(href), href)
}
assert.equal(destinations.filter((href) => href === "/my-library").length, 4)
assert.equal(destinations.filter((href) => href === "/history").length, 2)
assert.match(
  markup,
  /href="http:\/\/localhost:3000"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/
)
assert.match(markup, /aria-label="Đang tải tài khoản"/)
assert.equal((markup.match(/aria-label="Thông báo"/g) ?? []).length, 2)
assert.doesNotMatch(
  markup,
  /id-tag-full-color|Được đề cử|Không che|>Mimi<|>Tìm\*</
)
const searchInputs = [...markup.matchAll(/<input\b[^>]*name="q"[^>]*>/g)].map(
  (match) => match[0]
)
assert.equal(searchInputs.length, 2)
for (const input of searchInputs) {
  assert.match(input, /type="search"/)
  assert.match(input, /maxLength="160"/)
  assert.match(input, /autoComplete="off"/)
  assert.doesNotMatch(input, /\sdisabled(?:=|\s|\/?>)/)
}
assert.doesNotMatch(markup, /action="\/advanced-search"/)
assert.match(
  markup,
  /href="http:\/\/localhost:3000\/advanced-search"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/
)
assert.match(markup, /aria-label="Điều hướng mobile"/)
assert.match(markup, /aria-label="Điều hướng desktop"/)
assert.match(markup, /aria-expanded="false"/)
assert.doesNotMatch(markup, /Hi, Dark!/)
assert.match(markup, /Copyright © \d{4} • SuicaoDex v3\.5/)
assert.match(markup, /<header\b/)
assert.match(markup, /<footer\b/)

// Loading or missing taxonomy must never produce an unfiltered Full Màu link.
assert.match(renderShell(), /Đang tải thể loại/)
assert.doesNotMatch(renderShell(), /href="\/advanced-search\?/)
assert.match(renderShell([]), /Chưa có thể loại\./)
assert.doesNotMatch(renderShell([tags[1]!]), /href="\/advanced-search\?/)

console.log("web-hvn shell checks passed")
