import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useSwiper } from "swiper/react";

export default function SlideControl() {
  const swiper = useSwiper();

  return (
    <>
      <p
        className={cn(
          "hidden md:flex text-sm font-black uppercase",
          swiper.realIndex === 0 && "text-primary"
        )}
      >
        No. {swiper.realIndex + 1}
      </p>
      <Button
        size="icon"
        className={cn(
          "h-8 w-8 bg-transparent hover:bg-transparent hover:text-primary rounded-full [&_svg]:size-6 shadow-none text-inherit",
          "md:h-10 md:w-10"
        )}
        onClick={() => swiper.slidePrev()}
      >
        <ChevronLeft />
      </Button>

      <p className="md:hidden text-sm uppercase">{swiper.realIndex + 1} / 10</p>

      <Button
        size="icon"
        className={cn(
          "h-8 w-8 bg-transparent hover:bg-transparent hover:text-primary rounded-full [&_svg]:size-6 shadow-none text-inherit",
          "md:h-10 md:w-10"
        )}
        onClick={() => swiper.slideNext()}
      >
        <ChevronRight />
      </Button>
    </>
  );
}
