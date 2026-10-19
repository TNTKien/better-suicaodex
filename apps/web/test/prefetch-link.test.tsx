import assert from "node:assert/strict"
// @ts-expect-error Bun supplies this module at test runtime.
import { mock } from "bun:test"
import * as React from "react"
import type { ComponentProps } from "react"
import type Link from "next/link"

const react = { ...React }
let intent = false
mock.module("react", () => ({
  ...react,
  useState: () => [
    intent,
    (value: boolean) => {
      intent = value
    },
  ],
}))
const { PrefetchLink } = await import("@workspace/ui/components/prefetch-link")
type LinkProps = ComponentProps<typeof Link>
const href = "/manga/fixture/slug"
const ref = React.createRef<HTMLAnchorElement>()

for (const handler of ["onMouseEnter", "onFocus", "onTouchStart"] as const) {
  for (const cancelled of [false, true]) {
    intent = false
    let calls = 0
    const link = PrefetchLink({
      href,
      ref,
      children: "Truyện",
      [handler]: (event: React.SyntheticEvent) => {
        calls++
        if (cancelled) event.preventDefault()
      },
    })
    const props = link.props as LinkProps
    assert.equal(props.prefetch, "auto")
    assert.equal(props.href, href)
    assert.equal(props.ref, ref)
    assert.equal(props.children, "Truyện")
    const event = {
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true
      },
    }
    const trigger = props[handler] as (event: unknown) => void
    trigger(event)
    assert.equal(calls, 1)
    assert.equal(
      PrefetchLink({ href }).props.prefetch,
      cancelled ? "auto" : true
    )
  }
}

console.log(
  "Intent prefetch: mouse, keyboard, touch and composed handlers passed"
)
