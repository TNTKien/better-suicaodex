import type React from "react";
import { getCurrentImageProxyUrl } from "@/lib/utils";
import type { ChapterAtHome } from "@/lib/mangadex/chapter";
import type { ReaderDirection } from "@/hooks/use-reader-config";

export type ReaderPageStatus = "idle" | "loading" | "loaded" | "failed";

export type ReaderPage = {
  index: number;
  name: string;
  sourceUrl: string;
  url?: string;
  width?: number;
  height?: number;
  status: ReaderPageStatus;
  retries: number;
};

const DATA_PREFIX = "data";
const DATA_SAVER_PREFIX = "data-saver";

export function buildPageSources(
  atHome: ChapterAtHome,
  dataSaver: boolean
): { name: string; sourceUrl: string }[] {
  if (atHome?.chapter?.hash && atHome?.baseUrl && atHome?.chapter?.data) {
    const fileNames = dataSaver && atHome.chapter.dataSaver?.length
      ? atHome.chapter.dataSaver
      : atHome.chapter.data;

    const folder = dataSaver && atHome.chapter.dataSaver?.length
      ? DATA_SAVER_PREFIX
      : DATA_PREFIX;

    return fileNames.map((name) => ({
      name,
      sourceUrl: `${atHome.baseUrl}/${folder}/${atHome.chapter?.hash}/${name}`,
    }));
  }

  if (atHome?.images?.length) {
    return atHome.images.map((url) => {
      const resolvedUrl = url.startsWith("http")
        ? url
        : `${getCurrentImageProxyUrl()}/${url}`;
      const parts = resolvedUrl.split("/");
      return {
        name: parts[parts.length - 1] || resolvedUrl,
        sourceUrl: resolvedUrl,
      };
    });
  }

  return [];
}

export function createInitialPages(
  sources: { name: string; sourceUrl: string }[]
): ReaderPage[] {
  return sources.map((source, index) => ({
    index,
    name: source.name,
    sourceUrl: source.sourceUrl,
    status: "idle",
    retries: 0,
  }));
}

export function getPriorityOrder(
  currentIndex: number,
  total: number
): number[] {
  const order: number[] = [];
  if (total === 0) return order;

  const isNearEnd = currentIndex >= total - 2;
  order.push(currentIndex);

  for (let offset = 1; offset < total; offset += 1) {
    const prev = currentIndex - offset;
    const next = currentIndex + offset;

    if (isNearEnd) {
      if (prev >= 0) order.push(prev);
      if (next < total) order.push(next);
    } else {
      if (next < total) order.push(next);
      if (prev >= 0) order.push(prev);
    }
  }

  return Array.from(new Set(order));
}

export function getSpreadPages(
  pages: ReaderPage[],
  spreadOffset: number,
  direction: ReaderDirection
): number[][] {
  const spreads: number[][] = [];
  const rtl = direction === "rtl";
  let index = 0;

  while (index < pages.length) {
    if (index < spreadOffset) {
      spreads.push([index]);
      index += 1;
      continue;
    }

    const current = pages[index];
    const currentIsWide = current.width && current.height
      ? current.width > current.height
      : false;

    if (currentIsWide) {
      spreads.push([index]);
      index += 1;
      continue;
    }

    const next = pages[index + 1];
    const nextIsWide = next && next.width && next.height
      ? next.width > next.height
      : false;

    if (next && !nextIsWide) {
      spreads.push(rtl ? [index + 1, index] : [index, index + 1]);
      index += 2;
      continue;
    }

    spreads.push([index]);
    index += 1;
  }

  return spreads;
}

export function getNextPageIndex(
  spreads: number[][],
  currentPage: number,
  direction: ReaderDirection
): number | null {
  const currentSpreadIndex = spreads.findIndex((spread) =>
    spread.includes(currentPage)
  );
  if (currentSpreadIndex === -1) return null;

  const nextSpreadIndex = currentSpreadIndex + 1;
  if (nextSpreadIndex >= spreads.length) return null;

  const nextSpread = spreads[nextSpreadIndex];
  if (!nextSpread) return null;

  return direction === "rtl" ? nextSpread[nextSpread.length - 1] : nextSpread[0];
}

export function getPrevPageIndex(
  spreads: number[][],
  currentPage: number,
  direction: ReaderDirection
): number | null {
  const currentSpreadIndex = spreads.findIndex((spread) =>
    spread.includes(currentPage)
  );
  if (currentSpreadIndex === -1) return null;

  const prevSpreadIndex = currentSpreadIndex - 1;
  if (prevSpreadIndex < 0) return null;

  const prevSpread = spreads[prevSpreadIndex];
  if (!prevSpread) return null;

  return direction === "rtl" ? prevSpread[prevSpread.length - 1] : prevSpread[0];
}

export function resolveClickDirection(
  event: React.MouseEvent<HTMLDivElement>,
  direction: ReaderDirection
) {
  const { clientX } = event;
  const width = window.innerWidth || 1;
  const isLeft = clientX < width / 2;

  if (direction === "rtl") {
    return isLeft ? "next" : "prev";
  }

  return isLeft ? "prev" : "next";
}
