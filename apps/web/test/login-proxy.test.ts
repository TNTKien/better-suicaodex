import assert from "node:assert/strict"
import { NextRequest } from "next/server"

import { config, proxy } from "../proxy"

const originalFetch = globalThis.fetch
const request = (query = "", cookie = "better-auth.session_token=fixture") =>
  new NextRequest(`https://web.example.test/login${query}`, {
    headers: { cookie },
  })

try {
  assert.equal(config.matcher, "/login")

  let skippedCalls = 0
  globalThis.fetch = (async () => {
    skippedCalls++
    throw new Error("Unexpected API request")
  }) as typeof fetch
  for (const req of [
    request("", ""),
    request("?complete=1"),
    request("?error=oauth"),
  ]) {
    assert.equal((await proxy(req)).headers.get("x-middleware-next"), "1")
  }
  assert.equal(skippedCalls, 0)

  let calls = 0
  globalThis.fetch = (async (input, init) => {
    calls++
    assert.equal(new URL(String(input)).pathname, "/api/auth/get-session")
    assert.equal(
      new Headers(init?.headers).get("cookie"),
      "__Secure-better-auth.session_token=fixture"
    )
    assert.equal(init?.cache, "no-store")
    assert.equal(init?.redirect, "error")
    assert.ok(init?.signal)
    return Response.json({ user: { id: "reader" }, session: { id: "session" } })
  }) as typeof fetch
  for (const [query, destination] of [
    ["", "/"],
    ["?returnTo=%2Fmanage%2Faccount", "/manage/account"],
    ["?returnTo=https%3A%2F%2Fevil.test", "/"],
    ["?returnTo=%2Flogin", "/"],
  ]) {
    const response = await proxy(
      request(query, "__Secure-better-auth.session_token=fixture")
    )
    assert.equal(response.status, 307)
    assert.equal(
      response.headers.get("location"),
      `https://web.example.test${destination}`
    )
    assert.equal(response.headers.get("cache-control"), "private, no-store")
  }
  assert.equal(calls, 4)

  for (const response of [
    Response.json(null),
    Response.json({ user: {} }),
    new Response(null, { status: 503 }),
    new Response("invalid-json"),
  ]) {
    globalThis.fetch = (async () => response) as typeof fetch
    assert.equal((await proxy(request())).headers.get("x-middleware-next"), "1")
  }
  globalThis.fetch = (async () => {
    throw new Error("offline")
  }) as typeof fetch
  assert.equal((await proxy(request())).headers.get("x-middleware-next"), "1")
} finally {
  globalThis.fetch = originalFetch
}
console.log("Login proxy redirect checks passed")
