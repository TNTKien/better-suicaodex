import assert from "node:assert/strict"
import { QueryClient } from "@tanstack/react-query"

import { tagsQueryOptions } from "../lib/tags-query"
import type { components } from "../src/lib/generated/api"

const originalFetch = globalThis.fetch
const originalApiUrl = process.env.NEXT_PUBLIC_API_URL
const client = new QueryClient()
const tag: components["schemas"]["TagSummary"] = {
  id: "01a0de90-31e3-7635-a5dd-311fc5aafb94",
  slug: "full-color",
  name: "Full Color",
  group: "format",
}

try {
  process.env.NEXT_PUBLIC_API_URL = "https://catalog.example.test"
  globalThis.fetch = (async (input, init) => {
    assert.equal(String(input), "https://catalog.example.test/v1/tags")
    assert.equal(init?.credentials, "omit")
    assert.equal(init?.redirect, "error")
    const headers = new Headers(init?.headers)
    assert.equal(headers.has("X-Internal-API-Key"), false)
    assert.equal(headers.has("Cookie"), false)
    assert.equal(headers.has("Authorization"), false)
    return Response.json({ data: [{ ...tag, privateField: "not-public" }] })
  }) as typeof fetch
  assert.deepEqual(await client.fetchQuery(tagsQueryOptions), [tag])

  for (const upstream of [
    new Response("Unavailable", { status: 503 }),
    Response.json({ data: [{ ...tag, id: "invalid" }] }),
    Response.json({ data: [{ ...tag, slug: "../../unsafe" }] }),
    Response.json({ data: null }),
    new Response("Invalid JSON"),
  ]) {
    globalThis.fetch = (async () => upstream) as typeof fetch
    client.clear()
    await assert.rejects(
      client.fetchQuery({ ...tagsQueryOptions, retry: false })
    )
  }

  globalThis.fetch = (async () => {
    throw new Error("Network unavailable")
  }) as typeof fetch
  client.clear()
  await assert.rejects(
    client.fetchQuery({ ...tagsQueryOptions, retry: false }),
    /Network unavailable/
  )

  globalThis.fetch = (async () => Response.json({ data: [] })) as typeof fetch
  client.clear()
  assert.deepEqual(await client.fetchQuery(tagsQueryOptions), [])

  process.env.NEXT_PUBLIC_API_URL = "file:///not-an-api"
  client.clear()
  await assert.rejects(
    client.fetchQuery({ ...tagsQueryOptions, retry: false }),
    /NEXT_PUBLIC_API_URL must use http or https/
  )
} finally {
  client.clear()
  globalThis.fetch = originalFetch
  if (originalApiUrl === undefined) delete process.env.NEXT_PUBLIC_API_URL
  else process.env.NEXT_PUBLIC_API_URL = originalApiUrl
}

console.log("web-hvn tags API checks passed")
