import { describe, expect, test } from "bun:test"
import { createRoute, z } from "@hono/zod-openapi"
import { bodyLimit } from "hono/body-limit"

import { createApp } from "../../src/app"
import type { Database } from "../../src/db/client"
import { utf16MaxLength } from "../../src/shared/string-length"

const bodySchema = z.object({ name: z.string().check(...utf16MaxLength(4)) })
const app = createApp({ logger: () => undefined })
app.openapi(
  createRoute({
    method: "post",
    path: "/",
    middleware: [bodyLimit({ maxSize: 128 })],
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: bodySchema } },
      },
    },
    responses: {
      200: {
        description: "Validated input",
        content: { "application/json": { schema: bodySchema } },
      },
    },
  }),
  (c) => c.json(c.req.valid("json"), 200)
)

function chunked(body: string) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const byte of new TextEncoder().encode(body))
        controller.enqueue(Uint8Array.of(byte))
      controller.close()
    },
  })
}

describe("HTTP validation after dependency upgrades", () => {
  test("documents media-type errors for typed request bodies", async () => {
    const documentedApp = createApp({
      account: { database: {} as Database },
      logger: () => undefined,
    })
    const document = (await (
      await documentedApp.request("/openapi.json")
    ).json()) as {
      paths: Record<
        string,
        Record<string, { responses: Record<string, unknown> }>
      >
    }
    expect(
      document.paths["/v1/me/profile"]?.patch?.responses[415]
    ).toMatchObject({
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/ApiError" },
        },
      },
    })
    expect(document.paths["/health"]?.get?.responses[415]).toBeUndefined()
  })

  test("validates normal and chunked JSON with the same string limits", async () => {
    const body = JSON.stringify({ name: "😀😀" })
    for (const input of [body, chunked(body)]) {
      const response = await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: input,
      })
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ name: "😀😀" })
    }
    expect(
      (
        await app.request("/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "😀😀a" }),
        })
      ).status
    ).toBe(400)
  })

  test("rejects unsupported or missing media types instead of validating an empty object", async () => {
    for (const headers of [{}, { "Content-Type": "text/plain" }]) {
      const response = await app.request("/", {
        method: "POST",
        headers,
        body: JSON.stringify({ name: "text" }),
      })
      expect(response.status).toBe(415)
      expect(await response.json()).toEqual({
        error: {
          code: "UNSUPPORTED_MEDIA_TYPE",
          message: "Unsupported request Content-Type",
          requestId: response.headers.get("x-request-id"),
        },
      })
    }
  })

  test("rejects malformed and oversized chunked bodies", async () => {
    expect(
      (
        await app.request("/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{",
        })
      ).status
    ).toBe(400)
    expect(
      (
        await app.request("/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: chunked(JSON.stringify({ name: "a".repeat(128) })),
        })
      ).status
    ).toBe(413)
  })
})
