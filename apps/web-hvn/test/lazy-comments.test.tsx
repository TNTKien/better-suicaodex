import assert from "node:assert/strict"
// @ts-expect-error Bun supplies this module at test runtime.
import { mock } from "bun:test"
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"

let visible = false
const effects: (() => void | (() => void))[] = []
const target = {} as HTMLDivElement
mock.module("react", () => ({
  ...React,
  useRef: () => ({ current: target }),
  useState: () => [
    visible,
    (value: boolean) => {
      visible = value
    },
  ],
  useEffect: (effect: (typeof effects)[number]) => effects.push(effect),
}))
let loads = 0
mock.module("next/dynamic", () => ({
  default: (_loader: unknown, options: { ssr: boolean }) => {
    assert.equal(options.ssr, false)
    return ({ scope, targetId }: { scope: string; targetId: string }) => {
      loads++
      return (
        <section data-scope={scope} data-target={targetId}>
          Bình luận
        </section>
      )
    }
  },
}))
const originalObserver = globalThis.IntersectionObserver
let intersect: IntersectionObserverCallback
let disconnects = 0
let observed: Element | undefined
globalThis.IntersectionObserver = class {
  constructor(
    callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit
  ) {
    intersect = callback
    assert.equal(
      options?.rootMargin,
      undefined,
      "Comments load at the bottom, without early prefetch"
    )
  }
  observe(element: Element) {
    observed = element
  }
  disconnect() {
    disconnects++
  }
} as unknown as typeof IntersectionObserver
const { LazyCommentSection } =
  await import("../modules/comments/lazy-comment-section")
try {
  for (const scope of ["chapter", "manga"] as const) {
    visible = false
    loads = 0
    disconnects = 0
    effects.length = 0
    const render = () =>
      renderToStaticMarkup(
        <LazyCommentSection scope={scope} targetId={scope} />
      )
    assert.doesNotMatch(render(), /data-scope/)
    assert.equal(
      loads,
      0,
      "Dynamic comments must not mount on the initial render"
    )
    const cleanup = effects[0]!()
    assert.equal(observed, target)
    intersect!(
      [{ isIntersecting: false }] as IntersectionObserverEntry[],
      {} as IntersectionObserver
    )
    render()
    assert.equal(loads, 0)
    intersect!(
      [{ isIntersecting: true }] as IntersectionObserverEntry[],
      {} as IntersectionObserver
    )
    assert.equal(disconnects, 1, "Load only once per target")
    const loaded = render()
    assert.equal(loads, 1)
    assert.ok(loaded.includes(`data-scope="${scope}"`))
    assert.ok(loaded.includes(`data-target="${scope}"`))
    cleanup?.()
    assert.equal(disconnects, 2)
  }
} finally {
  globalThis.IntersectionObserver = originalObserver
}
console.log("HVN manga and chapter comments stay unmounted until visible")
