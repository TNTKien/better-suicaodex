"use client"

import { PrefetchLink } from "@workspace/ui/components/prefetch-link"
import { cover256, coverSrcSet } from "@workspace/catalog/images"

import Autoplay from "embla-carousel-autoplay"
import { useEffect, useState } from "react"

import { AssetImage } from "@/components/asset-image"
import type { MangaSummary } from "@/lib/api"
import { basicMarkdownElements } from "@/lib/markdown"
import { Badge } from "@workspace/ui/components/badge"
import { Card } from "@workspace/ui/components/card"
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@workspace/ui/components/carousel"
import { cn } from "@workspace/ui/lib/utils"
import { Streamdown } from "streamdown"

export function FeaturedCarousel({ manga }: { manga: MangaSummary[] }) {
  const [autoplay] = useState(() =>
    Autoplay({ delay: 6_000, stopOnInteraction: false, stopOnMouseEnter: true })
  )
  const [api, setApi] = useState<CarouselApi>()
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (!api) return

    const updateActiveIndex = () => setActiveIndex(api.selectedScrollSnap())
    updateActiveIndex()
    api.on("reInit", updateActiveIndex)
    api.on("select", updateActiveIndex)

    return () => {
      api.off("reInit", updateActiveIndex)
      api.off("select", updateActiveIndex)
    }
  }, [api])

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
    if (reducedMotion.matches) autoplay.stop()
  }, [autoplay])

  if (manga.length === 0) return null

  return (
    <Card className="relative gap-0 overflow-hidden rounded-none p-0! shadow-none">
      <div className="pointer-events-none absolute top-4 left-5 z-10 sm:top-5 sm:left-8 lg:left-10">
        <h1 className="section-heading text-2xl">Tiêu điểm</h1>
      </div>

      <Carousel
        aria-label="Danh sách truyện tiêu điểm"
        opts={{ loop: manga.length > 1 }}
        plugins={manga.length > 1 ? [autoplay] : []}
        setApi={setApi}
      >
        <CarouselContent className="ml-0 touch-pan-y touch-pinch-zoom">
          {manga.map((item, index) => {
            const href = `/manga/${item.id}/${item.slug}`
            const coverWidth = item.cover?.width ?? 700
            const coverHeight = item.cover?.height ?? 1_000
            const authors = item.authors.slice(0, 2)
            const authorNames =
              authors.map(({ name }) => name).join(", ") || "Chưa rõ"

            return (
              <CarouselItem
                aria-hidden={index !== activeIndex}
                aria-label={`${index + 1} trên ${manga.length}: ${item.title}`}
                className="pl-0"
                inert={index !== activeIndex}
                key={item.id}
              >
                <article className="relative h-84 overflow-hidden md:h-104">
                  {item.cover?.url ? (
                    <AssetImage
                      alt=""
                      className="absolute inset-0 size-full scale-105 object-cover blur-[2px] md:blur-xs"
                      eager={index === 0}
                      height={coverHeight}
                      src={cover256(item.cover.url)}
                      width={coverWidth}
                    />
                  ) : null}
                  <div className="absolute inset-0 bg-linear-to-r from-background/80 via-background/20 to-transparent" />
                  <div className="absolute inset-0 bg-linear-to-t from-background/45 via-transparent to-transparent" />

                  <div className="relative grid h-full grid-cols-[8rem_minmax(0,1fr)] grid-rows-[auto_auto] gap-x-4 gap-y-3 px-5 pt-16 pb-14 sm:grid-cols-[9rem_minmax(0,1fr)] sm:grid-rows-[auto_minmax(0,1fr)_auto] sm:px-8 sm:pt-18 md:grid-cols-[minmax(0,1fr)_11rem] md:gap-x-8 lg:grid-cols-[minmax(0,1fr)_13rem] lg:px-10">
                    <div className="col-start-2 row-start-1 flex h-full min-w-0 flex-col gap-2 md:col-start-1">
                      <PrefetchLink
                        className="w-fit rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                        href={href}
                      >
                        <h2 className="line-clamp-5 font-heading text-2xl leading-tight font-semibold tracking-tight sm:line-clamp-3 sm:text-3xl lg:text-4xl">
                          {item.title}
                        </h2>
                      </PrefetchLink>

                      {item.tags.length > 0 ? (
                        <div
                          aria-label={`Thể loại của ${item.title}`}
                          className="hidden max-h-12 flex-wrap gap-1.5 overflow-y-auto sm:flex"
                        >
                          {item.tags.map((tag) => (
                            <Badge
                              className="h-3.75 w-fit rounded-sm px-1.5 py-0 text-[0.625rem] font-bold uppercase md:h-4"
                              key={tag.id}
                              variant="secondary"
                            >
                              {tag.name}
                            </Badge>
                          ))}
                        </div>
                      ) : null}

                      <p className="mt-auto w-full truncate text-sm font-medium italic md:hidden">
                        {authorNames}
                      </p>
                    </div>

                    {item.tags.length > 0 ? (
                      <div
                        aria-label={`Thể loại của ${item.title}`}
                        className="col-span-2 row-start-2 flex min-w-0 gap-1.5 overflow-hidden sm:hidden"
                      >
                        {item.tags.map((tag) => (
                          <Badge
                            className="h-3.75 w-fit shrink-0 rounded-sm px-1.5 py-0 text-[0.625rem] font-bold uppercase md:h-4"
                            key={tag.id}
                            variant="secondary"
                          >
                            {tag.name}
                          </Badge>
                        ))}
                      </div>
                    ) : null}

                    <Streamdown
                      allowedElements={basicMarkdownElements}
                      className="col-span-2 row-start-2 hidden max-h-full min-h-0 max-w-5xl self-start overflow-y-auto pr-2 text-sm leading-6 text-pretty text-foreground md:col-span-1 md:col-start-1 md:block md:text-base no-scrollbar"
                      controls={false}
                      mode="static"
                      skipHtml
                    >
                      {item.description ?? ""}
                    </Streamdown>

                    <p className="col-span-2 row-start-3 hidden w-fit text-sm font-medium italic md:col-span-1 md:col-start-1 md:block">
                      {authorNames}
                    </p>

                    <PrefetchLink
                      aria-label={`Xem chi tiết ${item.title}`}
                      className="col-start-1 row-start-1 self-start rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:outline-none md:col-start-2 md:row-span-3 md:self-center"
                      href={href}
                    >
                      <AssetImage
                        alt={`Bìa truyện ${item.title}`}
                        className="aspect-5/7 w-full rounded-xl object-cover shadow-2xl ring-1 ring-foreground/10 transition-transform motion-reduce:transition-none md:rotate-2 md:hover:rotate-0"
                        eager={index === 0}
                        height={coverHeight}
                        src={item.cover?.url ?? null}
                        srcSet={coverSrcSet(item.cover)}
                        sizes="(min-width: 1024px) 208px, (min-width: 768px) 176px, (min-width: 640px) 144px, 128px"
                        width={coverWidth}
                      />
                    </PrefetchLink>
                  </div>
                </article>
              </CarouselItem>
            )
          })}
        </CarouselContent>

        {manga.length > 1 ? (
          <>
            <CarouselPrevious
              aria-label="Truyện tiêu điểm trước"
              className="inset-y-auto bottom-3 left-4 my-0 translate-y-0"
              variant="secondary"
            />
            <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center rounded-full bg-background/70 px-1 shadow-sm backdrop-blur-sm">
              {manga.map((item, index) => (
                <button
                  aria-label={`Xem ${item.title}`}
                  aria-pressed={index === activeIndex}
                  className="flex size-6 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  key={item.id}
                  onClick={() => api?.scrollTo(index)}
                  type="button"
                >
                  <span
                    className={cn(
                      "h-1.5 rounded-full transition-[width,background-color] motion-reduce:transition-none",
                      index === activeIndex
                        ? "w-5 bg-primary"
                        : "w-1.5 bg-muted-foreground/40"
                    )}
                  />
                </button>
              ))}
            </div>
            <CarouselNext
              aria-label="Truyện tiêu điểm tiếp theo"
              className="inset-y-auto right-4 bottom-3 my-0 translate-y-0"
              variant="secondary"
            />
          </>
        ) : null}
      </Carousel>
    </Card>
  )
}
