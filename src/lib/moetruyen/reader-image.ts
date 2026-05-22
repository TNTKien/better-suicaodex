import { postV2ChaptersByIdPageAccess } from "./hooks/chapters/chapters";
import { decodeImgxToWebp, isImgxUrl } from "./imgx";
import type { PostV2ChaptersByIdPageAccess200DataPagesItem } from "./model/postV2ChaptersByIdPageAccess200DataPagesItem";

type PageAccessFetcher = (
  chapterId: number,
  pageIndex: number,
  signal?: AbortSignal,
) => Promise<PostV2ChaptersByIdPageAccess200DataPagesItem>;

interface LoadMoetruyenReaderImageOptions {
  source: string;
  pageIndex: number;
  chapterId?: number;
  signal?: AbortSignal;
  pageAccessFetcher?: PageAccessFetcher;
  fetcher?: typeof fetch;
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

async function defaultPageAccessFetcher(
  chapterId: number,
  pageIndex: number,
  signal?: AbortSignal,
): Promise<PostV2ChaptersByIdPageAccess200DataPagesItem> {
  const result = await postV2ChaptersByIdPageAccess(
    chapterId,
    { pageIndexes: [pageIndex] },
    { signal },
  );

  if (result.status !== 200) {
    const errorMessage =
      "error" in result.data
        ? result.data.error.message
        : "IMGX page access failed";
    throw new Error(errorMessage);
  }

  const page = result.data.data.pages.find(
    (entry) => entry.pageIndex === pageIndex,
  );

  if (!page) {
    throw new Error("IMGX page grant missing");
  }

  return page;
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
