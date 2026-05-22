import { postV2ChaptersByIdPageAccess } from "./hooks/chapters/chapters";
import { decodeImgxToWebp, isImgxUrl } from "./imgx";
import type { PostV2ChaptersByIdPageAccess200DataPagesItem } from "./model/postV2ChaptersByIdPageAccess200DataPagesItem";

export const MOETRUYEN_PAGE_ACCESS_BATCH_SIZE = 5;
const GRANT_EXPIRY_SAFETY_MS = 1_000;

type PageAccessFetcher = (
  chapterId: number,
  pageIndex: number,
  signal?: AbortSignal,
) => Promise<PostV2ChaptersByIdPageAccess200DataPagesItem>;

type PageAccessBatchFetcher = (
  chapterId: number,
  pageIndexes: number[],
  signal?: AbortSignal,
) => Promise<PostV2ChaptersByIdPageAccess200DataPagesItem[]>;

interface LoadMoetruyenReaderImageOptions {
  source: string;
  pageIndex: number;
  chapterId?: number;
  signal?: AbortSignal;
  pageAccessFetcher?: PageAccessFetcher;
  fetcher?: typeof fetch;
}

interface CachedPageAccess {
  page: PostV2ChaptersByIdPageAccess200DataPagesItem;
  expiresAt: number;
}

interface CreateMoetruyenPageAccessFetcherOptions {
  chapterId: number;
  imageUrls: string[];
  batchSize?: number;
  now?: () => number;
  pageAccessBatchFetcher?: PageAccessBatchFetcher;
}

async function fetchBlob(
  source: string,
  signal: AbortSignal | undefined,
  fetcher: typeof fetch,
): Promise<Blob> {
  const response = await fetcher(source, { signal });

  if (!response.ok) {
    throw new Error(`Failed to fetch reader image: ${response.status}`);
  }

  return response.blob();
}

async function defaultPageAccessBatchFetcher(
  chapterId: number,
  pageIndexes: number[],
  signal?: AbortSignal,
): Promise<PostV2ChaptersByIdPageAccess200DataPagesItem[]> {
  const result = await postV2ChaptersByIdPageAccess(
    chapterId,
    { pageIndexes },
    { signal },
  );

  if (result.status !== 200) {
    const errorMessage =
      "error" in result.data
        ? result.data.error.message
        : "IMGX page access failed";
    throw new Error(errorMessage);
  }

  return result.data.data.pages;
}

async function defaultPageAccessFetcher(
  chapterId: number,
  pageIndex: number,
  signal?: AbortSignal,
): Promise<PostV2ChaptersByIdPageAccess200DataPagesItem> {
  const pages = await defaultPageAccessBatchFetcher(
    chapterId,
    [pageIndex],
    signal,
  );
  const page = pages.find((entry) => entry.pageIndex === pageIndex);

  if (!page) {
    throw new Error("IMGX page grant missing");
  }

  return page;
}

function getPageAccessChunkStart(pageIndex: number, batchSize: number): number {
  return Math.floor(pageIndex / batchSize) * batchSize;
}

function isCachedPageAccessFresh(
  cached: CachedPageAccess | undefined,
  now: number,
): cached is CachedPageAccess {
  return (
    cached !== undefined && cached.expiresAt - GRANT_EXPIRY_SAFETY_MS > now
  );
}

function getBatchPageIndexes(
  imageUrls: string[],
  pageIndex: number,
  batchSize: number,
): number[] {
  const start = getPageAccessChunkStart(pageIndex, batchSize);
  const end = Math.min(start + batchSize, imageUrls.length);
  const pageIndexes: number[] = [];

  for (let index = start; index < end; index += 1) {
    const imageUrl = imageUrls[index];

    if (imageUrl && isImgxUrl(imageUrl)) {
      pageIndexes.push(index);
    }
  }

  return pageIndexes.includes(pageIndex) ? pageIndexes : [pageIndex];
}

export function createMoetruyenPageAccessFetcher({
  chapterId,
  imageUrls,
  batchSize = MOETRUYEN_PAGE_ACCESS_BATCH_SIZE,
  now = () => Date.now(),
  pageAccessBatchFetcher = defaultPageAccessBatchFetcher,
}: CreateMoetruyenPageAccessFetcherOptions): PageAccessFetcher {
  const safeBatchSize = Math.max(1, Math.floor(batchSize));
  const cache = new Map<number, CachedPageAccess>();
  const inflightChunks = new Map<number, Promise<void>>();

  return async (requestedChapterId, pageIndex) => {
    if (requestedChapterId !== chapterId) {
      throw new Error("IMGX chapter id mismatch");
    }

    const requestedAt = now();
    const cached = cache.get(pageIndex);

    if (isCachedPageAccessFresh(cached, requestedAt)) {
      return cached.page;
    }

    const chunkStart = getPageAccessChunkStart(pageIndex, safeBatchSize);
    let inflight = inflightChunks.get(chunkStart);

    if (!inflight) {
      const pageIndexes = getBatchPageIndexes(
        imageUrls,
        pageIndex,
        safeBatchSize,
      );

      inflight = pageAccessBatchFetcher(requestedChapterId, pageIndexes).then(
        (pages) => {
          const receivedAt = now();

          for (const page of pages) {
            cache.set(page.pageIndex, {
              page,
              expiresAt: Math.max(page.grant.expiresAt, receivedAt),
            });
          }
        },
      );

      inflightChunks.set(chunkStart, inflight);
      void inflight
        .finally(() => {
          inflightChunks.delete(chunkStart);
        })
        .catch(() => undefined);
    }

    await inflight;

    const page = cache.get(pageIndex)?.page;

    if (!page) {
      throw new Error("IMGX page grant missing");
    }

    return page;
  };
}

export async function loadMoetruyenReaderImage({
  source,
  pageIndex,
  chapterId,
  signal,
  pageAccessFetcher = defaultPageAccessFetcher,
  fetcher = fetch,
}: LoadMoetruyenReaderImageOptions): Promise<Blob> {
  if (!isImgxUrl(source)) {
    return fetchBlob(source, signal, fetcher);
  }

  if (chapterId === undefined) {
    throw new Error("IMGX chapter id is required");
  }

  const page = await pageAccessFetcher(chapterId, pageIndex, signal);
  const response = await fetcher(page.downloadUrl, {
    signal,
    cache: "force-cache",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch IMGX binary: ${response.status}`);
  }

  const decoded = await decodeImgxToWebp(
    await response.arrayBuffer(),
    page.grant,
    page.storageKey,
  );

  return new Blob([Uint8Array.from(decoded.webp).buffer], {
    type: "image/webp",
  });
}
