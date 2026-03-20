"use client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useSwiper } from "swiper/react";

export default function SlideControl() {
  const swiper = useSwiper();

  return (
    <div className="relative md:-mt-8.5 md:z-10 w-full px-4 mr:px-8 lg:px-12 flex items-center gap-2 justify-end">
      <span
        className={cn(
          "text-sm font-black uppercase hidden md:inline-flex",
          swiper.realIndex === 0 && "text-primary",
        )}
      >
        No. {swiper.realIndex + 1}
      </span>
      <div className="w-full justify-between md:w-auto md:justify-end flex items-center gap-1">
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
