import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createMoetruyenPageAccessFetcher } from "./reader-image";
import type { PostV2ChaptersByIdPageAccess200DataPagesItem } from "./model/postV2ChaptersByIdPageAccess200DataPagesItem";

const makePage = (
  pageIndex: number,
  expiresAt: number,
): PostV2ChaptersByIdPageAccess200DataPagesItem => ({
  pageIndex,
  pageNumber: pageIndex + 1,
  storageKey: `chapters/test/${String(pageIndex + 1).padStart(3, "0")}.js`,
  downloadUrl: `https://i.truyen.moe/chapters/test/${String(pageIndex + 1).padStart(3, "0")}.js`,
  grant: {
    version: 2,
    algorithm: "IMGX-HMAC-SHA256-v2",
    imageId: `image-${pageIndex}`,
    issuedAt: 1_000,
    expiresAt,
    nonce: `nonce-${pageIndex}`,
    keyNonce: `key-nonce-${pageIndex}`,
    keyHash: `key-hash-${pageIndex}`,
    signature: `signature-${pageIndex}`,
    wrappedDecodeKey: `wrapped-${pageIndex}`,
  },
});

void describe("MoeTruyen reader image page access", () => {
  void it("batches concurrent IMGX page access requests in windows of five", async () => {
    const calls: number[][] = [];
    const imageUrls = Array.from(
      { length: 8 },
      (_, index) => `https://i.truyen.moe/chapter/${index + 1}.js`,
    );
    const pageAccessFetcher = createMoetruyenPageAccessFetcher({
      chapterId: 99,
      imageUrls,
      now: () => 1_000,
      pageAccessBatchFetcher: (chapterId, pageIndexes) => {
        assert.equal(chapterId, 99);
        calls.push(pageIndexes);
        return Promise.resolve(
          pageIndexes.map((pageIndex) => makePage(pageIndex, 61_000)),
        );
      },
    });

    const [first, second, third] = await Promise.all([
      pageAccessFetcher(99, 0),
      pageAccessFetcher(99, 1),
      pageAccessFetcher(99, 2),
    ]);

    assert.equal(first.pageIndex, 0);
    assert.equal(second.pageIndex, 1);
    assert.equal(third.pageIndex, 2);
    assert.deepEqual(calls, [[0, 1, 2, 3, 4]]);

    assert.equal((await pageAccessFetcher(99, 4)).pageIndex, 4);
    assert.deepEqual(calls, [[0, 1, 2, 3, 4]]);

    assert.equal((await pageAccessFetcher(99, 5)).pageIndex, 5);
    assert.deepEqual(calls, [
      [0, 1, 2, 3, 4],
      [5, 6, 7],
    ]);
  });

  void it("refreshes cached grants after they expire", async () => {
    let now = 1_000;
    const calls: number[][] = [];
    const pageAccessFetcher = createMoetruyenPageAccessFetcher({
      chapterId: 99,
      imageUrls: ["https://i.truyen.moe/chapter/1.js"],
      now: () => now,
      pageAccessBatchFetcher: (_chapterId, pageIndexes) => {
        calls.push(pageIndexes);
        return Promise.resolve(
          pageIndexes.map((pageIndex) => makePage(pageIndex, now + 10_000)),
        );
      },
    });

    await pageAccessFetcher(99, 0);
    now = 20_000;
    await pageAccessFetcher(99, 0);

    assert.deepEqual(calls, [[0], [0]]);
  });
});
