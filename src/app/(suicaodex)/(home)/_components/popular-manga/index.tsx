"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getMangaTop,
  getMangaTopResponseSuccess,
} from "@/lib/weebdex/hooks/manga/manga";
import { Autoplay, Navigation, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import SlideSkeleton from "./slide-skeleton";
import { useConfig } from "@/hooks/use-config";
import { GetMangaTopContentRatingItem } from "@/lib/weebdex/model";
import { useState } from "react";
import { useMounted } from "@mantine/hooks";
import SlideControl from "./slide-control";
import MangaSlide from "./manga-slide";

export default function PopularMangaSwiper() {
  const isMounted = useMounted();
  const [config] = useConfig();
  const contentRating = config.r18
    ? Object.values(GetMangaTopContentRatingItem)
    : undefined;

  const { data, isLoading, error } = useQuery({
    enabled: isMounted,
    queryKey: ["weebdex", "manga", "top", config.r18],
    queryFn: async () => {
      const res = await getMangaTop({
        limit: 10,
        rank: "read",
        time: "24h",
        contentRating,
      });
      if (res.status !== 200) throw new Error("Failed to fetch top manga");
      return (res as getMangaTopResponseSuccess).data.data ?? [];
    },
    refetchInterval: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });

  const [, setSlideIndex] = useState(1);

  if (!isMounted || isLoading) return <SlideSkeleton />;
  if (error || !data) return null;

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="absolute z-10 mx-4 md:mx-8 lg:mx-12">
        <hr className="w-9 h-1 bg-primary border-none" />
        <h1 className="text-2xl font-black uppercase">Tiêu điểm</h1>
      </div>

      <div className="w-full -mt-16">
        <Swiper
          autoplay={false}
          loop
          modules={[Autoplay, Navigation, Pagination]}
          onSlideChange={(swiper) => setSlideIndex(swiper.realIndex + 1)}
        >
          {data.map((manga, index) => (
            <SwiperSlide key={manga.id ?? index}>
              <MangaSlide manga={manga} />
            </SwiperSlide>
          ))}

          <SlideControl />
        </Swiper>
      </div>
    </div>
  );
}
