import { expect, test } from "bun:test"

import { createApp } from "../../src/app"
import type { CatalogDependencies } from "../../src/features/catalog/routes"
import {
  LibraryCategorySchema,
  PutLibraryItemSchema,
} from "../../src/features/library/contract"

test("library contract keeps four categories, strict input and shared MangaSummary", async () => {
  expect(LibraryCategorySchema.options).toEqual([
    "following",
    "reading",
    "plan",
    "completed",
  ])
  for (const category of ["DROPPED", "RE_READING", "favorite", "Reading"])
    expect(PutLibraryItemSchema.safeParse({ category }).success).toBe(false)
  expect(
    PutLibraryItemSchema.safeParse({ category: "plan", userId: "other" })
      .success
  ).toBe(false)
  const app = createApp({
    logger: () => undefined,
    catalog: {
      assetBaseUrl: "https://assets.example.com/",
    } as CatalogDependencies,
  })
  const document = await (await app.request("/openapi.json")).json()
  const schemas = document.components.schemas
  expect(schemas.LibraryItem.type).toBe("object")
  expect(schemas.LibraryItem.properties.manga).toEqual({
    $ref: "#/components/schemas/MangaSummary",
  })
  expect(
    schemas.MangaSummary.properties.latestChapterPublishedAt.anyOf
  ).toEqual([{ $ref: "#/components/schemas/Timestamp" }, { type: "null" }])
  expect(schemas.PutLibraryItem.additionalProperties).toBe(false)
  expect(document.paths["/v1/me/library/merge"]).toBeUndefined()
  const listParameters = document.paths["/v1/me/library"].get.parameters
  expect(listParameters.find(({ name }) => name === "q").schema).toMatchObject({
    maxLength: 160,
    minLength: 1,
    type: "string",
  })
  expect(listParameters.find(({ name }) => name === "sort").schema).toEqual({
    $ref: "#/components/schemas/LibrarySort",
  })
  expect(schemas.LibrarySort).toMatchObject({
    default: "addedAt",
    enum: ["addedAt", "latestChapter"],
  })
  const operations = document.paths["/v1/me/library/{mangaId}"]
  expect(
    operations.get.responses[200].content["application/json"].schema.properties
      .data.anyOf
  ).toEqual([{ $ref: "#/components/schemas/LibraryItem" }, { type: "null" }])
  expect(
    operations.put.responses[200].content["application/json"].schema.properties
      .data
  ).toEqual({ $ref: "#/components/schemas/LibraryItem" })
  expect(
    document.paths["/v1/me/library"].get.responses[200].content[
      "application/json"
    ].schema.properties.meta.properties.nextCursor.anyOf
  ).toContainEqual({ type: "null" })
})
