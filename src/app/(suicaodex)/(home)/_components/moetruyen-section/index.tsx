"use client";

import { useEffect, useId, useMemo, useState } from "react";

import { useMounted } from "@mantine/hooks";
import {
  ArrowRight,
  ArrowUpRight,
  ChevronsDown,
  OctagonAlert,
} from "lucide-react";
import Link from "next/link";
import { LazyLoadImage } from "react-lazy-load-image-component";
import { Streamdown } from "streamdown";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useGetV1MangaRandom } from "@/lib/moetruyen/hooks/manga/manga";
import type { GetV1MangaRandom200DataItem } from "@/lib/moetruyen/model/getV1MangaRandom200DataItem";
import { cn } from "@/lib/utils";

import MoetruyenSectionSkeleton from "./section-skeleton";
import { siteConfig } from "@/config/site";

const FALLBACK_COVER = "/images/place-doro.webp";

const MOETRUYEN_PAIR_COUNT = 5;
const CARD_ROTATION_DURATIONS = [4200, 5600, 6900, 5100, 7600] as const;

function getMoetruyenMangaUrl(slug: string) {
  return `${siteConfig.moetruyen.domain}/manga/${slug}`;
}

function getCardClassName(className?: string) {
  return cn(
    "group relative isolate overflow-hidden rounded-md bg-background shadow-xs",
    className,
  );
}

function getMangaTags(manga: GetV1MangaRandom200DataItem) {
  const tags = manga.genres.slice(0, 2).map((genre) => genre.name);
  return tags.length > 0 ? tags : ["Đang cập nhật"];
}

function pairManga(items: GetV1MangaRandom200DataItem[], pairCount: number) {
  const pairs: GetV1MangaRandom200DataItem[][] = [];

  for (let index = 0; index < pairCount; index += 1) {
    const firstItem = items[index * 2];
    const secondItem = items[index * 2 + 1];

    if (!firstItem) {
      break;
    }

    pairs.push(secondItem ? [firstItem, secondItem] : [firstItem]);
  }

  return pairs;
}

function getActiveRotationIndex(
  pair: GetV1MangaRandom200DataItem[],
  clockMs: number,
  duration: number = CARD_ROTATION_DURATIONS[0],
) {
  if (pair.length < 2) {
    return 0;
  }

  const flipCount = Math.max(0, Math.floor(clockMs / duration));
  return flipCount % 2;
}

function getNextRotationDelay(elapsedMs: number, durations: number[]) {
  let nextDelay = Number.POSITIVE_INFINITY;

  for (const duration of durations) {
    const elapsedInCycle = elapsedMs % duration;
    const currentDelay =
      elapsedInCycle === 0 ? duration : duration - elapsedInCycle;

    if (currentDelay < nextDelay) {
      nextDelay = currentDelay;
    }
  }

  return Number.isFinite(nextDelay) ? Math.max(1, nextDelay) : null;
}

function useSharedRotationClock(durations: number[]) {
  const [clockMs, setClockMs] = useState(0);

  useEffect(() => {
    if (durations.length === 0) {
      return;
    }

    const startTime = performance.now();
    let timeoutId: number | undefined;

    const scheduleNextTick = () => {
      const elapsedMs = performance.now() - startTime;
      const nextDelay = getNextRotationDelay(elapsedMs, durations);

      if (nextDelay === null) {
        return;
      }

      timeoutId = window.setTimeout(() => {
        setClockMs(performance.now() - startTime);
        scheduleNextTick();
      }, nextDelay);
    };

    scheduleNextTick();

    return () => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [durations]);

  return clockMs;
}

function RotatingBackground({
  pair,
  activeIndex,
  overlayClassName,
}: {
  pair: GetV1MangaRandom200DataItem[];
  activeIndex: number;
  overlayClassName: string;
}) {
  return (
    <div className="absolute inset-0 overflow-hidden rounded-md">
      {pair.map((manga, index) => (
        <div
          key={manga.id}
          className={cn(
            "absolute inset-0 overflow-hidden rounded-md transition duration-700",
            index === activeIndex ? "opacity-100" : "opacity-0",
          )}
        >
          <LazyLoadImage
            src={manga.coverUrl ?? FALLBACK_COVER}
            alt={manga.title}
            wrapperClassName="block! absolute inset-0 h-full w-full overflow-hidden rounded-md"
            placeholderSrc={FALLBACK_COVER}
            className="h-full w-full rounded-md object-cover transition duration-700 backface-hidden transform-[translateZ(0)] group-hover:scale-[1.03]"
            onError={(event) => {
              event.currentTarget.src = FALLBACK_COVER;
            }}
          />
          <div
            className={cn("absolute inset-0 rounded-md", overlayClassName)}
          />
        </div>
      ))}
    </div>
  );
}

function LargeMangaPairCard({
  pair,
  activeIndex,
  className,
  showCallToAction = false,
}: {
  pair: GetV1MangaRandom200DataItem[];
  activeIndex: number;
  className?: string;
  showCallToAction?: boolean;
}) {
  const activeManga = pair[activeIndex] ?? pair[0];

  if (!activeManga) {
    return null;
  }

  const mangaHref = getMoetruyenMangaUrl(activeManga.slug);

  return (
    <article className={getCardClassName(className)}>
      <RotatingBackground
        pair={pair}
        activeIndex={activeIndex}
        overlayClassName="bg-gradient-to-r from-background via-background/80 to-background/35"
      />

      <div className="relative flex h-full flex-col justify-end gap-5 p-5  sm:p-6 lg:p-8">
        <div className="flex flex-wrap gap-2">
          {/* <Badge variant="secondary">MOETRUYEN</Badge> */}

          {getMangaTags(activeManga).map((tag) => (
            <Badge
              key={tag}
              variant="outline"
              className="border-white/20 bg-black/20"
            >
              {tag}
            </Badge>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <a
            className="w-fit max-w-full rounded-md! outline-none focus-visible:ring-2 focus-visible:ring-primary"
            href={mangaHref}
            rel="noreferrer"
            target="_blank"
          >
            <h3 className="max-w-3xl text-balance text-2xl font-black leading-tight transition hover:text-primary sm:text-3xl">
              {activeManga.title}
            </h3>
          </a>

          {!!activeManga.description && (
            <div className="flex items-center gap-2 text-sm sm:text-base">
              <Streamdown className="line-clamp-3">
                {activeManga.description}
              </Streamdown>
            </div>
          )}
        </div>

        {showCallToAction ? (
          <div>
            <Button asChild className="rounded-full">
              <a href={mangaHref} rel="noreferrer" target="_blank">
                Đọc tại MOETRUYEN
                <ArrowUpRight data-icon="inline-end" />
              </a>
            </Button>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function MediumMangaPairCard({
  pair,
  activeIndex,
  className,
}: {
  pair: GetV1MangaRandom200DataItem[];
  activeIndex: number;
  className?: string;
}) {
  const activeManga = pair[activeIndex] ?? pair[0];

  if (!activeManga) {
    return null;
  }

  return (
    <article className={getCardClassName(className)}>
      <Link
        className="block h-full rounded-md! outline-none focus-visible:ring-2 focus-visible:ring-primary"
        href={getMoetruyenMangaUrl(activeManga.slug)}
        rel="noreferrer"
        target="_blank"
      >
        <RotatingBackground
          pair={pair}
          activeIndex={activeIndex}
          overlayClassName="bg-gradient-to-t from-background via-background/55 to-transparent"
        />

        <div className="relative flex h-full flex-col justify-end gap-3 p-4 ">
          <div className="flex flex-wrap gap-2">
            {getMangaTags(activeManga).map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="border-white/15 bg-black/20 "
              >
                {tag}
              </Badge>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="line-clamp-2 text-lg font-bold leading-snug transition group-hover:text-primary">
              {activeManga.title}
            </h3>

            {!!activeManga.description && (
              <div className="flex items-center gap-2 text-sm sm:text-base">
                <Streamdown className="line-clamp-2">
                  {activeManga.description}
                </Streamdown>
              </div>
            )}
          </div>
        </div>
      </Link>
    </article>
  );
}

function MobileExpandLayout({
  featuredPair,
  leftBottomPairs,
  rightTopPair,
  rightBottomPair,
  clockMs,
}: {
  featuredPair: GetV1MangaRandom200DataItem[];
  leftBottomPairs: GetV1MangaRandom200DataItem[][];
  rightTopPair: GetV1MangaRandom200DataItem[] | null;
  rightBottomPair: GetV1MangaRandom200DataItem[] | null;
  clockMs: number;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const mobilePairs = [
    featuredPair,
    leftBottomPairs[0],
    leftBottomPairs[1],
    rightTopPair,
    rightBottomPair,
  ].filter((pair): pair is GetV1MangaRandom200DataItem[] => Boolean(pair));
  const visiblePairs = mobilePairs.slice(0, 2);
  const hiddenPairs = mobilePairs.slice(2);

  return (
    <div className="md:hidden">
      <div className="flex flex-col gap-3">
        {visiblePairs.map((pair, index) => {
          const pairIndex = mobilePairs.indexOf(pair);
          const activeIndex = getActiveRotationIndex(
            pair,
            clockMs,
            CARD_ROTATION_DURATIONS[pairIndex] ?? CARD_ROTATION_DURATIONS[0],
          );

          return index === 0 ? (
            <LargeMangaPairCard
              key={pair.map((manga) => manga.id).join("-")}
              pair={pair}
              activeIndex={activeIndex}
              className="min-h-[13rem]"
            />
          ) : (
            <MediumMangaPairCard
              key={pair.map((manga) => manga.id).join("-")}
              pair={pair}
              activeIndex={activeIndex}
              className="min-h-[9rem]"
            />
          );
        })}

        {hiddenPairs.length > 0 ? (
          <div className="flex flex-col gap-3">
            <div
              className={cn(
                "grid transition-all duration-500 ease-out",
                isExpanded
                  ? "grid-rows-[1fr] opacity-100"
                  : "grid-rows-[0fr] opacity-0",
              )}
            >
              <div className="overflow-hidden">
                <div className="flex flex-col gap-3 pt-0.5">
                  {hiddenPairs.map((pair, index) => {
                    const pairIndex = mobilePairs.indexOf(pair);
                    const isLastCard = index === hiddenPairs.length - 1;

                    const activeIndex = getActiveRotationIndex(
                      pair,
                      clockMs,
                      CARD_ROTATION_DURATIONS[pairIndex] ??
                        CARD_ROTATION_DURATIONS[0],
                    );

                    return isLastCard ? (
                      <LargeMangaPairCard
                        key={pair.map((manga) => manga.id).join("-")}
                        pair={pair}
                        activeIndex={activeIndex}
                        className="min-h-[13rem]"
                      />
                    ) : (
                      <MediumMangaPairCard
                        key={pair.map((manga) => manga.id).join("-")}
                        pair={pair}
                        activeIndex={activeIndex}
                        className="min-h-[9rem]"
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            <Button
              aria-expanded={isExpanded}
              className="w-full rounded-full"
              onClick={() => setIsExpanded((current) => !current)}
              type="button"
              variant="secondary"
              size="sm"
            >
              <ChevronsDown
                className={cn(
                  "transition-transform",
                  isExpanded && "rotate-180",
                )}
              />
              {isExpanded ? "Thu gọn" : "Xem thêm"}
              <ChevronsDown
                className={cn(
                  "transition-transform",
                  isExpanded && "rotate-180",
                )}
              />
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function MoetruyenSection() {
  const isMounted = useMounted();
  const sectionTitleId = useId();

  const { data, isLoading, isError } = useGetV1MangaRandom(
    { limit: MOETRUYEN_PAIR_COUNT * 2 },
    {
      query: {
        enabled: isMounted,
        staleTime: 1000 * 60 * 5,
        refetchInterval: 1000 * 60 * 10,
        refetchOnWindowFocus: false,
      },
    },
  );

  const mangaItems = useMemo(
    () => (data?.status === 200 ? data.data.data : []),
    [data],
  );
  const hasResponseError = data !== undefined && data.status !== 200;

  const mangaPairs = useMemo(
    () => pairManga(mangaItems, MOETRUYEN_PAIR_COUNT),
    [mangaItems],
  );

  const featuredPair = mangaPairs[0] ?? null;
  const leftBottomPairs = mangaPairs.slice(1, 3);
  const rightTopPair = mangaPairs[3] ?? null;
  const rightBottomPair = mangaPairs[4] ?? null;
  const rotatableDurations = useMemo(() => {
    const durations: number[] = [];

    for (const [index, pair] of mangaPairs.entries()) {
      if (pair.length > 1) {
        durations.push(
          CARD_ROTATION_DURATIONS[index] ?? CARD_ROTATION_DURATIONS[0],
        );
      }
    }

    return durations;
  }, [mangaPairs]);
  const clockMs = useSharedRotationClock(rotatableDurations);

  if (!isMounted || isLoading) {
    return <MoetruyenSectionSkeleton />;
  }

  if (isError || hasResponseError || featuredPair === null) {
    return (
      <section aria-labelledby={sectionTitleId} className="flex flex-col gap-4">
        <div>
          <hr className="w-9 h-1 bg-primary border-none" />
          <h1 className="text-2xl font-black uppercase">MoèTruyện</h1>
        </div>

        <Alert>
          <OctagonAlert />
          <AlertTitle>Không tải được dữ liệu MOETRUYEN</AlertTitle>
          <AlertDescription>
            Có vẻ đã xảy ra lỗi, thử lại sau ít phút hoặc đấm mồm thằng dev nhé
            fen 🤪
          </AlertDescription>
        </Alert>
      </section>
    );
  }

  return (
    <section aria-labelledby={sectionTitleId} className="flex flex-col gap-4">
      <div className="flex justify-between">
        <div>
          <hr className="w-9 h-1 bg-primary border-none" />
          <h1 className="text-2xl font-black uppercase">MoèTruyện</h1>
        </div>

        <Button
          asChild
          size="icon"
          variant="secondary"
          className="[&_svg]:size-5"
        >
          <Link href="/moetruyen" prefetch={false}>
            <ArrowRight className="size-5" />
          </Link>
        </Button>
      </div>

      <MobileExpandLayout
        featuredPair={featuredPair}
        leftBottomPairs={leftBottomPairs}
        rightTopPair={rightTopPair}
        rightBottomPair={rightBottomPair}
        clockMs={clockMs}
      />

      <div className="hidden gap-4 md:grid xl:grid-cols-2">
        <div className="grid gap-4">
          <LargeMangaPairCard
            key={featuredPair.map((manga) => manga.id).join("-")}
            pair={featuredPair}
            activeIndex={getActiveRotationIndex(
              featuredPair,
              clockMs,
              CARD_ROTATION_DURATIONS[0],
            )}
            className="min-h-[18rem] sm:min-h-[22rem]"
            // showCallToAction
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {leftBottomPairs.map((pair, index) => (
              <MediumMangaPairCard
                key={pair.map((manga) => manga.id).join("-")}
                pair={pair}
                activeIndex={getActiveRotationIndex(
                  pair,
                  clockMs,
                  CARD_ROTATION_DURATIONS[index + 1],
                )}
                className="min-h-[13rem]"
              />
            ))}
          </div>
        </div>

        <div className="grid gap-4">
          {rightTopPair ? (
            <MediumMangaPairCard
              key={rightTopPair.map((manga) => manga.id).join("-")}
              pair={rightTopPair}
              activeIndex={getActiveRotationIndex(
                rightTopPair,
                clockMs,
                CARD_ROTATION_DURATIONS[3],
              )}
              className="min-h-[13rem]"
            />
          ) : null}

          {rightBottomPair ? (
            <LargeMangaPairCard
              key={rightBottomPair.map((manga) => manga.id).join("-")}
              pair={rightBottomPair}
              activeIndex={getActiveRotationIndex(
                rightBottomPair,
                clockMs,
                CARD_ROTATION_DURATIONS[4],
              )}
              className="min-h-[18rem] sm:min-h-[22rem]"
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}
