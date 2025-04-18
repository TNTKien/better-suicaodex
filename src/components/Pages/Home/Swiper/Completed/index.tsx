"use client";

import { Button } from "@/components/ui/button";
import { useConfig } from "@/hooks/use-config";
import { getCompletedMangas } from "@/lib/mangadex/manga";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import useSWR from "swr";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import MangaCompletedCard from "./manga-completed-card";
import { useIsMobile } from "@/hooks/use-mobile";
import { Skeleton } from "@/components/ui/skeleton";

export default function CompletedSwiper() {
  const isMobile = useIsMobile();
  const [config] = useConfig();
  const { data, error, isLoading } = useSWR(
    ["completed", config.translatedLanguage, config.r18],
    ([, language, r18]) => getCompletedMangas(language, r18),
    {
      refreshInterval: 1000 * 60 * 10,
      revalidateOnFocus: false,
    }
  );

  if (isLoading)
    return (
      <div className="flex flex-col">
        <hr className="w-9 h-1 bg-primary border-none" />
        <h1 className="text-2xl font-black uppercase">đã hoàn thành</h1>

        <Skeleton className="mt-4 w-full h-[280px] md:h-[400px] rounded-sm bg-gray-500" />
      </div>
    );

  if (error || !data) return null;

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex justify-between">
        <div>
          <hr className="w-9 h-1 bg-primary border-none" />
          <h1 className="text-2xl font-black uppercase">Đã hoàn thành</h1>
        </div>

        <Button asChild size="icon" variant="ghost" className="[&_svg]:size-6">
          <Link href={`/advanced-search?status=completed`}>
            <ArrowRight />
          </Link>
        </Button>
      </div>

      <div className="overflow-hidden">
        <Swiper
          slidesPerView={isMobile ? 3 : 5}
          autoplay={true}
          loop={true}
          modules={[Autoplay]}
          spaceBetween={12}
        >
          {data.map((manga, index) => (
            <SwiperSlide key={index}>
              <MangaCompletedCard manga={manga} />
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </div>
  );
}
