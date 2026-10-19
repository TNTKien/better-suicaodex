import assert from "node:assert/strict"
// @ts-expect-error Bun supplies this module at test runtime.
import { mock } from "bun:test"
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { AssetImage, watchImageFallback } from "../components/asset-image"
import { readerImageSource } from "../lib/reader"

const originals = {
  document: globalThis.document,
  observer: globalThis.IntersectionObserver,
  setTimeout: globalThis.setTimeout,
  clearTimeout: globalThis.clearTimeout,
}
let intersect: (entries: { isIntersecting: boolean }[]) => void
let onVisibility: (() => void) | undefined
let timer: (() => void) | undefined
let disconnected = false
const documentMock = {
  hidden: false,
  addEventListener: (_event: string, callback: () => void) => {
    onVisibility = callback
  },
  removeEventListener: () => {
    onVisibility = undefined
  },
}
try {
  Object.assign(globalThis, {
    document: documentMock,
    IntersectionObserver: class {
      constructor(callback: typeof intersect) {
        intersect = callback
      }
      observe() {}
      disconnect() {
        disconnected = true
      }
    },
    setTimeout: (callback: () => void, duration: number) => {
      assert.equal(duration, 15000)
      timer = callback
      return 1
    },
    clearTimeout: () => {
      timer = undefined
    },
  })
  const image = { complete: false, naturalWidth: 0 }
  let fallbacks = 0
  const stop = watchImageFallback(image as HTMLImageElement, 15000, () => {
    fallbacks++
  })
  assert.equal(
    timer,
    undefined,
    "offscreen lazy images must not start a deadline"
  )
  intersect!([{ isIntersecting: true }])
  assert.equal(typeof timer, "function")
  documentMock.hidden = true
  onVisibility!()
  assert.equal(timer, undefined, "background tab cancels deadline")
  documentMock.hidden = false
  onVisibility!()
  assert.equal(typeof timer, "function")
  intersect!([{ isIntersecting: false }])
  assert.equal(timer, undefined, "leaving viewport cancels deadline")
  intersect!([{ isIntersecting: true }])
  image.complete = true
  image.naturalWidth = 40
  timer!()
  assert.equal(fallbacks, 0, "cached/loaded images never fall back")
  image.complete = false
  image.naturalWidth = 0
  onVisibility!()
  timer!()
  assert.equal(fallbacks, 1)
  stop()
  assert.equal(timer, undefined)
  assert.equal(onVisibility, undefined)
  assert.equal(disconnected, true)
} finally {
  Object.assign(globalThis, {
    document: originals.document,
    IntersectionObserver: originals.observer,
    setTimeout: originals.setTimeout,
    clearTimeout: originals.clearTimeout,
  })
}
const page = {
  position: 0,
  url: "https://s1.test/page.webp",
  optimizedUrl: "https://s1.test/small.webp",
  replicaUrl: "https://p21-ad-sg.ibyteimg.com/page",
  width: 1600,
  height: 2400,
  optimizedWidth: 800,
  optimizedHeight: 1200,
}
const markup = renderToStaticMarkup(
  <AssetImage alt="Trang 1" {...readerImageSource(page)} />
)
assert.match(markup, /src="https:\/\/p21-ad-sg.ibyteimg.com\/page"/)
assert.match(markup, /width="1600"/)
assert.match(markup, /loading="lazy"/)
assert.doesNotMatch(markup, /crossorigin|<canvas/i)
assert.doesNotMatch(markup, /data-slot="spinner"/)
for (const replicaUrl of [page.replicaUrl, null]) {
  const pending = renderToStaticMarkup(
    <AssetImage
      alt="Trang 1"
      {...readerImageSource({ ...page, replicaUrl })}
      showSpinner
    />
  )
  assert.match(pending, /data-slot="spinner"/)
  assert.match(pending, /role="status"/)
  assert.match(pending, /aria-label="Đang tải Trang 1"/)
  assert.match(pending, /motion-reduce:animate-none/)
}
assert.doesNotMatch(
  renderToStaticMarkup(
    <AssetImage
      alt="Trang 1"
      src={null}
      width={800}
      height={1200}
      showSpinner
    />
  ),
  /data-slot="spinner"/,
  "missing images show their placeholder, not a perpetual spinner"
)
const responsiveProps = {
  alt: "Bìa truyện",
  src: "https://images.test/cover.512.webp",
  srcSet:
    "https://images.test/cover.256.webp 256w, https://images.test/cover.512.webp 512w",
  sizes: "auto, 50vw",
  fallbackSrc: "https://images.test/original.webp",
  width: 700,
  height: 1000,
}
const responsive = renderToStaticMarkup(<AssetImage {...responsiveProps} />)
assert.match(responsive, /srcSet="[^"]+256w, [^"]+512w"/)
assert.match(responsive, /sizes="auto, 50vw"/)

const react = { ...React }
mock.module("react", () => ({
  ...react,
  useState: (initial: unknown) => {
    const state = react.useState(initial)
    return initial === responsiveProps.src
      ? [responsiveProps.fallbackSrc, state[1]]
      : state
  },
}))
const fallback = renderToStaticMarkup(<AssetImage {...responsiveProps} />)
assert.match(fallback, /src="https:\/\/images.test\/original.webp"/)
assert.doesNotMatch(
  fallback,
  /srcSet=|sizes=/,
  "Failed responsive images must allow the fallback source to load"
)
console.log(
  "Reader image source, loading indicator and visible timeout checks passed"
)
