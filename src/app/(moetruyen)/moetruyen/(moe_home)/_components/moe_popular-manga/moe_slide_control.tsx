"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useSwiper } from "swiper/react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function MoeSlideControl() {
  const swiper = useSwiper();

  return (
    <div className="relative flex w-full items-center justify-end gap-2 px-4 md:-mt-8.5 md:z-10 md:px-8 lg:px-12">
      <span
        className={cn(
          "hidden text-sm font-black uppercase md:inline-flex",
          swiper.realIndex === 0 && "text-primary",
        )}
      >
        No. {swiper.realIndex + 1}
      </span>

      <div className="flex w-full items-center justify-between gap-1 md:w-auto md:justify-end">
        <Button
          variant="ghost"
          size="icon-sm"
          className="rounded-full"
          onClick={() => swiper.slidePrev()}
        >
          <ChevronLeft />
        </Button>

        <span className="text-sm md:hidden">
          {swiper.realIndex + 1} / {swiper.slides.length}
        </span>

        <Button
          variant="ghost"
          size="icon-sm"
          className="rounded-full"
          onClick={() => swiper.slideNext()}
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
