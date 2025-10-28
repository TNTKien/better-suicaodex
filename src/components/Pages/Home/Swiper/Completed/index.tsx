"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Autoplay } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { useConfig } from "@/hooks/use-config";
import { getCompletedMangas } from "@/lib/mangadex/manga";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import Image from "next/image";
import DoroLoading from "#/images/doro-loading.gif";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useIsMobile } from "@/hooks/use-mobile";
import MangaCompletedCard from "./manga-completed-card";

export default function CompletedSwiper() {
	const isMobile = useIsMobile();
	const [config] = useConfig();
	const { data, error, isLoading } = useSWR(
		["completed", config.translatedLanguage, config.r18],
		([, language, r18]) => getCompletedMangas(language, r18),
		{
			refreshInterval: 1000 * 60 * 10,
			revalidateOnFocus: false,
		},
	);

	if (isLoading)
		return (
			<div className="flex flex-col">
				<hr className="w-9 h-1 bg-primary border-none" />
				<h1 className="text-2xl font-black uppercase">đã hoàn thành</h1>

				<Alert className="rounded-sm border-none">
					<AlertDescription className="flex justify-center">
						<Image
							src={DoroLoading}
							alt="Loading..."
							unoptimized
							priority
							className="w-20 h-auto"
						/>
					</AlertDescription>
				</Alert>
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
