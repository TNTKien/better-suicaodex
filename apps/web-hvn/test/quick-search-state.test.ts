import assert from "node:assert/strict"
// @ts-expect-error Bun supplies this module at test runtime.
import { mock } from "bun:test"
import * as React from "react"
import * as Query from "@tanstack/react-query"
import { renderToStaticMarkup } from "react-dom/server"

const react = { ...React }
const query = { ...Query }
let input = "mato"
let composing = false
let pending = true
let fetching = false
let enabled = false
let activeQuery = ""

mock.module("react", () => ({
  ...react,
  useState: (initial: unknown) => [
    typeof initial === "string" ? input : composing,
    () => {},
  ],
}))
mock.module("@mantine/hooks", () => ({
  useDebouncedValue: (value: string, delay: number) => {
    assert.equal(delay, 300)
    activeQuery = value
    return [value]
  },
}))
mock.module("@tanstack/react-query", () => ({
  ...query,
  useQuery: (options: { enabled: boolean }) => {
    enabled = options.enabled
    return { isPending: pending, isFetching: fetching }
  },
}))
const { useMangaQuickSearch } = await import("@workspace/catalog/search")
const origin = "https://api.example.test"
function CaptureSearch({ open }: { open: boolean }) {
  const { loading } = useMangaQuickSearch(origin, open)
  return React.createElement("span", { "data-loading": loading })
}
function readLoading(open: boolean) {
  return renderToStaticMarkup(
    React.createElement(CaptureSearch, { open })
  ).includes('data-loading="true"')
}

assert.equal(readLoading(true), true)
assert.equal(enabled, true)
assert.equal(activeQuery, "mato")
pending = false
assert.equal(readLoading(true), false)

// Closing selects a disabled, uncached query which TanStack still calls pending.
pending = true
assert.equal(readLoading(false), false)
assert.equal(enabled, false)
assert.equal(activeQuery, "")
fetching = true
assert.equal(readLoading(false), false)
assert.equal(readLoading(true), true)

composing = true
assert.equal(readLoading(false), false)
assert.equal(readLoading(true), true)
assert.equal(enabled, false)
input = "  "
assert.equal(readLoading(true), false)
console.log(
  "Quick search loading stops when closed, including disabled pending queries"
)
