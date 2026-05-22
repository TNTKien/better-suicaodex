"use client";

import { useMounted } from "@mantine/hooks";
import { useState } from "react";
import { Autoplay, Navigation, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

import { useGetV2MangaTop } from "@/lib/moetruyen/hooks/manga/manga";

import MoeMangaSlide from "./moe_manga-slide";
import MoeSlideControl from "./moe_slide_control";
import MoeSlideSkeleton from "./moe_slide-skeleton";

import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

export default function MoePopularManga() {
  const isMounted = useMounted();
  const [, setSlideIndex] = useState(1);

  const { data, isLoading, error } = useGetV2MangaTop(
    {
      limit: 10,
      sort_by: "views",
      time: "24h",
      include: "genres",
    },
    {
      query: {
        enabled: isMounted,
        refetchInterval: 1000 * 60 * 10,
        refetchOnWindowFocus: false,
      },
    },
  );

  if (!isMounted || isLoading) {
    return <MoeSlideSkeleton />;
  }

  if (error || data?.status !== 200 || !data.data.data.length) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="absolute z-10 mx-4 md:mx-8 lg:mx-12">
        <hr className="h-1 w-9 border-none bg-primary" />
        <h1 className="text-2xl font-black uppercase">Tiêu điểm</h1>
      </div>

      <div className="w-full -mt-16">
        <Swiper
          autoplay
          modules={[Autoplay, Navigation, Pagination]}
          onSlideChange={(swiper) => setSlideIndex(swiper.realIndex + 1)}
        >
          {data.data.data.map((manga) => (
            <SwiperSlide key={manga.id}>
              <MoeMangaSlide manga={manga} />
            </SwiperSlide>
          ))}

          <MoeSlideControl />
        </Swiper>
      </div>
    </div>
  );
}
