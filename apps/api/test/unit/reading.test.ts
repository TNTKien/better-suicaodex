import { expect, test } from "bun:test"

import { createApp } from "../../src/app"
import type { CatalogDependencies } from "../../src/features/catalog/routes"
import { MergeHistoryInputSchema } from "../../src/features/reading/contract"

test("reading OpenAPI preserves nullable results and flat strict merge entries", async () => {
  const app = createApp({
    logger: () => undefined,
    catalog: {
      assetBaseUrl: "https://assets.example.com/",
    } as CatalogDependencies,
  })
  const document = await (await app.request("/openapi.json")).json()
  const schemas = document.components.schemas
  expect(schemas.ReadingProgress.type).toBe("object")
  const operations = document.paths["/v1/me/reading-progress/{chapterId}"]
  expect(
    operations.get.responses[200].content["application/json"].schema.properties
      .data.anyOf
  ).toEqual([
    { $ref: "#/components/schemas/ReadingProgress" },
    { type: "null" },
  ])
  expect(
    operations.put.responses[200].content["application/json"].schema.properties
      .data
  ).toEqual({
    $ref: "#/components/schemas/ReadingProgress",
  })
  const entry = schemas.MergeHistoryInput.properties.entries.items
  expect(entry.allOf).toBeUndefined()
  expect(entry.additionalProperties).toBe(false)
  expect(Object.keys(entry.properties).sort()).toEqual(["chapterId", "readAt"])
  expect(
    MergeHistoryInputSchema.safeParse({
      entries: [
        {
          chapterId: "019916a5-3013-7b3f-a0ef-66237490a7bb",
          userId: "someone-else",
        },
      ],
    }).success
  ).toBe(false)
  expect(
    document.paths["/v1/me/reading-history/manga"].get.responses[200].content[
      "application/json"
    ].schema.properties.data.items.$ref
  ).toBe("#/components/schemas/MangaReadingHistoryItem")
  expect(schemas.MangaReadingHistoryItem.properties.chapters.maxItems).toBe(3)
})
