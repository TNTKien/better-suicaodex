"use client";

import useSWR from "swr";
import CommentFeedItem from "./comment-feed-item";
import { useIsMobile } from "@/hooks/use-mobile";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import { Alert, AlertDescription } from "@/components/ui/alert";

import Image from "next/image";
import DoroLoading from "#/images/doro-loading.gif";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function CommentFeed() {
  const isMobile = useIsMobile();
  const {
    data: comments,
    isLoading,
    error,
  } = useSWR("/api/comments/latest", fetcher);

  if (isLoading)
    return (
      <>
        <div>
          <hr className="w-9 h-1 bg-primary border-none" />
          <h1 className="text-2xl font-black uppercase">Bình luận gần đây</h1>
        </div>
        <Alert className="rounded-sm border-none mt-4">
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
      </>
    );
  if (error || !comments) return null;

  return (
    <div className="grid grid-cols-1 gap-4">
      <div>
        <hr className="w-9 h-1 bg-primary border-none" />
        <h1 className="text-2xl font-black uppercase">Bình luận gần đây</h1>
      </div>

      {/* <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
        {displayedComments.map((comment: any) => (
          <CommentFeedItem
            key={comment.id}
            comment={comment}
            type={comment.type}
          />
        ))}
      </div> */}
      <div className="overflow-hidden">
        <Swiper
          slidesPerView={isMobile ? 1 : 3}
          autoplay={true}
          loop={true}
          modules={[Autoplay]}
          spaceBetween={8}
        >
          {comments.map((comment: any, index: any) => (
            <SwiperSlide key={index} className="pb-1 px-0.5">
              <CommentFeedItem
                key={comment.id}
                comment={comment}
                type={comment.type}
              />
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </div>
  );
}
