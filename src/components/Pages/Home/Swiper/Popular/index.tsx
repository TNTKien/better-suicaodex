"use client";

import { Autoplay, Navigation, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import useSWR from "swr";
import { useConfig } from "@/hooks/use-config";
import { getPopularMangas } from "@/lib/mangadex/manga";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import { useState } from "react";
import { cn } from "@/lib/utils";
import MangaSlide from "./manga-slide";
import SlideControl from "./slide-control";
import SlideSkeleton from "./slide-skeleton";

export default function PopularSwiper() {
	const [config] = useConfig();
	const { data, isLoading, error } = useSWR(
		[config.translatedLanguage, config.r18],
		([language, r18]) => getPopularMangas(language, r18),
		{
			refreshInterval: 1000 * 60 * 10,
			revalidateOnFocus: false,
		},
	);
	const [slideIndex, setSlideIndex] = useState(1);

	if (isLoading) return <SlideSkeleton />;
	if (error || !data) return null;

	return (
		<>
			<div className="absolute z-10">
				<hr className="w-9 h-1 bg-primary border-none" />
				<h1 className="text-2xl font-black uppercase">Tiêu điểm</h1>
			</div>

			<div className="absolute !p-0 !m-0 top-0 left-0 w-full">
				<div>
					<Swiper
						className="h-[335px] md:h-[410px] lg:h-[430px]"
						onSlideChange={(swiper) => setSlideIndex(swiper.realIndex + 1)}
						autoplay={true}
						loop={true}
						modules={[Autoplay, Navigation, Pagination]}
					>
						{data.map((manga, index) => (
							<SwiperSlide key={index}>
								<MangaSlide manga={manga} />
							</SwiperSlide>
						))}
						<div
							className={cn(
								"absolute flex gap-2 w-full bottom-0 md:-bottom-[1.5px] lg:-bottom-1 left-0 z-[3] justify-between md:justify-end items-center",
								"px-4 md:pr-[calc(32px+var(--sidebar-width-icon))] lg:pr-[calc(48px+var(--sidebar-width-icon))]",
							)}
						>
							<SlideControl />
						</div>
					</Swiper>
				</div>
			</div>
		</>
	);
}
