import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
// @ts-expect-error Bun supplies this module at test runtime.
import { mock } from "bun:test"
import type { ScrollDirection } from "@mantine/hooks"
import { renderToStaticMarkup } from "react-dom/server"

let direction: ScrollDirection = "unknown"
mock.module("@mantine/hooks", () => ({
  useScrollDirection: () => direction,
}))
const { BackToTop } = await import("../components/back-to-top")
const originalWindow = globalThis.window
let reducedMotion = false
const scrolls: ScrollToOptions[] = []
globalThis.window = {
  matchMedia: (query: string) => {
    assert.equal(query, "(prefers-reduced-motion: reduce)")
    return { matches: reducedMotion }
  },
  scrollTo: (options: ScrollToOptions) => scrolls.push(options),
} as unknown as Window & typeof globalThis
try {
  const hiddenButton = () => {
    const button = BackToTop().props.children
    assert.equal(button.props["data-visible"], false)
    assert.equal(button.props["aria-hidden"], true)
    assert.equal(
      button.props.inert,
      true,
      "Hidden button cannot receive focus or clicks"
    )
    assert.match(renderToStaticMarkup(<BackToTop />), /inert=""/)
  }
  hiddenButton()
  direction = "down"
  hiddenButton()
  direction = "up"
  assert.match(
    renderToStaticMarkup(<BackToTop />),
    /aria-label="Lên đầu trang"/
  )
  const button = BackToTop().props.children
  assert.equal(button.props["data-visible"], true)
  assert.equal(button.props["aria-hidden"], false)
  assert.equal(button.props.inert, false)
  button.props.onClick()
  reducedMotion = true
  button.props.onClick()
  assert.deepEqual(scrolls, [
    { top: 0, behavior: "smooth" },
    { top: 0, behavior: "auto" },
  ])
  direction = "down"
  hiddenButton()
  const layout = await readFile(
    new URL("../app/layout.tsx", import.meta.url),
    "utf8"
  )
  const reader = await readFile(
    new URL("../modules/reading/reader.tsx", import.meta.url),
    "utf8"
  )
  assert.doesNotMatch(layout, /BackToTop/)
  assert.match(reader, /<BackToTop\s*\/>/)
} finally {
  globalThis.window = originalWindow
}
console.log(
  "Reader-only back-to-top visibility and reduced-motion checks passed"
)
