"use client";

import Link from "next/link";
import { ComponentProps } from "react";
import { LazyLoadImage } from "react-lazy-load-image-component";
import { Streamdown } from "streamdown";

import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import type { GetV1MangaTop200DataItem } from "@/lib/moetruyen/model/getV1MangaTop200DataItem";

const FALLBACK_COVER = "/images/place-doro.webp";
const NO_COVER = "/images/no-cover.webp";

function MoeNormalTag(props: ComponentProps<"div">) {
  return (
    <div
      {...props}
      className={cn(
        "flex items-center gap-1 px-1.5 py-0 bg-accent font-bold rounded-sm text-[0.625rem] w-fit",
        props.className,
      )}
    >
      {props.children}
    </div>
  );
}

type StatusKey = "ongoing" | "completed" | "hiatus" | "cancelled";

const statusStyles: Record<
  StatusKey,
  { text: string; outline: string; bg: string }
> = {
  ongoing: {
    text: "text-blue-500 dark:text-blue-400",
    outline: "outline-blue-500 dark:outline-blue-400",
    bg: "bg-blue-500 dark:bg-blue-400",
  },
  completed: {
    text: "text-green-500 dark:text-green-400",
    outline: "outline-green-500 dark:outline-green-400",
    bg: "bg-green-500 dark:bg-green-400",
  },
  hiatus: {
    text: "text-gray-500 dark:text-gray-400",
    outline: "outline-gray-500 dark:outline-gray-400",
    bg: "bg-gray-500 dark:bg-gray-400",
  },
  cancelled: {
    text: "text-red-500 dark:text-red-400",
    outline: "outline-red-500 dark:outline-red-400",
    bg: "bg-red-500 dark:bg-red-400",
  },
};

const defaultStatusStyle = {
  text: "text-gray-500 dark:text-gray-400",
  outline: "outline-gray-500 dark:outline-gray-400",
  bg: "bg-gray-500 dark:bg-gray-400",
};

function MoeStatusTag({ status }: { status: string }) {
  const { text, outline, bg } =
    statusStyles[status as StatusKey] ?? defaultStatusStyle;

  return (
    <MoeNormalTag
      className={cn(
        "uppercase bg-transparent outline-solid outline-2 -outline-offset-2",
        text,
        outline,
      )}
    >
      <span className={cn("rounded-full w-2 h-2", bg)} />
      {status}
    </MoeNormalTag>
  );
}

export default function MoeMangaSlide({
  manga,
}: {
  manga: GetV1MangaTop200DataItem;
}) {
  const isMobile = useIsMobile();
  const coverUrl = manga.coverUrl ?? NO_COVER;
  const href = `/moetruyen/manga/${manga.id}/${manga.slug}`;
  const authorLine = manga.author ?? "";

  return (
    <div
      className="relative bg-no-repeat bg-cover bg-position-[center_top_25%] h-[300px] md:h-[400px] lg:h-[420px]"
      style={{ backgroundImage: `url('${coverUrl}')` }}
    >
      <div className="relative z-1 flex gap-4 pt-28 h-full px-4 md:px-8 lg:px-12">
        <Link href={href} prefetch={false} className="z-10!">
          <LazyLoadImage
            placeholderSrc={FALLBACK_COVER}
            src={coverUrl}
            alt={`Ảnh bìa ${manga.title}`}
            onError={(event) => {
              event.currentTarget.src = FALLBACK_COVER;
            }}
            visibleByDefault
            className="shadow-md drop-shadow-md aspect-7/10 object-cover! h-auto w-full rounded-sm block"
            wrapperClassName="block! rounded-sm object-cover w-[130px] md:w-[200px] lg:w-[215px] h-auto"
          />
        </Link>

        <div
          className="grid gap-6 sm:gap-2 h-full min-h-0"
          style={{
            gridTemplateRows: isMobile
              ? "1fr auto"
              : "max-content min-content auto max-content",
          }}
        >
          <Link href={href} prefetch={false}>
            <p className="drop-shadow-md font-black text-2xl line-clamp-5 sm:line-clamp-2 wrap-break-word lg:text-[42px] overflow-hidden lg:leading-12!">
              {manga.title}
            </p>
          </Link>

          <div className="hidden md:flex flex-wrap gap-1">
            <MoeStatusTag status={manga.status} />
            {manga.genres.map((genre) => (
              <MoeNormalTag key={genre.id} className="uppercase">
                {genre.name}
              </MoeNormalTag>
            ))}
          </div>

          <div className="hidden md:block min-h-0 relative overflow-auto">
            <div className="relative overflow-hidden">
              <Streamdown
                controls={{ table: false }}
                className="text-sm text-balance"
              >
                {manga.description ?? ""}
              </Streamdown>
            </div>
          </div>

          <p className=" flex-1 self-end text-base md:text-lg italic font-medium line-clamp-1 max-w-full md:max-w-[80%]">
            {authorLine}
          </p>
        </div>
      </div>

      <div
        className={cn(
          "absolute inset-0 z-0 w-full pointer-events-none",
          "bg-linear-to-b from-background/25 to-background backdrop-blur-[0.5px]",
        )}
      />
    </div>
  );
}
