"use client";

import { useEffect, useId, useMemo, useState } from "react";

import { useMounted } from "@mantine/hooks";
import {
  ArrowRight,
  ArrowUpRight,
  OctagonAlert,
  UserRound,
} from "lucide-react";
import { LazyLoadImage } from "react-lazy-load-image-component";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  getMoetruyenMangaUrl,
  type MoetruyenHomeManga,
} from "@/lib/moetruyen/client";
import { useMoetruyenRandomMangaQuery } from "@/lib/moetruyen/queries";
import { cn } from "@/lib/utils";

import MoetruyenSectionSkeleton from "./section-skeleton";
import Link from "next/link";

const FALLBACK_COVER = "/images/place-doro.webp";
const MOETRUYEN_PAIR_COUNT = 5;
const CARD_ROTATION_DURATIONS = [4200, 5600, 6900, 5100, 7600] as const;

function getCardClassName(className?: string) {
  return cn(
    "group relative isolate overflow-hidden rounded-md bg-background shadow-xs",
    className,
  );
}

function getMangaTags(manga: MoetruyenHomeManga) {
  return manga.tags.length > 0 ? manga.tags : ["Đang cập nhật"];
}

function pairManga(items: MoetruyenHomeManga[], pairCount: number) {
  const pairs: MoetruyenHomeManga[][] = [];

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
  pair: MoetruyenHomeManga[],
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
  pair: MoetruyenHomeManga[];
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
  pair: MoetruyenHomeManga[];
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
              variant="secondary"
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

          <div className="flex items-center gap-2 text-sm  sm:text-base">
            <UserRound className="size-4 shrink-0" />
            <span className="line-clamp-1 font-medium">
              {activeManga.author ?? "Đang cập nhật"}
            </span>
          </div>
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
  pair: MoetruyenHomeManga[];
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

            <div className="flex items-center gap-2 text-xs  sm:text-sm">
              <UserRound className="size-3.5 shrink-0" />
              <span className="line-clamp-1">
                {activeManga.author ?? "Đang cập nhật"}
              </span>
            </div>
          </div>
        </div>
      </Link>
    </article>
  );
}

export default function MoetruyenSection() {
  const isMounted = useMounted();
  const sectionTitleId = useId();

  const { data, isLoading, isError } = useMoetruyenRandomMangaQuery(
    MOETRUYEN_PAIR_COUNT * 2,
    isMounted,
  );

  const mangaPairs = useMemo(
    () => pairManga(data ?? [], MOETRUYEN_PAIR_COUNT),
    [data],
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

  if (isError || featuredPair === null) {
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
          <Link href="https://moetruyen.net/" prefetch={false} target="_blank">
            <ArrowRight className="size-5" />
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
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
